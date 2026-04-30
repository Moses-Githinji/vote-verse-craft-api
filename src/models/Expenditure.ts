import mongoose, { Schema, Document, Types } from 'mongoose';

export type ExpenditureCategory = 'operations' | 'marketing' | 'staff' | 'infrastructure' | 'taxes' | 'other';

export interface IExpenditure extends Document {
  description: string;
  category: ExpenditureCategory;
  amount: number;
  date: Date;
  recordedBy: Types.ObjectId; // Admin user who recorded this
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenditureSchema = new Schema(
  {
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['operations', 'marketing', 'staff', 'infrastructure', 'taxes', 'other'],
      required: true,
    },
    amount: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

expenditureSchema.index({ date: 1 });
expenditureSchema.index({ category: 1 });

export const Expenditure = mongoose.model<IExpenditure>('Expenditure', expenditureSchema);
