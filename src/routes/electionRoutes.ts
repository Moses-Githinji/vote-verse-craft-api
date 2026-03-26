import { Router } from 'express';
import { 
  getElections, 
  getElectionById,
  createElection, 
  updateElection,
  updateElectionStatus 
} from '../controllers/electionController';
import { authenticate, requireRole, requireOrgAccess, optionalAuth } from '../middlewares/auth';

export const electionRouter = Router({ mergeParams: true });

// GET requests - allow voters to view elections (optional auth)
electionRouter.get('/', optionalAuth, getElections);
electionRouter.get('/:id', optionalAuth, getElectionById);

// Other methods - require full authentication
electionRouter.post('/', authenticate, requireRole(['super_admin', 'admin']), createElection);
electionRouter.put('/:id', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, updateElection);
electionRouter.put('/:id/status', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, updateElectionStatus);
