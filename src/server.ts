import http from 'http';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app';
import { logger } from './utils/logger';
import { configureSockets } from './sockets/electionMonitoring';
import dotenv from 'dotenv';
dotenv.config();

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:8081', 'http://localhost:3000', 'https://kurapap-admin.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Attach io to app for use in controllers
app.set('io', io);

// Configure Socket Namespaces
configureSockets(io);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shulepal';

const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();
