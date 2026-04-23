import { Request, Response } from 'express';
import { Organization } from '../models/Organization';
import { Election } from '../models/Election';
import { Voter } from '../models/Voter';
import { Candidate } from '../models/Candidate';
import { Vote } from '../models/Vote';

export const getOrganizations = async (req: Request, res: Response) => {
  try {
    const organizations = await Organization.find();
    res.json({ success: true, data: { organizations } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createOrganization = async (req: Request, res: Response) => {
  try {
    const org = await Organization.create(req.body);
    res.status(201).json({ success: true, data: { organization: org } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
};

export const getOrganizationById = async (req: Request, res: Response) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
    }
    res.json({ success: true, data: { organization: org } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const updateOrganization = async (req: Request, res: Response) => {
  try {
    const org = await Organization.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!org) {
       return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
    }
    res.json({ success: true, data: { organization: org } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
};

export const deleteOrganization = async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id;
    
    // 1. Delete all Votes from all Elections in this Org
    const elections = await Election.find({ organizationId: orgId }).select('_id');
    const electionIds = elections.map(e => e._id);
    
    if (electionIds.length > 0) {
      await Vote.deleteMany({ electionId: { $in: electionIds } });
      await Candidate.deleteMany({ electionId: { $in: electionIds } });
      await Election.deleteMany({ organizationId: orgId });
    }
    
    // 2. Delete all Voters
    await Voter.deleteMany({ organizationId: orgId });
    
    // 3. Delete the Organization itself
    const org = await Organization.findByIdAndDelete(orgId);
    
    if (!org) {
       return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
    }
    res.json({ success: true, data: { message: 'Organization and all related data deleted successfully' } });
  } catch (error: any) {
     res.status(500).json({ success: false, error: { message: error.message } });
  }
};
