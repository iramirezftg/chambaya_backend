import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadService, UploadedFilePayload } from './upload.service.js';

@ApiTags('Almacenamiento de Archivos y Evidencias')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Subir archivo de evidencia, ticket de ferretería o documento KYC' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        category: {
          type: 'string',
          enum: ['evidence', 'kyc', 'tickets', 'general'],
          default: 'general',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
    }),
  )
  async uploadFile(
    @UploadedFile() file: UploadedFilePayload,
    @Query('category') queryCategory?: string,
    @Body('category') bodyCategory?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo no adjuntado');
    }
    const category = bodyCategory || queryCategory || 'general';
    return this.uploadService.handleFileUpload(file, category);
  }

  @Post('base64')
  @ApiOperation({ summary: 'Subir captura de webcam / cámara móvil en formato Base64' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['base64Data'],
      properties: {
        base64Data: { type: 'string', description: 'Data URI en Base64' },
        category: { type: 'string', default: 'kyc' },
        filenameHint: { type: 'string', default: 'selfie' },
      },
    },
  })
  async uploadBase64(
    @Body('base64Data') base64Data: string,
    @Body('category') category?: string,
    @Body('filenameHint') filenameHint?: string,
  ) {
    return this.uploadService.handleBase64Upload(base64Data, category, filenameHint);
  }
}
