import { Request, Response } from 'express';
import { Organization } from '../models/Organization';
import { Election } from '../models/Election';
import { Voter } from '../models/Voter';
import { Vote } from '../models/Vote';
import { Candidate } from '../models/Candidate';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Use user's organization ID from token instead of URL parameter
    const userOrgId = (req as any).userOrgId;
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const totalElections = await Election.countDocuments({ organizationId: userOrgId });
    const activeElections = await Election.countDocuments({ organizationId: userOrgId, status: 'active' });
    const totalVoters = await Voter.countDocuments({ organizationId: userOrgId });
    const votersVoted = await Voter.countDocuments({ organizationId: userOrgId, hasVoted: true });
    
    // Total votes cast across all elections in this org
    // Actually, Vote doesn't store organizationId directly but electionId.
    // Let's get all election IDs for this org.
    const elections = await Election.find({ organizationId: userOrgId }, '_id');
    const electionIds = elections.map(e => e._id);
    const totalVotes = await Vote.countDocuments({ electionId: { $in: electionIds } });
    const totalCandidates = await Candidate.countDocuments({ electionId: { $in: electionIds } });

    const turnoutPercentage = totalVoters > 0 ? (votersVoted / totalVoters) * 100 : 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalElections,
          activeElections,
          totalVoters,
          votersVoted,
          totalVotes,
          totalCandidates,
          turnoutPercentage: parseFloat(turnoutPercentage.toFixed(2))
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
