import { Twilio } from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

export class WhatsAppService {
  private static readonly ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  private static readonly AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  private static readonly FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  private static client = (WhatsAppService.ACCOUNT_SID?.startsWith('AC') && WhatsAppService.AUTH_TOKEN)
    ? new Twilio(WhatsAppService.ACCOUNT_SID, WhatsAppService.AUTH_TOKEN)
    : null;

  /**
   * Generic method to send a WhatsApp message
   * In Twilio, 'to' must be prefixed with 'whatsapp:' if not already
   */
  static async sendMessage(to: string, body: string): Promise<any> {
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    if (!this.client) {
      console.warn('Twilio credentials missing. Skipping message.');
      return null;
    }

    try {
      const message = await this.client.messages.create({
        body: body,
        from: this.FROM_NUMBER,
        to: formattedTo
      });
      return message;
    } catch (error: any) {
      console.error('Twilio WhatsApp Error:', error.message);
      throw error;
    }
  }

  /**
   * Send a WhatsApp template message
   * For Twilio, templates are often sent by just sending the body that matches the pre-approved template.
   * We keep the signature the same as requested, but map it to Twilio's messaging.
   */
  static async sendTemplate(to: string, templateName: string, languageCode: string = 'en_US', components: any[] = []): Promise<any> {
    // For Twilio Sandbox/Production, we usually send the body directly.
    // If you are using the Twilio Content API, you would use contentSid instead.
    // Here we will construct a body from components to mimic the cloud API behavior for the "Keep templates" requirement.
    
    let body = "";
    const bodyComponent = components.find(c => c.type === 'body');
    
    // Simple placeholder replacement for common VoteVerse templates
    // In a real production environment with Twilio Content API, you would pass contentSid and contentVariables.
    if (templateName === 'intent_submission_confirmation') {
      const orgName = bodyComponent?.parameters[0]?.text || 'Client';
      body = `Hi ${orgName}, we've received your election intent! We are calculating booth availability now.`;
    } else if (templateName === 'booking_confirmation') {
      const bookingId = bodyComponent?.parameters[0]?.text || 'ID';
      const date = bodyComponent?.parameters[1]?.text || 'Date';
      body = `Your booking ${bookingId} has been confirmed for ${date}. We are starting calibration.`;
    } else if (templateName === 'invoice_issued') {
      const amount = bodyComponent?.parameters[0]?.text || '0.00';
      const link = bodyComponent?.parameters[1]?.text || '';
      body = `Your invoice for ${amount} is ready. View it here: ${link}`;
    } else if (templateName === 'payment_received') {
      const invoiceId = bodyComponent?.parameters[0]?.text || 'ID';
      body = `Payment received for ${invoiceId}. Your results/services are now unlocked!`;
    } else if (templateName === 'election_reminder') {
      const title = bodyComponent?.parameters[0]?.text || 'Election';
      const date = bodyComponent?.parameters[1]?.text || 'Date';
      body = `Reminder: The ${title} election is starting in 2 days (${date}). Prepare your voters!`;
    } else {
      // Fallback
      body = `Template ${templateName} triggered.`;
    }

    return this.sendMessage(to, body);
  }

  // Helper methods for specific business events (signatures stay identical)
  
  static async sendIntentConfirmation(to: string, orgName: string) {
    return this.sendTemplate(to, 'intent_submission_confirmation', 'en_US', [
      {
        type: 'body',
        parameters: [{ type: 'text', text: orgName }]
      }
    ]);
  }

  static async sendBookingConfirmation(to: string, bookingId: string, date: string) {
    return this.sendTemplate(to, 'booking_confirmation', 'en_US', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: bookingId },
          { type: 'text', text: date }
        ]
      }
    ]);
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
