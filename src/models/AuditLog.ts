import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  organizationId: Types.ObjectId;
  userId?: Types.ObjectId;
  voterId?: Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId: Types.ObjectId | string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata: Map<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    voterId: { type: Schema.Types.ObjectId, ref: 'Voter' },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.Mixed, required: true },
    oldValues: Schema.Types.Mixed,
    newValues: Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
