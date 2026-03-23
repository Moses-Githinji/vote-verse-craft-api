import { Router } from 'express';
import { getResults } from '../controllers/resultsController';
import { authenticate, requireOrgAccess } from '../middlewares/auth';

export const resultsRouter = Router({ mergeParams: true });

resultsRouter.use(authenticate);
resultsRouter.use(requireOrgAccess);

resultsRouter.get('/', getResults);
