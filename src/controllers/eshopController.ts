import { Request, Response, NextFunction } from 'express';
import { EShopOrder } from '../models/EShopOrder';
import { writeAuditLog } from '../utils/audit';
import mongoose from 'mongoose';

/**
 * POST /eshop/orders
 * Create a new EShop order
 */
export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, totalAmount, currency, paymentMethod } = req.body;
    const orgId = (req as any).user?.organizationId || (req as any).userOrgId || (req as any).user?.organization?.id;

    if (!orgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization ID required' } });
    }

    const organizationId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;

    const order = new EShopOrder({
      organizationId,
      items,
      totalAmount,
      currency: currency || 'KES',
      paymentMethod,
      status: 'pending'
    });

    await order.save();

    // Audit log
    await writeAuditLog({
      organizationId: organizationId as any,
      action: 'create_eshop_order',
      resourceType: 'eshop_order',
      resourceId: order._id as any,
      userId: (req as any).user?.id,
      metadata: { totalAmount, itemsCount: items.length }
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /eshop/orders
 * List orders for the current organization
 */
export const getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.organizationId || (req as any).userOrgId || (req as any).user?.organization?.id;
    if (!orgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization ID required' } });
    }

    const queryOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;

    const orders = await EShopOrder.find({ organizationId: queryOrgId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /eshop/orders/:id
 * Get a single order by ID
 */
export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organizationId || (req as any).userOrgId || (req as any).user?.organization?.id;

    if (!orgId) {
      return res.status(403).json({ success: false, error: { message: 'Organization ID required' } });
    }

    const queryOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;

    const order = await EShopOrder.findOne({ _id: id, organizationId: queryOrgId }).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    }

    // Map to a format compatible with InvoiceData if needed, 
    // or just return the order. The frontend will handle mapping.
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};
