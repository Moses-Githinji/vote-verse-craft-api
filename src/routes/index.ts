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
import { mediaRouter } from './mediaRoutes';
import { aiRouter } from './aiRoutes';
import simulationRouter from './simulationRoutes';

export const apiRouter = Router();

// Routes
apiRouter.use('/auth', authRouter);
apiRouter.use('/simulate', simulationRouter);
apiRouter.use('/:orgType/simulate', simulationRouter);
apiRouter.use('/organizations', orgRouter); // Changed to orgRouter to match import, assuming instruction had a typo with organizationRouter
apiRouter.use('/media', mediaRouter);

// Organization specific routes - org type support added
apiRouter.use('/:orgType/voters', voterRouter);
apiRouter.use('/:orgType/elections', electionRouter);
apiRouter.use('/:orgType/elections/:electionId/candidates', candidateRouter);
apiRouter.use('/:orgType/dashboard', dashboardRouter);
apiRouter.use('/:orgType/elections/:id/results', resultsRouter);
apiRouter.use('/:orgType/audit', auditRouter);
apiRouter.use('/:orgType/ai', aiRouter);

// Original routes for backward compatibility
apiRouter.use('/voters', voterRouter);
apiRouter.use('/elections', electionRouter);
apiRouter.use('/elections/:electionId/candidates', candidateRouter);
apiRouter.use('/vote', voteRouter);
apiRouter.use('/elections/:id/results', resultsRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/ai', aiRouter);
