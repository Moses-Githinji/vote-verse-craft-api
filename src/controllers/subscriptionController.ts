import { Request, Response } from 'express';
import { Subscription } from '../models/Subscription';
import { EntitlementService } from '../services/EntitlementService';
import { PLAN_LIMITS, GRACE_PERIOD_DAYS, PlanId } from '../config/entitlements';
import { Voter } from '../models/Voter';
import { Election } from '../models/Election';
import { writeAuditLog } from '../utils/audit';
import mongoose from 'mongoose';

// --- Helpers ---

const getPlanDisplayName = (planId: PlanId): string => {
  const names: Record<PlanId, string> = {
    starter: 'Starter (Free)',
    pro: 'Pro (Growth)',
    enterprise: 'Enterprise (Scale)',
  };
  return names[planId] ?? planId;
};

// --- User-facing Endpoints ---

/**
 * GET /api/v1/subscription
 * Returns the org's current subscription state + resolved entitlements.
 */
export const getSubscription = async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).userOrgId;

    const { planId, features, status, warning, warningMessage, electionIntegrityOverride } =
      await EntitlementService.getEffectivePlan(orgId);

    const sub = await Subscription.findOne({ organizationId: orgId });

    res.json({
      success: true,
      data: {
        subscription: {
          planId,
          planName: getPlanDisplayName(planId),
          status,
          currentPeriodStart: sub?.currentPeriodStart,
          currentPeriodEnd: sub?.currentPeriodEnd,
          gracePeriodEnd: sub?.gracePeriodEnd,
          trialEndsAt: sub?.trialEndsAt,
          cancelAtPeriodEnd: sub?.cancelAtPeriodEnd,
          electionIntegrityOverride,
        },
        entitlements: features,
        warning,
        warningMessage,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * GET /api/v1/subscription/usage
 * Returns live usage stats vs. plan limits for the dashboard gauge.
 */
export const getUsage = async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).userOrgId;
    const { planId, features } = await EntitlementService.getEffectivePlan(orgId);

    const [currentVoters, activeElections] = await Promise.all([
      Voter.countDocuments({ organizationId: orgId, isActive: true }),
      Election.countDocuments({ organizationId: orgId, status: { $in: ['active', 'scheduled'] } }),
    ]);

    res.json({
      success: true,
      data: {
        planId,
        planName: getPlanDisplayName(planId),
        usage: {
          voters: {
            current: currentVoters,
            limit: features.maxVoters,
            percentUsed:
              features.maxVoters !== null
                ? Math.min(Math.round((currentVoters / features.maxVoters) * 100), 100)
                : null,
          },
          activeElections: {
            current: activeElections,
            limit: features.maxActiveElections,
            percentUsed:
              features.maxActiveElections !== null
                ? Math.min(Math.round((activeElections / features.maxActiveElections) * 100), 100)
                : null,
          },
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * PUT /api/v1/subscription/plan
 * Self-service plan upgrade/downgrade.
 * Body: { planId: 'starter' | 'pro' | 'enterprise' }
 */
export const changePlan = async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).userOrgId;
    const { planId } = req.body as { planId: PlanId };

    if (!planId || !PLAN_LIMITS[planId]) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid planId. Must be one of: ${Object.keys(PLAN_LIMITS).join(', ')}` },
      });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const sub = await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      { planId, status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd, gracePeriodEnd: null },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      data: {
        message: `Plan updated to ${getPlanDisplayName(planId)}`,
        subscription: {
          planId: sub.planId,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * PUT /api/v1/subscription/cancel
 * Marks the subscription to cancel at the end of the current period.
 */
export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).userOrgId;

    const sub = await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      { cancelAtPeriodEnd: true },
      { new: true }
    );

    if (!sub) {
      return res.status(404).json({ success: false, error: { message: 'Subscription not found' } });
    }

    res.json({
      success: true,
      data: {
        message: `Subscription will be canceled at the end of the current period (${sub.currentPeriodEnd.toISOString().split('T')[0]}).`,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// --- Super Admin Endpoints ---

/**
 * GET /api/v1/admin/subscriptions
 * List all org subscriptions (super_admin only).
 */
export const listAllSubscriptions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, planId } = req.query;
    const query: Record<string, any> = {};
    if (status) query.status = status;
    if (planId) query.planId = planId;

    const [subs, total] = await Promise.all([
      Subscription.find(query)
        .populate('organizationId', 'name email orgType')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
      Subscription.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        subscriptions: subs,
        pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * PUT /api/v1/admin/subscriptions/:orgId/status
 * Manually set an org's subscription status (super_admin only).
 * Body: { status, planId?, gracePeriodDays? }
 */
export const setSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { status, planId, gracePeriodDays } = req.body;

    const validStatuses = ['trialing', 'active', 'past_due', 'past_due_restricted', 'canceled', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } });
    }

    if (gracePeriodDays !== undefined && (typeof gracePeriodDays !== 'number' || gracePeriodDays < 0)) {
        return res.status(400).json({ success: false, error: { message: 'gracePeriodDays must be a positive number' } });
    }

    const oldSub = await Subscription.findOne({ organizationId: orgId });
    const update: Record<string, any> = { status };
    if (planId && PLAN_LIMITS[planId as PlanId]) update.planId = planId;

    // Set grace period on past_due transition
    if (status === 'past_due') {
      const days = gracePeriodDays ?? GRACE_PERIOD_DAYS;
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + Number(days));
      update.gracePeriodEnd = gracePeriodEnd;
      update.lastPaymentFailedAt = new Date();
    } else {
      update.gracePeriodEnd = null;
    }

    const sub = await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      update,
      { new: true, upsert: true }
    );

    // --- Audit Log ---
    await writeAuditLog({
      organizationId: orgId as string,
      action: 'admin_subscription_status_update',
      resourceType: 'subscription',
      resourceId: sub._id as any,
      userId: (req as any).user.id,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      oldValues: oldSub ? { status: oldSub.status, planId: oldSub.planId } : null,
      newValues: { status: sub.status, planId: sub.planId, gracePeriodEnd: sub.gracePeriodEnd },
      metadata: { reason: 'Admin manual override' }
    });

    res.json({ success: true, data: { subscription: sub } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * PUT /api/v1/admin/subscriptions/:orgId/override
 * Toggle the election integrity override (super_admin only).
 * Body: { electionIntegrityOverride: boolean }
 */
export const setElectionIntegrityOverride = async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { electionIntegrityOverride } = req.body;

    if (typeof electionIntegrityOverride !== 'boolean') {
      return res.status(400).json({ success: false, error: { message: 'electionIntegrityOverride must be a boolean' } });
    }

    const sub = await Subscription.findOneAndUpdate(
      { organizationId: orgId },
      { electionIntegrityOverride },
      { new: true }
    );

    if (!sub) {
      return res.status(404).json({ success: false, error: { message: 'Subscription not found for this organization' } });
    }

    // --- Audit Log ---
    await writeAuditLog({
      organizationId: orgId as string,
      action: 'admin_election_integrity_override_toggle',
      resourceType: 'subscription',
      resourceId: sub._id as any,
      userId: (req as any).user.id,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      newValues: { electionIntegrityOverride: sub.electionIntegrityOverride },
      metadata: { action: electionIntegrityOverride ? 'enabled' : 'disabled' }
    });

    res.json({
      success: true,
      data: {
        message: electionIntegrityOverride
          ? 'Election integrity override ENABLED. Voting is allowed; results are gated.'
          : 'Election integrity override DISABLED.',
        electionIntegrityOverride: sub.electionIntegrityOverride,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

