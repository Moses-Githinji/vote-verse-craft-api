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

    // Only proceed if status is pending_verification
    if (booking.status === 'pending_verification') {
      booking.status = 'confirmed';
      await booking.save();

      // Trigger the same logic as manual verification
      await this.confirmOrganizationAndUser(booking);
    }

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

  /**
   * Internal helper: Activate org, create user, send credentials
   * (Mirrors logic in bookingController.ts:verifyBooking)
   */
  private static async confirmOrganizationAndUser(booking: any) {
    const org = await Organization.findById(booking.organizationId);
    if (!org) return;

    // 1. Activate organization
    org.isActive = true;
    await org.save();

    // 2. Generate random password
    const password = generateRandomPassword(8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create or update the Admin User
    let user = await Admin.findOne({ email: org.email });
    if (!user) {
      await Admin.create({
        organizationId: org._id,
        email: org.email,
        passwordHash: hashedPassword,
        firstName: 'Admin',
        lastName: org.name.split(' ')[0] || 'User',
        role: 'admin',
        isActive: true
      });
    } else {
      user.passwordHash = hashedPassword;
      user.organizationId = org._id as any;
      user.isActive = true;
      await user.save();
    }

    // 4. Send Confirmation Emails (Background)
    const fees = LogisticsService.getFeeBreakdown(
      booking.planId, 
      booking.voterCount || 0, 
      booking.logisticsSurcharge, 
      booking.boothsRequested
    );

    const emailData = {
      bookingId: booking._id.toString(),
      location: booking.location,
      startDate: booking.startDate.toISOString(),
      planName: booking.planId.charAt(0).toUpperCase() + booking.planId.slice(1),
      serviceMode: booking.serviceMode,
      loginEmail: org.email,
      loginPassword: password,
      quotedPrice: booking.quotedPrice || fees.total,
      softwareFee: fees.softwareFee,
      logisticsFee: fees.logisticsFee,
      voterFee: fees.voterFee,
      voterCount: booking.voterCount || 0,
      boothsCount: booking.boothsRequested,
      staffCount: booking.staffRequested,
      attachInvoice: true
    };

    EmailService.sendOnboardingEmail('intent_approved', org._id.toString(), emailData)
      .catch(err => logger.error('Email confirmation failed:', err));

    // 5. WhatsApp Notification (Background)
    const phone = org.phone;
    if (phone) {
      (async () => {
        try {
          // Generate and upload invoice for WhatsApp attachment
          const invoiceUrl = await InvoiceService.getInvoiceUrl(booking);
          
          await WhatsAppService.sendBookingConfirmation(
            phone, 
            booking._id.toString(), 
            booking.startDate.toISOString().split('T')[0],
            invoiceUrl
          );
          logger.info(`[WHATSAPP] Sent confirmation with invoice to ${phone}`);
        } catch (err: any) {
          // Fallback to sending without invoice if PDF/Cloudinary fails
          logger.error('[WHATSAPP] Failed to attach invoice, sending text only:', err.message);
          await WhatsAppService.sendBookingConfirmation(
            phone, 
            booking._id.toString(), 
            booking.startDate.toISOString().split('T')[0]
          ).catch(werr => logger.error('WhatsApp fallback failed:', werr));
        }
      })();
    }
  }
}
