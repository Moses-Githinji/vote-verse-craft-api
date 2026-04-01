import { Router } from 'express';
import { generateBallotQuestions, analyzeBallot } from '../controllers/aiController';
import { authenticate, requireRole } from '../middlewares/auth';

export const aiRouter = Router();

// Protect AI routes - only admins should be able to generate/analyze ballots
aiRouter.post('/generate-ballot', authenticate, requireRole(['super_admin', 'admin']), generateBallotQuestions);
aiRouter.post('/analyze-ballot', authenticate, requireRole(['super_admin', 'admin']), analyzeBallot);
