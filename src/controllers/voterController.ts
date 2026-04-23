import { Request, Response } from 'express';
import { Voter } from '../models/Voter';
import { Vote } from '../models/Vote';
import { Election } from '../models/Election';
import { Organization } from '../models/Organization';
import { processVoterCSV } from '../utils/csvProcessor';
import { voterLoginSchema } from '../validators/auth';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { writeAuditLog } from '../utils/audit';
import { EntitlementService } from '../services/EntitlementService';
import { Subscription } from '../models/Subscription';

// NOTE: loginVoter keeps orgType from URL because voters need to identify their org on first login
export const loginVoter = async (req: Request, res: Response) => {
  try {
    // Get orgType from URL params first, then fall back to body
    let orgType = req.params.orgType || req.body.orgType;
    
    // Support organization type in body for backward compatibility
    if (!orgType && req.body.organizationType) {
      orgType = req.body.organizationType;
    }
    
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

    // If orgType is still not provided, we need to find which org the voter belongs to
    // This requires searching across all organizations
    if (!orgType) {
      // Try to find voter by authCredential and get their organization
      const voter = await Voter.findOne({ authCredential }).populate('organizationId');
      if (!voter) {
        return res.status(401).json({ success: false, error: { message: 'Invalid credential' } });
      }
      const org = await Organization.findById(voter.organizationId);
      if (!org) {
        return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
      }
      orgType = org.orgType;
    }

    // Better approach: Find all organizations of this type
    const organizations = await Organization.find({ orgType });
    if (!organizations || organizations.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
    }

    // Try to find the voter in any of these organizations
    let voter = await Voter.findOne({ 
      organizationId: { $in: organizations.map(o => o._id) }, 
      authCredential 
    });

    if (!voter || !voter.isActive) {
      // Check if this was a simulation credential format (e.g., SCHOOL-052)
      if (/^[A-Z]+-\d{3}$/.test(authCredential)) {
         // Automatically generate simulation voters on-the-fly for smooth dev experience
         const fallbackOrg = organizations[0];
         if (fallbackOrg) {
           const existingCount = await Voter.countDocuments({ 
             organizationId: fallbackOrg._id, 
             'voterMetadata.isSimulation': true 
           });
           
           if (existingCount < 100) {
             const votersToCreate = [];
             for (let i = existingCount + 1; i <= 100; i++) {
               votersToCreate.push({
                 organizationId: fallbackOrg._id,
                 name: `Sim Voter ${i}`,
                 authCredential: `${orgType.toUpperCase()}-${i.toString().padStart(3, '0')}`,
                 studentId: orgType === 'school' ? `S-${i}` : undefined,
                 voterMetadata: new Map([['isSimulation', true]]),
                 isActive: true,
                 hasVoted: false
               });
             }
             if (votersToCreate.length > 0) {
               await Voter.insertMany(votersToCreate);
             }
             
             // Re-query the voter now that we've created them
             voter = await Voter.findOne({ organizationId: fallbackOrg._id, authCredential });
           }
         }
         
         // If STILL not found (out of range, etc.)
         if (!voter || !voter.isActive) {
           return res.status(401).json({ success: false, error: { message: 'Simulation credential not found. Out of range.' } });
         }
      } else {
        return res.status(401).json({ success: false, error: { message: 'Invalid active credential' } });
      }
    }

    // Capture the specific organization this voter belongs to
    const organization = organizations.find(o => o._id.toString() === voter.organizationId.toString())!;

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
    
    console.log(`[getVoters] Fetching voters for org: ${userOrgId}, page: ${page}, limit: ${limit}`);
    
    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const query: any = { organizationId: userOrgId };
    
    if (search) {
      // Use regex for flexible, case-insensitive partial matches instead of $text
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { authCredential: { $regex: search, $options: 'i' } }
      ];
    }
    if (stream) query.stream = stream;
    if (hasVoted !== undefined) query.hasVoted = hasVoted === 'true';

    const voters = await Voter.find(query)
      .sort({ createdAt: -1 }) // Show newest first for "Live Registry" feel
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

    if (!req.body.authCredential) {
      return res.status(400).json({ success: false, error: { message: 'authCredential is required' } });
    }

    const voterExists = await Voter.findOne({ organizationId: userOrgId, authCredential: req.body.authCredential });
    if (voterExists) return res.status(400).json({ success: false, error: { message: 'Auth credential already exists' } });

    const voterData = { ...req.body, organizationId: userOrgId };

    // --- Usage Limit Check ---
    const usage = await EntitlementService.checkUsage(userOrgId, 'voters');
    if (!usage.allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'LIMIT_REACHED',
          message: `Voter limit reached (${usage.limit}). Upgrade your plan to add more voters.`,
          current: usage.current,
          limit: usage.limit,
          requiredPlan: usage.requiredPlan
        }
      });
    }

    // If an image was uploaded, store the Cloudinary URL
    if (req.file) {
      voterData.voterMetadata = voterData.voterMetadata || {};
      if (typeof voterData.voterMetadata === 'string') {
        try {
          voterData.voterMetadata = JSON.parse(voterData.voterMetadata);
        } catch {
          voterData.voterMetadata = {};
        }
      }
      voterData.voterMetadata.photoUrl = req.file.path;
    }

    const voter = await Voter.create(voterData);
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
    
    // --- Bulk Usage Limit Check ---
    const { features } = await EntitlementService.getEffectivePlan(userOrgId);
    if (features.maxVoters !== null) {
      const currentVoters = await Voter.countDocuments({ organizationId: userOrgId, isActive: true });
      if (currentVoters + result.validVoters.length > features.maxVoters) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'LIMIT_REACHED',
            message: `Bulk upload exceeds voter limit. Space remaining: ${features.maxVoters - currentVoters}. CSV contains ${result.validVoters.length} valid voters.`,
          }
        });
      }
    }

    if (result.validVoters.length > 0) {
      await Voter.insertMany(result.validVoters);
      
      // Update usage log in subscription (since insertMany is manual)
      await Subscription.findOneAndUpdate(
        { organizationId: userOrgId },
        { $inc: { 'usage.voters': result.validVoters.length } }
      );
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

export const deleteAllVoters = async (req: Request, res: Response) => {
  try {
    const userOrgId = (req as any).userOrgId;
    const userRole = (req as any).userRole; // Assuming role is available in request
    const { all } = req.query;

    let query: any = {};
    let message = "";

    if (all === 'true' && userRole === 'super_admin') {
      // Global delete - only for super_admin
      message = "All voter records deleted from the database";
    } else if (userOrgId) {
      // Organization-specific delete
      query.organizationId = userOrgId;
      message = `All voter records deleted for organization ${userOrgId}`;
    } else {
      return res.status(403).json({ success: false, error: { message: 'Unauthorized or Organization not found' } });
    }

    // Identify voters to be deleted for cascading
    const votersToDelete = await Voter.find(query).select('_id');
    const voterIds = votersToDelete.map(v => v._id);

    // Cascade delete votes
    if (voterIds.length > 0) {
      await Vote.deleteMany({ voterId: { $in: voterIds } });
    }

    const result = await Voter.deleteMany(query);
    
    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        message
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
export const deleteVoter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userOrgId = (req as any).userOrgId;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid voter ID format' } });
    }

    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    // Ensure the voter belongs to the organization
    const voter = await Voter.findOne({ _id: id, organizationId: userOrgId });
    if (!voter) {
      return res.status(404).json({ success: false, error: { message: 'Voter not found' } });
    }

    // Cascade delete any votes cast by this voter
    await Vote.deleteMany({ voterId: id });
    
    // Delete the voter
    await Voter.findByIdAndDelete(id);

    res.json({
      success: true,
      data: {
        message: 'Voter and all related data (votes) deleted successfully',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const deleteVotersBulk = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    const userOrgId = (req as any).userOrgId;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'IDs array is required' } });
    }

    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    // Filter out invalid IDs and ensure they belong to the organization
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    const votersToDelete = await Voter.find({ 
      _id: { $in: validIds }, 
      organizationId: userOrgId 
    }).select('_id');
    
    const actualIdsToDelete = votersToDelete.map(v => v._id);

    if (actualIdsToDelete.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'No valid voters found to delete' } });
    }

    // Cascade delete any votes cast by these voters
    await Vote.deleteMany({ voterId: { $in: actualIdsToDelete } });
    
    // Delete the voters
    const result = await Voter.deleteMany({ _id: { $in: actualIdsToDelete } });

    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        message: `${result.deletedCount} voters and their related data (votes) deleted successfully`,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
