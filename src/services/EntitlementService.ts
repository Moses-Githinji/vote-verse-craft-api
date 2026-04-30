import { Subscription, SubscriptionStatus } from '../models/Subscription';
import { Election } from '../models/Election';
import { Voter } from '../models/Voter';
import { Vote } from '../models/Vote';
import { PLAN_LIMITS, FALLBACK_PLAN_ID, GRACE_PERIOD_DAYS, PlanId, PlanFeatureKey } from '../config/entitlements';

export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null; // null = unlimited
  currentPlan: PlanId;
  requiredPlan?: PlanId;
}

export interface EntitlementResult {
  allowed: boolean;
  currentPlan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  /** True if within grace period — feature is allowed but payment warning should surface */
  warning: boolean;
  warningMessage?: string;
}

export class EntitlementService {
  /**
   * Resolves the effective plan features for an org, accounting for grace periods
   * and degraded states (canceled/expired → starter).
   */
  static async getEffectivePlan(orgId: string): Promise<{
    planId: PlanId;
    features: typeof PLAN_LIMITS[PlanId];
    status: SubscriptionStatus;
    warning: boolean;
    warningMessage?: string;
    electionIntegrityOverride: boolean;
  }> {
    let sub = await Subscription.findOne({ organizationId: orgId });

    if (!sub) {
      // No subscription record — create a default starter subscription on-the-fly
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1); // 1-year default
      sub = await Subscription.create({
        organizationId: orgId,
        planId: 'starter',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
    }

    const now = new Date();
    let effectivePlanId = (sub.planId as PlanId) || 'enterprise';
    let status: SubscriptionStatus = 'active'; // Always active as per one-off payment model
    let warning = false;
    let warningMessage: string | undefined;

    // --- Grace period and degradation logic bypassed for one-off model ---

    // --- Validate planId exists in config (safety net) ---
    if (!PLAN_LIMITS[effectivePlanId]) {
      effectivePlanId = FALLBACK_PLAN_ID;
    }

    return {
      planId: effectivePlanId,
      features: PLAN_LIMITS[effectivePlanId],
      status,
      warning,
      warningMessage,
      electionIntegrityOverride: sub.electionIntegrityOverride,
    };
  }

  /**
   * Check if an org has access to a boolean feature gate.
   */
  static async canUse(orgId: string, featureKey: PlanFeatureKey): Promise<EntitlementResult> {
    const { planId, features, status, warning, warningMessage } = await this.getEffectivePlan(orgId);

    // Hard block for restricted statuses on non-mission-critical features
    if (status === 'past_due_restricted') {
      return {
        allowed: false,
        currentPlan: planId,
        subscriptionStatus: status,
        warning: true,
        warningMessage: 'Your subscription payment is overdue. Please update your payment to restore access.',
      };
    }

    const allowed = Boolean((features as any)[featureKey]);
    return { allowed, currentPlan: planId, subscriptionStatus: status, warning, warningMessage };
  }

  /**
   * Check if an org can add one more of a resource (voters or active elections).
   * Returns allowed=true if under the limit (or limit is null = unlimited).
   */
  static async checkUsage(orgId: string, resource: 'voters' | 'active_elections'): Promise<UsageCheckResult> {
    const { planId, features, status } = await this.getEffectivePlan(orgId);

    // past_due_restricted: block new resource creation
    if (status === 'past_due_restricted') {
      const sub = await Subscription.findOne({ organizationId: orgId });
      const current = sub ? (resource === 'voters' ? sub.usage.voters : sub.usage.activeElections) : 0;
      return { allowed: false, current, limit: 0, currentPlan: planId };
    }

    const limit = resource === 'voters' ? features.maxVoters : features.maxActiveElections;
    const usageField = resource === 'voters' ? 'usage.voters' : 'usage.activeElections';

    // Atomic update with condition: only increment if under limit
    const filter: any = { organizationId: orgId };
    if (limit !== null) {
      filter[usageField] = { $lt: limit };
    }

    const updatedSub = await Subscription.findOneAndUpdate(
      filter,
      { $inc: { [usageField]: 1 } },
      { new: true }
    );

    if (!updatedSub) {
      // Limit reached or sub not found
      const sub = await Subscription.findOne({ organizationId: orgId });
      const current = sub ? (resource === 'voters' ? sub.usage.voters : sub.usage.activeElections) : 0;
      
      let requiredPlan: PlanId | undefined;
      const planOrder: PlanId[] = ['starter', 'pro', 'enterprise'];
      for (const pid of planOrder) {
        const pf = PLAN_LIMITS[pid];
        const pLimit = resource === 'voters' ? pf.maxVoters : pf.maxActiveElections;
        if (pLimit === null || (limit !== null && pLimit > limit)) {
          requiredPlan = pid;
          break;
        }
      }

      return { allowed: false, current, limit, currentPlan: planId, requiredPlan };
    }

    const current = resource === 'voters' ? updatedSub.usage.voters : updatedSub.usage.activeElections;
    return { allowed: true, current, limit, currentPlan: planId };
  }

  /**
   * Results Gate: determines if an org can view election results.
   * If electionIntegrityOverride is true and subscription is restricted,
   * returns partial preview data instead of full results.
   */
  static async canViewResults(orgId: string, electionId: string): Promise<{
    allowed: boolean;
    partial: boolean;
    previewData?: object;
  }> {
    const { status, electionIntegrityOverride } = await this.getEffectivePlan(orgId);

    const isRestricted = status === 'past_due_restricted' || status === 'canceled' || status === 'expired';

    if (!isRestricted) {
      return { allowed: true, partial: false };
    }

    // Election integrity override: election ran, but results are gated
    if (electionIntegrityOverride) {
      // Build a minimal, non-revealing preview
      const election = await Election.findById(electionId).select('organizationId title status');
      if (!election || election.organizationId.toString() !== orgId) {
        return { allowed: false, partial: false };
      }
      const totalVoters = await Voter.countDocuments({ organizationId: orgId, isActive: true });
      const votesCast = await Vote.countDocuments({ electionId });
      const turnoutPercent = totalVoters > 0 ? Math.round((votesCast / totalVoters) * 10000) / 100 : 0;

      return {
        allowed: false,
        partial: true,
        previewData: {
          totalVoters,
          votesCast,
          turnoutPercent,
          disputeCount: 0,
          message:
            'Your election completed successfully and all votes are safely recorded. ' +
            'Clear your outstanding balance to unlock the full results and audit report.',
        },
      };
    }

    // Fully locked — no override, no preview
    return { allowed: false, partial: false };
  }
}
