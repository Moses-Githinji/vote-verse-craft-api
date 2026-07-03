import { Booking } from '../models/Booking';
import { EShopOrder } from '../models/EShopOrder';
import { Invoice } from '../models/Invoice';
import { Organization } from '../models/Organization';
import { User, Admin, IAdmin } from '../models/User';
import { PaymentTransaction } from '../models/PaymentTransaction';
import { Subscription } from '../models/Subscription';
import { EmailService } from './EmailService';
import { WhatsAppService } from './WhatsAppService';
import { LogisticsService } from './LogisticsService';
import { InvoiceService } from './InvoiceService';
import { generateRandomPassword } from '../utils/crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

export class PaymentService {
  /**
   * Process a successful payment for a booking
   */
  static async handleBookingSuccess(transaction: any) {
    const { targetId, organizationId } = transaction;

    const booking = await Booking.findById(targetId);
    if (!booking) {
      logger.error(`Booking ${targetId} not found during payment processing`);
      return;
    }

    // We do NOT auto-confirm bookings here anymore.
    // The system admin must manually verify and confirm intents/bookings.

    // Update Invoice status
    await Invoice.findOneAndUpdate(
      { bookingId: booking._id },
      { status: 'paid', amountPaid: booking.quotedPrice },
      { new: true }
    );
  }

  /**
   * Process a successful payment for an EShop order
   */
  static async handleEShopSuccess(transaction: any) {
    const { targetId } = transaction;

    const order = await EShopOrder.findById(targetId);
    if (!order) {
      logger.error(`EShopOrder ${targetId} not found during payment processing`);
      return;
    }

    if (order.status === 'pending') {
      order.status = 'processing';
      await order.save();
      
      // Notify customer (could add an email/whatsapp service call here)
      logger.info(`EShopOrder ${targetId} moved to processing`);
    }
  }
  
  /**
   * Process a successful payment for a subscription upgrade
   */
  static async handleSubscriptionSuccess(transaction: any) {
    const { organizationId, metadata } = transaction;
    const planId = metadata.planId;

    if (!planId) {
      logger.error(`No planId found in transaction metadata for subscription payment ${transaction.reference}`);
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const sub = await Subscription.findOneAndUpdate(
      { organizationId },
      { 
        planId, 
        status: 'active', 
        currentPeriodStart: now, 
        currentPeriodEnd: periodEnd, 
        gracePeriodEnd: null 
      },
      { new: true, upsert: true }
    );

    // Notify via WhatsApp
    const org = await Organization.findById(organizationId);
    if (org?.phone) {
      await WhatsAppService.sendPaymentSuccess(org.phone, `PLAN_${planId.toUpperCase()}`)
        .catch(err => logger.error('WhatsApp plan upgrade notification failed:', err));
    }

    logger.info(`Organization ${organizationId} upgraded to ${planId}`);
  }
}
