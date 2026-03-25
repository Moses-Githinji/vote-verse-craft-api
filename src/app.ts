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

// CORS - allow production frontend explicitly
const corsOptions = {
  origin: function(origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:8081',
      'http://localhost:3000',
      'https://kurapap-admin.vercel.app'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
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
