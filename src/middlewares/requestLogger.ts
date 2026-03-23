import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  const sanitizeBody = (body: any) => {
    if (!body) return body;
    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'passwordHash', 'token', 'refreshToken', 'authCredential'];
    
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  };

  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'Unknown',
      query: req.query,
      body: sanitizeBody(req.body),
      // If auth middleware decoded a user, log their ID
      user: (req as any).user ? (req as any).user.id : 'Unauthenticated',
    };

    // Log as info, unless it's a server error
    if (res.statusCode >= 500) {
      logger.error('API Request Error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('API Request Warning', logData);
    } else {
      logger.info('API Request', logData);
    }
  });

  next();
};
