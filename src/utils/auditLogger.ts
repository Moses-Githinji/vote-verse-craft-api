import { AuditLog } from '../models/AuditLog';

interface AuditLogOptions {
  organizationId: any;
  userId?: any;
  voterId?: any;
  action: string;
  resourceType: string;
  resourceId: any;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export const logAudit = async (options: AuditLogOptions) => {
  try {
    await AuditLog.create(options);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
