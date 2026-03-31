import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Election } from '../models/Election';
import { Candidate } from '../models/Candidate';
import { Organization } from '../models/Organization';
import { Voter } from '../models/Voter';
import { Vote } from '../models/Vote';
import { electionSchema } from '../validators';

export const getElections = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userOrgId = (req as any).userOrgId;
    
    // If no user, deny access (require authentication)
    if (!user || !userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const { status, page = 1, limit = 5 } = req.query;
    const query: any = { organizationId: userOrgId };
    
    if (status) {
      query.status = status;
    }

    const pg = parseInt(page as string) || 1;
    const lim = parseInt(limit as string) || 5;
    const skip = (pg - 1) * lim;

    const [elections, total] = await Promise.all([
      Election.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim),
      Election.countDocuments(query)
    ]);

    res.json({ 
      success: true, 
      data: { 
        elections,
        pagination: {
          total,
          page: pg,
          limit: lim,
          pages: Math.ceil(total / lim)
        }
      } 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getElectionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userOrgId = (req as any).userOrgId;
    
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    // Require organization access
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const election = await Election.findOne({ _id: id, organizationId: userOrgId });

    if (!election) return res.status(404).json({ success: false, error: { message: 'Election not found' } });

    const candidates = await Candidate.find({ electionId: election._id });
    
    res.json({ success: true, data: { election, candidates } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getActiveElection = async (req: Request, res: Response) => {
  try {
    const userOrgId = (req as any).userOrgId;
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const election = await Election.findOne({ 
      organizationId: userOrgId, 
      status: 'active' 
    }).sort({ startDate: -1 });

    if (!election) {
      return res.status(404).json({ success: false, error: { message: 'No active election found' } });
    }

    const candidates = await Candidate.find({ electionId: election._id });
    
    res.json({ success: true, data: { election, candidates } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createElection = async (req: Request, res: Response) => {
  try {
    // Use user's organization ID from token instead of URL parameter
    const userOrgId = (req as any).userOrgId;
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const validatedData = electionSchema.parse(req.body);

    // Auto-generate ballot question IDs if not provided
    let ballotQuestions = validatedData.ballotQuestions;
    if (ballotQuestions && ballotQuestions.length > 0) {
      ballotQuestions = ballotQuestions.map((q, index) => ({
        ...q,
        id: q.id || `question_${Date.now()}_${index + 1}`
      }));
    }

    const election = await Election.create({
      ...validatedData,
      ballotQuestions,
      organizationId: userOrgId,
      createdBy: req.user.id
    });

    if (validatedData.candidates && validatedData.candidates.length > 0) {
      const candidatesToInsert = validatedData.candidates.map(c => ({
        ...c,
        electionId: election._id
      }));
      await Candidate.insertMany(candidatesToInsert);
    }

    res.status(201).json({ success: true, data: { election } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
};

export const updateElection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = electionSchema.partial().parse(req.body);
    const userOrgId = (req as any).userOrgId;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    // First check the election belongs to user's organization
    const existingElection = await Election.findOne({ _id: id, organizationId: userOrgId });
    if (!existingElection) {
      return res.status(404).json({ success: false, error: { message: 'Election not found' } });
    }

    // Auto-generate ballot question IDs if not provided
    let ballotQuestions = validatedData.ballotQuestions;
    if (ballotQuestions && ballotQuestions.length > 0) {
      ballotQuestions = ballotQuestions.map((q, index) => ({
        ...q,
        id: q.id || `question_${Date.now()}_${index + 1}`
      }));
    }

    const election = await Election.findByIdAndUpdate(
      id as string,
      { $set: { ...validatedData, ballotQuestions } },
      { new: true, runValidators: true }
    );

    if (!election) return res.status(404).json({ success: false, error: { message: 'Election not found' } });

    res.json({ success: true, data: { election } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
};

export const updateElectionStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    const election = await Election.findByIdAndUpdate(
      id as string, 
      { status },
      { new: true }
    );

    if (!election) return res.status(404).json({ success: false, error: { message: 'Election not found' } });

    res.json({ success: true, data: { election, reason } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
};

export const resetVoters = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userOrgId = (req as any).userOrgId;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    // Ensure the election belongs to the caller's organization
    const election = await Election.findOne({ _id: id, organizationId: userOrgId });
    if (!election) {
      return res.status(404).json({ success: false, error: { message: 'Election not found' } });
    }

    // Only allow reset when the election has already ended
    const now = new Date();
    if (election.endDate > now) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot reset voters: election has not ended yet' },
      });
    }

    // Bulk-reset all voters in this organization
    const result = await Voter.updateMany(
      { organizationId: userOrgId },
      { $set: { hasVoted: false }, $unset: { votedAt: '', voteSessionId: '' } }
    );

    res.json({
      success: true,
      data: {
        message: 'Voter statuses have been reset successfully',
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const deleteElection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userOrgId = (req as any).userOrgId;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    // Ensure the election belongs to the organization
    const election = await Election.findOne({ _id: id, organizationId: userOrgId });
    if (!election) {
      return res.status(404).json({ success: false, error: { message: 'Election not found' } });
    }

    // Delete related data first
    await Candidate.deleteMany({ electionId: id });
    await Vote.deleteMany({ electionId: id });
    
    // Finally delete the election
    await Election.findByIdAndDelete(id);

    res.json({
      success: true,
      data: {
        message: 'Election and all related data (candidates, votes) deleted successfully',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getElectionsCategorized = async (req: Request, res: Response) => {
  try {
    const userOrgId = (req as any).userOrgId;

    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const allElections = await Election.find({ organizationId: userOrgId }).sort({ createdAt: -1 });

    const categorized = {
      active: allElections.filter(e => e.status === 'active' || e.status === 'scheduled'),
      past: allElections.filter(e => e.status === 'completed' || e.status === 'cancelled'),
      inConfig: allElections.filter(e => e.status === 'draft')
    };

    res.json({
      success: true,
      data: categorized
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
