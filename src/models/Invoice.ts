import mongoose, { Schema, Document, Types } from 'mongoose';

export type InvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'void' | 'refunded';

export interface IInvoice extends Document {
  organizationId: Types.ObjectId;
  bookingId?: Types.ObjectId; // Optional: invoice may not be tied to a booking
  externalId?: string; // e.g. INV-2026-001
  totalAmount: number;
  amountPaid: number;
  status: InvoiceStatus;
  dueDate: Date;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    externalId: { type: String },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'unpaid', 'partially_paid', 'paid', 'overdue', 'void', 'refunded'],
      default: 'unpaid',
    },
    dueDate: { type: Date, required: true },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

invoiceSchema.index({ status: 1 });
invoiceSchema.index({ organizationId: 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
