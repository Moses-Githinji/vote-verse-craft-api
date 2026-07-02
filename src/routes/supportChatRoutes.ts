import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  authenticateChat,
  createGuestSession,
  getConversationMessages,
  listConversations,
} from '../controllers/supportChatController';

export const supportChatRouter = Router();

// Visitor: create a guest chat session + conversation
supportChatRouter.post('/session', createGuestSession);

// Visitor/admin: fetch conversation message history (guest JWT scoped to conversation)
supportChatRouter.get('/conversations/:id/messages', authenticateChat, getConversationMessages);

// Admin: list conversations
supportChatRouter.get(
  '/conversations',
  authenticate,
  requireRole(['super_admin', 'admin']),
  listConversations,
);

