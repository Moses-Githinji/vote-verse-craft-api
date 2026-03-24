import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVote extends Document {
  electionId: Types.ObjectId;
  voterId: Types.ObjectId;
  voteData: Map<string, any>;
  ipAddress?: string;
  userAgent?: string;
  voteTimestamp: Date;
}

const voteSchema = new Schema({
  electionId: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
  voterId: { type: Schema.Types.ObjectId, ref: 'Voter', required: true },
  voteData: { type: Map, of: Schema.Types.Mixed, required: true },
  ipAddress: String,
  userAgent: String,
  voteTimestamp: { type: Date, default: Date.now },
});

voteSchema.index({ electionId: 1, voterId: 1 }, { unique: true });

export const Vote = mongoose.model<IVote>('Vote', voteSchema);
