import { Router } from 'express';
import { 
  getOrganizations, 
  createOrganization, 
  getOrganizationById, 
  updateOrganization, 
  deleteOrganization 
} from '../controllers/organizationController';
import { authenticate, requireRole } from '../middlewares/auth';

export const orgRouter = Router();

// Only super_admin can manage organizations globally
orgRouter.use(authenticate, requireRole(['super_admin']));

orgRouter.get('/', getOrganizations);
orgRouter.post('/', createOrganization);
orgRouter.get('/:id', getOrganizationById);
orgRouter.put('/:id', updateOrganization);
orgRouter.delete('/:id', deleteOrganization);
