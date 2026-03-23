import { Router } from 'express';
import { 
  getElections, 
  getElectionById,
  createElection, 
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
  if (req.method !== 'GET') {
    authenticate(req, res, () => {
      requireRole(['super_admin', 'admin'])(req, res, () => {
        requireOrgAccess(req, res, next);
      });
    });
  } else {
    next();
  }
});

electionRouter.get('/', getElections);
electionRouter.get('/:id', getElectionById);
electionRouter.post('/', createElection);
electionRouter.put('/:id/status', updateElectionStatus);
