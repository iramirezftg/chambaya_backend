import { Injectable, BadRequestException } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class UploadedFilePayload {
  fieldname?: string;
  originalname!: string;
  encoding?: string;
  mimetype!: string;
  size!: number;
  buffer!: Buffer;
}

@Injectable()
export class UploadService {
  private readonly uploadsRoot = path.join(process.cwd(), 'uploads');

  constructor() {
    this.ensureDirectory(this.uploadsRoot);
    this.ensureDirectory(path.join(this.uploadsRoot, 'evidence'));
    this.ensureDirectory(path.join(this.uploadsRoot, 'kyc'));
    this.ensureDirectory(path.join(this.uploadsRoot, 'tickets'));
    this.ensureDirectory(path.join(this.uploadsRoot, 'general'));
  }

  private ensureDirectory(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Guarda un archivo Multipart subido
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
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Guarda una imagen en formato Base64 (capturas de cámara o firmas)
   */
  async handleBase64Upload(base64Data: string, category = 'general', filenameHint = 'capture') {
    if (!base64Data) {
      throw new BadRequestException('El campo base64Data es requerido');
    }

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

    const cleanCategory = ['evidence', 'kyc', 'tickets', 'general'].includes(category)
      ? category
      : 'general';

    const safeName = `${filenameHint}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
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
      createdAt: new Date().toISOString(),
    };
  }
}
