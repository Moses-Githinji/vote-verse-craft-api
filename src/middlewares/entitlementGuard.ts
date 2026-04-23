import { Request, Response, NextFunction } from 'express';
import { EntitlementService } from '../services/EntitlementService';
import { PlanFeatureKey } from '../config/entitlements';

/**
 * requireFeature — boolean feature gate middleware factory.
 *
 * Usage: router.get('/reports/ai', authenticate, requireOrgAccess, requireFeature('aiInsights'), controller)
 *
 * Returns 402 with structured error if the org's plan doesn't include the feature.
 * Attaches `req.subscriptionWarning` if the org is in grace period.
 */
export const requireFeature = (featureKey: PlanFeatureKey) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = (req as any).userOrgId;
      if (!orgId) {
        return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
      }

      const result = await EntitlementService.canUse(orgId, featureKey);

      if (result.warning) {
        (req as any).subscriptionWarning = result.warningMessage;
      }

      if (!result.allowed) {
        return res.status(402).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: `This feature is not available on your current plan.`,
            currentPlan: result.currentPlan,
            subscriptionStatus: result.subscriptionStatus,
            upgradeUrl: '/billing/upgrade',
          },
        });
      }

      next();
    } catch (err: any) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  };
};

/**
 * checkResourceLimit — usage counter gate middleware factory.
 *
 * Usage: router.post('/voters', authenticate, requireOrgAccess, checkResourceLimit('voters'), controller)
 *
 * Returns 402 with soft-limit payload when org has hit their plan cap.
 * The frontend uses this payload to show an "Upgrade Now" modal rather than a plain error.
 */
export const checkResourceLimit = (resource: 'voters' | 'active_elections') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = (req as any).userOrgId;
      if (!orgId) {
        return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
      }

      const result = await EntitlementService.checkUsage(orgId, resource);

      if (!result.allowed) {
        const resourceLabel = resource === 'voters' ? 'voters' : 'active elections';
        const limitLabel = result.limit !== null ? result.limit : 'unlimited';
        return res.status(402).json({
          success: false,
          error: {
            code: 'LIMIT_REACHED',
            message: `You've reached your ${result.currentPlan} plan limit of ${limitLabel} ${resourceLabel}.`,
            limitReached: true,
            current: result.current,
            limit: result.limit,
            currentPlan: result.currentPlan,
            requiredPlan: result.requiredPlan,
            upgradeUrl: '/billing/upgrade',
          },
        });
      }

      // Attach a count hint for bulk operations
      (req as any).usageInfo = result;
      next();
    } catch (err: any) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  };
};

/**
 * attachSubscription — lightweight middleware that attaches the subscription
 * state to req without blocking the request. Useful for non-gated routes
 * that still need to show the warning banner.
 */
export const attachSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).userOrgId;
    if (orgId) {
      const { planId, status, warning, warningMessage } = await EntitlementService.getEffectivePlan(orgId);
      (req as any).subscription = { planId, status, warning, warningMessage };
    }
    next();
  } catch {
    next();
  }
};
