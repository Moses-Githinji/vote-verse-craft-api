import { Router } from 'express';
import { authenticate, requireRole, requireOrgAccess } from '../middlewares/auth';
import { initiatePayment, verifyPayment, handleWebhook, getAccountLockStatus } from '../controllers/paymentController';

export const paymentRouter = Router();

// Public webhook route (Paystack will call this)
paymentRouter.post('/webhook', handleWebhook);

// Authenticated routes
paymentRouter.get('/lock-status', authenticate, requireOrgAccess, getAccountLockStatus);
paymentRouter.post('/initiate', authenticate, requireOrgAccess, initiatePayment);
paymentRouter.get('/verify/:reference', authenticate, requireOrgAccess, verifyPayment);
