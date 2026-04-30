import mongoose, { Schema, Document, Types } from 'mongoose';

export type EShopOrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface IEShopOrderItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  image?: string;
}

export interface IEShopOrder extends Document {
  organizationId: Types.ObjectId;
  items: IEShopOrderItem[];
  totalAmount: number;
  currency: string;
  status: EShopOrderStatus;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
}

const eShopOrderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    items: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        currency: { type: String, required: true },
        quantity: { type: Number, required: true },
        image: { type: String },
      },
    ],
    totalAmount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'KES' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: { type: String, required: true },
  },
  { timestamps: true }
);

eShopOrderSchema.index({ organizationId: 1, createdAt: -1 });

export const EShopOrder = mongoose.model<IEShopOrder>('EShopOrder', eShopOrderSchema);
