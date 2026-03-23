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

// Organization specific routes
apiRouter.use('/:orgType/voters', voterRouter);
apiRouter.use('/:orgType/elections', electionRouter);
apiRouter.use('/:orgType/elections/:electionId/candidates', candidateRouter);
apiRouter.use('/:orgType/vote', voteRouter);
apiRouter.use('/:orgType/elections/:id/results', resultsRouter);
apiRouter.use('/:orgType/audit', auditRouter);
apiRouter.use('/:orgType/dashboard', dashboardRouter);
