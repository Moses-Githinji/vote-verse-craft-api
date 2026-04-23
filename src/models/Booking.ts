import mongoose, { Schema, Document, Types } from 'mongoose';

export type BookingStatus = 'pending_verification' | 'confirmed' | 'cancelled' | 'completed';

export interface IBooking extends Document {
  organizationId: Types.ObjectId;
  planId: 'starter' | 'standard' | 'premium';
  startDate: Date;   // The day of the election
  endDate: Date;     // The day the election ends
  setupDate: Date;   // Buffer: typically startDate - 1
  teardownDate: Date; // Buffer: typically endDate + 1
  boothsRequested: number;
  staffRequested: number;
  status: BookingStatus;
  
  // New Intent Questionnaire fields
  location: string;
  serviceMode: 'self_service' | 'managed';
  voterCount: number;
  infrastructureInfo: {
    hasReliablePower: boolean;
    hasCellularData: boolean;
    specialRequirements?: string;
  };
  logisticsSurcharge: number;
  quotedPrice: number;

  // Throughput Metadata
  projectedDurationMinutes?: number;
  throughputStress?: 'low' | 'moderate' | 'high' | 'critical';

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    planId: {
      type: String,
      enum: ['starter', 'standard', 'premium'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    setupDate: { type: Date, required: true },
    teardownDate: { type: Date, required: true },
    boothsRequested: { type: Number, required: true },
    staffRequested: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: ['pending_verification', 'confirmed', 'cancelled', 'completed'],
      default: 'pending_verification',
    },
    
    // New Intent fields
    location: { type: String, required: true },
    serviceMode: { 
      type: String, 
      enum: ['self_service', 'managed'], 
      required: true,
      default: 'self_service'
    },
    voterCount: { type: Number, required: true },
    infrastructureInfo: {
      hasReliablePower: { type: Boolean, default: true },
      hasCellularData: { type: Boolean, default: true },
      specialRequirements: { type: String }
    },
    logisticsSurcharge: { type: Number, default: 0 },
    quotedPrice: { type: Number, default: 0 },

    projectedDurationMinutes: { type: Number },
    throughputStress: { 
      type: String, 
      enum: ['low', 'moderate', 'high', 'critical'] 
    },

    notes: { type: String },
  },
  { timestamps: true }
);

// Index for availability lookups: find overlapping bookings
bookingSchema.index({ status: 1, setupDate: 1, teardownDate: 1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
