import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('Payments & Gateways')
@Controller('payments')
export class PaymentsController {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
  ) {}

  @Get('gateways')
  @ApiOperation({ summary: 'List all payment gateway configurations' })
  async getGateways() {
    const list = await this.prisma.paymentGateway.findMany();
    const dict: Record<string, { name: string; enabled: boolean; feePercent: number }> = {};
    for (const gw of list) {
      dict[gw.key] = {
        name: gw.name,
        enabled: gw.enabled,
        feePercent: gw.feePercent,
      };
    }
    return dict;
  }

  @Patch('gateways/:key/toggle')
  @ApiOperation({ summary: 'Super Admin: Enable or disable a payment gateway' })
  @ApiParam({ name: 'key', example: 'oxxo' })
  async toggleGateway(@Param('key') key: string) {
    const gw = await this.prisma.paymentGateway.findUnique({ where: { key } });
    if (!gw) {
      throw new NotFoundException(`Gateway ${key} not found`);
    }

    const updated = await this.prisma.paymentGateway.update({
      where: { key },
      data: { enabled: !gw.enabled },
    });

    return {
      name: updated.name,
      enabled: updated.enabled,
      feePercent: updated.feePercent,
    };
  }

  @Post('create-intent')
  @ApiOperation({ summary: 'Crear intención de pago (Stripe, Mercado Pago, OXXO Pay, SPEI)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', example: 'CHAMBA-9021' },
        gateway: {
          type: 'string',
          enum: ['stripe', 'mercadopago', 'oxxo', 'spei', 'tarjeta', 'efectivo'],
          example: 'oxxo',
        },
        amount: { type: 'number', example: 575.0 },
      },
      required: ['bookingId', 'gateway'],
    },
  })
  async createIntent(
    @Body()
    body: {
      bookingId: string;
      gateway: 'stripe' | 'mercadopago' | 'oxxo' | 'spei' | 'tarjeta' | 'efectivo';
      amount?: number;
    },
  ) {
    return this.paymentsService.createPaymentIntent(body);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Consultar estado de pago y comprobante de una chamba' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-9021' })
  async getBookingPayment(@Param('bookingId') bookingId: string) {
    return this.paymentsService.getBookingPaymentInfo(bookingId);
  }

  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Webhook oficial Stripe (payment_intent.succeeded)' })
  async stripeWebhook(@Body() payload: any) {
    return this.paymentsService.handleWebhook(
      'stripe',
      payload.type || 'payment_intent.succeeded',
      payload,
    );
  }

  @Post('webhooks/mercadopago')
  @ApiOperation({ summary: 'Webhook oficial Mercado Pago (IPN / payment.created)' })
  async mercadopagoWebhook(@Body() payload: any) {
    return this.paymentsService.handleWebhook(
      'mercadopago',
      payload.action || 'payment.updated',
      payload,
    );
  }

  @Post('webhooks/oxxo')
  @ApiOperation({ summary: 'Webhook oficial OXXO Pay (oxxo.cashier_payment)' })
  async oxxoWebhook(@Body() payload: any) {
    return this.paymentsService.handleWebhook(
      'oxxo',
      payload.eventType || 'oxxo.cashier_payment',
      payload,
    );
  }

  @Post('webhooks/spei')
  @ApiOperation({ summary: 'Webhook oficial SPEI STP (stp.payment_received)' })
  async speiWebhook(@Body() payload: any) {
    return this.paymentsService.handleWebhook(
      'spei',
      payload.eventType || 'stp.payment_received',
      payload,
    );
  }

  @Post('simulate-webhook')
  @ApiOperation({
    summary: 'Simulador de Webhook para testing en vivo (1 clic para confirmar pago)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', example: 'CHAMBA-9021' },
        gateway: {
          type: 'string',
          enum: ['stripe', 'mercadopago', 'oxxo', 'spei'],
          example: 'oxxo',
        },
      },
      required: ['bookingId', 'gateway'],
    },
  })
  async simulateWebhook(
    @Body()
    body: {
      bookingId: string;
      gateway: 'stripe' | 'mercadopago' | 'oxxo' | 'spei';
    },
  ) {
    return this.paymentsService.handleWebhook(
      body.gateway,
      `${body.gateway}.simulated_payment`,
      {
        bookingId: body.bookingId,
        simulated: true,
        timestamp: new Date().toISOString(),
      },
    );
  }

  @Get('webhooks/logs')
  @ApiOperation({ summary: 'Torre de Control: Historial de Webhooks recibidos' })
  async getWebhookLogs(@Query('limit') limit?: string) {
    const num = limit ? parseInt(limit, 10) : 20;
    return this.paymentsService.getWebhookLogs(num);
  }
}
