import { Router } from 'express';
import { 
  generateSimulationData, 
  startSimulation, 
  stopSimulation, 
  generateCandidates,
  clearSimulationVoters
} from '../controllers/simulationController';

const router = Router();

// Enable simulation routes for all environments to allow access from production app
router.post('/generate-voters', generateSimulationData);
router.delete('/voters', clearSimulationVoters);
router.post('/start', startSimulation);
router.post('/stop', stopSimulation);
router.post('/generate-candidates', generateCandidates);

export default router;
