import { Router } from 'express';
import { 
  generateSimulationData, 
  startSimulation, 
  stopSimulation, 
  generateCandidates,
  clearSimulationVoters
} from '../controllers/simulationController';

const router = Router();

// Only enable simulation routes in non-production environments
if (process.env.NODE_ENV !== 'production') {
  router.post('/generate-voters', generateSimulationData);
  router.delete('/voters', clearSimulationVoters);
  router.post('/start', startSimulation);
  router.post('/stop', stopSimulation);
  router.post('/generate-candidates', generateCandidates);
}

export default router;
