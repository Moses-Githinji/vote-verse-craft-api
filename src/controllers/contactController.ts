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
