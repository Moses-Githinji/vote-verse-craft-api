import { Router } from 'express';
import { generateBallotQuestions } from '../controllers/aiController';
import { authenticate, requireRole } from '../middlewares/auth';

export const aiRouter = Router();

// Protect AI routes - only admins should be able to generate ballots
aiRouter.post('/generate-ballot', authenticate, requireRole(['super_admin', 'admin']), generateBallotQuestions);
