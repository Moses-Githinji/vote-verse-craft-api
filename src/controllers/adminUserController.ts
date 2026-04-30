import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User, Admin, Moderator } from '../models/User';
import { Organization } from '../models/Organization';
import { Subscription } from '../models/Subscription';
import { writeAuditLog } from '../utils/audit';
import mongoose from 'mongoose';

/**
 * GET /admin/users/admins
 * List all admin users with their organizations and subscriptions
 */
export const getAdmins = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admins = await Admin.find()
      .populate('organizationId')
      .sort({ createdAt: -1 })
      .lean();

    // Map to include subscription info
    const orgIds = admins.map(a => a.organizationId._id);
    const subs = await Subscription.find({ organizationId: { $in: orgIds } }).lean();
    const subMap = Object.fromEntries(subs.map(s => [String(s.organizationId), s]));

    const data = admins.map(admin => ({
      ...admin,
      organization: admin.organizationId,
      subscription: subMap[String(admin.organizationId._id)] || null
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/users/admins
 * Create a new admin user and a corresponding organization
 */
export const createAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { email, password, firstName, lastName, orgName, orgType } = req.body;

    // 1. Create Organization
    const organization = new Organization({
      name: orgName,
      email: email, // Default org email to admin email
      orgType: orgType || 'other',
      isActive: true
    });
    await organization.save({ session });

    // 2. Create Subscription (Free Tier by default)
    const subscription = new Subscription({
      organizationId: organization._id,
      planId: 'starter',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    await subscription.save({ session });

    // 3. Create Admin User
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = new Admin({
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'admin',
      organizationId: organization._id,
      isActive: true
    });
    await admin.save({ session });

    await session.commitTransaction();

    // Audit log
    await writeAuditLog({
      organizationId: 'global',
      action: 'create_admin',
      resourceType: 'user',
      resourceId: admin._id as any,
      userId: (req as any).user?.id,
      metadata: { email, orgName }
    });

    res.status(201).json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName
        },
        organization: {
          id: organization._id,
          name: organization.name
        }
      }
    });

  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * GET /admin/users/moderators
 * List all moderator users across organizations
 */
export const getModerators = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const moderators = await Moderator.find()
      .populate('organizationId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: moderators });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /admin/users/:id
 * Delete a user account (soft delete or hard delete based on policy)
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    await writeAuditLog({
      organizationId: 'global',
      action: 'delete_user',
      resourceType: 'user',
      resourceId: user._id as any,
      userId: (req as any).user?.id,
      metadata: { deletedEmail: user.email, roleValue: user.role }
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
