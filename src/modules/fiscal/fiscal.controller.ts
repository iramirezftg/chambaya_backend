import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Header,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { FiscalService } from './fiscal.service.js';
import type { Response } from 'express';

@ApiTags('Fiscal SAT CFDI 4.0 & Retenciones')
@Controller('fiscal')
export class FiscalController {
  constructor(private fiscalService: FiscalService) {}

  @Post('calculate')
  @ApiOperation({
    summary: 'Calculadora fiscal mexicana de retenciones SAT (ISR 1% e IVA 8%)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        grossAmount: { type: 'number', example: 1200.0 },
        hasRfc: { type: 'boolean', example: true },
        commissionRate: { type: 'number', example: 15.0 },
      },
      required: ['grossAmount'],
    },
  })
  calculateRetentions(
    @Body()
    body: {
      grossAmount: number;
      hasRfc?: boolean;
      commissionRate?: number;
    },
  ) {
    return this.fiscalService.calculateRetentions(
      body.grossAmount,
      body.hasRfc !== false,
      body.commissionRate || 15.0,
    );
  }

  @Post('cfdi/generate')
  @ApiOperation({ summary: 'Timbrar Factura Electrónica CFDI 4.0 con el SAT' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', example: 'CHAMBA-9021' },
        rfcReceptor: { type: 'string', example: 'GOMA920315HA1' },
        nombreReceptor: { type: 'string', example: 'FERNANDA GÓMEZ ÁVILA' },
        domicilioFiscalReceptor: { type: 'string', example: '06700' },
        regimenReceptor: { type: 'string', example: '605' },
        usoCfdi: { type: 'string', example: 'G03' },
        formaPago: { type: 'string', example: '04' },
      },
      required: [
        'bookingId',
        'rfcReceptor',
        'nombreReceptor',
        'domicilioFiscalReceptor',
        'regimenReceptor',
        'usoCfdi',
      ],
    },
  })
  async generateCfdi(@Body() body: any) {
    return this.fiscalService.generateCfdi(body);
  }

  @Get('cfdi/:bookingId')
  @ApiOperation({ summary: 'Obtener datos de Factura CFDI 4.0 por Chamba' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-9021' })
  async getCfdi(@Param('bookingId') bookingId: string) {
    return this.fiscalService.getInvoiceByBooking(bookingId);
  }

  @Get('cfdi/:bookingId/xml')
  @ApiOperation({ summary: 'Descargar archivo XML oficial del CFDI 4.0' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-9021' })
  async downloadXml(@Param('bookingId') bookingId: string, @Res() res: Response) {
    const invoice = await this.fiscalService.getInvoiceByBooking(bookingId);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="CFDI_4.0_${invoice.uuid}.xml"`,
    );
    return res.send(invoice.xmlContent);
  }

  @Get('provider/:providerId/retentions')
  @ApiOperation({
    summary:
      'Constancia mensual de retenciones e información de pagos para el Chambeador / Taller',
  })
  @ApiParam({ name: 'providerId', example: 'prov_01' })
  async getProviderRetentions(@Param('providerId') providerId: string) {
    return this.fiscalService.getProviderTaxReport(providerId);
  }

  @Get('admin/summary')
  @ApiOperation({
    summary:
      'Torre de Control: Reporte global de retenciones SAT a enterar en declaración mensual',
  })
  async getAdminTaxSummary() {
    return this.fiscalService.getGlobalTaxReport();
  }
}
