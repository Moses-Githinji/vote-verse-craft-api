import http from 'http';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app';
import { logger } from './utils/logger';
import { configureSockets } from './sockets/electionMonitoring';
import { EmailService } from './services/EmailService';
import dotenv from 'dotenv';
dotenv.config();

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:3000', 'https://kurapap-admin.vercel.app', 'https://shulepal-connect.vercel.app'],
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

const connectDB = async (retryCount = 0): Promise<void> => {
  const options = {
    serverSelectionTimeoutMS: 5000, // Wait 5s for a primary before failing
    socketTimeoutMS: 45000,
    family: 4, // Force IPv4 to resolve potential DNS issues
  };

  try {
    await mongoose.connect(MONGODB_URI, options);
    logger.info('Connected to MongoDB');

    // Verify SMTP connection (non-blocking)
    EmailService.verifyConnection();
    
    // Start server only after successful connection
    if (!server.listening) {
      server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
      });
    }
  } catch (error: any) {
    logger.error(`DB Connection Error: ${error.message}`);
    
    // Exponential Backoff: Wait longer with each failure (up to 30s)
    const delay = Math.min(Math.pow(2, retryCount) * 1000, 30000);
    logger.info(`Retrying MongoDB connection in ${delay / 1000}s... (Attempt ${retryCount + 1})`);
    
    setTimeout(() => connectDB(retryCount + 1), delay);
  }
};

connectDB();
