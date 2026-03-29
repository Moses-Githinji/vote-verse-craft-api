declare module 'multer-storage-cloudinary' {
  import { StorageEngine } from 'multer';
  import { ConfigOptions } from 'cloudinary';

  export interface Options {
    cloudinary: any; // v2 uses any for cloudinary instance usually
    params?: {
      folder?: string;
      format?: string;
      allowed_formats?: string[];
      transformation?: any;
      [key: string]: any;
    };
    [key: string]: any;
  }

  const CloudinaryStorage: (options: Options) => StorageEngine;
  export default CloudinaryStorage;
}

