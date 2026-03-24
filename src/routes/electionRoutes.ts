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

electionRouter.use(optionalAuth, (req, res, next) => {
  // if GET, we allow voters to view if they have valid token.
  if (req.method === 'GET') {
     return authenticate(req, res, next);
  }
  next();
});

electionRouter.use((req, res, next) => {
  // Apply authentication and org access check for all methods
  authenticate(req, res, () => {
    requireRole(['super_admin', 'admin', 'voter'])(req, res, () => {
      requireOrgAccess(req, res, next);
    });
  });
});

electionRouter.get('/', getElections);
electionRouter.get('/:id', getElectionById);
electionRouter.post('/', createElection);
electionRouter.put('/:id', updateElection);
electionRouter.put('/:id/status', updateElectionStatus);
