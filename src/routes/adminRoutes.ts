import { Router } from 'express';
import { authenticate, isSuperAdmin } from '../middlewares/auth';
import { Organization } from '../models/Organization';
import { Subscription } from '../models/Subscription';
import { Booking } from '../models/Booking';
import { Election } from '../models/Election';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import mongoose from 'mongoose';
import * as bookingController from '../controllers/bookingController';
import * as financeController from '../controllers/financeController';
import * as adminUserController from '../controllers/adminUserController';
import { EShopOrder } from '../models/EShopOrder';
import { OrganizationService } from '../services/OrganizationService';

export const adminRouter = Router();

// All admin routes require authentication + super_admin role
adminRouter.use(authenticate, isSuperAdmin);

// ── GET /admin/stats ─────────────────────────────────────────────────────
adminRouter.get('/stats', async (req, res, next) => {
  try {
    const [
      totalOrganizations,
      totalVotersAgg,
      activeElections,
      totalIntentSubmissions,
      totalRevenueAgg,
      recentOrganizations,
      recentBookings,
    ] = await Promise.all([
      Organization.countDocuments(),
      Subscription.aggregate([{ $group: { _id: null, total: { $sum: '$usage.voters' } } }]),
      Election.countDocuments({ status: { $in: ['active', 'live', 'upcoming', 'scheduled'] } }),
      Booking.countDocuments(),
      Booking.aggregate([{ $group: { _id: null, total: { $sum: '$quotedPrice' } } }]),
      Organization.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .then(async (orgs) => {
          const orgIds = orgs.map((o) => o._id);
          const subs = await Subscription.find({ organizationId: { $in: orgIds } }).lean();
          const subMap = Object.fromEntries(subs.map((s) => [String(s.organizationId), s]));
          return orgs.map((o) => ({ ...o, subscription: subMap[String(o._id)] || null }));
        }),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('organizationId', 'name')
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        totalOrganizations,
        totalVoters: totalVotersAgg[0]?.total ?? 0,
        activeElections,
        totalIntentSubmissions,
        totalRevenue: totalRevenueAgg[0]?.total ?? 0,
        recentOrganizations,
        recentBookings,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/organizations ──────────────────────────────────────────────
adminRouter.get('/organizations', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const orgType = String(req.query.orgType || '').trim();
    const subStatus = String(req.query.subStatus || '').trim();

    const filter: Record<string, unknown> = {};
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    if (orgType) filter.orgType = orgType;

    const [orgsList, total] = await Promise.all([
      Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Organization.countDocuments(filter),
    ]);

    // Populate subscriptions
    const orgIds = orgsList.map((o) => o._id);
    const subsFilter: Record<string, unknown> = { organizationId: { $in: orgIds } };
    if (subStatus) subsFilter.status = subStatus;
    const subs = await Subscription.find(subsFilter).lean();
    const subMap = Object.fromEntries(subs.map((s) => [String(s.organizationId), s]));

    // Filter by subStatus if provided (post-join)
    let organizations = orgsList.map((o) => ({ ...o, subscription: subMap[String(o._id)] || null }));
    if (subStatus) {
      organizations = organizations.filter((o) => o.subscription?.status === subStatus);
    }

    res.json({
      success: true,
      data: {
        organizations,
        total: subStatus ? organizations.length : total,
        page,
        totalPages: Math.ceil((subStatus ? organizations.length : total) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/organizations/:id ──────────────────────────────────────────
adminRouter.get('/organizations/:id', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id).lean();
    if (!org) return res.status(404).json({ success: false, error: { message: 'Organization not found' } });

    const [subscription, elections, bookings] = await Promise.all([
      Subscription.findOne({ organizationId: org._id }).lean(),
      Election.find({ organizationId: org._id }).sort({ startDate: -1 }).limit(10).lean(),
      Booking.find({ organizationId: org._id }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({ success: true, data: { organization: org, subscription, elections, bookings } });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /admin/organizations/bulk ────────────────────────────────────
adminRouter.delete('/organizations/bulk', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Valid "ids" array is required' });
    }
    const result = await OrganizationService.cascadeDelete(ids);
    res.json({ success: true, message: `Deleted ${result?.deletedCount} organizations and all related data` });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /admin/organizations/:id ─────────────────────────────────────
adminRouter.delete('/organizations/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await OrganizationService.cascadeDelete([id]);
    res.json({ success: true, message: 'Organization and all associated records deleted' });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /admin/organizations/:id/active ────────────────────────────────
adminRouter.patch('/organizations/:id/active', async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const org = await Organization.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!org) return res.status(404).json({ success: false, error: { message: 'Organization not found' } });
    res.json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/bookings ───────────────────────────────────────────────────
adminRouter.get('/bookings', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;
    const status = String(req.query.status || '').trim();
    const planId = String(req.query.planId || '').trim();

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (planId) filter.planId = planId;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organizationId', 'name email')
        .lean(),
      Booking.countDocuments(filter),
    ]);

    // Filter out bookings where the organization no longer exists
    const filteredBookings = bookings.filter((b: any) => b.organizationId !== null);

    res.json({
      success: true,
      data: { 
        bookings: filteredBookings, 
        total: filteredBookings.length, 
        page, 
        totalPages: Math.ceil(filteredBookings.length / limit) 
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /admin/bookings/:id/status ─────────────────────────────────────
adminRouter.patch('/bookings/:id/status', bookingController.verifyBooking);

// ── PATCH /admin/bookings/:id/price-override ──────────────────────────────
adminRouter.patch('/bookings/:id/price-override', bookingController.priceOverride);

// ── POST /admin/bookings/:id/resend-credentials ───────────────────────────
adminRouter.post('/bookings/:id/resend-credentials', bookingController.resendCredentials);

// ── PATCH /admin/bookings/:id/archive ─────────────────────────────────────
adminRouter.patch('/bookings/:id/archive', bookingController.archiveBooking);

// ── DELETE /admin/bookings/:id ──────────────────────────────────────────────
adminRouter.delete('/bookings/:id', bookingController.deleteBooking);

// ── DELETE /admin/bookings ──────────────────────────────────────────────────
adminRouter.delete('/bookings', bookingController.deleteAllBookings);

// ── GET /admin/subscriptions ──────────────────────────────────────────────
adminRouter.get('/subscriptions', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      Subscription.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organizationId', 'name email orgType')
        .lean(),
      Subscription.countDocuments(),
    ]);

    // Filter out subscriptions where the organization no longer exists
    const filteredSubscriptions = subscriptions.filter((s: any) => s.organizationId !== null);

    res.json({
      success: true,
      data: { 
        subscriptions: filteredSubscriptions, 
        total: filteredSubscriptions.length, 
        page, 
        totalPages: Math.ceil(filteredSubscriptions.length / limit) 
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/elections ──────────────────────────────────────────────────
adminRouter.get('/elections', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    const [elections, total] = await Promise.all([
      Election.find()
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organizationId', 'name orgType')
        .lean(),
      Election.countDocuments(),
    ]);

    // Enhanced population: Get booking info for each organization to determine service nature and price
    const orgIds = elections.map((el: any) => el.organizationId._id);
    const bookings = await Booking.find({ organizationId: { $in: orgIds } }).lean();
    const bookingMap = Object.fromEntries(
      orgIds.map(id => {
        const orgBookings = bookings.filter(b => String(b.organizationId) === String(id));
        // Sort by date to get most relevant or recent
        const latest = orgBookings.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        return [String(id), latest];
      })
    );

    // Map populate alias and add insights
    const mapped = elections.map((el: any) => {
      const b = bookingMap[String(el.organizationId._id)];
      return {
        ...el,
        organization: el.organizationId,
        serviceNature: b ? (b.serviceMode === 'managed' ? 'Managed Event' : 'Software Service') : 'Standard',
        totalCharged: b ? (b.quotedPrice + (b.logisticsSurcharge || 0)) : 0,
        durationDays: Math.ceil((new Date(el.endDate).getTime() - new Date(el.startDate).getTime()) / (1000 * 60 * 60 * 24))
      };
    });

    res.json({
      success: true,
      data: { elections: mapped, total, page, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/audit ──────────────────────────────────────────────────────
adminRouter.get('/audit', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(100, parseInt(String(req.query.limit || '30')));
    const skip = (page - 1) * limit;

    const searchOrg = String(req.query.searchOrg || '').trim();
    const category = String(req.query.category || '').trim();

    const filter: Record<string, any> = {};
    if (category) filter.action = { $regex: category, $options: 'i' };

    if (searchOrg) {
      const orgs = await Organization.find({ name: { $regex: searchOrg, $options: 'i' } }).select('_id');
      const orgIds = orgs.map(o => o._id);
      filter.organizationId = { $in: orgIds };
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organizationId', 'name')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // Filter out logs where the organization no longer exists
    const filteredLogs = logs.filter((l: any) => l.organizationId !== null);

    res.json({
      success: true,
      data: { 
        logs: filteredLogs, 
        total: filteredLogs.length, 
        page, 
        totalPages: Math.ceil(filteredLogs.length / limit) 
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/invoices ───────────────────────────────────────────────────
adminRouter.get('/invoices', financeController.getInvoices);

// ── GET /admin/expenditures ───────────────────────────────────────────────
adminRouter.get('/expenditures', financeController.getExpenditures);

// ── POST /admin/expenditures ──────────────────────────────────────────────
adminRouter.post('/expenditures', financeController.createExpenditure);

// ── GET /admin/financial-stats ────────────────────────────────────────────
adminRouter.get('/financial-stats', financeController.getFinancialStats);

// ── USER MANAGEMENT (Super Admin Only) ───────────────────────────────────
adminRouter.get('/users/admins', adminUserController.getAdmins);
adminRouter.post('/users/admins', adminUserController.createAdmin);
adminRouter.get('/users/moderators', adminUserController.getModerators);
adminRouter.delete('/users/:id', adminUserController.deleteUser);

// ── ESHOP ORDERS ─────────────────────────────────────────────────────────
adminRouter.get('/eshop/orders', async (req, res, next) => {
  try {
    const orders = await EShopOrder.find()
      .populate('organizationId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    
    // Filter out orders where the organization no longer exists
    const filteredOrders = orders.filter((o: any) => o.organizationId !== null);
    
    res.json({ success: true, data: filteredOrders });
  } catch (err) {
    next(err);
  }
});

