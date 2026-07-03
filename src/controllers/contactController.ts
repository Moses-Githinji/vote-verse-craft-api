import { Request, Response } from 'express';
import { ContactMessage } from '../models/ContactMessage';

export const submitContactForm = async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const newContact = new ContactMessage({
      name,
      email,
      subject,
      message,
    });

    await newContact.save();

    // Optionally you could call EmailService here to send an alert to admins

    return res.status(201).json({
      success: true,
      message: 'Contact message received successfully.',
    });
  } catch (error) {
    console.error('[CONTACT] Error saving contact message:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getAllContactMessages = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const query = status ? { status } : {};
    
    const messages = await ContactMessage.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, data: { messages } });
  } catch (error) {
    console.error('[CONTACT] Error fetching messages:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

import { EmailService } from '../services/EmailService';

export const replyToContactMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { replyText } = req.body;
    const adminId = (req as any).user?._id;

    if (!replyText) {
      return res.status(400).json({ error: 'Reply text is required.' });
    }

    const message = await ContactMessage.findById(id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (message.status === 'replied') {
      return res.status(400).json({ error: 'Message has already been replied to.' });
    }

    // Send email using EmailService
    await EmailService.sendContactReply(
      message.email,
      message.name,
      message.subject,
      message.message,
      replyText
    );

    // Update database
    message.status = 'replied';
    message.replyText = replyText;
    message.repliedAt = new Date();
    message.repliedBy = adminId;
    await message.save();

    return res.json({ success: true, message: 'Reply sent successfully.', data: message });
  } catch (error) {
    console.error('[CONTACT] Error replying to message:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
