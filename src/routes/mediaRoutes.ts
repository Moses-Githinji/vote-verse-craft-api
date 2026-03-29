import { Router } from 'express';
import multer from 'multer';
import { searchImages, uploadImage, uploadVideo } from '../controllers/mediaController';
import { authenticate } from '../middlewares/auth';

export const mediaRouter = Router({ mergeParams: true });

const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const videoMemoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit for videos

// We require authentication to prevent public abuse of your Google API Key
mediaRouter.get('/search-images', authenticate, searchImages);

// Upload an image to Cloudinary and return the secure URL
mediaRouter.post('/upload-image', authenticate, memoryUpload.single('image'), uploadImage);

// Upload a video to Cloudinary and return the secure URL
mediaRouter.post('/upload-video', authenticate, videoMemoryUpload.single('video'), uploadVideo);
