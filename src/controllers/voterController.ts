import { Request, Response } from 'express';
import { Voter } from '../models/Voter';
import { Election } from '../models/Election';
import { Organization } from '../models/Organization';
import { processVoterCSV } from '../utils/csvProcessor';
import { voterLoginSchema } from '../validators/auth';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { writeAuditLog } from '../utils/audit';

// NOTE: loginVoter keeps orgType from URL because voters need to identify their org on first login
export const loginVoter = async (req: Request, res: Response) => {
  try {
    const { orgType } = req.params;
    const body = req.body;

    // Support organization-specific field aliases
    let authCredential = body.authCredential;
    if (!authCredential) {
      authCredential = body.admissionNumber || // school
                       body.memberNumber ||    // sacco
                       body.districtNumber ||  // church
                       body.voterCardId;       // political
    }

    if (!authCredential) {
      return res.status(400).json({ success: false, error: { message: 'Identification number is required' } });
    }

    const organization = await Organization.findOne({ orgType });
    if (!organization) {
      return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
    }

    const voter = await Voter.findOne({ 
      organizationId: organization._id, 
      authCredential 
    });

    if (!voter || !voter.isActive) {
      return res.status(401).json({ success: false, error: { message: 'Invalid active credential' } });
    }

    let election = null;
    if (body.electionId) {
      if (mongoose.Types.ObjectId.isValid(body.electionId)) {
        election = await Election.findById(body.electionId);
      }
    } else {
      // Automatically resolve the latest active election for this org
      election = await Election.findOne({ 
        organizationId: organization._id, 
        status: 'active' 
      }).sort({ startDate: -1 });
    }

    const payload = {
      voterId: voter._id,
      electionId: election ? election._id : undefined,
      organizationId: organization._id,
      organization: {
        id: organization._id,
        type: organization.orgType
      },
      type: 'voter_session'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '12h' });

    // Write audit log
    await writeAuditLog({
      organizationId: organization._id,
      action: 'voter_login',
      resourceType: 'voter',
      resourceId: voter._id as any,
      voterId: voter._id as any,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      metadata: { authCredential }
    });

    res.json({
      success: true,
      data: {
        voter: {
          id: voter._id,
          name: voter.name,
          stream: voter.stream,
          hasVoted: voter.hasVoted
        },
        election: election ? {
          id: election._id,
          title: election.title,
          candidates: (election as any).candidates
        } : null,
        token
      }
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { message: error.errors } });
    }
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getVoters = async (req: Request, res: Response) => {
  try {
    // Use user's organization ID from token instead of URL parameter
    const userOrgId = (req as any).userOrgId;
    const { page = 1, limit = 20, search, stream, hasVoted } = req.query;
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const query: any = { organizationId: userOrgId };
    if (search) {
      query.$text = { $search: search as string };
    }
    if (stream) query.stream = stream;
    if (hasVoted !== undefined) query.hasVoted = hasVoted === 'true';

    const voters = await Voter.find(query)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .exec();

    const total = await Voter.countDocuments(query);

    res.json({
      success: true,
      data: {
        voters: voters.map(v => ({
           id: v._id,
           name: v.name,
           authCredential: v.authCredential,
           stream: v.stream,
           hasVoted: v.hasVoted,
           createdAt: v.createdAt
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createVoter = async (req: Request, res: Response) => {
  try {
    // Use user's organization ID from token instead of URL parameter
    const userOrgId = (req as any).userOrgId;
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const voterExists = await Voter.findOne({ organizationId: userOrgId, authCredential: req.body.authCredential });
    if (voterExists) return res.status(400).json({ success: false, error: { message: 'Auth credential already exists' } });

    const voter = await Voter.create({ ...req.body, organizationId: userOrgId });
    res.status(201).json({ success: true, data: { voter } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
};


export const bulkCreateVoters = async (req: Request, res: Response) => {
  try {
    // Use user's organization ID from token instead of URL parameter
    const userOrgId = (req as any).userOrgId;
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'CSV file required' } });
    }

    const result: any = await processVoterCSV(req.file.buffer, userOrgId.toString());
    
    if (result.validVoters.length > 0) {
      await Voter.insertMany(result.validVoters);
    }

    res.json({
      success: true,
      data: {
        processed: result.totalRows,
        successful: result.validRows,
        failed: result.errorRows,
        errors: result.errors
      }
    });
  } catch (error: any) {
     res.status(400).json({ success: false, error: { message: error.message } });
  }
};
