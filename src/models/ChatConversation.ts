import mongoose, { Schema, Document, Types } from 'mongoose';

export type ChatConversationStatus = 'open' | 'waiting_for_agent' | 'assigned' | 'closed';

export interface IChatConversation extends Document {
  status: ChatConversationStatus;
  assignedAgentId?: Types.ObjectId;
  assignedAgentName?: string;
  visitor: {
    sessionId: string;
    name?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const chatConversationSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['open', 'waiting_for_agent', 'assigned', 'closed'],
      default: 'open',
      required: true,
    },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    assignedAgentName: { type: String, required: false },
    visitor: {
      sessionId: { type: String, required: true, index: true },
      name: { type: String, required: false },
      email: { type: String, required: false },
      ipAddress: { type: String, required: false },
      userAgent: { type: String, required: false },
    },
  },
  { timestamps: true },
);

chatConversationSchema.index({ status: 1, updatedAt: -1 });

export const ChatConversation = mongoose.model<IChatConversation>(
  'ChatConversation',
  chatConversationSchema,
);

