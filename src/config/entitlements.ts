/**
 * entitlements.ts — The Single Source of Truth for plan features.
 *
 * This is a pure static config. Changing what a plan includes means
 * editing ONLY this file. No other business logic should hardcode plan names.
 */

export const PLAN_LIMITS = {
  starter: {
    maxVoters: null,
    maxActiveElections: null,
    ballotAccess: 'all' as const,
    analyticsLevel: 'ai' as const,
    branding: 'whitelabel' as const,
    offlineSupport: true,
    auditTrailPdf: true,
    maxCertificateGenerations: null,
    aiInsights: true,
    aiBallotArchitect: true,
    prioritySupport: true,
  },
  pro: {
    maxVoters: null,
    maxActiveElections: null,
    ballotAccess: 'all' as const,
    analyticsLevel: 'ai' as const,
    branding: 'whitelabel' as const,
    offlineSupport: true,
    auditTrailPdf: true,
    maxCertificateGenerations: null,
    aiInsights: true,
    aiBallotArchitect: true,
    prioritySupport: true,
  },
  enterprise: {
    maxVoters: null,
    maxActiveElections: null,
    ballotAccess: 'all' as const,
    analyticsLevel: 'ai' as const,
    branding: 'whitelabel' as const,
    offlineSupport: true,
    auditTrailPdf: true,
    maxCertificateGenerations: null,
    aiInsights: true,
    aiBallotArchitect: true,
    prioritySupport: true,
  },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;
export type PlanFeatureKey = keyof typeof PLAN_LIMITS[PlanId];
export type PlanFeatures = typeof PLAN_LIMITS[PlanId];

/** Ballot question types allowed per plan tier */
export const BALLOT_ACCESS_TYPES: Record<string, string[]> = {
  basic: ['single', 'yesno', 'multi'],
  standard: ['single', 'yesno', 'multi', 'dropdown', 'linear', 'rating', 'paragraph', 'short', 'section', 'image_block', 'video_block', 'date', 'time', 'file', 'grid_multiple', 'grid_checkbox'],
  all: ['single', 'yesno', 'multi', 'dropdown', 'linear', 'rating', 'paragraph', 'short', 'section', 'image_block', 'video_block', 'date', 'time', 'file', 'grid_multiple', 'grid_checkbox', 'ranked'],
};

/** Fallback plan used when a subscription is canceled/expired — org gets degraded to starter limits */
export const FALLBACK_PLAN_ID: PlanId = 'starter';

/** Grace period duration in days after a payment failure before hard-blocking features */
export const GRACE_PERIOD_DAYS = 5;
