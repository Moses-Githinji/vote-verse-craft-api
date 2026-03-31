import mongoose, { Schema, Document, Types } from 'mongoose';

export type ElectionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
export type BallotQuestionType = 
  | 'short' | 'paragraph' | 'single' | 'multi' | 'dropdown' | 'file' 
  | 'linear' | 'rating' | 'grid_multiple' | 'grid_checkbox' 
  | 'date' | 'time' | 'ranked' | 'yesno'
  | 'section' | 'image_block' | 'video_block';

export interface IBallotQuestion {
  id: string;
  type: BallotQuestionType;
  title: string;
  description?: string;
  options: string[];
  optionImages?: Record<string, string>;
  imageUrl?: string;
  videoUrl?: string;
  allowWriteIn: boolean;
  allowNota: boolean;
  maxSelections?: number;
  required?: boolean;
  linearMin?: number;
  linearMax?: number;
  linearMinLabel?: string;
  linearMaxLabel?: string;
  ratingMax?: number;
  gridRows?: string[];
  gridColumns?: string[];
  dateFormat?: 'date' | 'time' | 'datetime';
  fileTypes?: string[];
  maxFileSize?: number;
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
      enum: ['short', 'paragraph', 'single', 'multi', 'dropdown', 'file', 'linear', 'rating', 'grid_multiple', 'grid_checkbox', 'date', 'time', 'ranked', 'yesno', 'section', 'image_block', 'video_block'],
      required: true,
    },
    title: { type: String, required: false },
    description: String,
    options: { type: [String], default: [] },
    optionImages: { type: Map, of: String },
    imageUrl: String,
    videoUrl: String,
    allowWriteIn: { type: Boolean, default: false },
    allowNota: { type: Boolean, default: false },
    maxSelections: Number,
    required: Boolean,
    linearMin: Number,
    linearMax: Number,
    linearMinLabel: String,
    linearMaxLabel: String,
    ratingMax: Number,
    gridRows: [String],
    gridColumns: [String],
    dateFormat: { type: String, enum: ['date', 'time', 'datetime'] },
    fileTypes: [String],
    maxFileSize: Number,
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
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

electionSchema.virtual('inConfig').get(function() {
  return this.status === 'draft';
});

electionSchema.index({ organizationId: 1, status: 1, startDate: 1 });
electionSchema.index({ title: 'text' });

export const Election = mongoose.model<IElection>('Election', electionSchema);
