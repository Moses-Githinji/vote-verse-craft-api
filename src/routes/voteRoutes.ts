import { Router } from 'express';
import { castVote } from '../controllers/voteController';
import { authenticate, requireOrgAccess } from '../middlewares/auth';
import { voteLimiter } from '../middlewares/rateLimiter';

export const voteRouter = Router({ mergeParams: true });

voteRouter.use(voteLimiter);
voteRouter.use(authenticate);
// Voter auth doesn't have role, but let's check org access
voteRouter.use(requireOrgAccess);

voteRouter.post('/', castVote);
