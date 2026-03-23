import { Request, Response } from 'express';
import { Vote } from '../models/Vote';
import { Election } from '../models/Election';
import { Voter } from '../models/Voter';
import { Organization } from '../models/Organization';
import mongoose from 'mongoose';

const getElectionResultsAggregation = (electionId: string) => {
  return [
    { $match: { electionId: new mongoose.Types.ObjectId(electionId) } },
    { $project: { votesArray: { $objectToArray: "$voteData" } } },
    { $unwind: "$votesArray" },
    { $group: { 
        _id: { 
          candidateId: "$votesArray.v", 
          position: "$votesArray.k" 
        }, 
        voteCount: { $sum: 1 } 
      } 
    },
    { $addFields: { candidateObjectId: { $toObjectId: "$_id.candidateId" } } },
    { $lookup: {
        from: "candidates",
        localField: "candidateObjectId",
        foreignField: "_id",
        as: "candidateDetails"
    } },
    { $unwind: "$candidateDetails" },
    { $group: {
        _id: "$_id.position",
        candidates: { $push: {
            id: "$_id.candidateId",
            name: "$candidateDetails.name",
            votes: "$voteCount"
        } }
    } },
    { $project: {
        position: "$_id",
        candidates: 1,
        _id: 0
    } }
  ];
};

export const getResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid election ID format' } });
    }

    const election = await Election.findById(id as string);

    if (!election) return res.status(404).json({ success: false, error: { message: 'Election not found' } });

    const totalVoters = await Voter.countDocuments({ organizationId: election.organizationId });
    const votesCast = await Vote.countDocuments({ electionId: election._id });
    
    const resultsAgg = await Vote.aggregate(getElectionResultsAggregation(election._id as unknown as string));

    const responseData = {
      success: true,
      data: {
        election: {
          id: election._id,
          title: election.title,
          status: election.status,
          totalVoters,
          votesCast,
          turnoutPercentage: totalVoters > 0 ? (votesCast / totalVoters) * 100 : 0
        },
        results: resultsAgg.map(r => ({
          position: r.position,
          candidates: r.candidates.map((c: any) => ({
             ...c,
             percentage: votesCast > 0 ? (c.votes / votesCast) * 100 : 0
          }))
        })),
        realTime: false
      }
    };

    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
