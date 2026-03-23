import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

export const configureSockets = (io: SocketIOServer) => {
  io.use((socket: any, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication failed'));
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  const electionNamespace = io.of('/election-monitoring');

  electionNamespace.on('connection', (socket) => {
    const { electionId } = socket.handshake.query;
    
    if (electionId) {
      socket.join(`election_${electionId}`);
      console.log(`Socket connected and joined election_${electionId}`);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected`);
    });
  });
};
