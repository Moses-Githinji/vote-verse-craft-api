import { Router } from 'express';
import { authenticate, isSuperAdmin, requireRole } from '../middlewares/auth';
import * as adminEquipmentController from '../controllers/adminEquipmentController';

export const adminEquipmentRouter = Router();

// All admin equipment routes require authentication
adminEquipmentRouter.use(authenticate);

// List & Get: require admin or higher
adminEquipmentRouter.get(
  '/',
  requireRole(['admin', 'super_admin']),
  adminEquipmentController.listEquipment,
);
adminEquipmentRouter.get(
  '/:id',
  requireRole(['admin', 'super_admin']),
  adminEquipmentController.getEquipment,
);

// Create/Update/Delete: require super_admin
adminEquipmentRouter.post('/', isSuperAdmin, adminEquipmentController.createEquipment);
adminEquipmentRouter.patch('/:id', isSuperAdmin, adminEquipmentController.updateEquipment);
adminEquipmentRouter.delete('/:id', isSuperAdmin, adminEquipmentController.deleteEquipment);
