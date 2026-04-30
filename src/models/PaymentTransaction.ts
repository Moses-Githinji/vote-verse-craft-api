import mongoose, { Schema, Document, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'reversed';
export type PaymentTargetType = 'booking' | 'eshop_order' | 'subscription';

export interface IPaymentTransaction extends Document {
  organizationId: Types.ObjectId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  reference: string; // Unique reference from Paystack
  provider: 'paystack';
  targetType: PaymentTargetType;
  targetId: Types.ObjectId; // ID of the Booking or EShopOrder
  metadata: any;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentTransactionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'KES' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'reversed'],
      default: 'pending',
    },
    reference: { type: String, required: true, unique: true },
    provider: { type: String, enum: ['paystack'], default: 'paystack' },
    targetType: {
      type: String,
      enum: ['booking', 'eshop_order', 'subscription'],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ organizationId: 1 });
paymentTransactionSchema.index({ status: 1 });

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  paymentTransactionSchema
);
