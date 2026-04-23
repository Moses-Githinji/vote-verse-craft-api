import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryConfig extends Document {
  totalBooths: number;
  totalTechnicians: number;
  bufferDays: number; // For teardown/setup
  updatedAt: Date;
}

const inventoryConfigSchema = new Schema(
  {
    totalBooths: { type: Number, required: true, default: 20 },
    totalTechnicians: { type: Number, required: true, default: 5 },
    bufferDays: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

// We only ever want one document of this type
export const InventoryConfig = mongoose.model<IInventoryConfig>('InventoryConfig', inventoryConfigSchema);
