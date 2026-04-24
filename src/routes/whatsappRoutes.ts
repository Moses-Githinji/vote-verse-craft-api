import { Router, Request, Response } from 'express';
import { WhatsAppAgentService } from '../services/WhatsAppAgentService';

export const whatsappRouter = Router();

/**
 * Webhook Event Handling (POST)
 * Twilio sends events as application/x-www-form-urlencoded
 */
whatsappRouter.post('/webhook', (req: Request, res: Response) => {
  // Twilio uses flat keys in a POST body for its webhook
  const { From, Body, MessageSid, MessageStatus, SmsStatus } = req.body;

  // 1. Handle Incoming Message (User sent a text)
  if (From && Body) {
    console.log(`Received Twilio WhatsApp message from ${From} [${MessageSid}]: ${Body}`);

    // Forward to AI Agent for processing
    WhatsAppAgentService.handleIncomingMessage(From, Body)
      .catch(err => console.error('Error in WhatsApp Agent handling:', err));
    
    res.type('text/xml');
    return res.send('<Response></Response>');
  }

  // 2. Handle Status Callback (Sent, Delivered, Read, etc.)
  if (MessageStatus || SmsStatus) {
    // console.log(`Twilio Message Status Update [${MessageSid}]: ${MessageStatus || SmsStatus}`);
    return res.sendStatus(200);
  }

  // Fallback for unknown payloads
  res.sendStatus(200);
});

// GET verification is not typically used by Twilio in the same way as Meta Cloud API.
// We remove it to keep the routes clean.
