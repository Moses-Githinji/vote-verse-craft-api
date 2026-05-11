import { AuditLog } from '../models/AuditLog';
import mongoose, { Types } from 'mongoose';

interface AuditParams {
  organizationId?: Types.ObjectId | string;
  action: string;
  resourceType: string;
  resourceId: Types.ObjectId | string;
  userId?: Types.ObjectId | string;
  voterId?: Types.ObjectId | string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: Record<string, any>;
}

export const writeAuditLog = async (params: AuditParams): Promise<void> => {
  try {
    // Skip DB-backed audit writes in test environment to avoid needing a Mongo connection
    if (process.env.NODE_ENV === 'test') return;

    const isObjectId = (id: any) => id && mongoose.isValidObjectId(id);
    const validOrgId = isObjectId(params.organizationId) ? params.organizationId : undefined;

    await AuditLog.create({
      organizationId: validOrgId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      userId: params.userId,
      voterId: params.voterId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      oldValues: params.oldValues,
      newValues: params.newValues,
      metadata: params.metadata || {},
    });
  } catch (err) {
    // Audit log failure should never crash the main request
    console.error('[AuditLog] Failed to write audit log:', err);
  }
};
