import { Router } from 'express';
import { uploadFile } from '../controllers/fileController';
import { uploadImage, uploadCSV } from '../middlewares/upload';

export const fileRouter = Router({ mergeParams: true });

// Use multer memory storage; reuse uploadImage but ensure it accepts files beyond images if needed
fileRouter.post('/upload', uploadCSV.single('file'), uploadFile);
