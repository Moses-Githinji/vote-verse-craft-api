import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticate, requireRole, requireOrgAccess } from '../middlewares/auth';

export const auditRouter = Router({ mergeParams: true });

auditRouter.use(authenticate);
auditRouter.use(requireRole(['super_admin', 'admin']));
auditRouter.use(requireOrgAccess);

auditRouter.get('/', getAuditLogs);
