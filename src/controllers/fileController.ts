import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary';

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file provided' } });
    }

    // multer memoryStorage will provide buffer in req.file.buffer
    // multer + cloudinary-storage will usually put a path on req.file.path for direct uploads — handle buffer case.
    const fileBuffer = (req.file as any).buffer;
    const originalName = req.file.originalname;

    if (!fileBuffer) {
      return res
        .status(400)
        .json({
          success: false,
          error: { message: 'File upload failed or invalid storage adapter' },
        });
    }

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'vote-verse/uploads' },
        (error, res) => {
          if (error) return reject(error);
          resolve(res);
        },
      );
      uploadStream.end(fileBuffer);
    });

    res.json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
