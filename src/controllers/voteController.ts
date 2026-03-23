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
  return hash(JSON.stringify(vote.voteData) + vote.voterId + vote.electionId);
};

export const castVote = async (req: Request, res: Response) => {
  try {
    const { orgType } = req.params;
    const { electionId, votes, timestamp } = req.body;
    const voterId = req.user.voterId;

    if (!mongoose.Types.ObjectId.isValid(electionId as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    const election = await Election.findById(electionId);

    if (!election || election.status !== 'active') {
      return res.status(400).json({ success: false, error: { message: 'Invalid or inactive election' } });
    }

    const targetElectionId = election._id;

    const voter = await Voter.findById(voterId);
    if (!voter || voter.hasVoted) {
      return res.status(400).json({ success: false, error: { message: 'Voter already voted or invalid' } });
    }

    const existingVote = await Vote.findOne({ electionId: targetElectionId, voterId });
    if (existingVote) {
       return res.status(400).json({ success: false, error: { message: 'Already voted in this election' } });
    }

    const newVote = await Vote.create({
      electionId: targetElectionId,
      voterId,
      voteData: votes,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      voteTimestamp: timestamp || new Date()
    });

    voter.hasVoted = true;
    voter.votedAt = new Date();
    await voter.save();

    // Write audit log
    await writeAuditLog({
      organizationId: election.organizationId,
      action: 'vote_cast',
      resourceType: 'election',
      resourceId: targetElectionId,
      voterId: voterId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { positions: Object.keys(votes || {}) }
    });

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
          verificationHash: createVerificationHash(newVote)
        }
      }
    });

    // We can emit to socket.io here via an event emitter or importing io instance.
    req.app.get('io')?.of('/election-monitoring')?.to(`election_${electionId}`).emit('vote_cast', {
      electionId,
      timestamp: new Date()
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
