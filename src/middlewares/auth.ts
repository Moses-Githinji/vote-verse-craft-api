import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: { message: 'No token provided' } });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: { message: 'Invalid token' } });
  }
};

export const requireOrgAccess = (req: Request, res: Response, next: NextFunction) => {
  const { orgType } = req.params;
  const user = (req as any).user;
  
  if (!user || !user.organization) {
     return res.status(403).json({ success: false, error: { message: 'Organization access denied' } });
  }

  if (user.organization.type !== orgType && user.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { message: 'Organization access denied for this type' } });
  }
  next();
};

export const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || !roles.includes(user.role)) {
    return res.status(403).json({ success: false, error: { message: 'Insufficient permissions' } });
  }
  next();
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      (req as any).user = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (e) {
      // ignore token error
    }
  }
  next();
};
