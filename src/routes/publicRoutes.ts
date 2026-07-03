import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';
import * as contactController from '../controllers/contactController';

const router = Router();

// Publicly accessible PDF download for invoices (used by WhatsApp)
router.get('/booking/:id/invoice/pdf', bookingController.downloadInvoicePDF);

// Public contact form submission
router.post('/contact', contactController.submitContactForm);

export default router;
