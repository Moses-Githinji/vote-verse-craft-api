import { Request, Response } from 'express';
import { Organization } from '../models/Organization';

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
    const org = await Organization.findByIdAndDelete(req.params.id);
    if (!org) {
       return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
    }
    res.json({ success: true, data: { message: 'Organization deleted' } });
  } catch (error: any) {
     res.status(500).json({ success: false, error: { message: error.message } });
  }
};
