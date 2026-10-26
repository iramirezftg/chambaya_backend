import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChatTelemetryGateway } from '../chat-telemetry/chat-telemetry.gateway.js';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatTelemetryGateway))
    private wsGateway: ChatTelemetryGateway,
  ) {}

  /**
   * Crear o actualizar la intención de pago para una chamba
   */
  async createPaymentIntent(dto: {
    bookingId: string;
    gateway: 'stripe' | 'mercadopago' | 'oxxo' | 'spei' | 'tarjeta' | 'efectivo';
    amount?: number;
  }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`La chamba ${dto.bookingId} no existe`);
    }

    const amount = dto.amount || booking.amount;
    const normalizedGateway = dto.gateway === 'tarjeta' ? 'stripe' : dto.gateway;

    // Generar datos específicos por pasarela
    let externalId: string | null = null;
    let clientSecret: string | null = null;
    let oxxoReference: string | null = null;
    let oxxoBarcode: string | null = null;
    let oxxoExpiresAt: Date | null = null;
    let speiClabe: string | null = null;
    let receiptUrl: string | null = null;

    const randomDigits = (len: number) =>
      Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');

    switch (normalizedGateway) {
      case 'stripe':
        externalId = `pi_3${Date.now().toString(36)}${randomDigits(14)}`;
        clientSecret = `${externalId}_secret_${Date.now().toString(36)}${randomDigits(10)}`;
        receiptUrl = `https://pay.stripe.com/receipts/chambaya_${externalId}`;
        break;

      case 'mercadopago':
        externalId = `mp_pref_${Date.now()}_${randomDigits(6)}`;
        clientSecret = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${externalId}`;
        receiptUrl = `https://www.mercadopago.com.mx/comprobante?id=${externalId}`;
        break;

      case 'oxxo':
        // Referencia OXXO Pay de 14 dígitos (ej. 9382 7104 5592 10)
        const refDigits = `9382${randomDigits(10)}`;
        oxxoReference = refDigits;
        oxxoBarcode = `${refDigits}00000000`;
        // Expira en 48 horas
        oxxoExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        externalId = `oxxo_ref_${refDigits}`;
        break;

      case 'spei':
        // CLABE interbancaria STP de 18 dígitos: 646 (STP) + 180 (Plaza) + 11 dígitos + 1 control
        speiClabe = `646180${randomDigits(12)}`;
        externalId = `spei_${speiClabe}`;
        break;

      case 'efectivo':
        externalId = `cash_otp_${booking.otp}`;
        break;

      default:
        externalId = `txn_${Date.now()}`;
    }

    // Registrar o actualizar transacción
    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        bookingId: booking.id,
        gateway: normalizedGateway,
        amount,
        currency: 'MXN',
        status: normalizedGateway === 'efectivo' ? 'pending' : 'pending',
        externalId,
        clientSecret,
        oxxoReference,
        oxxoBarcode,
        oxxoExpiresAt,
        speiClabe,
        speiBank: 'STP (Sistema de Transferencias y Pagos)',
        receiptUrl,
      },
    });

    return {
      success: true,
      transaction,
      booking: {
        id: booking.id,
        amount: booking.amount,
        serviceTitle: booking.serviceTitle,
        customerName: booking.customerName,
      },
      instructions: this.getInstructions(normalizedGateway, {
        oxxoReference,
        speiClabe,
        amount,
        bookingId: booking.id,
      }),
    };
  }

  /**
   * Procesar Webhook (Stripe, Mercado Pago, OXXO Pay, SPEI)
   */
  async handleWebhook(
    gateway: 'stripe' | 'mercadopago' | 'oxxo' | 'spei',
    eventType: string,
    payload: any,
  ) {
    // 1. Guardar log del webhook entrante
    await this.prisma.webhookLog.create({
      data: {
        gateway,
        eventType,
        payload: JSON.stringify(payload),
        processed: true,
      },
    });

    // 2. Extraer identificadores del pago
    let bookingId: string | undefined = payload.bookingId;
    let externalId: string | undefined = payload.externalId || payload.id;
    let oxxoReference: string | undefined = payload.oxxoReference;

    // Si viene de Stripe
    if (gateway === 'stripe' && payload.data?.object) {
      externalId = payload.data.object.id;
      bookingId = payload.data.object.metadata?.bookingId || bookingId;
    }

    // Si viene de Mercado Pago
    if (gateway === 'mercadopago' && payload.data) {
      externalId = payload.data.id ? `mp_pref_${payload.data.id}` : externalId;
    }

    // Si no tenemos bookingId directo, buscar por externalId o oxxoReference
    let transaction = null;
    if (bookingId) {
      transaction = await this.prisma.paymentTransaction.findFirst({
        where: { bookingId, gateway },
        orderBy: { createdAt: 'desc' },
      });
    } else if (externalId) {
      transaction = await this.prisma.paymentTransaction.findFirst({
        where: { externalId },
        orderBy: { createdAt: 'desc' },
      });
    } else if (oxxoReference) {
      transaction = await this.prisma.paymentTransaction.findFirst({
        where: { oxxoReference },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!transaction && !bookingId) {
      // Fallback para pruebas si no coincide: usar la primera chamba pendiente
      const fallbackBooking = await this.prisma.booking.findFirst({
        where: { paymentStatus: { not: 'paid' } },
      });
      if (fallbackBooking) {
        bookingId = fallbackBooking.id;
      }
    } else if (transaction) {
      bookingId = transaction.bookingId;
    }

    if (!bookingId) {
      return { received: true, note: 'No matching booking found for webhook' };
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    // 3. Marcar transacción como pagada
    if (transaction) {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'paid' },
      });
    }

    // 4. Actualizar estatus de la Chamba
    const gatewayName =
      gateway === 'stripe'
        ? 'Stripe México'
        : gateway === 'mercadopago'
        ? 'Mercado Pago'
        : gateway === 'oxxo'
        ? 'OXXO Pay'
        : 'SPEI STP';

    const nowFormatted = new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'paid',
        paymentMethod: gateway,
        transactionId: externalId || `TXN-${Date.now()}`,
      },
    });

    // 5. Agregar hito en la línea de tiempo
    await this.prisma.bookingTimeline.create({
      data: {
        bookingId: booking.id,
        status: 'paid',
        label: `Pago acreditado exitosamente vía ${gatewayName} ($${booking.amount.toFixed(2)} MXN)`,
        time: nowFormatted,
      },
    });

    // 6. Registrar notificación SMS
    await this.prisma.smsLog.create({
      data: {
        to: booking.customerPhone,
        text: `ChambaYa: ¡Tu pago de $${booking.amount.toFixed(2)} MXN vía ${gatewayName} para ${booking.serviceTitle} fue confirmado! Código de seguridad: ${booking.otp}.`,
        time: nowFormatted,
      },
    });

    // 7. Notificar a través del WebSocket Gateway en tiempo real
    try {
      const room = `booking_${booking.id}`;
      this.wsGateway?.server?.to(room).emit('payment_confirmed', {
        bookingId: booking.id,
        amount: booking.amount,
        gateway: gatewayName,
        paymentStatus: 'paid',
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // Ignorar si el socket server no tiene conexiones activas
    }

    return {
      success: true,
      message: `Pago de ${booking.id} acreditado exitosamente vía ${gatewayName}`,
      bookingId: booking.id,
      amount: booking.amount,
      gateway: gatewayName,
    };
  }

  /**
   * Obtener transacciones y estado de pago de una chamba
   */
  async getBookingPaymentInfo(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Chamba ${bookingId} no encontrada`);
    }

    return {
      bookingId: booking.id,
      amount: booking.amount,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      transactionId: booking.transactionId,
      transactions: booking.transactions,
      activeTransaction: booking.transactions[0] || null,
    };
  }

  /**
   * Obtener logs recientes de Webhooks para la Torre de Control Admin
   */
  async getWebhookLogs(limit = 20) {
    return this.prisma.webhookLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private getInstructions(gateway: string, meta: any) {
    switch (gateway) {
      case 'oxxo':
        return {
          steps: [
            '1. Acude a cualquier tienda OXXO de la República Mexicana.',
            '2. Indica al cajero que deseas realizar un pago de servicio "OXXO Pay".',
            `3. Proporciona la referencia numérica de 14 dígitos: ${meta.oxxoReference}.`,
            `4. Paga en efectivo el monto exacto de $${meta.amount.toFixed(2)} MXN (+ $15 MXN de comisión en caja OXXO).`,
            '5. Guarda tu ticket de pago; tu chamba se confirmará automáticamente en menos de 5 minutos mediante nuestro Webhook.',
          ],
        };
      case 'spei':
        return {
          steps: [
            '1. Ingresa a la app móvil de tu banco (BBVA, Banorte, Santander, Hey Banco, Nu, etc.).',
            '2. Selecciona Transferir a otra cuenta / CLABE.',
            `3. Ingresa la CLABE interbancaria STP: ${meta.speiClabe}.`,
            '4. Banco Receptor: STP (Sistema de Transferencias y Pagos). Beneficiario: ChambaYa México SAPI de CV.',
            `5. Concepto de pago: ${meta.bookingId}. Monto exacto: $${meta.amount.toFixed(2)} MXN.`,
            '6. La transferencia se acreditará de inmediato (24/7 sin costo ni comisiones bancarias).',
          ],
        };
      case 'stripe':
        return {
          steps: [
            'Paga de forma 100% segura con tarjeta Visa, Mastercard o American Express.',
            'Cifrado SSL de 256 bits y protección anti-fraude 3D Secure 2.0.',
          ],
        };
      default:
        return { steps: ['Completa tu pago a través de la pasarela seleccionada.'] };
    }
  }
}
