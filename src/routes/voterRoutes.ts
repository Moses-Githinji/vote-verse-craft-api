import { Router } from 'express';
import { 
  loginVoter, 
  getVoters, 
  createVoter, 
  bulkCreateVoters,
  deleteAllVoters,
  deleteVotersBulk,
  deleteVoter
} from '../controllers/voterController';
import { authenticate, requireRole, requireOrgAccess } from '../middlewares/auth';
import { loginLimiter } from '../middlewares/rateLimiter';
import { uploadCSV, uploadImage } from '../middlewares/upload';
import { checkResourceLimit } from '../middlewares/entitlementGuard';

export const voterRouter = Router({ mergeParams: true });

// Voter login requires orgType to identify which organization the voter belongs to
voterRouter.post('/:orgType/login', loginLimiter, loginVoter);

// Also support direct login without orgType (for backward compatibility)
voterRouter.post('/login', loginLimiter, loginVoter);

voterRouter.use(authenticate);
voterRouter.use(requireOrgAccess);
voterRouter.use(requireRole(['super_admin', 'admin']));

voterRouter.get('/', getVoters);
voterRouter.post('/', uploadImage.single('photo'), checkResourceLimit('voters'), createVoter);
voterRouter.post('/bulk', uploadCSV.single('csvFile'), checkResourceLimit('voters'), bulkCreateVoters);
voterRouter.delete('/', deleteAllVoters);
voterRouter.post('/delete-bulk', deleteVotersBulk);
voterRouter.delete('/:id', deleteVoter);
