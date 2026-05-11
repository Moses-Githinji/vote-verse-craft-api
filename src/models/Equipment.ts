import mongoose, { Schema, Document } from 'mongoose';

export interface IEquipment extends Document {
  name: string;
  description?: string;
  quantity: number;
  dailyRate?: number;
  currency: string;
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const equipmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0 },
    dailyRate: { type: Number, min: 0 },
    currency: { type: String, required: true, default: 'USD' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Indexes: name for quick lookup, text index for search, createdAt for sorting
equipmentSchema.index({ name: 1 });
equipmentSchema.index({ name: 'text', description: 'text' });
equipmentSchema.index({ createdAt: -1 });

export const Equipment = mongoose.model<IEquipment>('Equipment', equipmentSchema);
