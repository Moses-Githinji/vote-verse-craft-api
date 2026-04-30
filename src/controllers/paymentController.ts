import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import { EShopOrder } from '../models/EShopOrder';
import { PaymentTransaction } from '../models/PaymentTransaction';
import { Organization } from '../models/Organization';
import { 
  initializePaystackTransaction, 
  verifyPaystackTransaction, 
  verifyPaystackSignature,
  PAYSTACK_PUBLIC_KEY
} from '../utils/paystack';
import { PaymentService } from '../services/PaymentService';
import { logger } from '../utils/logger';
import { writeAuditLog } from '../utils/audit';

/**
 * POST /api/v1/payments/initiate
 * Initiate a payment for a Booking, EShop order, or Subscription
 */
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const { targetType, targetId, callbackUrl } = req.body;
    const organizationId = (req as any).userOrgId;

    if (!targetType || !targetId) {
      return res.status(400).json({ success: false, message: 'targetType and targetId are required' });
    }

    let amount = 0;
    let email = '';
    let metadata: any = { targetType, targetId, organizationId, callback_url: callbackUrl };

    const org = await Organization.findById(organizationId);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }
    email = org.email;

    if (targetType === 'booking') {
      const booking = await Booking.findById(targetId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      amount = booking.quotedPrice;
      metadata.bookingId = targetId;
    } else if (targetType === 'eshop_order') {
      const order = await EShopOrder.findById(targetId);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      amount = order.totalAmount;
      metadata.orderId = targetId;
    } else if (targetType === 'subscription') {
      // targetId here is the planId (pro, enterprise)
      const planPrices: Record<string, number> = {
        'pro': 12000,
        'enterprise': 45000
      };
      
      amount = planPrices[targetId as string] || 0;
      metadata.planId = targetId;
      
      if (amount <= 0) {
        return res.status(400).json({ success: false, message: `Invalid plan ID: ${targetId}` });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid targetType' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    // Reference format: VV-[targetType]-[timestamp]-[random]
    const reference = `VV-${targetType.substring(0, 1).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const paystackResponse = await initializePaystackTransaction(
      email,
      amount,
      reference,
      metadata
    );

    if (paystackResponse.status) {
      // Create transaction record
      await PaymentTransaction.create({
        organizationId,
        amount,
        currency: 'KES',
        status: 'pending',
        reference,
        provider: 'paystack',
        targetType,
        targetId: targetType === 'subscription' ? organizationId : targetId, // Use orgId as targetId for subscriptions
        metadata
      });

      return res.status(200).json({
        success: true,
        data: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          reference,
          publicKey: PAYSTACK_PUBLIC_KEY
        }
      });
    } else {
      throw new Error(paystackResponse.message || 'Failed to initialize Paystack');
    }
  } catch (error: any) {
    logger.error('Payment initiation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v1/payments/verify/:reference
 * Manual verification of a payment
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const reference = req.params.reference as string;
    const paystackData = await verifyPaystackTransaction(reference);

    if (paystackData.status && paystackData.data.status === 'success') {
      const transaction = await PaymentTransaction.findOne({ reference });
      
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'success';
        transaction.paidAt = new Date();
        await transaction.save();

        // Process success logic
        if (transaction.targetType === 'booking') {
          await PaymentService.handleBookingSuccess(transaction);
        } else if (transaction.targetType === 'eshop_order') {
          await PaymentService.handleEShopSuccess(transaction);
        } else if (transaction.targetType === 'subscription') {
          await PaymentService.handleSubscriptionSuccess(transaction);
        }

        return res.json({ success: true, message: 'Payment verified and processed' });
      } else if (transaction && transaction.status === 'success') {
        return res.json({ success: true, message: 'Payment already processed' });
      }
    }

    res.status(400).json({ success: false, message: 'Payment verification failed' });
  } catch (error: any) {
    logger.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v1/payments/webhook
 * Paystack Webhook handler
 */
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    const body = req.body;

    if (!verifyPaystackSignature(body, signature)) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(400).send('Invalid signature');
    }

    // Acknowledge receipt immediately
    res.status(200).send('Webhook Received');

    const event = body.event;
    if (event === 'charge.success') {
      const data = body.data;
      const reference = data.reference;

      const transaction = await PaymentTransaction.findOne({ reference });
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'success';
        transaction.paidAt = new Date();
        await transaction.save();

        // Audit log
        await writeAuditLog({
          organizationId: transaction.organizationId.toString(),
          action: 'payment_success',
          resourceType: 'payment',
          resourceId: transaction._id as any,
          metadata: { reference, amount: transaction.amount }
        });

        // Process success logic
        if (transaction.targetType === 'booking') {
          await PaymentService.handleBookingSuccess(transaction);
        } else if (transaction.targetType === 'eshop_order') {
          await PaymentService.handleEShopSuccess(transaction);
        } else if (transaction.targetType === 'subscription') {
          await PaymentService.handleSubscriptionSuccess(transaction);
        }
      }
    }
  } catch (error: any) {
    logger.error('Webhook processing error:', error);
    // Don't send 500 to Paystack if it's already acknowledged
  }
};
