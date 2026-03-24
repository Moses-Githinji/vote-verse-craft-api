import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Election } from '../models/Election';
import { Candidate } from '../models/Candidate';
import { Organization } from '../models/Organization';
import { electionSchema } from '../validators';

export const getElections = async (req: Request, res: Response) => {
  try {
    const userOrgId = (req as any).userOrgId;
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const elections = await Election.find({ organizationId: userOrgId });
    res.json({ success: true, data: { elections } });
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

    // Use user's organization ID from token instead of looking up by orgType
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
