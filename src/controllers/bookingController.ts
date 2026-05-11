import { Request, Response } from 'express';
import { AvailabilityService } from '../services/AvailabilityService';
import { Booking } from '../models/Booking';
import { Organization } from '../models/Organization';
import { User, Admin } from '../models/User';
import { Invoice } from '../models/Invoice';
import { WhatsAppService } from '../services/WhatsAppService';
import { EmailService } from '../services/EmailService';
import { LogisticsService } from '../services/LogisticsService';
import { InvoiceService } from '../services/InvoiceService';
import { writeAuditLog } from '../utils/audit';
import { generateRandomPassword } from '../utils/crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const PLAN_REQUIREMENTS: Record<string, { booths: number; staff: number }> = {
  starter: { booths: 2, staff: 1 },
  standard: { booths: 5, staff: 2 },
  premium: { booths: 10, staff: 3 }
};

export const getAvailability = async (req: Request, res: Response) => {
  try {
    const { planId = 'starter', months = 3 } = req.query;
    const reqs = PLAN_REQUIREMENTS[planId as string] || PLAN_REQUIREMENTS.starter;

    const blockedDates = await AvailabilityService.getBlockedDates(
      Number(months),
      reqs.booths,
      reqs.staff
    );

    res.json({
      success: true,
      data: {
        planId,
        blockedDates: blockedDates.map(d => d.toISOString().split('T')[0])
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBooking = async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      planId,
      location,
      serviceMode,
      voterCount,
      infrastructureInfo,
      boothsRequested
    } = req.body;
    const orgId = (req as any).userOrgId;

    if (!startDate || !endDate || !planId || !location || !voterCount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required intent fields (startDate, endDate, planId, location, voterCount)' 
      });
    }

    const reqs = PLAN_REQUIREMENTS[planId as string];
    if (!reqs) {
      return res.status(400).json({ success: false, message: 'Invalid planId' });
    }

    // --- Throughput Calculation ---
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    
    // Calculate duration in minutes (default to 8 hours if same time or invalid range)
    let durationMinutes = Math.floor((eDate.getTime() - sDate.getTime()) / (1000 * 60));
    if (durationMinutes <= 0) durationMinutes = 480; // 8-hour default for same-day/unspecified time

    // Determine booths using throughput model if managed
    const throughputBooths = serviceMode === 'managed' 
      ? LogisticsService.calculateRequiredBooths(voterCount, durationMinutes)
      : 0;

    const finalBoothsNeeded = serviceMode === 'managed' ? (boothsRequested || throughputBooths) : 0;
    const finalStaffNeeded = serviceMode === 'managed' ? (finalBoothsNeeded > 10 ? 2 : reqs.staff) : 0;
    const throughputStress = LogisticsService.getWaitTimeStress(voterCount, finalBoothsNeeded, durationMinutes);

    // 1. Check Availability (only if managed)
    if (serviceMode === 'managed') {
      const check = await AvailabilityService.checkAvailability(
        sDate,
        eDate,
        finalBoothsNeeded,
        finalStaffNeeded
      );

      if (!check.available) {
        return res.status(409).json({
          success: false,
          code: 'DATES_UNAVAILABLE',
          message: check.reason
        });
      }
    }

    // 2. Calculate Logistics Surcharge and Total Price
    const logisticsSurcharge = serviceMode === 'managed' 
      ? LogisticsService.calculateSurcharge(location, finalBoothsNeeded)
      : 0;
    
    const quotedPrice = LogisticsService.calculateTotalPrice(planId, voterCount, logisticsSurcharge, finalBoothsNeeded);

    // 3. Create the Booking (Soft Reservation)
    const setupDate = new Date(sDate);
    setupDate.setDate(setupDate.getDate() - 1);
    setupDate.setHours(0, 0, 0, 0);

    const teardownDate = new Date(eDate);
    teardownDate.setDate(teardownDate.getDate() + 1);
    teardownDate.setHours(23, 59, 59, 999);

    const booking = await Booking.create({
      organizationId: orgId,
      planId,
      startDate: sDate,
      endDate: eDate,
      setupDate,
      teardownDate,
      boothsRequested: finalBoothsNeeded,
      staffRequested: finalStaffNeeded,
      location,
      serviceMode,
      voterCount,
      infrastructureInfo,
      logisticsSurcharge,
      quotedPrice,
      projectedDurationMinutes: durationMinutes,
      throughputStress,
      status: 'pending_verification'
    });

    // 4. Trigger Submission Received Email
    await EmailService.sendOnboardingEmail('submission_received', orgId, {
      bookingId: booking._id.toString(),
      quotedPrice,
      location,
      startDate: sDate.toISOString(),
      voterCount,
      boothsCount: finalBoothsNeeded,
      staffCount:  finalStaffNeeded,
      planName: planId.charAt(0).toUpperCase() + planId.slice(1),
      serviceMode
    });
    
    // 4.1 Trigger WhatsApp Intent Confirmation
    const org = await Organization.findById(orgId);
    if (org?.phone) {
      await WhatsAppService.sendIntentConfirmation(org.phone, org.name)
        .catch(err => console.error('WhatsApp trigger failed:', err));
    }

    // 5. Log it
    await writeAuditLog({
      organizationId: orgId,
      action: 'booking_intent_submitted',
      resourceType: 'booking',
      resourceId: booking._id as any,
      userId: (req as any).user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      newValues: { startDate, endDate, planId, location, serviceMode, quotedPrice }
    });

    res.status(201).json({
      success: true,
      message: 'Intent questionnaire received! Our team is reviewing your logistics requirements.',
      data: booking
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitIntent = async (req: Request, res: Response) => {
  try {
    const { 
      organizationName,
      orgType,
      email,
      phone,
      startDate, 
      endDate, 
      planId,
      location,
      serviceMode,
      voterCount,
      infrastructureInfo,
      durationMinutes: clientDurationMinutes,
      boothCount
    } = req.body;

    if (!organizationName || !email || !startDate || !planId) {
      return res.status(400).json({ success: false, message: 'Missing core organization or intent details' });
    }

    // 1. Create or find provisional organization
    const normalizedOrgType = (orgType || 'other').toLowerCase().replace(' ', '_') as any;
    
    let org = await Organization.findOne({ email });
    if (!org) {
      org = await Organization.create({
        name: organizationName,
        orgType: normalizedOrgType,
        email,
        phone,
        password: 'provisional_placeholder',
        isActive: false
      });
    } else {
      // Ensure existing provisional (or even active) org reflects the latest captured name/phone from the intent
      org.name = organizationName;
      if (phone) org.phone = phone;
      await org.save();

      // --- DUPLICATE PREVENTION CHECK ---
      // Check if this organization already has an existing intent (Booking)
      const existingBooking = await Booking.findOne({ organizationId: org._id }).sort({ createdAt: -1 });
      
      if (existingBooking) {
        console.log(`[INTENT] Duplicate detected for ${email}. Quoting original intent ${existingBooking._id}`);
        
        // Trigger Duplicate Notification Email
        await EmailService.sendOnboardingEmail(
          'duplicate_intent',
          org._id.toString(),
          {
            bookingId:    existingBooking._id.toString(),
            location:     existingBooking.location,
            quotedPrice:  existingBooking.quotedPrice,
            startDate:    existingBooking.startDate.toISOString(),
            voterCount:   existingBooking.voterCount || 0,
            boothsCount:  existingBooking.boothsRequested,
            staffCount:   existingBooking.staffRequested,
            planName:     existingBooking.planId.charAt(0).toUpperCase() + existingBooking.planId.slice(1),
            serviceMode:  existingBooking.serviceMode
          }
        ).catch(err => console.error('Duplicate email trigger failed:', err));

        return res.status(200).json({
          success: true,
          message: 'An intent has already been submitted for this email. We have sent a reminder with the original details to your inbox.',
          data: {
            duplicate: true,
            bookingId: existingBooking._id
          }
        });
      }
    }

    // 2. Throughput & Price Logic
    // Prefer client-supplied durationMinutes (more accurate than date-diff for same-day elections)
    const sDate = new Date(startDate);
    const eDate = new Date(endDate || startDate);
    
    let durationMinutes: number;
    if (clientDurationMinutes && clientDurationMinutes > 0) {
      durationMinutes = clientDurationMinutes;
    } else {
      durationMinutes = Math.floor((eDate.getTime() - sDate.getTime()) / (1000 * 60));
      if (durationMinutes <= 0) durationMinutes = 480; // Default: 8-hour election day
    }

    const reqs = PLAN_REQUIREMENTS[planId as string] || PLAN_REQUIREMENTS.starter;
    const throughputBooths = serviceMode === 'managed' 
      ? LogisticsService.calculateRequiredBooths(voterCount || 0, durationMinutes)
      : 0;

    const finalBoothsNeeded = serviceMode === 'managed' ? (boothCount || throughputBooths) : 0;
    const finalStaffNeeded = serviceMode === 'managed' ? (finalBoothsNeeded > 10 ? 2 : reqs.staff) : 0;
    const throughputStress = LogisticsService.getWaitTimeStress(voterCount || 0, finalBoothsNeeded, durationMinutes);

    const logisticsSurcharge = serviceMode === 'managed' 
      ? LogisticsService.calculateSurcharge(location, finalBoothsNeeded)
      : 0;
    
    const quotedPrice = LogisticsService.calculateTotalPrice(planId, voterCount || 0, logisticsSurcharge, finalBoothsNeeded);

    // 3. Create Booking
    const setupDate = new Date(sDate);
    setupDate.setDate(setupDate.getDate() - 1);
    const teardownDate = new Date(eDate);
    teardownDate.setDate(teardownDate.getDate() + 1);

    const booking = await Booking.create({
      organizationId: org._id,
      planId,
      startDate: sDate,
      endDate: eDate,
      setupDate,
      teardownDate,
      status: 'pending_verification',
      location,
      serviceMode,
      voterCount,
      infrastructureInfo,
      logisticsSurcharge,
      quotedPrice,
      boothsRequested: finalBoothsNeeded,
      staffRequested: finalStaffNeeded,
      projectedDurationMinutes: durationMinutes,
      throughputStress,
      notes: `Throughput-Based Intent. Duration: ${durationMinutes}m, Stress: ${throughputStress}. Power: ${infrastructureInfo?.power}, Data: ${infrastructureInfo?.internet}`
    });

    // 3b. Log it
    await writeAuditLog({
      organizationId: org._id.toString(),
      action: 'intent_submitted',
      resourceType: 'booking',
      resourceId: booking._id as any,
      userId: undefined,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      newValues: { startDate, planId, location, serviceMode, quotedPrice }
    });

    // 4. Trigger Onboarding Email
    await EmailService.sendOnboardingEmail(
      'submission_received',
      org._id.toString(),
      {
        bookingId:    booking._id.toString(),
        location,
        quotedPrice,
        startDate:    sDate.toISOString(),
        voterCount:   voterCount || 0,
        boothsCount:  finalBoothsNeeded,
        staffCount:   finalStaffNeeded,
        planName:     planId.charAt(0).toUpperCase() + planId.slice(1),
        logisticsFee: logisticsSurcharge,
        serviceMode
      }
    ).catch(err => console.error('Email trigger failed:', err));

    // 4.1 Trigger WhatsApp Intent Confirmation
    if (phone) {
      await WhatsAppService.sendIntentConfirmation(phone, organizationName)
        .catch(err => console.error('WhatsApp trigger failed:', err));
    }

    res.status(201).json({
      success: true,
      message: 'Intent submitted successfully. Calibration started.',
      data: {
        bookingId: booking._id,
        organizationId: org._id
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body; // status: 'confirmed' | 'cancelled'

    // Find the booking first to check fields before update
    const existingBooking = await Booking.findById(id);
    if (!existingBooking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // --- completed Logic: Lock critical fields ---
    if (status === 'completed') {
      // Logic for locking quotedPrice and boothsRequested can be enforced by simply not allowing updates 
      // to them in other endpoints once status is 'completed', but here we ensure they are what they were.
    }

    const booking = await Booking.findByIdAndUpdate(
      id,
      { status, notes },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // --- Credentials Assignment & Notification on Confirmation ---
    const org = await Organization.findById(booking.organizationId);
    
    if (status === 'confirmed' && org) {
      // 1. Activate organization
      org.isActive = true;
      await org.save();

      // 2. Generate random password
      const password = generateRandomPassword(8);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 3. Create or update the Admin User for this organization
      // We use the organization's primary email as the login email
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

      // 4. Send Confirmation Emails (Credentials & Invoice)
      const fees = LogisticsService.getFeeBreakdown(
        booking.planId, 
        booking.voterCount || 0, 
        booking.logisticsSurcharge, 
        booking.boothsRequested
      );

      // If price was overridden, we reflect it in the total
      const displayPrice = booking.quotedPrice || fees.total;

      // --- ACCOUNTING INTEGRITY: Create/Update Invoice Persistence ---
      // This ensures the financeController can track revenue in the dashboard
      await Invoice.findOneAndUpdate(
        { bookingId: booking._id },
        {
          organizationId: org._id,
          bookingId: booking._id,
          totalAmount: displayPrice,
          status: 'unpaid',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
          issuedAt: new Date(),
          externalId: `INV-${Date.now().toString().slice(-6)}`
        },
        { upsert: true, new: true }
      );

      const emailData = {
        bookingId: booking._id.toString(),
        location: booking.location,
        startDate: booking.startDate.toISOString(),
        planName: booking.planId.charAt(0).toUpperCase() + booking.planId.slice(1),
        serviceMode: booking.serviceMode,
        loginEmail: org.email,
        loginPassword: password,
        quotedPrice: displayPrice,
        softwareFee: fees.softwareFee,
        logisticsFee: fees.logisticsFee,
        voterFee: fees.voterFee,
        voterCount: booking.voterCount || 0,
        boothsCount: booking.boothsRequested,
        staffCount: booking.staffRequested,
        organizationName: org.name,
        attachInvoice: true
      };

      // 4a. Send Credentials
      await EmailService.sendOnboardingEmail('intent_approved', org._id.toString(), emailData)
        .catch(err => console.error('Email confirmation failed:', err));

      // 4b. Send Invoice
      await EmailService.sendOnboardingEmail('invoice_ready', org._id.toString(), emailData)
        .catch(err => console.error('Invoice email failed:', err));

      // 5. WhatsApp Notification
      if (org.phone) {
        try {
          // Generate and upload invoice for WhatsApp attachment
          const invoiceUrl = await InvoiceService.getInvoiceUrl(booking);
          
          await WhatsAppService.sendBookingConfirmation(
            org.phone, 
            booking._id.toString(), 
            booking.startDate.toISOString().split('T')[0],
            invoiceUrl
          );
          logger.info(`[WHATSAPP] Sent confirmation with invoice to ${org.phone}`);
        } catch (err: any) {
          // Fallback to sending without invoice if PDF/Cloudinary fails
          logger.error('[WHATSAPP] Failed to attach invoice, sending text only:', err.message);
          await WhatsAppService.sendBookingConfirmation(
            org.phone, 
            booking._id.toString(), 
            booking.startDate.toISOString().split('T')[0]
          ).catch(werr => logger.error('WhatsApp fallback failed:', werr));
        }
      }
    }

    // --- Revocation Logic for pending_verification ---
    if (status === 'pending_verification' && org) {
      // If moved from confirmed back to pending, revoke access
      org.isActive = false;
      await org.save();

      const adminUser = await User.findOne({ email: org.email });
      if (adminUser) {
        adminUser.isActive = false;
        await adminUser.save();
      }
    }

    // --- Feedback Email on completion ---
    if (status === 'completed' && org) {
      await EmailService.sendOnboardingEmail('post_election_feedback', org._id.toString(), {
        bookingId: booking._id.toString(),
        location: booking.location,
        startDate: booking.startDate.toISOString(),
      }).catch(err => console.error('Feedback email failed:', err));
    }

    // --- Audit Log ---
    await writeAuditLog({
      organizationId: booking.organizationId.toString(),
      action: `booking_${status}`,
      resourceType: 'booking',
      resourceId: booking._id as any,
      userId: (req as any).user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      newValues: { status, notes }
    });

    res.json({
      success: true,
      message: `Booking ${status} successfully`,
      data: booking
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const priceOverride = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quotedPrice, logisticsSurcharge, reason } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot override price for a completed booking' });
    }

    const oldValues = { 
      quotedPrice: booking.quotedPrice, 
      logisticsSurcharge: booking.logisticsSurcharge 
    };

    booking.quotedPrice = quotedPrice;
    booking.logisticsSurcharge = logisticsSurcharge;
    booking.notes = `${booking.notes || ''}\n[PRICE OVERRIDE] Reason: ${reason}`.trim();
    await booking.save();

    await writeAuditLog({
      organizationId: booking.organizationId.toString(),
      action: 'booking_price_override',
      resourceType: 'booking',
      resourceId: booking._id as any,
      userId: (req as any).user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      oldValues,
      newValues: { quotedPrice, logisticsSurcharge, reason }
    });

    res.json({ success: true, message: 'Price override successful', data: booking });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resendCredentials = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Manual credential resend is only allowed for confirmed bookings' });
    }

    const org = await Organization.findById(booking.organizationId);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    const password = generateRandomPassword(8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let user = await User.findOne({ email: org.email });
    if (user) {
      user.passwordHash = hashedPassword;
      user.isActive = true;
      await user.save();
    }

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

    await EmailService.sendOnboardingEmail('intent_approved', org._id.toString(), emailData);
    await EmailService.sendOnboardingEmail('invoice_ready', org._id.toString(), emailData);

    res.json({ success: true, message: 'Credentials and invoice regenerated and resent successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const archiveBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByIdAndUpdate(id, { isArchived: true }, { new: true });
    
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    await writeAuditLog({
      organizationId: booking.organizationId.toString(),
      action: 'booking_archived',
      resourceType: 'booking',
      resourceId: booking._id as any,
      userId: (req as any).user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      newValues: { isArchived: true }
    });

    res.json({ success: true, message: 'Booking archived successfully', data: booking });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).userOrgId;
    const bookings = await Booking.find({ organizationId: orgId }).sort({ startDate: -1 });

    res.json({
      success: true,
      data: bookings
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookingInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const orgId = (req as any).userOrgId;
    
    // 0. Fetch associated invoice
    const invoice = await Invoice.findOne({ bookingId: id });
    
    // Detailed logging for debugging
    logger.info(`Fetching invoice for booking ID: ${id}, userOrgId: ${orgId}, role: ${user.role}, invoiceStatus: ${invoice?.status}`);

    // Defensive check for database connectivity
    if (mongoose.connection.readyState !== 1) {
      logger.error('Database not connected. ReadyState: ' + mongoose.connection.readyState);
      return res.status(503).json({ 
        success: false, 
        error: { message: 'Database connection is currently unstable. Please try again in a moment.' } 
      });
    }

    // 1. Fetch booking
    let booking;
    if (user.role === 'super_admin') {
      // Super Admin bypass: can see any invoice for accounting
      booking = await Booking.findById(id);
    } else {
      // BOLA check: owner-only access for organizations
      booking = await Booking.findOne({ _id: id, organizationId: orgId });
    }
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Invoice not found or access denied.' });
    }

    // 2. Calculate fee breakdown
    const fees = LogisticsService.getFeeBreakdown(
      booking.planId, 
      booking.voterCount || 0, 
      booking.logisticsSurcharge, 
      booking.boothsRequested
    );

    // 3. Return detailed invoice data
    res.json({
      success: true,
      data: {
        bookingId: booking._id,
        status: booking.status,
        planName: booking.planId.charAt(0).toUpperCase() + booking.planId.slice(1),
        location: booking.location,
        startDate: booking.startDate,
        voterCount: booking.voterCount,
        boothsCount: booking.boothsRequested,
        staffCount: booking.staffRequested,
        invoiceStatus: invoice ? invoice.status : (booking.status === 'confirmed' ? 'unpaid' : 'draft'),
        breakdown: {
          softwareFee: fees.softwareFee,
          logisticsFee: fees.logisticsFee,
          voterFee: fees.voterFee,
          total: booking.quotedPrice || fees.total
        },
        isOverridden: !!booking.quotedPrice && booking.quotedPrice !== fees.total
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const booking = await Booking.findById(id).populate('organizationId', 'name');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({
      success: true,
      data: {
        _id: booking._id,
        status: booking.status,
        planId: booking.planId,
        startDate: booking.startDate,
        location: booking.location,
        serviceMode: booking.serviceMode,
        quotedPrice: booking.quotedPrice,
        voterCount: booking.voterCount,
        organizationName: (booking.organizationId as any)?.name,
        orgType: booking.notes?.includes('orgType:') ? booking.notes.split('orgType:')[1].split('|')[0] : 'Institution',
        notes: booking.notes
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByIdAndDelete(id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await writeAuditLog({
      organizationId: booking.organizationId.toString(),
      action: 'booking_deleted',
      resourceType: 'booking',
      resourceId: booking._id as any,
      userId: (req as any).user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      newValues: { status: 'deleted' }
    });

    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAllBookings = async (req: Request, res: Response) => {
  try {
    const result = await Booking.deleteMany({});

    await writeAuditLog({
      organizationId: 'system',
      action: 'all_bookings_deleted',
      resourceType: 'booking',
      resourceId: 'bulk_delete' as any,
      userId: (req as any).user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      newValues: { count: result.deletedCount }
    });

    res.json({ success: true, message: `Deleted ${result.deletedCount} bookings successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const downloadInvoicePDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 1. Fetch booking & Org
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const org = await Organization.findById(booking.organizationId);
    const orgName = org?.name || 'Valued Client';

    // 2. Format values for the template
    const fees = LogisticsService.getFeeBreakdown(
      booking.planId, 
      booking.voterCount || 0, 
      booking.logisticsSurcharge, 
      booking.boothsRequested
    );

    const formattedPrice = (booking.quotedPrice || fees.total).toLocaleString('en-KE');
    const formattedSoftware = fees.softwareFee.toLocaleString('en-KE');
    const formattedLogistics = fees.logisticsFee.toLocaleString('en-KE');
    const formattedVoterFee  = fees.voterFee.toLocaleString('en-KE');
    const formattedDate = booking.startDate.toLocaleDateString('en-KE', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const variables = {
      ORGANIZATION_NAME: orgName,
      BOOKING_ID:        booking._id.toString(),
      LOCATION:          booking.location,
      START_DATE:        formattedDate,
      QUOTED_PRICE:      formattedPrice,
      BOOTHS_COUNT:      booking.boothsRequested,
      STAFF_COUNT:       booking.staffRequested,
      VOTER_COUNT:       booking.voterCount || 0,
      PLAN_NAME:         booking.planId.charAt(0).toUpperCase() + booking.planId.slice(1),
      SOFTWARE_FEE:      formattedSoftware,
      LOGISTICS_FEE:     formattedLogistics,
      VOTER_FEE:         formattedVoterFee,
      SERVICE_MODE:      booking.serviceMode === 'managed' ? 'Managed Full-Service' : 'Self-Service Software',
    };

    // 3. Generate PDF
    const pdfBuffer = await InvoiceService.generateInvoicePDF(variables);

    // 4. Send as File
    const safeOrgName = orgName.replace(/\s+/g, '_');
    const filename = `Invoice_${safeOrgName}_${id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('[PDF_DOWNLOAD] Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};
