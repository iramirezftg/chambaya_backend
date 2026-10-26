import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { FieldOpsService } from './field-ops.service.js';

@ApiTags('Operaciones de Campo & Evidencias (FieldOps)')
@Controller('field-ops')
export class FieldOpsController {
  constructor(private fieldOpsService: FieldOpsService) {}

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Consultar evidencias fotográficas y refacciones de una orden' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-5647' })
  getBookingFieldOps(@Param('bookingId') bookingId: string) {
    return this.fieldOpsService.getBookingFieldOps(bookingId);
  }

  @Post('booking/:bookingId/evidence')
  @ApiOperation({ summary: 'Chambeador: Registrar evidencia fotográfica (Antes, Después o En Progreso)' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-5647' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['BEFORE', 'AFTER', 'IN_PROGRESS'], example: 'BEFORE' },
        photoUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7' },
        description: { type: 'string', example: 'Inspección inicial de la fuga en tubería de cocina' },
        lat: { type: 'number', example: 19.4194 },
        lng: { type: 'number', example: -99.1634 },
      },
      required: ['type', 'photoUrl'],
    },
  })
  addEvidence(
    @Param('bookingId') bookingId: string,
    @Body()
    body: {
      type: 'BEFORE' | 'AFTER' | 'IN_PROGRESS';
      photoUrl: string;
      description?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    return this.fieldOpsService.addEvidence(bookingId, body);
  }

  @Post('booking/:bookingId/materials/request')
  @ApiOperation({ summary: 'Chambeador: Solicitar autorización de compra en ferretería con ticket adjunto' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-5647' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: { type: 'string', example: 'Cople de PVC 1/2 + Soldadura y pasta fundente' },
        storeName: { type: 'string', example: 'Ferretería El Tornillo Roma Norte' },
        ticketPhotoUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c' },
        amount: { type: 'number', example: 185.0 },
      },
      required: ['description', 'ticketPhotoUrl', 'amount'],
    },
  })
  requestMaterialItem(
    @Param('bookingId') bookingId: string,
    @Body()
    body: {
      description: string;
      storeName?: string;
      ticketPhotoUrl: string;
      amount: number;
    },
  ) {
    return this.fieldOpsService.requestMaterialItem(bookingId, body);
  }

  @Post('materials/:itemId/respond')
  @ApiOperation({ summary: 'Cliente: Autorizar o Rechazar el cargo de materiales con ticket' })
  @ApiParam({ name: 'itemId', example: 'material-uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        approved: { type: 'boolean', example: true },
        rejectionReason: { type: 'string', example: 'El costo excede mi presupuesto' },
      },
      required: ['approved'],
    },
  })
  respondMaterialItem(
    @Param('itemId') itemId: string,
    @Body() body: { approved: boolean; rejectionReason?: string },
  ) {
    return this.fieldOpsService.respondMaterialItem(itemId, body);
  }
}
