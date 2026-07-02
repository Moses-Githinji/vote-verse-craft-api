import mongoose, { Schema, Document, Types } from 'mongoose';

export type ChatSenderType = 'visitor' | 'agent' | 'system';

export interface IChatMessage extends Document {
  conversationId: Types.ObjectId;
  senderType: ChatSenderType;
  senderId?: Types.ObjectId | string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
    senderType: { type: String, enum: ['visitor', 'agent', 'system'], required: true },
    senderId: { type: Schema.Types.Mixed, required: false },
    text: { type: String, required: true },
  },
  { timestamps: true },
);

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);

