import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { loginSchema } from '../validators/auth';
import { writeAuditLog } from '../utils/audit';

export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email }).populate('organizationId');

    if (!user || !user.isActive) {
       return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }

    const isMatch = await bcrypt.compare(validatedData.password, user.passwordHash);
    if (!isMatch) {
       return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }

    const org = user.organizationId as any;

    const payload = {
      id: user._id,
      userId: user._id,
      organizationId: org ? org._id : undefined,
      organization: org ? {
        id: org._id,
        type: org.orgType,
        name: org.name
      } : undefined,
      role: user.role,
      type: 'access'
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any
    });

    const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, process.env.JWT_REFRESH_SECRET as string, {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any
    });

    user.lastLogin = new Date();
    await user.save();

    // Write audit log
    await writeAuditLog({
      organizationId: org ? org._id : 'global',
      action: 'admin_login',
      resourceType: 'user',
      resourceId: user._id as any,
      userId: user._id as any,
      ipAddress: (req as any).ip,
      userAgent: (req as any).get('User-Agent'),
      metadata: { email: user.email, role: user.role }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          organization: payload.organization
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 86400
        }
      }
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { message: error.errors } });
    }
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
