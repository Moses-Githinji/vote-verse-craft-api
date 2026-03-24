import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV === 'development';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  message: { success: false, error: 'Too many requests from this IP, please try again later' },
});

export const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 10,
  message: { success: false, error: 'Too many voting attempts, please wait' },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 5,
  message: { success: false, error: 'Too many login attempts, please try again later' },
});
