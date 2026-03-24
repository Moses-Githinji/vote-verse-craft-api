import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { Organization } from '../models/Organization';

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    // Use user's organization ID from token instead of URL parameter
    const userOrgId = (req as any).userOrgId;
    const { page = 1, limit = 50, action, userId, resourceType, startDate, endDate } = req.query;

    if (!userOrgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization not found' } });
    }

    const query: any = { organizationId: userOrgId };
    
    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (resourceType) query.resourceType = resourceType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: {
        logs: logs.map(l => ({
          id: l._id,
          timestamp: l.createdAt,
          action: l.action,
          userId: l.userId,
          voterId: l.voterId,
          resourceType: l.resourceType,
          resourceId: l.resourceId,
          ipAddress: l.ipAddress,
          metadata: l.metadata
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
