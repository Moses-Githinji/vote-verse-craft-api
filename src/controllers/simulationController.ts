import { Request, Response } from 'express';
import { Voter } from '../models/Voter';
import { Organization } from '../models/Organization';
import { Candidate } from '../models/Candidate';
import { Election } from '../models/Election';
import { Vote } from '../models/Vote';
import mongoose from 'mongoose';
import { writeAuditLog } from '../utils/audit';

export const generateSimulationData = async (req: Request, res: Response) => {
  try {
    const { orgType, organizationId } = req.body;
    console.log(`[generateSimulationData] Request: orgType=${orgType}, organizationId=${organizationId}`);
    
    // If specific org is provided, only generate for that one
    if (orgType && organizationId) {
      const org = await Organization.findById(organizationId);
      if (!org) {
        console.error(`[generateSimulationData] Org not found: ${organizationId}`);
        return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
      }

      console.log(`[generateSimulationData] Generating for existing org: ${org.name} (${org._id})`);
      await generateVotersForOrg(org, orgType);
      
      // Audit log simulation generation
      await writeAuditLog({
        organizationId: org._id,
        action: 'simulation_voters_generated',
        resourceType: 'simulation',
        resourceId: org._id as any,
        userId: (req as any).user?.id,
        ipAddress: (req as any).ip,
        userAgent: (req as any).get('User-Agent'),
        metadata: { orgType, voterCount: 100 }
      });

      return res.json({ 
        success: true, 
        data: { [orgType]: { orgId: org._id, voters: 100 } } 
      });
    }

    const orgTypes = ['school', 'sacco', 'church', 'political'];
    const results: any = {};

    for (const type of orgTypes) {
      // Find or create simulation organization for this type
      let org = await Organization.findOne({ orgType: type, name: `Sim ${type.charAt(0).toUpperCase() + type.slice(1)} Org` });
      if (!org) {
        org = await Organization.create({
          orgType: type as any,
          name: `Sim ${type.charAt(0).toUpperCase() + type.slice(1)} Org`,
          email: `sim-${type}@example.com`,
          isActive: true,
          settings: new Map([['isSimulation', true]])
        });
      }

      await generateVotersForOrg(org, type);
      results[type] = { orgId: org._id, voters: 100 };
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

async function generateVotersForOrg(org: any, type: string) {
  // Generate 100 simulation voters if they don't already exist
  const existingVotersCount = await Voter.countDocuments({ 
    organizationId: org._id,
    'voterMetadata.isSimulation': true 
  });
  
  if (existingVotersCount < 100) {
    const votersToCreate = [];
    for (let i = existingVotersCount + 1; i <= 100; i++) {
      // Ensure we format the credential exactly as the UI Quick Login expects:
      // school -> SCHOOL-001, sacco -> SACCO-001, etc.
      const authCredential = `${type.toUpperCase()}-${i.toString().padStart(3, '0')}`;
      
      votersToCreate.push({
        organizationId: org._id,
        name: `Sim Voter ${i}`,
        authCredential,
        studentId: type === 'school' ? `S-${i}` : undefined,
        voterMetadata: new Map([['isSimulation', true]]),
        isActive: true,
        hasVoted: false
      });
    }
    await Voter.insertMany(votersToCreate);
  }
}

let simulationInterval: NodeJS.Timeout | null = null;

export const startSimulation = async (req: Request, res: Response) => {
  try {
    const { electionId, speed = 1000 } = req.body; // Speed in ms per vote

    if (!electionId) {
      return res.status(400).json({ success: false, error: { message: 'Election ID required' } });
    }

    const election = await Election.findById(electionId);
    if (!election || election.status !== 'active') {
      return res.status(400).json({ success: false, error: { message: 'Active election not found' } });
    }

    if (simulationInterval) {
      clearInterval(simulationInterval);
    }

    // Get all simulation voters for this org
    const voters = await Voter.find({ organizationId: election.organizationId, hasVoted: false });
    let voterIndex = 0;

    simulationInterval = setInterval(async () => {
      // Guard: If simulation was stopped (interval cleared), abort immediately
      if (!simulationInterval) return;

      if (voterIndex >= voters.length) {
        clearInterval(simulationInterval!);
        simulationInterval = null;
        console.log('Simulation complete: All voters have voted.');
        return;
      }

      const voter = voters[voterIndex++];
      
      // Generate random vote data based on ballot questions
      const voteData = new Map();
      election.ballotQuestions.forEach((q: any) => {
        if (['section', 'image_block', 'video_block'].includes(q.type)) return;
        
        if (q.options && q.options.length > 0) {
          if (q.type === 'multi') {
            const numSelections = Math.floor(Math.random() * (q.maxSelections || 1)) + 1;
            const selected = [];
            for(let i=0; i<numSelections; i++) {
              selected.push(q.options[Math.floor(Math.random() * q.options.length)]);
            }
            voteData.set(q.id, selected);
          } else {
            voteData.set(q.id, q.options[Math.floor(Math.random() * q.options.length)]);
          }
        } else if (q.type === 'yesno') {
          voteData.set(q.id, Math.random() > 0.5 ? 'Yes' : 'No');
        } else if (q.type === 'rating') {
          voteData.set(q.id, Math.floor(Math.random() * (q.ratingMax || 5)) + 1);
        }
      });

      try {
        await Vote.create({
          electionId: election._id,
          voterId: voter._id,
          voteData,
          ipAddress: '127.0.0.1',
          userAgent: 'Simulation Engine',
          voteTimestamp: new Date()
        });
        
        await Voter.findByIdAndUpdate(voter._id, { hasVoted: true, votedAt: new Date() });
      } catch (err) {
        console.error('Simulation vote failed:', err);
      }
    }, speed);

    res.json({ success: true, message: `Simulation started for election ${electionId}` });

    // Audit log simulation start
    await writeAuditLog({
      organizationId: election.organizationId,
      action: 'simulation_started',
      resourceType: 'simulation',
      resourceId: electionId as any,
      userId: (req as any).user?.id,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      metadata: { electionId, speed }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const stopSimulation = (req: Request, res: Response) => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    
    // Audit log simulation stop (global/session scope)
    // We don't necessarily have the electionId here easily, but we can log the action
    res.json({ success: true, message: 'Simulation stopped' });
  } else {
    res.json({ success: true, message: 'No simulation running' });
  }
};

export const generateCandidates = async (req: Request, res: Response) => {
  try {
    const { electionId, count = 3 } = req.body;
    if (!electionId) return res.status(400).json({ success: false, error: { message: 'Election ID required' } });

    const election = await Election.findById(electionId);
    if (!election) return res.status(400).json({ success: false, error: { message: 'Election not found' } });

    const candidatesToCreate = [];
    for (let i = 1; i <= count; i++) {
      candidatesToCreate.push({
        electionId: election._id,
        name: `Sim Candidate ${i}`,
        description: `This is a simulation candidate for the ${election.title} election.`,
        manifesto: `Vote for me to ensure a great future! (Simulation ID: ${i})`,
        candidateMetadata: new Map([['isSimulation', true]]),
        isActive: true
      });
    }

    await Candidate.insertMany(candidatesToCreate);
    
    // Audit log candidate generation
    await writeAuditLog({
      organizationId: election.organizationId,
      action: 'simulation_candidates_generated',
      resourceType: 'simulation',
      resourceId: electionId as any,
      userId: (req as any).user?.id,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      metadata: { electionId, count }
    });

    res.json({ success: true, message: `${count} candidates generated for election ${electionId}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const clearSimulationVoters = async (req: Request, res: Response) => {
  // Stop any running simulation before clearing data
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log('[clearSimulationVoters] Active simulation stopped due to data reset.');
  }

  try {
    const organizationId = req.query.organizationId || req.body.organizationId;

    if (!organizationId) {
      return res.status(400).json({ success: false, error: { message: 'Organization ID required' } });
    }

    const simVoterQuery = {
      organizationId,
      'voterMetadata.isSimulation': true
    };

    // Identify all elections for this organization
    const orgElections = await Election.find({ organizationId }).select('_id');
    const orgElectionIds = orgElections.map(e => e._id);

    // Deep Cleanup: Delete ALL votes associated with these elections
    // This ensures orphaned votes from deleted voters are also purged
    if (orgElectionIds.length > 0) {
      const voteResult = await Vote.deleteMany({ electionId: { $in: orgElectionIds } });
      console.log(`[clearSimulationVoters] Purged ${voteResult.deletedCount} total votes for organization ${organizationId}`);
    }

    const result = await Voter.deleteMany(simVoterQuery);

    // Audit log environment purge
    await writeAuditLog({
      organizationId,
      action: 'simulation_environment_purged',
      resourceType: 'simulation',
      resourceId: organizationId as any,
      userId: (req as any).user?.id,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      metadata: { organizationId, deletedCount: result.deletedCount }
    });

    res.json({ 
      success: true, 
      message: `Cleared ${result.deletedCount} simulation voters for organization ${organizationId}` 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
