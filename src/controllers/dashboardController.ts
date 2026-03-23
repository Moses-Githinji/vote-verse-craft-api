import { Request, Response } from 'express';
import { Organization } from '../models/Organization';
import { Election } from '../models/Election';
import { Voter } from '../models/Voter';
import { Vote } from '../models/Vote';
import { Candidate } from '../models/Candidate';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { orgType } = req.params;
    const organization = await Organization.findOne({ orgType });
    if (!organization) return res.status(404).json({ success: false, error: { message: 'Org not found' } });

    const totalElections = await Election.countDocuments({ organizationId: organization._id });
    const activeElections = await Election.countDocuments({ organizationId: organization._id, status: 'active' });
    const totalVoters = await Voter.countDocuments({ organizationId: organization._id });
    const votersVoted = await Voter.countDocuments({ organizationId: organization._id, hasVoted: true });
    
    // Total votes cast across all elections in this org
    // Actually, Vote doesn't store organizationId directly but electionId.
    // Let's get all election IDs for this org.
    const elections = await Election.find({ organizationId: organization._id }, '_id');
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
