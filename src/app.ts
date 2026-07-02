import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRouter } from './routes';
import { apiLimiter } from './middlewares/rateLimiter';
import { optionalAuth } from './middlewares/auth';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';

export const app = express();

// Security headers
app.use(helmet());

// ==================== CORS CONFIGURATION ====================
const allowedOrigins = [
  'https://admin.kurapap.co.ke',
  'https://org.kurapap.co.ke',
  'https://kurapap.co.ke',
  'https://www.kurapap.co.ke',
  'http://localhost:5174',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization']
}));
// ============================================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
app.use(requestLogger);

// Optional auth middleware
app.use('/api', optionalAuth);

// Rate limiting
app.use('/api', apiLimiter);

// Routes
app.use('/api/v1', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling (must be last)
app.use(errorHandler);

export default app;