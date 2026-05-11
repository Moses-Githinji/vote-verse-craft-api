import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Equipment } from '../models/Equipment';
import { writeAuditLog } from '../utils/audit';

const CURRENCIES = ['USD', 'KES', 'EUR'];

function errorResponse(res: Response, status: number, message: string, errMsg?: string) {
  return res
    .status(status)
    .json({ success: false, message, error: { message: errMsg || message } });
}

export const listEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(200, parseInt(String(req.query.limit || '100')));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();

    const filter: any = { isArchived: false };
    if (search) filter.$text = { $search: search };

    const [items, total] = await Promise.all([
      Equipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Equipment.countDocuments(filter),
    ]);

    return res.json({ success: true, data: { items, total, page, limit } });
  } catch (err: any) {
    next(err);
  }
};

export const getEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 404, 'Equipment not found');

    const item = await Equipment.findById(id).lean();
    if (!item) return errorResponse(res, 404, 'Equipment not found');

    return res.json({ success: true, data: item });
  } catch (err: any) {
    next(err);
  }
};

export const createEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, quantity, dailyRate, currency } = req.body;
    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse(res, 400, 'Validation failed', 'Name is required');
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      return errorResponse(res, 400, 'Validation failed', 'Quantity must be an integer >= 0');
    }
    if (dailyRate !== undefined && (typeof dailyRate !== 'number' || dailyRate < 0)) {
      return errorResponse(res, 400, 'Validation failed', 'dailyRate must be a number >= 0');
    }
    const curr = currency || 'USD';
    if (!CURRENCIES.includes(curr)) {
      return errorResponse(res, 400, 'Validation failed', `Unsupported currency: ${curr}`);
    }

    const equipment = new Equipment({
      name: name.trim(),
      description,
      quantity: qty,
      dailyRate,
      currency: curr,
    });
    await equipment.save();

    await writeAuditLog({
      organizationId: (req as any).userOrgId || (req as any).user?.organization?.id,
      action: 'create_equipment',
      resourceType: 'equipment',
      resourceId: equipment._id as any,
      userId: (req as any).user?.id,
      metadata: { name: equipment.name, quantity: equipment.quantity },
    });

    return res.status(201).json({ success: true, data: equipment });
  } catch (err: any) {
    next(err);
  }
};
export const updateEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 404, 'Equipment not found');

    const patch: any = {};
    const allowed = ['name', 'description', 'quantity', 'dailyRate', 'currency', 'isArchived'];
    for (const k of allowed) {
      if (k in req.body) patch[k] = req.body[k];
    }

    if (
      patch.name !== undefined &&
      (typeof patch.name !== 'string' || patch.name.trim().length === 0)
    ) {
      return errorResponse(res, 400, 'Validation failed', 'Name must be a non-empty string');
    }
    if (patch.quantity !== undefined) {
      const q = Number(patch.quantity);
      if (!Number.isInteger(q) || q < 0)
        return errorResponse(res, 400, 'Validation failed', 'Quantity must be integer >= 0');
      patch.quantity = q;
    }
    if (patch.dailyRate !== undefined) {
      const dr = Number(patch.dailyRate);
      if (isNaN(dr) || dr < 0)
        return errorResponse(res, 400, 'Validation failed', 'dailyRate must be number >= 0');
      patch.dailyRate = dr;
    }
    if (patch.currency !== undefined && !CURRENCIES.includes(patch.currency)) {
      return errorResponse(
        res,
        400,
        'Validation failed',
        `Unsupported currency: ${patch.currency}`,
      );
    }

    const updated = await Equipment.findByIdAndUpdate(id, patch, { new: true }).lean();
    if (!updated) return errorResponse(res, 404, 'Equipment not found');

    await writeAuditLog({
      organizationId: (req as any).userOrgId || (req as any).user?.organization?.id,
      action: 'update_equipment',
      resourceType: 'equipment',
      resourceId: id as any,
      userId: (req as any).user?.id,
      metadata: { changes: patch },
    });

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    next(err);
  }
};
export const deleteEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 404, 'Equipment not found');

    // Business rule: prevent deletion if active bookings reference this equipment
    // For now, implement soft delete by setting isArchived = true
    const existing = await Equipment.findById(id);
    if (!existing) return errorResponse(res, 404, 'Equipment not found');

    existing.isArchived = true;
    await existing.save();

    await writeAuditLog({
      organizationId: (req as any).userOrgId || (req as any).user?.organization?.id,
      action: 'delete_equipment',
      resourceType: 'equipment',
      resourceId: id as any,
      userId: (req as any).user?.id,
      metadata: { id },
    });

    return res.json({ success: true, data: { id } });
  } catch (err: any) {
    next(err);
  }
};
