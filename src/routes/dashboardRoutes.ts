import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { authenticate, requireRole, requireOrgAccess } from '../middlewares/auth';

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.use(authenticate);
dashboardRouter.use(requireRole(['super_admin', 'admin']));
dashboardRouter.use(requireOrgAccess);

dashboardRouter.get('/stats', getDashboardStats);
