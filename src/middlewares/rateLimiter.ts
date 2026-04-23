import { rateLimit } from 'express-rate-limit';

// General API Rate Limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: (req: any) => {
    // Development Bypass/High Limit
    if (process.env.NODE_ENV === 'development') {
      return 5000; // Very high limit for local development
    }

    // Session Awareness: Authenticated users get 2000, guests get 300
    // Increased guest limit from 100 to 300 to better support polling
    return req.user ? 2000 : 300;
  },
  standardHeaders: 'draft-7', // Returns RateLimit-* headers
  legacyHeaders: false,
  skip: (req: any) => {
    // Skip rate limiting for internal/local requests in development
    return process.env.NODE_ENV === 'development' && (req.ip === '::1' || req.ip === '127.0.0.1');
  },
  message: {
    status: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter limiter for voting to prevent automated mass submissions
export const voteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 vote attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Vote limit exceeded for this hour. Please try again later.',
});

// Stricter limiter for login
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again after 15 minutes.',
});
