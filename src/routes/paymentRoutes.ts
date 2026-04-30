import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { initiatePayment, verifyPayment, handleWebhook } from '../controllers/paymentController';

export const paymentRouter = Router();

// Public webhook route (Paystack will call this)
paymentRouter.post('/webhook', handleWebhook);

// Authenticated routes
paymentRouter.post('/initiate', authenticate, initiatePayment);
paymentRouter.get('/verify/:reference', authenticate, verifyPayment);
