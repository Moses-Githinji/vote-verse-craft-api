import { Request, Response } from 'express';
import { Vote } from '../models/Vote';
import { Voter } from '../models/Voter';
import { Election } from '../models/Election';
import { Organization } from '../models/Organization';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { writeAuditLog } from '../utils/audit';

const generateSecureId = () => crypto.randomBytes(16).toString('hex');
const hash = (data: string) => crypto.createHash('sha256').update(data).digest('hex');

const createVerificationHash = (vote: any) => {
  // Canonicalize voteData for stable hashing: sort keys and stringify
  const dataObj =
    vote.voteData instanceof Map ? Object.fromEntries(vote.voteData) : vote.voteData || {};

  const canonicalize = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(canonicalize);
    if (typeof obj === 'object') {
      const sortedKeys = Object.keys(obj).sort();
      const res: any = {};
      for (const k of sortedKeys) {
        res[k] = canonicalize(obj[k]);
      }
      return res;
    }
    return obj;
  };

  const canonical = canonicalize(dataObj);
  return hash(JSON.stringify(canonical) + vote.voterId + vote.electionId);
};

const isValidDateString = (s: string) => {
  const d = new Date(s);
  return !isNaN(d.getTime());
};

const testLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'test') console.log('[TEST-LOG]', ...args);
};

// Replace direct handler with an injectable factory so tests can pass mocked models
export const makeCastVote = (deps?: {
  ElectionModel?: any;
  VoterModel?: any;
  VoteModel?: any;
  auditFn?: any;
}) => {
  const ElectionModel = deps?.ElectionModel ?? Election;
  const VoterModel = deps?.VoterModel ?? Voter;
  const VoteModel = deps?.VoteModel ?? Vote;
  const auditFn = deps?.auditFn ?? writeAuditLog;

  return async (req: Request, res: Response) => {
    try {
      // Note: orgType not used - voters are authenticated via token and already have org info
      const { electionId, votes, timestamp } = req.body;
      const voterId = req.user.voterId;

      if (!mongoose.Types.ObjectId.isValid(electionId as string)) {
        return res
          .status(400)
          .json({ success: false, error: { message: 'Invalid election ID format' } });
      }

      testLog('before Election.findById');
      const election = await ElectionModel.findById(electionId);
      testLog('after Election.findById', !!election);

      if (!election || election.status !== 'active') {
        return res
          .status(400)
          .json({ success: false, error: { message: 'Invalid or inactive election' } });
      }

      const targetElectionId = election._id;

      testLog('before Voter.findById');
      const voter = await VoterModel.findById(voterId);
      testLog('after Voter.findById', !!voter);

      if (!voter || voter.hasVoted) {
        return res
          .status(400)
          .json({ success: false, error: { message: 'Voter already voted or invalid' } });
      }

      testLog('before Vote.findOne');
      const existingVote = await VoteModel.findOne({ electionId: targetElectionId, voterId });
      testLog('after Vote.findOne', !!existingVote);

      if (existingVote) {
        return res
          .status(400)
          .json({ success: false, error: { message: 'Already voted in this election' } });
      }

      // ─── Validate votes against ballot questions ─────────────────
      if (election.ballotQuestions && election.ballotQuestions.length > 0) {
        interface BallotQuestion {
          id: string;
          type?: string;
          options?: string[];
          allowNota?: boolean;
          allowWriteIn?: boolean;
          required?: boolean;
          linearMin?: number;
          linearMax?: number;
          ratingMax?: number;
          maxSelections?: number;
          gridRows?: string[];
          gridColumns?: string[];
          // allow other question-specific props
          [key: string]: any;
        }

        const questionMap: Map<string, BallotQuestion> = new Map(
          (election.ballotQuestions as BallotQuestion[]).map((q: BallotQuestion) => [q.id, q]),
        );

        for (const q of election.ballotQuestions) {
          const questionId = q.id;
          const provided = (votes || {})[questionId];

          // Required check
          if (q.required) {
            const empty =
              provided === null ||
              provided === undefined ||
              (typeof provided === 'string' && provided.trim() === '') ||
              (Array.isArray(provided) && provided.length === 0) ||
              (typeof provided === 'object' && Object.keys(provided).length === 0);
            if (empty) {
              return res
                .status(400)
                .json({ success: false, error: { message: `Question ${questionId} is required` } });
            }
          }

          // Skip layout-only types
          if (['section', 'image_block', 'video_block'].includes(q.type)) {
            continue;
          }

          const validOptions = [...(q.options || [])];
          if (q.allowNota) validOptions.push('NOTA');

          switch (q.type) {
            case 'single':
            case 'yesno':
            case 'dropdown':
              if (typeof provided !== 'string') {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a single string answer` },
                });
              }
              if (!q.allowWriteIn && !validOptions.includes(provided)) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Invalid option for ${questionId}: ${provided}` },
                });
              }
              break;

            case 'linear':
              if (provided === undefined || provided === null) break; // required handled earlier
              const numL = Number(provided);
              if (isNaN(numL)) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a numeric value` },
                });
              }
              if (q.linearMin !== undefined && numL < q.linearMin) {
                return res.status(400).json({
                  success: false,
                  error: {
                    message: `Question ${questionId}: value below minimum (${q.linearMin})`,
                  },
                });
              }
              if (q.linearMax !== undefined && numL > q.linearMax) {
                return res.status(400).json({
                  success: false,
                  error: {
                    message: `Question ${questionId}: value above maximum (${q.linearMax})`,
                  },
                });
              }
              break;

            case 'rating':
              if (provided === undefined || provided === null) break;
              const numR = Number(provided);
              if (isNaN(numR)) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a numeric rating` },
                });
              }
              if (q.ratingMax !== undefined && numR > q.ratingMax) {
                return res.status(400).json({
                  success: false,
                  error: {
                    message: `Question ${questionId}: rating exceeds maximum (${q.ratingMax})`,
                  },
                });
              }
              break;

            case 'multi':
              if (!Array.isArray(provided)) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires an array of selections` },
                });
              }
              if (q.maxSelections && provided.length > q.maxSelections) {
                return res.status(400).json({
                  success: false,
                  error: {
                    message: `Question ${questionId}: max ${q.maxSelections} selections allowed`,
                  },
                });
              }
              for (const selection of provided) {
                if (!q.allowWriteIn && !validOptions.includes(selection) && selection !== 'NOTA') {
                  return res.status(400).json({
                    success: false,
                    error: { message: `Invalid option for ${questionId}: ${selection}` },
                  });
                }
              }
              break;

            case 'ranked':
              if (!Array.isArray(provided)) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a ranked array` },
                });
              }
              // no duplicates
              const set = new Set(provided);
              if (set.size !== provided.length) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} ranked choices contain duplicates` },
                });
              }
              for (const ranked of provided) {
                if (!q.allowWriteIn && !validOptions.includes(ranked) && ranked !== 'NOTA') {
                  return res.status(400).json({
                    success: false,
                    error: { message: `Invalid ranked option for ${questionId}: ${ranked}` },
                  });
                }
              }
              break;

            case 'grid_multiple':
              if (typeof provided !== 'object' || Array.isArray(provided)) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a row-to-option mapping` },
                });
              }
              // Validate rows exist
              const rows = q.gridRows || [];
              const cols = q.gridColumns || q.options || [];
              for (const [row, col] of Object.entries(provided)) {
                if (rows.length && !rows.includes(row)) {
                  return res.status(400).json({
                    success: false,
                    error: { message: `Unknown row in ${questionId}: ${row}` },
                  });
                }
                if (
                  typeof col !== 'string' ||
                  (!q.allowWriteIn && !cols.includes(col) && col !== 'NOTA')
                ) {
                  return res.status(400).json({
                    success: false,
                    error: { message: `Invalid option in row ${row} for ${questionId}: ${col}` },
                  });
                }
              }
              break;

            case 'grid_checkbox':
              if (typeof provided !== 'object' || Array.isArray(provided)) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a row-to-options mapping` },
                });
              }
              const rowsC = q.gridRows || [];
              const colsC = q.gridColumns || q.options || [];
              for (const [row, colsSelected] of Object.entries(provided)) {
                if (rowsC.length && !rowsC.includes(row)) {
                  return res.status(400).json({
                    success: false,
                    error: { message: `Unknown row in ${questionId}: ${row}` },
                  });
                }
                if (!Array.isArray(colsSelected)) {
                  return res.status(400).json({
                    success: false,
                    error: {
                      message: `Row ${row} in ${questionId} requires an array of selections`,
                    },
                  });
                }
                for (const col of colsSelected) {
                  if (!q.allowWriteIn && !colsC.includes(col) && col !== 'NOTA') {
                    return res.status(400).json({
                      success: false,
                      error: { message: `Invalid option in row ${row} for ${questionId}: ${col}` },
                    });
                  }
                }
              }
              break;

            case 'short':
            case 'paragraph':
              if (typeof provided !== 'string') {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a string response` },
                });
              }
              break;

            case 'date':
            case 'time':
              if (typeof provided !== 'string' || !isValidDateString(provided)) {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a valid date/time string` },
                });
              }
              break;

            case 'file':
              if (typeof provided !== 'string') {
                return res.status(400).json({
                  success: false,
                  error: { message: `Question ${questionId} requires a file URL string` },
                });
              }
              // Optionally validate that URL is from Cloudinary or allowed storage
              break;

            default:
              // Unknown question type - safety
              break;
          }
        }

        // Validate unknown keys in votes payload
        for (const key of Object.keys(votes || {})) {
          if (!questionMap.has(key)) {
            return res
              .status(400)
              .json({ success: false, error: { message: `Unknown question: ${key}` } });
          }
        }
      }

      testLog('before Vote.create');
      const newVote = await VoteModel.create({
        electionId: targetElectionId,
        voterId,
        voteData: votes,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        voteTimestamp: timestamp || new Date(),
      });
      testLog('after Vote.create', !!newVote);

      voter.hasVoted = true;
      voter.votedAt = new Date();
      testLog('before voter.save');
      await voter.save();
      testLog('after voter.save');

      // Write audit log
      testLog('before writeAuditLog');
      await auditFn({
        organizationId: election.organizationId,
        action: 'vote_cast',
        resourceType: 'election',
        resourceId: targetElectionId,
        voterId: voterId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { positions: Object.keys(votes || {}) },
      });
      testLog('after writeAuditLog');

      const receiptId = generateSecureId();

      res.json({
        success: true,
        data: {
          voteId: newVote._id,
          message: 'Vote cast successfully',
          receipt: {
            election: election.title,
            timestamp: newVote.voteTimestamp,
            transactionId: receiptId,
            verificationHash: createVerificationHash(newVote),
          },
        },
      });

      // We can emit to socket.io here via an event emitter or importing io instance.
      req.app
        .get('io')
        ?.of('/election-monitoring')
        ?.to(`election_${electionId}`)
        .emit('vote_cast', {
          electionId,
          timestamp: new Date(),
        });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  };
};

// Default handler exported for runtime (uses actual models)
export const castVote = makeCastVote();
