import { Request, Response } from 'express';
import { Vote } from '../models/Vote';
import { Election, IBallotQuestion } from '../models/Election';
import { Voter } from '../models/Voter';
import { Organization } from '../models/Organization';
import mongoose from 'mongoose';

/**
 * Tallies results question-by-question from raw vote documents.
 * Handles single, multi, ranked, and yesno question types.
 */
const tallyResults = (votes: any[], ballotQuestions: IBallotQuestion[]) => {
  const tallies: Record<string, Record<string, number>> = {};

  // Initialize tallies for each question
  for (const q of ballotQuestions) {
    tallies[q.id] = {};
    for (const opt of q.options) {
      tallies[q.id][opt] = 0;
    }
    if (q.allowNota) tallies[q.id]['NOTA'] = 0;
  }

  // Count votes
  for (const vote of votes) {
    const voteData = vote.voteData instanceof Map
      ? Object.fromEntries(vote.voteData)
      : vote.voteData;

    for (const q of ballotQuestions) {
      const answer = voteData[q.id];
      if (!answer) continue;

      switch (q.type) {
        case 'single':
        case 'yesno':
          if (typeof answer === 'string') {
            tallies[q.id][answer] = (tallies[q.id][answer] || 0) + 1;
          }
          break;

        case 'multi':
          if (Array.isArray(answer)) {
            for (const sel of answer) {
              tallies[q.id][sel] = (tallies[q.id][sel] || 0) + 1;
            }
          }
          break;

        case 'ranked':
          // For ranked-choice, count first-preference votes (simplified IRV)
          if (Array.isArray(answer) && answer.length > 0) {
            tallies[q.id][answer[0]] = (tallies[q.id][answer[0]] || 0) + 1;
          }
          break;
      }
    }
  }

  return tallies;
};

export const getResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    const election = await Election.findById(id as string);

    if (!election) return res.status(404).json({ success: false, error: { message: 'Election not found' } });

    const totalVoters = await Voter.countDocuments({ organizationId: election.organizationId });
    const votesCast = await Vote.countDocuments({ electionId: election._id });

    // Fetch all votes for this election
    const allVotes = await Vote.find({ electionId: election._id }).lean();

    // Build results based on ballot questions
    let results: any[] = [];

    if (election.ballotQuestions && election.ballotQuestions.length > 0) {
      const tallies = tallyResults(allVotes, election.ballotQuestions);

      results = election.ballotQuestions.map(q => ({
        questionId: q.id,
        type: q.type,
        title: q.title,
        options: Object.entries(tallies[q.id] || {}).map(([option, count]) => ({
          option,
          votes: count,
          percentage: votesCast > 0 ? Math.round((count / votesCast) * 10000) / 100 : 0
        })).sort((a, b) => b.votes - a.votes)
      }));
    }

    res.json({
      success: true,
      data: {
        election: {
          id: election._id,
          title: election.title,
          status: election.status,
          totalVoters,
          votesCast,
          turnoutPercentage: totalVoters > 0 ? Math.round((votesCast / totalVoters) * 10000) / 100 : 0
        },
        results,
        ballotQuestions: election.ballotQuestions,
        realTime: false
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
