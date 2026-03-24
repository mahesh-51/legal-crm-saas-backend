import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export type CloudinaryResourceKind = 'image' | 'video' | 'raw';

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('cloudinary.cloudName');
    const apiKey = this.config.get<string>('cloudinary.apiKey');
    const apiSecret = this.config.get<string>('cloudinary.apiSecret');
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }
  }

  private ensureConfigured(): void {
    const cloudName = this.config.get<string>('cloudinary.cloudName');
    const apiKey = this.config.get<string>('cloudinary.apiKey');
    const apiSecret = this.config.get<string>('cloudinary.apiSecret');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }
  }

  resourceKindFromMimetype(mimetype: string): CloudinaryResourceKind {
    if (mimetype.startsWith('image/')) {
      return 'image';
    }
    if (mimetype.startsWith('video/')) {
      return 'video';
    }
    return 'raw';
  }

  getBaseFolder(): string {
    return this.config.get<string>('cloudinary.folder') || 'legal-crm';
  }

  async uploadBuffer(
    buffer: Buffer,
    options: {
      publicId: string;
      mimetype: string;
      overwrite?: boolean;
    },
  ): Promise<{
    secureUrl: string;
    publicId: string;
    resourceType: CloudinaryResourceKind;
  }> {
    this.ensureConfigured();
    const resourceType = this.resourceKindFromMimetype(options.mimetype);
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: options.publicId,
          resource_type: resourceType,
          overwrite: options.overwrite ?? false,
          invalidate: options.overwrite ?? false,
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }
          if (!result?.secure_url || !result.public_id) {
            return reject(new Error('Cloudinary upload returned no result'));
          }
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            resourceType,
          });
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }

  async destroy(
    publicId: string,
    resourceType: CloudinaryResourceKind,
  ): Promise<void> {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }
}
