import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary';

export const searchImages = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Search query is required' } });
    }

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    const cxId = process.env.GOOGLE_CX_ID;

    if (!apiKey || !cxId) {
      return res.status(500).json({ success: false, error: { message: 'Google API credentials are not configured on the server' } });
    }

    // Call the Google Custom Search API
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(q)}&searchType=image&key=${apiKey}&cx=${cxId}&num=10`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google API Error:', errorData);
      return res.status(response.status).json({ 
        success: false, 
        error: { message: 'Error fetching images from Google API', details: errorData } 
      });
    }

    const data = await response.json();
    
    // Map the results to just the URLs we need for the frontend
    const items = data.items || [];
    const searchResults = items.map((item: any) => ({
      url: item.link,
      thumbnail: item.image?.thumbnailUrl || item.link
    }));

    res.json({ success: true, data: { results: searchResults } });
  } catch (error: any) {
    console.error('Media search controller error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Internal server error' } });
  }
};

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    // Upload the buffer to Cloudinary using upload_stream
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'shulepal/ballot-images', resource_type: 'image' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file!.buffer);
    });

    res.json({ success: true, data: { url: uploadResult.secure_url } });
  } catch (error: any) {
    console.error('Image upload controller error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Upload failed' } });
  }
};

export const uploadVideo = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    // Upload the buffer to Cloudinary using upload_stream (Videos require resource_type: 'video' or 'auto')
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'shulepal/ballot-videos', resource_type: 'video' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file!.buffer);
    });

    res.json({ success: true, data: { url: uploadResult.secure_url } });
  } catch (error: any) {
    console.error('Image upload controller error:', error);
    res.status(500).json({ success: false, error: { message: error.message || 'Upload failed' } });
  }
};
