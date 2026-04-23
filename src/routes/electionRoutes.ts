import { Router } from 'express';
import { 
  getElections, 
  getElectionById,
  getActiveElection,
  createElection, 
  updateElection,
  updateElectionStatus,
  resetVoters,
  deleteElection,
  deleteElectionsBulk,
  deleteAllElections,
  getElectionsCategorized,
} from '../controllers/electionController';
import { authenticate, requireRole, requireOrgAccess } from '../middlewares/auth';
import { checkResourceLimit } from '../middlewares/entitlementGuard';

export const electionRouter = Router({ mergeParams: true });

// Special routes first
electionRouter.get('/active', authenticate, requireOrgAccess, getActiveElection);
electionRouter.get('/summary', authenticate, requireOrgAccess, getElectionsCategorized);

// GET requests - require auth and org access for voters to view elections
electionRouter.get('/', authenticate, requireOrgAccess, getElections);
electionRouter.get('/:id', authenticate, requireOrgAccess, getElectionById);

// Other methods - require full authentication
electionRouter.post('/', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, checkResourceLimit('active_elections'), createElection);
electionRouter.put('/:id', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, updateElection);
electionRouter.put('/:id/status', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, updateElectionStatus);
electionRouter.post('/:id/reset-voters', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, resetVoters);
electionRouter.post('/delete-bulk', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, deleteElectionsBulk);
electionRouter.delete('/', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, deleteAllElections);
electionRouter.delete('/:id', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, deleteElection);
