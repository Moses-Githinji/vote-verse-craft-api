import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRouter } from './routes';
import { apiLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';

export const app = express();

// Middlewares
app.use(helmet());
app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Get allowed origins - prioritize FRONTEND_URL if set
    const allowedOrigins = process.env.FRONTEND_URL 
      ? [process.env.FRONTEND_URL] 
      : ['http://localhost:8081', 'http://localhost:3000'];
    
    // In production, also allow the Vercel frontend
    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push('https://kurapap-admin.vercel.app');
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all incoming requests
app.use(requestLogger);

// Global rate limiter
app.use('/api', apiLimiter);

// Routes
app.use('/api/v1', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);
