import { Router } from 'express';
import { generateBallotQuestions, analyzeBallot, getAIJobStatus } from '../controllers/aiController';
import { authenticate, requireRole, requireOrgAccess } from '../middlewares/auth';
import { requireFeature } from '../middlewares/entitlementGuard';

export const aiRouter = Router();

// Protect AI routes - only admins should be able to generate/analyze ballots
aiRouter.post('/generate-ballot', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, generateBallotQuestions);
aiRouter.post('/analyze-ballot', authenticate, requireRole(['super_admin', 'admin']), requireOrgAccess, requireFeature('aiInsights'), analyzeBallot);
aiRouter.get('/status/:jobId', authenticate, requireRole(['super_admin', 'admin']), getAIJobStatus);
