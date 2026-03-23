import mongoose, { Schema, Document, Types } from 'mongoose';

export type ElectionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface IElection extends Document {
  organizationId: Types.ObjectId;
  title: string;
  description?: string;
  electionType: string;
  votingMethod: string;
  status: ElectionStatus;
  startDate: Date;
  endDate: Date;
  timezone: string;
  settings: Map<string, any>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const electionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    title: { type: String, required: true },
    description: String,
    electionType: { type: String, required: true },
    votingMethod: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'],
      default: 'draft',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },
    settings: { type: Map, of: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

electionSchema.index({ organizationId: 1, status: 1, startDate: 1 });
electionSchema.index({ title: 'text' });

export const Election = mongoose.model<IElection>('Election', electionSchema);
