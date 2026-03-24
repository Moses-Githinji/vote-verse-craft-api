import mongoose, { Schema, Document, Types } from 'mongoose';

export type ElectionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
export type BallotQuestionType = 'single' | 'multi' | 'ranked' | 'yesno';

export interface IBallotQuestion {
  id: string;
  type: BallotQuestionType;
  title: string;
  options: string[];
  allowWriteIn: boolean;
  allowNota: boolean;
  maxSelections?: number;
}

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
  ballotQuestions: IBallotQuestion[];
  settings: Map<string, any>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ballotQuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['single', 'multi', 'ranked', 'yesno'],
      required: true,
    },
    title: { type: String, required: true },
    options: { type: [String], required: true },
    allowWriteIn: { type: Boolean, default: false },
    allowNota: { type: Boolean, default: false },
    maxSelections: { type: Number },
  },
  { _id: false }
);

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
    ballotQuestions: { type: [ballotQuestionSchema], default: [] },
    settings: { type: Map, of: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

electionSchema.index({ organizationId: 1, status: 1, startDate: 1 });
electionSchema.index({ title: 'text' });

export const Election = mongoose.model<IElection>('Election', electionSchema);
