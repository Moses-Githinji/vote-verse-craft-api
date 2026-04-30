import { Request, Response } from 'express';
import { Organization } from '../models/Organization';
import { Election } from '../models/Election';
import { Voter } from '../models/Voter';
import { Candidate } from '../models/Candidate';
import { Vote } from '../models/Vote';
import { OrganizationService } from '../services/OrganizationService';

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
    const orgId = req.params.id as string;
    await OrganizationService.cascadeDelete([orgId]);
    res.json({ success: true, message: 'Organization and all related data deleted successfully' });
  } catch (error: any) {
     res.status(500).json({ success: false, error: { message: error.message } });
  }
};
