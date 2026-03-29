import multer from 'multer';
import CloudinaryStorage from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

const imageStorage = (CloudinaryStorage as any)({
  cloudinary: cloudinary,
  params: {
    folder: 'shulepal/candidates',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  } as any,
});

const csvStorage = multer.memoryStorage();

const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPG/PNG) are allowed'));
  }
};

const csvFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'));
  }
};

export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB for images
});

export const uploadCSV = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB for CSVs
});

// Legacy export for compatibility if needed, but better to use specific ones
export const upload = multer({ storage: csvStorage });
