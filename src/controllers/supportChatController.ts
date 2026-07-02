import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { ChatConversation } from '../models/ChatConversation';
import { ChatMessage } from '../models/ChatMessage';
import { writeAuditLog } from '../utils/audit';

function getClientIp(req: Request) {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.length) return xfwd.split(',')[0].trim();
  return (req as any).ip;
}

function signGuestToken(payload: Record<string, any>) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.SUPPORT_CHAT_GUEST_EXPIRES_IN || '2h') as any,
  });
}

export const createGuestSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = `guest_${crypto.randomUUID()}`;
    const userAgent = req.get('User-Agent') || undefined;
    const ipAddress = getClientIp(req);

    const conversation = await ChatConversation.create({
      status: 'open',
      visitor: { sessionId, ipAddress, userAgent },
    });

    await ChatMessage.create({
      conversationId: conversation._id,
      senderType: 'system',
      text: 'Hi! How can we help you today?',
    });

    const guestToken = signGuestToken({
      type: 'guest',
      conversationId: String(conversation._id),
      sessionId,
    });

    await writeAuditLog({
      organizationId: 'global',
      action: 'support_chat_session_created',
      resourceType: 'chat_conversation',
      resourceId: conversation._id as any,
      ipAddress,
      userAgent,
      metadata: { sessionId },
    });

    return res.json({
      success: true,
      data: {
        conversationId: String(conversation._id),
        guestToken,
        status: conversation.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const authenticateChat = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: { message: 'No token provided' } });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    // Support both guest tokens (type: 'guest') and regular user JWTs
    (req as any).chatUser = decoded;
    // Also populate req.user for regular auth tokens so downstream middleware is compatible
    if (decoded.type !== 'guest') {
      (req as any).user = decoded;
    }
    next();
  } catch {
    return res.status(401).json({ success: false, error: { message: 'Invalid token' } });
  }
};

export const getConversationMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid conversation id' } });
    }

    const chatUser = (req as any).chatUser as any;
    const isGuest = chatUser?.type === 'guest';
    const isAdmin = !isGuest && ['admin', 'super_admin'].includes(chatUser?.role);

    if (isGuest && chatUser.conversationId !== id) {
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }

    if (!isGuest && !isAdmin) {
      return res.status(403).json({ success: false, error: { message: 'Access denied' } });
    }

    const messages = await ChatMessage.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    return res.json({ success: true, data: { messages } });
  } catch (err) {
    next(err);
  }
};

export const listConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = String(req.query.status || '').trim();
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'))));

    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const conversations = await ChatConversation.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, data: { conversations } });
  } catch (err) {
    next(err);
  }
};

