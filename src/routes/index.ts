import { Router } from 'express';
import { authRouter } from './authRoutes';
import { orgRouter } from './organizationRoutes'; // Keeping orgRouter as per original, but the instruction uses organizationRouter in the mounting. I will assume orgRouter is meant to be organizationRouter.
import { voterRouter } from './voterRoutes';
import { electionRouter } from './electionRoutes';
import { voteRouter } from './voteRoutes';
import { resultsRouter } from './resultsRoutes';
import { auditRouter } from './auditRoutes';
import { dashboardRouter } from './dashboardRoutes';
import { candidateRouter } from './candidateRoutes';

export const apiRouter = Router();

// Routes
apiRouter.use('/auth', authRouter);
apiRouter.use('/organizations', orgRouter); // Changed to orgRouter to match import, assuming instruction had a typo with organizationRouter

// Organization specific routes - org type removed, org derived from JWT token
apiRouter.use('/voters', voterRouter);
apiRouter.use('/elections', electionRouter);
apiRouter.use('/elections/:electionId/candidates', candidateRouter);
apiRouter.use('/vote', voteRouter);
apiRouter.use('/elections/:id/results', resultsRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/dashboard', dashboardRouter);
