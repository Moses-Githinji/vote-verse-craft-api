import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Election } from '../models/Election';
import { Candidate } from '../models/Candidate';
import { Organization } from '../models/Organization';
import { electionSchema } from '../validators';

export const getElections = async (req: Request, res: Response) => {
  try {
    const { orgType } = req.params;
    const organization = await Organization.findOne({ orgType });
    if (!organization) return res.status(404).json({ success: false, error: { message: 'Org not found' } });

    const elections = await Election.find({ organizationId: organization._id });
    res.json({ success: true, data: { elections } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getElectionById = async (req: Request, res: Response) => {
  try {
    const { id, orgType } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    const organization = await Organization.findOne({ orgType });
    if (!organization) return res.status(404).json({ success: false, error: { message: 'Org not found' } });

    const election = await Election.findOne({ _id: id, organizationId: organization._id });

    if (!election) return res.status(404).json({ success: false, error: { message: 'Election not found' } });

    const candidates = await Candidate.find({ electionId: election._id });
    
    res.json({ success: true, data: { election, candidates } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createElection = async (req: Request, res: Response) => {
  try {
    const { orgType } = req.params;
    const organization = await Organization.findOne({ orgType });
    if (!organization) return res.status(404).json({ success: false, error: { message: 'Org not found' } });

    const validatedData = electionSchema.parse(req.body);

    const election = await Election.create({
      ...validatedData,
      organizationId: organization._id,
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
