import { Request, Response } from 'express';
import { AvailabilityService } from '../services/AvailabilityService';
import { Booking } from '../models/Booking';
import { Organization } from '../models/Organization';
import { writeAuditLog } from '../utils/audit';

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

import { LogisticsService } from '../services/LogisticsService';
import { EmailService } from '../services/EmailService';

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

    if (!['confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const booking = await Booking.findByIdAndUpdate(
      id,
      { status, notes },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
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
