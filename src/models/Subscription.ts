import mongoose, { Schema, Document, Types } from 'mongoose';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'past_due_restricted'
  | 'canceled'
  | 'expired';

export interface ISubscription extends Document {
  organizationId: Types.ObjectId;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  gracePeriodEnd: Date | null;
  customGracePeriod: number | null;
  usage: {
    voters: number;
    activeElections: number;
  };
  trialEndsAt: Date | null;
  /** When true, voting is allowed even if subscription is past_due_restricted.
   *  Results/reports remain gated until payment is cleared. */
  electionIntegrityOverride: boolean;
  cancelAtPeriodEnd: boolean;
  externalPaymentId: string | null; // future Stripe/Paystack customer ID
  lastPaymentFailedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    planId: { type: String, required: true, default: 'starter' },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'past_due_restricted', 'canceled', 'expired'],
      default: 'active',
    },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    gracePeriodEnd: { type: Date, default: null },
    customGracePeriod: { type: Number, default: null },
    usage: {
      voters: { type: Number, default: 0 },
      activeElections: { type: Number, default: 0 },
    },
    trialEndsAt: { type: Date, default: null },
    electionIntegrityOverride: { type: Boolean, default: false },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    externalPaymentId: { type: String, default: null },
    lastPaymentFailedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
