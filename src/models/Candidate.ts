import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICandidate extends Document {
  electionId: Types.ObjectId;
  name: string;
  description?: string;
  manifesto?: string;
  imageUrl?: string;
  candidateMetadata: Map<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const candidateSchema = new Schema(
  {
    electionId: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
    name: { type: String, required: true },
    description: String,
    manifesto: String,
    imageUrl: String,
    candidateMetadata: { type: Map, of: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Candidate = mongoose.model<ICandidate>('Candidate', candidateSchema);
