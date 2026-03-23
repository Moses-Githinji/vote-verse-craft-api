import { Router } from 'express';
import { 
  getCandidates, 
  createCandidate, 
  updateCandidate, 
  deleteCandidate 
} from '../controllers/candidateController';
import { authenticate, requireRole, requireOrgAccess, optionalAuth } from '../middlewares/auth';
import { uploadImage } from '../middlewares/upload';

export const candidateRouter = Router({ mergeParams: true });

candidateRouter.use(optionalAuth, (req, res, next) => {
  if (req.method === 'GET') {
     return authenticate(req, res, next);
  }
  next();
});

candidateRouter.use((req, res, next) => {
  if (req.method !== 'GET') {
    authenticate(req, res, () => {
      requireRole(['super_admin', 'admin'])(req, res, () => {
        requireOrgAccess(req, res, next);
      });
    });
  } else {
    next();
  }
});

candidateRouter.get('/', getCandidates);
// Using upload.single('profilePicture') to handle image form uploads
candidateRouter.post('/', uploadImage.single('profilePicture'), createCandidate);
candidateRouter.put('/:candidateId', uploadImage.single('profilePicture'), updateCandidate);
candidateRouter.delete('/:candidateId', deleteCandidate);
