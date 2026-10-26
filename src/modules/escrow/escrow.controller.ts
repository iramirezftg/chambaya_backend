import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { EscrowService } from './escrow.service.js';

@ApiTags('Escrow & Satisfaction Guarantee')
@Controller('escrow')
export class EscrowController {
  constructor(private escrowService: EscrowService) {}

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Consultar estado de la Bóveda de Garantía (Escrow) de una orden' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-5647' })
  getEscrowByBooking(@Param('bookingId') bookingId: string) {
    return this.escrowService.getEscrowByBooking(bookingId);
  }

  @Post('booking/:bookingId/hold')
  @ApiOperation({ summary: 'Asegurar fondos de orden en custodia preventiva (Escrow Hold)' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-5647' })
  holdInEscrow(@Param('bookingId') bookingId: string) {
    return this.escrowService.holdInEscrow(bookingId);
  }

  @Post('booking/:bookingId/confirm-satisfaction')
  @ApiOperation({ summary: 'Cliente: Confirmar entera satisfacción y liberar fondos al chambeador' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-5647' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        rating: { type: 'number', example: 5 },
        reviewText: { type: 'string', example: 'Excelente trabajo, puntual y muy profesional.' },
      },
    },
  })
  confirmSatisfaction(
    @Param('bookingId') bookingId: string,
    @Body('rating') rating: number,
    @Body('reviewText') reviewText: string,
  ) {
    return this.escrowService.confirmSatisfactionAndRelease(bookingId, rating, reviewText);
  }

  @Post('booking/:bookingId/dispute')
  @ApiOperation({ summary: 'Cliente: Hacer válida Garantía de Satisfacción e iniciar Disputa' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-5647' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'TRABAJO_DEFECTUOSO' },
        description: { type: 'string', example: 'La instalación tiene fuga en la conexión principal.' },
        evidencePhotos: { type: 'string', example: 'https://images.unsplash.com/photo-1585704032915' },
        requestedRefund: { type: 'number', example: 699 },
      },
      required: ['reason', 'description'],
    },
  })
  openDispute(
    @Param('bookingId') bookingId: string,
    @Body()
    body: {
      reason: string;
      description: string;
      evidencePhotos?: string;
      requestedRefund?: number;
    },
  ) {
    return this.escrowService.openDispute(bookingId, body);
  }

  @Get('admin/disputes')
  @ApiOperation({ summary: 'Torre de Control: Listar disputas de garantía con filtros' })
  @ApiQuery({ name: 'status', required: false, example: 'OPEN' })
  getAdminDisputes(@Query('status') status?: string) {
    return this.escrowService.getAdminDisputes(status);
  }

  @Post('admin/disputes/:id/resolve')
  @ApiOperation({ summary: 'Super Admin: Dictaminar resolución de mediación y liquidar fondos' })
  @ApiParam({ name: 'id', example: 'dispute-uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          enum: ['RELEASE_TO_PROVIDER', 'REFUND_CUSTOMER_FULL', 'SPLIT_SETTLEMENT', 'INSURANCE_CLAIM'],
          example: 'REFUND_CUSTOMER_FULL',
        },
        adminNotes: { type: 'string', example: 'Evidencia fotográfica confirma falla técnica. Reembolso total emitido.' },
        refundAmount: { type: 'number', example: 699 },
        releaseAmount: { type: 'number', example: 0 },
        mediatorName: { type: 'string', example: 'Mediación ChambaYa' },
      },
      required: ['decision', 'adminNotes'],
    },
  })
  resolveDispute(
    @Param('id') id: string,
    @Body()
    body: {
      decision: 'RELEASE_TO_PROVIDER' | 'REFUND_CUSTOMER_FULL' | 'SPLIT_SETTLEMENT' | 'INSURANCE_CLAIM';
      adminNotes: string;
      refundAmount?: number;
      releaseAmount?: number;
      mediatorName?: string;
    },
  ) {
    return this.escrowService.adminResolveDispute(id, body);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Métricas de Bóveda de Garantía y Depósitos Escrow' })
  getStats() {
    return this.escrowService.getStats();
  }
}
