import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVoter extends Document {
  organizationId: Types.ObjectId;
  name: string;
  authCredential: string;
  studentId?: string;
  stream?: string;
  email?: string;
  phone?: string;
  voterMetadata: Map<string, any>;
  isActive: boolean;
  hasVoted: boolean;
  votedAt?: Date;
  voteSessionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const voterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true },
    authCredential: { type: String, required: true },
    studentId: String,
    stream: String,
    email: String,
    phone: String,
    voterMetadata: { type: Map, of: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    hasVoted: { type: Boolean, default: false },
    votedAt: Date,
    voteSessionId: Schema.Types.ObjectId,
  },
  { timestamps: true }
);

voterSchema.index({ organizationId: 1, authCredential: 1 }, { unique: true });
voterSchema.index({ name: 'text' });

export const Voter = mongoose.model<IVoter>('Voter', voterSchema);
