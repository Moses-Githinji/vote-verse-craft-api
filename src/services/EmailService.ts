import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import juice from 'juice';
import { Organization } from '../models/Organization';

// ─────────────────────────────────────────────────────────────────────────────
// Transporter — reads SMTP config from environment variables.
// Supports any SMTP provider: Gmail, Amazon SES, Brevo, Postmark, etc.
// ─────────────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Template engine — loads an HTML file and replaces {{PLACEHOLDER}} tokens
// ─────────────────────────────────────────────────────────────────────────────
function loadTemplate(templateName: string, variables: Record<string, string | number>): string {
  const templatePath = path.join(__dirname, '../emails', `${templateName}.html`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templatePath}`);
  }

  let html = fs.readFileSync(templatePath, 'utf-8');

  // Replace all {{TOKEN}} placeholders with actual values
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, String(value ?? '—'));
  }

  // Inline CSS styles for maximum email client compatibility
  return juice(html);
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain-text fallback generator (strips HTML tags)
// ─────────────────────────────────────────────────────────────────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, '\n')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Email type definitions
// ─────────────────────────────────────────────────────────────────────────────
type EmailType = 'submission_received' | 'processing_started' | 'invoice_ready' | 'duplicate_intent';

interface EmailData {
  bookingId?: string;
  location?: string;
  quotedPrice?: number;
  startDate?: string;
  statusUrl?: string;
  paymentUrl?: string;
  boothsCount?: number;
  staffCount?: number;
  voterCount?: number;
  planName?: string;
  softwareFee?: number;
  logisticsFee?: number;
  voterFee?: number;
  serviceMode?: 'managed' | 'self_service';
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject lines per email type
// ─────────────────────────────────────────────────────────────────────────────
const SUBJECTS: Record<EmailType, string> = {
  submission_received: "We've received your election request — KuraPap",
  processing_started:  "Your booking is under review — KuraPap",
  invoice_ready:       "Your custom election invoice is ready — KuraPap",
  duplicate_intent:    "Intent Already Submitted — KuraPap",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main EmailService
// ─────────────────────────────────────────────────────────────────────────────
export class EmailService {
  /**
   * Sends a templated onboarding email to an organisation.
   *
   * @param type    The email template to use
   * @param orgId   MongoDB ObjectId string of the Organisation
   * @param data    Dynamic data to inject into the template
   */
  static async sendOnboardingEmail(
    type: EmailType,
    orgId: string,
    data: EmailData
  ): Promise<void> {
    // 1. Resolve the recipient
    const org = await Organization.findById(orgId);
    if (!org) {
      console.warn(`[EMAIL] Organisation not found: ${orgId} — skipping email.`);
      return;
    }

    const recipientEmail = org.email;
    const recipientName  = org.name || 'Valued Client';

    // 2. Build the base URL for links
    const baseUrl  = process.env.CLIENT_STATUS_BASE_URL || 'https://shulepal-connect.vercel.app';
    const statusUrl  = data.statusUrl  || `${baseUrl}/status/${data.bookingId}`;
    const paymentUrl = data.paymentUrl || `${baseUrl}/status/${data.bookingId}/pay`;

    // 3. Format values
    const formattedPrice   = data.quotedPrice  ? data.quotedPrice.toLocaleString('en-KE')  : '—';
    const formattedSoftware = data.softwareFee ? data.softwareFee.toLocaleString('en-KE') : '—';
    const formattedLogistics = data.logisticsFee ? data.logisticsFee.toLocaleString('en-KE') : '—';
    const formattedVoterFee  = data.voterFee ? data.voterFee.toLocaleString('en-KE') : '—';
    const formattedDate = data.startDate
      ? new Date(data.startDate).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '—';

    // 4. Resolve template variables
    const serviceModeLabel = data.serviceMode === 'managed'
      ? 'Managed Full-Service'
      : 'Self-Service Software';

    const variables: Record<string, string | number> = {
      ORGANIZATION_NAME: recipientName,
      BOOKING_ID:        data.bookingId  || '—',
      LOCATION:          data.location   || '—',
      START_DATE:        formattedDate,
      QUOTED_PRICE:      formattedPrice,
      STATUS_URL:        statusUrl,
      PAYMENT_URL:       paymentUrl,
      BOOTHS_COUNT:      data.boothsCount  ?? '—',
      STAFF_COUNT:       data.staffCount   ?? '—',
      VOTER_COUNT:       data.voterCount   ?? '—',
      PLAN_NAME:         data.planName     || 'Standard',
      SOFTWARE_FEE:      formattedSoftware,
      LOGISTICS_FEE:     formattedLogistics,
      VOTER_FEE:         formattedVoterFee,
      SERVICE_MODE:      serviceModeLabel,
    };

    // 5. Load & render the HTML template
    let html: string;
    try {
      html = loadTemplate(type, variables);
    } catch (err: any) {
      console.error(`[EMAIL] Template load failed for "${type}":`, err.message);
      return;
    }

    // 6. Send the email
    const from = `"KuraPap" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

    try {
      const info = await transporter.sendMail({
        from,
        to:      `"${recipientName}" <${recipientEmail}>`,
        subject: SUBJECTS[type],
        html,
        text:    htmlToText(html), // plain-text fallback for clients that block HTML
      });

      console.log(`[EMAIL] ✅ Sent "${SUBJECTS[type]}" → ${recipientEmail} (msgId: ${info.messageId})`);
    } catch (err: any) {
      // Log but never crash the request — email is non-critical
      console.error(`[EMAIL] ❌ Failed to send "${type}" to ${recipientEmail}:`, err.message);
    }
  }

  /**
   * Verifies SMTP connectivity on startup (optional — call from server.ts)
   */
  static async verifyConnection(): Promise<void> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('[EMAIL] ⚠️  SMTP credentials not set. Email sending is disabled.');
      return;
    }
    try {
      await transporter.verify();
      console.log('[EMAIL] ✅ SMTP connection verified.');
    } catch (err: any) {
      console.error('[EMAIL] ❌ SMTP verification failed:', err.message);
    }
  }
}
