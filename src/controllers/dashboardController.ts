import { Request, Response } from 'express';
import { Organization } from '../models/Organization';
import { Election } from '../models/Election';
import { Voter } from '../models/Voter';
import { Vote } from '../models/Vote';
import { Candidate } from '../models/Candidate';
import { AuditLog } from '../models/AuditLog';

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

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const userOrgId = (req as any).userOrgId;
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    // 1. Basic Stats
    const totalElections = await Election.countDocuments({ organizationId: userOrgId });
    const activeElections = await Election.countDocuments({ organizationId: userOrgId, status: 'active' });
    const totalVoters = await Voter.countDocuments({ organizationId: userOrgId });
    const votersVoted = await Voter.countDocuments({ organizationId: userOrgId, hasVoted: true });
    
    // 2. Integrity Check
    const elections = await Election.find({ organizationId: userOrgId }).select('title status');
    const totalVotersCount = await Voter.countDocuments({ organizationId: userOrgId });
    
    const electionIntegrity = await Promise.all(elections.map(async (e) => {
      const votes = await Vote.find({ electionId: e._id }).select('voterId');
      const votesCount = votes.length;
      
      // Perform deep validation: Check if each vote's voter exists
      const voterIds = votes.map(v => v.voterId);
      const existingVoters = await Voter.find({ _id: { $in: voterIds } }).select('_id');
      const existingVoterIds = new Set(existingVoters.map(v => v._id.toString()));
      
      const orphanedVotes = votes.filter(v => !existingVoterIds.has(v.voterId.toString()));
      const isValid = orphanedVotes.length === 0 && votesCount <= totalVotersCount;
      
      return {
        electionId: e._id,
        title: e.title,
        status: e.status,
        votesCast: votesCount,
        totalVoters: totalVotersCount,
        isValid,
        discrepancy: Math.max(votesCount > totalVotersCount ? votesCount - totalVotersCount : 0, orphanedVotes.length)
      };
    }));

    // 3. Recent Results (Latest active election or most recent)
    const latestElection = await Election.findOne({ organizationId: userOrgId })
      .sort({ createdAt: -1 });

    let latestResults = null;
    if (latestElection) {
      const votesCountForLatest = await Vote.countDocuments({ electionId: latestElection._id });
      latestResults = {
        id: latestElection._id,
        title: latestElection.title,
        status: latestElection.status,
        votesCast: votesCountForLatest,
        turnoutPercentage: totalVoters > 0 ? Math.round((votesCountForLatest / totalVoters) * 10000) / 100 : 0
      };
    }

    res.json({
      success: true,
      data: {
        stats: {
          totalElections,
          activeElections,
          totalVoters,
          votersVoted,
          turnoutPercentage: totalVoters > 0 ? parseFloat(((votersVoted / totalVoters) * 100).toFixed(2)) : 0
        },
        integrity: {
          summary: {
            allValid: electionIntegrity.every(ei => ei.isValid),
            totalVoters: totalVotersCount,
            electionCount: elections.length,
            votersWhoVoted: votersVoted
          },
          diagnostics: electionIntegrity,
          timestamp: new Date()
        },
        latestElection: latestResults,
        timestamp: new Date()
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
