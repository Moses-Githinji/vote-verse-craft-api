import { Router, Request, Response } from 'express';
import { WhatsAppAgentService } from '../services/WhatsAppAgentService';

export const whatsappRouter = Router();

/**
 * Webhook Event Handling (POST)
 * Twilio sends events as application/x-www-form-urlencoded
 */
whatsappRouter.post('/webhook', (req: Request, res: Response) => {
  // Twilio uses flat keys in a POST body for its webhook
  const { From, Body, MessageSid } = req.body;

  if (From && Body) {
    // Strip 'whatsapp:' prefix for processing if necessary, 
    // but WhatsAppAgentService expects the phone number (which might include it or not)
    // For consistency with Twilio-based sending, we'll keep the full identifier
    console.log(`Received Twilio WhatsApp message from ${From} [${MessageSid}]: ${Body}`);

    // Forward to AI Agent for processing
    WhatsAppAgentService.handleIncomingMessage(From, Body)
      .catch(err => console.error('Error in WhatsApp Agent handling:', err));
    
    // Twilio expects a valid TwiML response or a 200 OK
    // Using empty <Response /> is standard
    res.type('text/xml');
    return res.send('<Response></Response>');
  }

  res.sendStatus(400);
});

// GET verification is not typically used by Twilio in the same way as Meta Cloud API.
// We remove it to keep the routes clean.
