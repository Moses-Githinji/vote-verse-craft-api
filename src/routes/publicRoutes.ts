import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';

const router = Router();

// Publicly accessible PDF download for invoices (used by WhatsApp)
router.get('/booking/:id/invoice/pdf', bookingController.downloadInvoicePDF);

export default router;
