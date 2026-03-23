import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  orgType: 'school' | 'sacco' | 'church' | 'political';
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  settings: Map<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema(
  {
    orgType: {
      type: String,
      enum: ['school', 'sacco', 'church', 'political'],
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    phone: String,
    address: String,
    settings: { type: Map, of: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
