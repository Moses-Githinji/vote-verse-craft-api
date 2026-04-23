import { Router } from 'express';
import { authenticate, requireOrgAccess, requireRole, isSuperAdmin } from '../middlewares/auth';
import {
  getSubscription,
  getUsage,
  changePlan,
  cancelSubscription,
  listAllSubscriptions,
  setSubscriptionStatus,
  setElectionIntegrityOverride,
} from '../controllers/subscriptionController';

export const subscriptionRouter = Router();

// ── Authenticated org routes ─────────────────────────────────────────────────
subscriptionRouter.use(authenticate, requireOrgAccess);

subscriptionRouter.get('/', getSubscription);
subscriptionRouter.get('/usage', getUsage);
subscriptionRouter.put('/plan', changePlan);
subscriptionRouter.put('/cancel', cancelSubscription);

// ── Super admin routes ───────────────────────────────────────────────────────
subscriptionRouter.get('/admin/all', isSuperAdmin, listAllSubscriptions);
subscriptionRouter.put('/admin/:orgId/status', isSuperAdmin, setSubscriptionStatus);
subscriptionRouter.put('/admin/:orgId/override', isSuperAdmin, setElectionIntegrityOverride);
