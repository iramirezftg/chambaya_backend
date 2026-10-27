import { describe, it, expect } from 'vitest';
import { UploadService } from './upload.service.js';

describe('UploadService', () => {
  const uploadService = new UploadService();

  it('debe procesar un archivo simulado y retornar URL relativa segura', async () => {
    const mockFile = {
      originalname: 'evidencia_fuga.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake-image-bytes'),
    };

    const res = await uploadService.handleFileUpload(mockFile, 'evidence');

    expect(res.success).toBe(true);
    expect(res.url).toMatch(/^\/uploads\/evidence\/[0-9]+_[a-f0-9-]+\.jpg$/);
    expect(res.category).toBe('evidence');
    expect(res.mimetype).toBe('image/jpeg');
  });

  it('debe procesar una cadena base64 y asignarle nombre y formato correcto', async () => {
    // 1x1 pixel base64 PNG
    const base64Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await uploadService.handleBase64Upload(base64Png, 'kyc', 'selfie');

    expect(res.success).toBe(true);
    expect(res.url).toMatch(/^\/uploads\/kyc\/selfie_[0-9]+_[a-f0-9-]+\.png$/);
    expect(res.category).toBe('kyc');
    expect(res.mimetype).toBe('image/png');
  });

  it('debe rechazar extensiones no permitidas', async () => {
    const invalidFile = {
      originalname: 'malware.exe',
      mimetype: 'application/x-msdownload',
      size: 500,
      buffer: Buffer.from('malicious-content'),
    };

    await expect(uploadService.handleFileUpload(invalidFile, 'general')).rejects.toThrow();
  });

  it('debe retornar proveedor local por defecto si no hay credenciales cloud', () => {
    expect(uploadService.getActiveProvider()).toBe('local');
  });
});
