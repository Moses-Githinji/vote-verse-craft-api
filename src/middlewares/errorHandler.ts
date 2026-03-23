import { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';
import { logAudit } from '../utils/auditLogger';

export const errorHandler: ErrorRequestHandler = async (error, req, res, next) => {
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || req.user?.voterId,
  });

  if (error.status === 401 || error.status === 403) {
    await logAudit({
      organizationId: req.user?.organizationId,
      userId: req.user?.id,
      voterId: req.user?.voterId,
      action: 'security_violation',
      resourceType: 'api',
      resourceId: req.url,
      metadata: { error: error.message, ipAddress: req.ip },
    });
  }

  const statusCode = error.status || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'An internal server error occurred'
    : error.message || 'An error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: error.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
};
