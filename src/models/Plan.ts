import mongoose, { Schema, Document } from 'mongoose';

export type BallotAccess = 'basic' | 'standard' | 'all';
export type AnalyticsLevel = 'summary' | 'detailed' | 'ai';
export type BrandingLevel = 'voteverse' | 'custom_logo' | 'whitelabel';

export interface IPlanFeatures {
  maxVoters: number | null;          // null = unlimited
  maxActiveElections: number | null; // null = unlimited
  ballotAccess: BallotAccess;
  analyticsLevel: AnalyticsLevel;
  branding: BrandingLevel;
  offlineSupport: boolean;
  auditTrailPdf: boolean;
  aiInsights: boolean;
  prioritySupport: boolean;
}

export interface IPlan extends Document {
  planId: string;
  name: string;
  description: string;
  features: IPlanFeatures;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const planFeaturesSchema = new Schema(
  {
    maxVoters: { type: Number, default: null },
    maxActiveElections: { type: Number, default: null },
    ballotAccess: { type: String, enum: ['basic', 'standard', 'all'], default: 'basic' },
    analyticsLevel: { type: String, enum: ['summary', 'detailed', 'ai'], default: 'summary' },
    branding: { type: String, enum: ['voteverse', 'custom_logo', 'whitelabel'], default: 'voteverse' },
    offlineSupport: { type: Boolean, default: false },
    auditTrailPdf: { type: Boolean, default: false },
    aiInsights: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
  },
  { _id: false }
);

const planSchema = new Schema(
  {
    planId: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    features: { type: planFeaturesSchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Plan = mongoose.model<IPlan>('Plan', planSchema);
