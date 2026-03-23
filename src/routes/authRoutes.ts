import { Router } from 'express';
import { login } from '../controllers/authController';
import { loginLimiter } from '../middlewares/rateLimiter';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, login);
// In a full app: refresh and logout, forgot password
