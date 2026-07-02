import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { ChatConversation } from '../models/ChatConversation';
import { ChatMessage } from '../models/ChatMessage';
import { User } from '../models/User';
import { writeAuditLog } from '../utils/audit';

type AgentPresence = {
  socketId: string;
  available: boolean;
  lastAssignedAt: number;
};

const agents = new Map<string, AgentPresence>(); // userId -> presence
const rateBuckets = new Map<string, { windowStart: number; count: number }>(); // socketId -> bucket

function allowEvent(socketId: string, limit = 30, windowMs = 60_000) {
  const t = now();
  const bucket = rateBuckets.get(socketId);
  if (!bucket || t - bucket.windowStart >= windowMs) {
    rateBuckets.set(socketId, { windowStart: t, count: 1 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  rateBuckets.set(socketId, bucket);
  return true;
}

function isAdminRole(role: any) {
  return role === 'admin' || role === 'super_admin';
}

function now() {
  return Date.now();
}

async function emitConversationUpdated(nsp: ReturnType<SocketIOServer['of']>, conversationId: string) {
  const conv = await ChatConversation.findById(conversationId).lean();
  if (!conv) return;
  const payload = {
    conversationId,
    status: conv.status,
    assignedAgentName: conv.assignedAgentName || null,
  };
  nsp.to(`conversation_${conversationId}`).emit('conversation:updated', payload);
  nsp.to('agents').emit('conversation:updated', payload);
}

function pickNextAvailableAgent(): string | null {
  const available = Array.from(agents.entries())
    .filter(([, p]) => p.available)
    .sort((a, b) => a[1].lastAssignedAt - b[1].lastAssignedAt);
  return available[0]?.[0] || null;
}

export const configureSupportChatSockets = (io: SocketIOServer) => {
  const nsp = io.of('/support-chat');

  nsp.use((socket: any, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication failed'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  nsp.on('connection', (socket: any) => {
    const user = socket.user || {};

    const isGuest = user.type === 'guest';
    const isAdmin = isAdminRole(user.role);

    if (isGuest) {
      const conversationId = String(user.conversationId || '');
      if (mongoose.isValidObjectId(conversationId)) {
        socket.join(`conversation_${conversationId}`);
      } else {
        socket.disconnect(true);
        return;
      }
    }

    if (isAdmin && user.id) {
      const userId = String(user.id);
      agents.set(userId, {
        socketId: socket.id,
        available: false,
        lastAssignedAt: 0,
      });
      socket.join('agents');
    }

    socket.on('agent:set_availability', (payload: { available: boolean }) => {
      if (!isAdmin || !user.id) return;
      const userId = String(user.id);
      const existing = agents.get(userId);
      if (!existing) return;
      agents.set(userId, { ...existing, available: Boolean(payload?.available) });
    });

    socket.on('visitor:message', async (payload: { conversationId: string; text: string }) => {
      if (!isGuest) return;
      if (!allowEvent(socket.id, 20)) return;
      const conversationId = String(payload?.conversationId || '');
      const text = String(payload?.text || '').trim();
      if (!text) return;
      if (text.length > 2000) return;
      if (conversationId !== String(user.conversationId)) return;
      if (!mongoose.isValidObjectId(conversationId)) return;

      const msg = await ChatMessage.create({
        conversationId,
        senderType: 'visitor',
        senderId: user.sessionId || 'guest',
        text,
      });

      nsp.to(`conversation_${conversationId}`).emit('message:new', {
        id: String(msg._id),
        sender: 'visitor',
        text: msg.text,
        createdAt: msg.createdAt.toISOString(),
      });
    });

    socket.on('visitor:request_human', async (payload: { conversationId: string }) => {
      if (!isGuest) return;
      if (!allowEvent(socket.id, 10)) return;
      const conversationId = String(payload?.conversationId || '');
      if (conversationId !== String(user.conversationId)) return;
      if (!mongoose.isValidObjectId(conversationId)) return;

      const conv = await ChatConversation.findById(conversationId);
      if (!conv) return;
      if (conv.status === 'assigned' || conv.status === 'closed') return;

      conv.status = 'waiting_for_agent';
      await conv.save();

      await emitConversationUpdated(nsp, conversationId);
      nsp.to('agents').emit('inbox:updated', { conversationId });

      const nextAgentId = pickNextAvailableAgent();
      if (nextAgentId) {
        const agentPresence = agents.get(nextAgentId);
        if (agentPresence) {
          nsp.to(agentPresence.socketId).emit('assignment:offered', {
            conversationId,
          });
        }
      }
    });

    socket.on('agent:accept_assignment', async (payload: { conversationId: string }) => {
      if (!isAdmin || !user.id) return;
      if (!allowEvent(socket.id, 20)) return;
      const conversationId = String(payload?.conversationId || '');
      if (!mongoose.isValidObjectId(conversationId)) return;

      const conv = await ChatConversation.findById(conversationId);
      if (!conv) return;
      if (conv.status !== 'waiting_for_agent' && conv.status !== 'open') return;

      const agentId = String(user.id);
      const agentUser = await User.findById(agentId).lean();
      const agentName = agentUser
        ? [agentUser.firstName, agentUser.lastName].filter(Boolean).join(' ').trim()
        : undefined;

      conv.status = 'assigned';
      conv.assignedAgentId = agentId as any;
      conv.assignedAgentName = agentName;
      await conv.save();

      const presence = agents.get(agentId);
      if (presence) agents.set(agentId, { ...presence, available: false, lastAssignedAt: now() });

      socket.join(`conversation_${conversationId}`);
      await emitConversationUpdated(nsp, conversationId);

      await writeAuditLog({
        organizationId: 'global',
        action: 'support_chat_assigned',
        resourceType: 'chat_conversation',
        resourceId: conv._id as any,
        userId: agentId as any,
        metadata: { conversationId },
      });
    });

    socket.on('agent:message', async (payload: { conversationId: string; text: string }) => {
      if (!isAdmin || !user.id) return;
      if (!allowEvent(socket.id, 40)) return;
      const conversationId = String(payload?.conversationId || '');
      const text = String(payload?.text || '').trim();
      if (!text) return;
      if (text.length > 2000) return;
      if (!mongoose.isValidObjectId(conversationId)) return;

      const conv = await ChatConversation.findById(conversationId).lean();
      if (!conv) return;
      if (String(conv.assignedAgentId || '') !== String(user.id) && user.role !== 'super_admin') return;

      const msg = await ChatMessage.create({
        conversationId,
        senderType: 'agent',
        senderId: user.id,
        text,
      });

      nsp.to(`conversation_${conversationId}`).emit('message:new', {
        id: String(msg._id),
        sender: 'agent',
        text: msg.text,
        createdAt: msg.createdAt.toISOString(),
      });
    });

    socket.on('disconnect', () => {
      if (isAdmin && user.id) {
        agents.delete(String(user.id));
      }
      rateBuckets.delete(socket.id);
    });
  });
};

