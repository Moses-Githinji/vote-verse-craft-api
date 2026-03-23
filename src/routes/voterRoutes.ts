import { Router } from 'express';
import { 
  loginVoter, 
  getVoters, 
  createVoter, 
  bulkCreateVoters 
} from '../controllers/voterController';
import { authenticate, requireRole, requireOrgAccess } from '../middlewares/auth';
import { loginLimiter } from '../middlewares/rateLimiter';
import { uploadCSV } from '../middlewares/upload';

export const voterRouter = Router({ mergeParams: true });

voterRouter.post('/login', loginLimiter, loginVoter);

voterRouter.use(authenticate);
voterRouter.use(requireOrgAccess);
voterRouter.use(requireRole(['super_admin', 'admin']));

voterRouter.get('/', getVoters);
voterRouter.post('/', createVoter);
voterRouter.post('/bulk', uploadCSV.single('csvFile'), bulkCreateVoters);
