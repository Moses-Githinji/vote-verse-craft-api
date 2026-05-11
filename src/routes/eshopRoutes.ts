import { Router } from 'express';
import { authenticate, requireOrgAccess } from '../middlewares/auth';
import * as eshopController from '../controllers/eshopController';

export const eshopRouter = Router();

// All eshop routes require authentication and organization context
eshopRouter.use(authenticate, requireOrgAccess);

eshopRouter.post('/orders', eshopController.createOrder);
eshopRouter.get('/orders', eshopController.getMyOrders);
eshopRouter.get('/orders/:id', eshopController.getOrderById);

