import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';
import { authenticate, requireRole, requireOrgAccess } from '../middlewares/auth';

const router = Router();

// Publicly check availability (landing page questionnaire)
router.get('/availability', bookingController.getAvailability);

// Public intent submission from landing page
router.post('/intent', bookingController.submitIntent);

// My bookings
router.get('/my', authenticate, requireOrgAccess, bookingController.getMyBookings);

// Request a new booking
router.post('/reserve', authenticate, requireOrgAccess, bookingController.createBooking);

// Get specific invoice
router.get('/:id/invoice', authenticate, requireOrgAccess, bookingController.getBookingInvoice);

// Admin-only: Verify/Cancel bookings
router.patch('/:id/verify', authenticate, requireRole(['admin', 'super_admin']), bookingController.verifyBooking);

// Public status tracking
router.get('/:id/public', bookingController.getPublicBookingStatus);

export default router;
