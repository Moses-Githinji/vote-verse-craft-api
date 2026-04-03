import { Request, Response } from 'express';
import { Voter } from '../models/Voter';
import { Organization } from '../models/Organization';
import { Candidate } from '../models/Candidate';
import { Election } from '../models/Election';
import { Vote } from '../models/Vote';
import mongoose from 'mongoose';

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
  // Generate 100 voters if they don't already exist
  const existingVotersCount = await Voter.countDocuments({ organizationId: org._id });
  if (existingVotersCount < 100) {
    const votersToCreate = [];
    for (let i = existingVotersCount + 1; i <= 100; i++) {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const stopSimulation = (req: Request, res: Response) => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
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
    res.json({ success: true, message: `${count} candidates generated for election ${electionId}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const clearSimulationVoters = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query; // Accept as query param based on user request URL

    if (!organizationId) {
      return res.status(400).json({ success: false, error: { message: 'Organization ID required' } });
    }

    const simVoterQuery = {
      organizationId,
      'voterMetadata.isSimulation': true
    };

    // Identify simulation voters for cascading deletion
    const simVoters = await Voter.find(simVoterQuery).select('_id');
    const simVoterIds = simVoters.map(v => v._id);

    // Cascade delete votes cast by these simulation voters
    if (simVoterIds.length > 0) {
      await Vote.deleteMany({ voterId: { $in: simVoterIds } });
    }

    const result = await Voter.deleteMany(simVoterQuery);

    res.json({ 
      success: true, 
      message: `Cleared ${result.deletedCount} simulation voters for organization ${organizationId}` 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
