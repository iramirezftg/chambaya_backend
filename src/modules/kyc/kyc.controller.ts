import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { KycService } from './kyc.service.js';

@ApiTags('KYC Identity Verification México')
@Controller('kyc')
export class KycController {
  constructor(private kycService: KycService) {}

  @Post('validate-curp')
  @ApiOperation({ summary: 'Validar CURP contra algoritmo oficial de RENAPO' })
  @ApiBody({ schema: { type: 'object', properties: { curp: { type: 'string', example: 'MEMC850412HDFRND09' } }, required: ['curp'] } })
  validateCurp(@Body('curp') curp: string) {
    return this.kycService.validateCurp(curp);
  }

  @Post('validate-rfc')
  @ApiOperation({ summary: 'Validar RFC Persona Física contra estructura del SAT' })
  @ApiBody({ schema: { type: 'object', properties: { rfc: { type: 'string', example: 'MEMC8504128X9' } }, required: ['rfc'] } })
  validateRfc(@Body('rfc') rfc: string) {
    return this.kycService.validateRfc(rfc);
  }

  @Post('simulate-ocr')
  @ApiOperation({ summary: 'Simular OCR inteligente sobre Credencial para Votar INE / IFE' })
  @ApiBody({ schema: { type: 'object', properties: { nameHint: { type: 'string', example: 'CARLOS MENDOZA' } } } })
  simulateOcr(@Body('nameHint') nameHint?: string) {
    return this.kycService.simulateIneOcr(nameHint);
  }

  @Post('simulate-facematch')
  @ApiOperation({ summary: 'Simular Biometría Facial y Prueba de Vida (Liveness Detection)' })
  simulateFacematch() {
    return this.kycService.simulateFacematch();
  }

  @Get('serviceman/:servicemanId')
  @ApiOperation({ summary: 'Obtener expediente KYC de un chambeador' })
  @ApiParam({ name: 'servicemanId', example: 'sm-1' })
  getServicemanExpediente(@Param('servicemanId') servicemanId: string) {
    return this.kycService.getExpedienteByServiceman(servicemanId);
  }

  @Post('serviceman/:servicemanId/submit')
  @ApiOperation({ summary: 'Chambeador: Enviar o actualizar documentación de expediente KYC' })
  @ApiParam({ name: 'servicemanId', example: 'sm-2' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        curp: { type: 'string', example: 'ROSE900821MDFNLL03' },
        rfc: { type: 'string', example: 'ROSE900821TR2' },
        ineClaveElector: { type: 'string', example: 'ROSELE90082119M200' },
        ineCic: { type: 'string', example: '849201948' },
        ineOcrNumber: { type: 'string', example: 'IDMEX2938471029<<' },
        ineFrontUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1544717305-2782549b5136' },
        ineBackUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1544717305-2782549b5136' },
        selfieUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1573496359142' },
        antecedentesDocUrl: { type: 'string', example: '/docs/fgr_elena.pdf' },
        antecedentesFolio: { type: 'string', example: 'FGR-NL-2026-4421' },
        comprobanteDomicilioUrl: { type: 'string', example: '/docs/cfe_elena.pdf' },
      },
    },
  })
  submitServicemanExpediente(
    @Param('servicemanId') servicemanId: string,
    @Body() body: any,
  ) {
    return this.kycService.submitExpediente(servicemanId, body);
  }

  @Get('admin/expedientes')
  @ApiOperation({ summary: 'Torre de Control: Listar expedientes KYC con filtros' })
  @ApiQuery({ name: 'status', required: false, example: 'UNDER_REVIEW' })
  getAdminExpedientes(@Query('status') status?: string) {
    return this.kycService.getAdminExpedientes(status);
  }

  @Post('admin/:id/dictamen')
  @ApiOperation({ summary: 'Super Admin: Emitir dictamen sobre expediente KYC (Aprobar o Rechazar)' })
  @ApiParam({ name: 'id', example: 'expediente-uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['APPROVED', 'REJECTED'], example: 'APPROVED' },
        notes: { type: 'string', example: 'Expediente cotejado con el padrón del INE y constancia SAT.' },
        adminUser: { type: 'string', example: 'SuperAdmin ChambaYa' },
      },
      required: ['decision'],
    },
  })
  dictamenExpediente(
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVED' | 'REJECTED',
    @Body('notes') notes: string,
    @Body('adminUser') adminUser?: string,
  ) {
    return this.kycService.adminDictamen(id, decision, notes, adminUser);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Métricas del Sistema de Validación KYC' })
  getStats() {
    return this.kycService.getStats();
  }
}
