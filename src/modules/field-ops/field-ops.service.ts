import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class FieldOpsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.seedInitialFieldOps().catch((err) => {
      console.warn('⚠️ [FieldOps] Error al inicializar datos demo:', err.message);
    });
  }

  /**
   * Consultar evidencias y materiales de una orden
   */
  async getBookingFieldOps(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        evidences: {
          orderBy: { capturedAt: 'desc' },
        },
        materials: {
          orderBy: { requestedAt: 'desc' },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Orden ${bookingId} no encontrada`);
    }

    const totalApprovedMaterials = booking.materials
      .filter((m) => m.status === 'APPROVED' || m.status === 'PAID')
      .reduce((sum, m) => sum + m.amount, 0);

    const pendingMaterials = booking.materials.filter((m) => m.status === 'PENDING_APPROVAL');

    return {
      bookingId: booking.id,
      serviceTitle: booking.serviceTitle,
      status: booking.status,
      baseAmount: booking.amount - booking.materialsCost,
      materialsCost: booking.materialsCost,
      totalAmount: booking.amount,
      evidences: booking.evidences,
      materials: booking.materials,
      summary: {
        totalEvidences: booking.evidences.length,
        hasBeforePhoto: booking.evidences.some((e) => e.type === 'BEFORE'),
        hasAfterPhoto: booking.evidences.some((e) => e.type === 'AFTER'),
        totalMaterialsApproved: totalApprovedMaterials,
        pendingApprovalsCount: pendingMaterials.length,
      },
    };
  }

  /**
   * Registrar evidencia fotográfica (Antes, Después o En Proceso)
   */
  async addEvidence(
    bookingId: string,
    data: {
      type: 'BEFORE' | 'AFTER' | 'IN_PROGRESS';
      photoUrl: string;
      description?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Orden ${bookingId} no encontrada`);

    const evidence = await this.prisma.bookingEvidence.create({
      data: {
        bookingId,
        type: data.type,
        photoUrl: data.photoUrl,
        description: data.description || (data.type === 'BEFORE' ? 'Foto inicial del estado de la avería' : 'Foto final del trabajo concluido'),
        lat: data.lat || 19.4194,
        lng: data.lng || -99.1634,
      },
    });

    // Registrar en la cronología de la orden
    const typeLabel = data.type === 'BEFORE' ? 'Inicial (Antes)' : data.type === 'AFTER' ? 'Final (Después)' : 'En Proceso';
    await this.prisma.bookingTimeline.create({
      data: {
        bookingId,
        status: booking.status,
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        label: `📸 Evidencia Fotográfica ${typeLabel}`,
      },
    });

    // Notificar al cliente
    await this.notificationsService.sendNotification({
      role: 'CUSTOMER',
      title: `📸 Nueva Evidencia de tu Chamba (#${bookingId})`,
      body: `El técnico subió la foto ${typeLabel} de la reparación. Toca para ver la inspección visual.`,
      url: `/marketplace`,
    });

    return evidence;
  }

  /**
   * El chambeador solicita autorización para compra de materiales en ferretería con ticket adjunto
   */
  async requestMaterialItem(
    bookingId: string,
    data: {
      description: string;
      storeName?: string;
      ticketPhotoUrl: string;
      amount: number;
    },
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Orden ${bookingId} no encontrada`);

    if (data.amount <= 0) {
      throw new BadRequestException('El monto del material debe ser mayor a 0 MXN');
    }

    const item = await this.prisma.bookingMaterialItem.create({
      data: {
        bookingId,
        description: data.description,
        storeName: data.storeName || 'Ferretería Local / Construrama',
        ticketPhotoUrl: data.ticketPhotoUrl,
        amount: data.amount,
        status: 'PENDING_APPROVAL',
      },
    });

    // Registrar en cronología
    await this.prisma.bookingTimeline.create({
      data: {
        bookingId,
        status: booking.status,
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        label: `🛒 Solicitud de Refacciones ($${data.amount} MXN)`,
      },
    });

    // Notificar al cliente con llamada a la acción
    await this.notificationsService.sendNotification({
      role: 'CUSTOMER',
      title: `🛒 Solicitud de Materiales: $${data.amount} MXN`,
      body: `El chambeador requiere "${data.description}" en ${data.storeName || 'ferretería'}. Comprobante y ticket adjuntos para tu aprobación.`,
      url: `/marketplace`,
    });

    return item;
  }

  /**
   * El cliente autoriza o rechaza el cargo de materiales
   */
  async respondMaterialItem(
    itemId: string,
    data: {
      approved: boolean;
      rejectionReason?: string;
    },
  ) {
    const item = await this.prisma.bookingMaterialItem.findUnique({
      where: { id: itemId },
      include: { booking: true },
    });

    if (!item) throw new NotFoundException(`Ítem de material ${itemId} no encontrado`);

    if (item.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`El material ya se encuentra en estado ${item.status}`);
    }

    if (data.approved) {
      // 1. Actualizar estado del material
      const updatedItem = await this.prisma.bookingMaterialItem.update({
        where: { id: itemId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });

      // 2. Incrementar monto de la orden y costo de materiales
      const newMaterialsCost = item.booking.materialsCost + item.amount;
      const newTotalAmount = item.booking.amount + item.amount;

      await this.prisma.booking.update({
        where: { id: item.bookingId },
        data: {
          materialsCost: newMaterialsCost,
          amount: newTotalAmount,
        },
      });

      // 3. Si existe Bóveda Escrow, actualizar el monto en custodia preventiva
      await this.prisma.escrowVault.updateMany({
        where: { bookingId: item.bookingId },
        data: {
          totalAmount: newTotalAmount,
        },
      });

      // 4. Agregar a cronología
      await this.prisma.bookingTimeline.create({
        data: {
          bookingId: item.bookingId,
          status: item.booking.status,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          label: `✅ Materiales Autorizados ($${item.amount} MXN)`,
        },
      });

      // 5. Notificar al chambeador
      await this.notificationsService.sendNotification({
        role: 'SERVICEMAN',
        title: `✅ ¡Materiales Aprobados por el Cliente!`,
        body: `Se autorizaron $${item.amount} MXN para "${item.description}". Puedes proceder a instalarlos.`,
        url: `/serviceman`,
      });

      return { success: true, status: 'APPROVED', updatedItem, newTotalAmount };
    } else {
      // Rechazado por el cliente
      const updatedItem = await this.prisma.bookingMaterialItem.update({
        where: { id: itemId },
        data: {
          status: 'REJECTED',
          rejectedReason: data.rejectionReason || 'El cliente optó por no autorizar esta refacción.',
        },
      });

      await this.prisma.bookingTimeline.create({
        data: {
          bookingId: item.bookingId,
          status: item.booking.status,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          label: `❌ Materiales Rechazados`,
        },
      });

      await this.notificationsService.sendNotification({
        role: 'SERVICEMAN',
        title: `❌ Solicitud de Material Rechazada`,
        body: `El cliente no autorizó la compra de "${item.description}".`,
        url: `/serviceman`,
      });

      return { success: false, status: 'REJECTED', updatedItem };
    }
  }

  /**
   * Semillas iniciales para demostración interactiva
   */
  private async seedInitialFieldOps() {
    const booking5647 = await this.prisma.booking.findUnique({
      where: { id: 'CHAMBA-5647' },
      include: { evidences: true, materials: true },
    });

    if (booking5647 && booking5647.evidences.length === 0) {
      // Sembrar evidencias Antes y Después
      await this.prisma.bookingEvidence.createMany({
        data: [
          {
            bookingId: 'CHAMBA-5647',
            type: 'BEFORE',
            photoUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600',
            description: 'Inspección inicial: Filtración por desgaste en empaque y rosca de alimentación principal.',
            lat: 19.4194,
            lng: -99.1634,
          },
          {
            bookingId: 'CHAMBA-5647',
            type: 'AFTER',
            photoUrl: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=600',
            description: 'Inspección final: Tubería de cobre sustituida con sellado hidráulico a prueba de fugas.',
            lat: 19.4194,
            lng: -99.1634,
          },
        ],
      });

      // Sembrar material aprobado
      await this.prisma.bookingMaterialItem.create({
        data: {
          bookingId: 'CHAMBA-5647',
          description: 'Cople de cobre 1/2 pulgada + Soldadura de estaño y pasta fundente',
          storeName: 'Ferretería El Tornillo Roma Norte',
          ticketPhotoUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
          amount: 185.0,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });
    }

    const booking9021 = await this.prisma.booking.findUnique({
      where: { id: 'CHAMBA-9021' },
      include: { evidences: true, materials: true },
    });

    if (booking9021 && booking9021.materials.length === 0) {
      // Sembrar evidencia inicial y solicitud de refacción pendiente de aprobación
      await this.prisma.bookingEvidence.create({
        data: {
          bookingId: 'CHAMBA-9021',
          type: 'BEFORE',
          photoUrl: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600',
          description: 'Inspección inicial: Serpentín de evaporadora tapado y turbina con restos de grasa.',
          lat: 19.4194,
          lng: -99.1634,
        },
      });

      await this.prisma.bookingMaterialItem.create({
        data: {
          bookingId: 'CHAMBA-9021',
          description: 'Químico espumante biodegradable para serpentín + Filtro antibacteriano',
          storeName: 'Construrama Climas CDMX',
          ticketPhotoUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
          amount: 220.0,
          status: 'PENDING_APPROVAL',
        },
      });
    }
  }
}
