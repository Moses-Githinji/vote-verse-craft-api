import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Candidate } from '../models/Candidate';
import { Election } from '../models/Election';
import { Organization } from '../models/Organization';
import { writeAuditLog } from '../utils/audit';

export const getCandidates = async (req: Request, res: Response) => {
  try {
    // Note: orgType not needed - electionId already ties to specific election
    const { electionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(electionId as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    const candidates = await Candidate.find({ electionId: electionId as string });
    res.json({ success: true, data: { candidates } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createCandidate = async (req: Request, res: Response) => {
  try {
    // Use user's organization ID from token instead of URL parameter
    const userOrgId = (req as any).userOrgId;
    const { electionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(electionId as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }
    
    // Verify election belongs to user's organization
    const election = await Election.findOne({ _id: electionId, organizationId: userOrgId });

    if (!election) return res.status(404).json({ success: false, error: { message: 'Election not found' } });

    // Handle multipart/form-data via multer if needed, or structured JSON
    const payload = req.body;
    
    // If using Cloudinary, req.file.path will contain the URL
    const imageUrl = req.file ? (req.file as any).path : payload.imageUrl;

    // Harvest extra fields into candidateMetadata
    const { name, description, manifesto, candidateMetadata, ...extraFields } = payload;
    
    const finalMetadata = {
      ...(candidateMetadata || {}),
      ...extraFields
    };

    const candidate = await Candidate.create({
      electionId: election.id,
      name: name,
      description: description,
      manifesto: manifesto,
      imageUrl: imageUrl,
      candidateMetadata: finalMetadata,
      isActive: true
    });

    await writeAuditLog({
      organizationId: userOrgId,
      action: 'candidate_created',
      resourceType: 'candidate',
      resourceId: candidate._id as any,
      userId: (req as any).user?.id,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      newValues: { name, electionId: election.id }
    });

    res.status(201).json({ success: true, data: { candidate } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
};

export const updateCandidate = async (req: Request, res: Response) => {
  try {
    const { candidateId } = req.params;
    const payload = req.body;

    if (!mongoose.Types.ObjectId.isValid(candidateId as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid candidate ID format' } });
    }

    if (req.file) {
      payload.imageUrl = (req.file as any).path;
    }

    const candidate = await Candidate.findByIdAndUpdate(candidateId as string, payload, { new: true });
    if (!candidate) return res.status(404).json({ success: false, error: { message: 'Candidate not found' } });

    // Get organizationId from the election
    const election = await Election.findById(candidate.electionId);
    const orgId = election?.organizationId || candidate.electionId;

    await writeAuditLog({
      organizationId: orgId,
      action: 'candidate_updated',
      resourceType: 'candidate',
      resourceId: candidate._id as any,
      userId: (req as any).user?.id,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      newValues: payload
    });

    res.json({ success: true, data: { candidate } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
};

export const deleteCandidate = async (req: Request, res: Response) => {
  try {
    const { candidateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(candidateId as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid candidate ID format' } });
    }

    const candidate = await Candidate.findByIdAndDelete(candidateId as string);
    if (!candidate) return res.status(404).json({ success: false, error: { message: 'Candidate not found' } });

    // Get organizationId from the election
    const election = await Election.findById(candidate.electionId);
    const orgId = election?.organizationId || candidate.electionId;

    await writeAuditLog({
      organizationId: orgId,
      action: 'candidate_deleted',
      resourceType: 'candidate',
      resourceId: candidate._id as any,
      userId: (req as any).user?.id,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      oldValues: { name: candidate.name }
    });

    res.json({ success: true, data: { message: 'Candidate removed successfully' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
