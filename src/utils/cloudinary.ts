import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { config } from '../config/config';
import createHttpError from 'http-errors';

export class CloudinaryService {
    constructor() {
        cloudinary.config({
            cloud_name: config.cloudinary.cloud_name,
            api_key: config.cloudinary.api_key,
            api_secret: config.cloudinary.api_secret
        });
    }

    async uploadImage(
        buffer: Buffer,
        folder: string = 'games'
    ): Promise<UploadApiResponse> {
        try {
            return await new Promise<UploadApiResponse>((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { resource_type: 'image', folder },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result as UploadApiResponse);
                    }
                ).end(buffer);
            });
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            throw createHttpError.InternalServerError('Error uploading image');
        }
    }
}