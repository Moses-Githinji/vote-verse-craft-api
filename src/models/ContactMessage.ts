import mongoose, { Document, Schema } from 'mongoose';

export interface IContactMessage extends Document {
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ContactMessage = mongoose.model<IContactMessage>('ContactMessage', contactMessageSchema);
