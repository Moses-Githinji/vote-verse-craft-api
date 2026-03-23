import { AuditLog } from '../models/AuditLog';
import { Types } from 'mongoose';

interface AuditParams {
  organizationId: Types.ObjectId | string;
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
    await AuditLog.create({
      organizationId: params.organizationId,
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
