import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export class UploadedFilePayload {
  fieldname?: string;
  originalname!: string;
  encoding?: string;
  mimetype!: string;
  size!: number;
  buffer!: Buffer;
}

export type StorageProviderType = 'cloudinary' | 's3' | 'local';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadsRoot = path.join(process.cwd(), 'uploads');
  private s3Client: S3Client | null = null;
  private s3Bucket: string | null = null;
  private s3Region = 'us-east-1';
  private cloudinaryActive = false;
  private cloudinary: any = null;

  constructor() {
    this.ensureDirectory(this.uploadsRoot);
    this.ensureDirectory(path.join(this.uploadsRoot, 'evidence'));
    this.ensureDirectory(path.join(this.uploadsRoot, 'kyc'));
    this.ensureDirectory(path.join(this.uploadsRoot, 'tickets'));
    this.ensureDirectory(path.join(this.uploadsRoot, 'general'));
    this.initStorageProviders();
  }

  async onModuleInit() {
    await this.initStorageProviders();
  }

  private async initStorageProviders() {
    // 1. Sanitizar y cargar Cloudinary con protecciones contra valores malformados
    if (process.env.CLOUDINARY_URL) {
      let raw = process.env.CLOUDINARY_URL.trim();
      if (raw.startsWith('CLOUDINARY_URL=')) {
        raw = raw.replace(/^CLOUDINARY_URL=\s*/, '');
      }
      raw = raw.replace(/^["']|["']$/g, '').trim();

      if (!raw.startsWith('cloudinary://')) {
        this.logger.warn(`⚠️ [Cloudinary] El valor de CLOUDINARY_URL no comienza con 'cloudinary://'. Se detectó: "${raw.slice(0, 15)}...". Desactivando Cloudinary para evitar caídas del servidor. Usa formato: cloudinary://API_KEY:API_SECRET@CLOUD_NAME`);
        delete process.env.CLOUDINARY_URL;
      } else {
        process.env.CLOUDINARY_URL = raw;
      }
    }

    try {
      if (
        process.env.CLOUDINARY_URL ||
        (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
      ) {
        const cldModule = await import('cloudinary');
        this.cloudinary = cldModule.v2 || cldModule.default?.v2 || cldModule;

        if (process.env.CLOUDINARY_URL) {
          this.cloudinary.config();
          this.cloudinaryActive = true;
          this.logger.log('☁️ Almacenamiento en Nube: Cloudinary conectado exitosamente');
        } else if (process.env.CLOUDINARY_CLOUD_NAME) {
          this.cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true,
          });
          this.cloudinaryActive = true;
          this.logger.log(`☁️ Almacenamiento en Nube: Cloudinary configurado para "${process.env.CLOUDINARY_CLOUD_NAME}"`);
        }
      }
    } catch (err: any) {
      this.logger.warn('⚠️ [Cloudinary] Error al inicializar Cloudinary, se activará almacenamiento local:', err?.message || err);
      this.cloudinaryActive = false;
      this.cloudinary = null;
    }

    // 2. AWS S3 / S3-Compatible (Cloudflare R2, Supabase Storage, DigitalOcean Spaces)
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
    const accessKey = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;

    if (bucket && accessKey && secretKey) {
      this.s3Bucket = bucket;
      this.s3Region = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
      const endpoint = process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT;

      this.s3Client = new S3Client({
        region: this.s3Region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: !!endpoint,
      });

      this.logger.log(`🪣 Almacenamiento en Nube: AWS S3 compatible configurado para bucket "${bucket}"`);
    }

    if (!this.cloudinaryActive && !this.s3Client) {
      this.logger.log('📁 Almacenamiento: Modo Local Disco (/uploads). Para persistencia en la nube, define variables de Cloudinary o AWS S3.');
    }
  }

  public getActiveProvider(): StorageProviderType {
    if (this.cloudinaryActive) return 'cloudinary';
    if (this.s3Client) return 's3';
    return 'local';
  }

  private ensureDirectory(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Guarda un archivo Multipart subido (Cloudinary -> S3 -> Local)
   */
  async handleFileUpload(file: UploadedFilePayload, category = 'general') {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }

    const cleanCategory = ['evidence', 'kyc', 'tickets', 'general'].includes(category)
      ? category
      : 'general';

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

    if (!allowedExts.includes(ext)) {
      throw new BadRequestException(`Extensión no permitida (${ext}). Permitidas: ${allowedExts.join(', ')}`);
    }

    const safeName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;

    // A) Cloudinary
    if (this.cloudinaryActive) {
      try {
        const cloudUrl = await this.uploadBufferToCloudinary(file.buffer, cleanCategory, safeName);
        return {
          success: true,
          url: cloudUrl,
          filename: safeName,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          category: cleanCategory,
          provider: 'cloudinary',
          createdAt: new Date().toISOString(),
        };
      } catch (err: any) {
        this.logger.error('Error al subir a Cloudinary, intentando fallback:', err?.message || err);
      }
    }

    // B) AWS S3 / Compatible
    if (this.s3Client && this.s3Bucket) {
      try {
        const s3Url = await this.uploadBufferToS3(file.buffer, cleanCategory, safeName, file.mimetype);
        return {
          success: true,
          url: s3Url,
          filename: safeName,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          category: cleanCategory,
          provider: 's3',
          createdAt: new Date().toISOString(),
        };
      } catch (err: any) {
        this.logger.error('Error al subir a S3, intentando fallback local:', err?.message || err);
      }
    }

    // C) Fallback Local en disco
    const targetFolder = path.join(this.uploadsRoot, cleanCategory);
    this.ensureDirectory(targetFolder);
    const targetPath = path.join(targetFolder, safeName);

    await fs.promises.writeFile(targetPath, file.buffer);

    const relativeUrl = `/uploads/${cleanCategory}/${safeName}`;

    return {
      success: true,
      url: relativeUrl,
      filename: safeName,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      category: cleanCategory,
      provider: 'local',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Guarda una imagen en formato Base64 (capturas de cámara, firmas o selfies)
   */
  async handleBase64Upload(base64Data: string, category = 'general', filenameHint = 'capture') {
    if (!base64Data) {
      throw new BadRequestException('El campo base64Data es requerido');
    }

    const cleanCategory = ['evidence', 'kyc', 'tickets', 'general'].includes(category)
      ? category
      : 'general';

    const safeId = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // A) Cloudinary admite data URIs de Base64 directamente
    if (this.cloudinaryActive && this.cloudinary) {
      try {
        const formattedUri = base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
        const uploadResult = await this.cloudinary.uploader.upload(formattedUri, {
          folder: `chambaya/${cleanCategory}`,
          public_id: `${filenameHint}_${safeId}`,
          resource_type: 'auto',
        });

        return {
          success: true,
          url: uploadResult.secure_url || uploadResult.url,
          filename: `${filenameHint}_${safeId}`,
          size: uploadResult.bytes || 0,
          mimetype: uploadResult.format ? `image/${uploadResult.format}` : 'image/jpeg',
          category: cleanCategory,
          provider: 'cloudinary',
          createdAt: new Date().toISOString(),
        };
      } catch (err: any) {
        this.logger.error('Error al subir Base64 a Cloudinary, intentando fallback:', err?.message || err);
      }
    }

    // Procesar buffer binario para S3 o Local
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let ext = '.jpg';
    let mime = 'image/jpeg';

    if (matches && matches.length === 3) {
      mime = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
      if (mime === 'image/png') ext = '.png';
      else if (mime === 'image/webp') ext = '.webp';
      else if (mime === 'application/pdf') ext = '.pdf';
    } else {
      buffer = Buffer.from(base64Data, 'base64');
    }

    const safeName = `${filenameHint}_${safeId}${ext}`;

    // B) AWS S3 / Compatible
    if (this.s3Client && this.s3Bucket) {
      try {
        const s3Url = await this.uploadBufferToS3(buffer, cleanCategory, safeName, mime);
        return {
          success: true,
          url: s3Url,
          filename: safeName,
          size: buffer.length,
          mimetype: mime,
          category: cleanCategory,
          provider: 's3',
          createdAt: new Date().toISOString(),
        };
      } catch (err: any) {
        this.logger.error('Error al subir Base64 a S3, intentando fallback local:', err?.message || err);
      }
    }

    // C) Fallback Local en disco
    const targetFolder = path.join(this.uploadsRoot, cleanCategory);
    this.ensureDirectory(targetFolder);
    const targetPath = path.join(targetFolder, safeName);

    await fs.promises.writeFile(targetPath, buffer);

    const relativeUrl = `/uploads/${cleanCategory}/${safeName}`;

    return {
      success: true,
      url: relativeUrl,
      filename: safeName,
      size: buffer.length,
      mimetype: mime,
      category: cleanCategory,
      provider: 'local',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Helper para subir buffer a Cloudinary mediante streams
   */
  private uploadBufferToCloudinary(buffer: Buffer, category: string, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.cloudinary) return reject(new Error('Cloudinary no inicializado'));
      const publicId = path.parse(filename).name;
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder: `chambaya/${category}`,
          public_id: publicId,
          resource_type: 'auto',
        },
        (error: any, result: any) => {
          if (error) return reject(error);
          resolve(result?.secure_url || result?.url || '');
        },
      );
      uploadStream.end(buffer);
    });
  }

  /**
   * Helper para subir buffer a AWS S3 o compatible
   */
  private async uploadBufferToS3(buffer: Buffer, category: string, filename: string, mime: string): Promise<string> {
    const key = `chambaya/${category}/${filename}`;
    const command = new PutObjectCommand({
      Bucket: this.s3Bucket!,
      Key: key,
      Body: buffer,
      ContentType: mime,
    });

    await this.s3Client!.send(command);

    const customPublicUrl = process.env.S3_PUBLIC_URL || process.env.AWS_S3_PUBLIC_URL;
    if (customPublicUrl) {
      return `${customPublicUrl.replace(/\/$/, '')}/${key}`;
    }

    const endpoint = process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT;
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${this.s3Bucket}/${key}`;
    }

    return `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${key}`;
  }
}

