import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBaseUser extends Document {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'moderator';
  isActive: boolean;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrgUser extends IBaseUser {
  organizationId: Types.ObjectId;
}

export interface ISuperAdmin extends IBaseUser {
  role: 'super_admin';
}

export interface IAdmin extends IOrgUser {
  role: 'admin';
}

export interface IModerator extends IOrgUser {
  role: 'moderator';
}

// Union type for general usage
export type IUser = ISuperAdmin | IAdmin | IModerator;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'admin', 'moderator'], default: 'admin', required: true },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  { 
    discriminatorKey: 'role', 
    timestamps: true 
  }
);

// Base Model
export const User = mongoose.model<IBaseUser>('User', userSchema);

// specialized discriminator schemas
const orgUserSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true }
});

// Discriminator models
export const Admin = User.discriminator<IAdmin>('admin', orgUserSchema);
export const Moderator = User.discriminator<IModerator>('moderator', orgUserSchema);
export const SuperAdmin = User.discriminator<ISuperAdmin>('super_admin', new Schema({}));

