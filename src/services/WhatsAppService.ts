import { Twilio } from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Mapping of Template Names to their Approved Body Patterns.
 * In production, you would ensure these match your Twilio/Meta dashboard exactly.
 */
const TEMPLATE_MAP: Record<string, string> = {
  'intent_submission_confirmation': "Hi {{1}}, we've received your election intent! We are calculating booth availability now.",
  'booking_confirmation': "Your booking {{1}} for {{2}} is confirmed! View your invoice here: {{3}}. We are starting calibration.",
  'payment_received': "Payment received for {{1}}. Your results/services are now unlocked!",
  'invoice_issued': "An invoice for {{1}} has been issued. View and pay here: {{2}}",
  'election_reminder': "Reminder: The {{1}} election is starting in 2 days ({{2}}). Prepare your voters!",
};

export class WhatsAppService {
  private static readonly ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  private static readonly AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  private static readonly FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  private static client = (WhatsAppService.ACCOUNT_SID?.startsWith('AC') && WhatsAppService.AUTH_TOKEN)
    ? new Twilio(WhatsAppService.ACCOUNT_SID, WhatsAppService.AUTH_TOKEN)
    : null;

  /**
   * Generic method to send a free-form WhatsApp message
   */
  static async sendMessage(to: string, body: string, mediaUrl?: string): Promise<any> {
    // 1. Normalize recipient number
    let normalizedTo = to.trim();
    if (normalizedTo.startsWith('0')) {
      normalizedTo = '+254' + normalizedTo.substring(1);
    }
    const formattedTo = normalizedTo.startsWith('whatsapp:') ? normalizedTo : `whatsapp:${normalizedTo}`;

    // 2. Normalize sender number (from .env)
    const rawFrom = this.FROM_NUMBER;
    const formattedFrom = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`;

    if (!this.client) {
      console.warn('Twilio credentials missing. Skipping message.');
      return null;
    }

    try {
      const message = await this.client.messages.create({
        body: body,
        from: formattedFrom,
        to: formattedTo,
        mediaUrl: mediaUrl ? [mediaUrl] : undefined
      });
      return message;
    } catch (error: any) {
      console.error('Twilio WhatsApp Error:', error.message);
      throw error;
    }
  }

  /**
   * Sends a Template-based message.
   * Dynamically replaces {{1}}, {{2}}, etc. based on the components provided.
   */
  static async sendTemplate(to: string, templateName: string, languageCode: string = 'en_US', components: any[] = [], mediaUrl?: string): Promise<any> {
    const pattern = TEMPLATE_MAP[templateName];
    if (!pattern) {
      console.error(`Template ${templateName} not found in TEMPLATE_MAP.`);
      return this.sendMessage(to, `[Error] Template ${templateName} not found.`);
    }

    // Extract body parameters
    const bodyComponent = components.find(c => c.type === 'body');
    const parameters = bodyComponent?.parameters || [];

    // Replace placeholders {{1}}, {{2}}, etc. dynamically
    let finalizedBody = pattern;
    parameters.forEach((param: any, index: number) => {
      const placeholder = `{{${index + 1}}}`;
      finalizedBody = finalizedBody.replace(placeholder, param.text || '');
    });

    console.log(`[WHATSAPP] Sending Message to ${to}: "${finalizedBody}" | Media: ${mediaUrl || 'None'}`);

    return this.sendMessage(to, finalizedBody, mediaUrl);
  }

  // --- Convenience Helper Methods (保持签名一致) ---
  
  static async sendIntentConfirmation(to: string, orgName: string) {
    return this.sendTemplate(to, 'intent_submission_confirmation', 'en_US', [
      {
        type: 'body',
        parameters: [{ type: 'text', text: orgName }]
      }
    ]);
  }

  static async sendBookingConfirmation(to: string, bookingId: string, date: string, mediaUrl?: string) {
    return this.sendTemplate(to, 'booking_confirmation', 'en_US', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: bookingId },
          { type: 'text', text: date },
          { type: 'text', text: mediaUrl || '—' }
        ]
      }
    ], mediaUrl);
  }

  static async sendInvoicingNotification(to: string, amount: string, link: string) {
    return this.sendTemplate(to, 'invoice_issued', 'en_US', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: amount },
          { type: 'text', text: link }
        ]
      }
    ]);
  }

  static async sendPaymentSuccess(to: string, invoiceId: string) {
    return this.sendTemplate(to, 'payment_received', 'en_US', [
      {
        type: 'body',
        parameters: [{ type: 'text', text: invoiceId }]
      }
    ]);
  }

  static async sendElectionReminder(to: string, electionTitle: string, date: string) {
    return this.sendTemplate(to, 'election_reminder', 'en_US', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: electionTitle },
          { type: 'text', text: date }
        ]
      }
    ]);
  }
}
