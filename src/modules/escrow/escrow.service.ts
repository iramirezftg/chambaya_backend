import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class EscrowService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.seedInitialEscrows().catch((err) => {
      console.warn('⚠️ [Escrow] Error al inicializar bóvedas demo:', err.message);
    });
  }

  /**
   * Obtener el estado del depósito en garantía (Escrow Vault) para una orden
   */
  async getEscrowByBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        escrowVault: {
          include: { disputes: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Orden ${bookingId} no encontrada`);
    }

    if (!booking.escrowVault) {
      // Si la orden ya está pagada y no tiene bóveda, crearla
      const vault = await this.prisma.escrowVault.create({
        data: {
          bookingId: booking.id,
          totalAmount: booking.amount,
          providerEarnings: booking.providerEarnings,
          platformFee: booking.platformFee,
          status: booking.status === 'completed' ? 'RELEASED' : 'HELD_IN_ESCROW',
          guaranteeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          releasedAt: booking.status === 'completed' ? new Date() : null,
        },
        include: { disputes: true },
      });
      return { ...booking, escrowVault: vault };
    }

    return booking;
  }

  /**
   * Asegurar fondos en Bóveda Escrow tras pago confirmado
   */
  async holdInEscrow(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} no encontrado`);

    const existing = await this.prisma.escrowVault.findUnique({ where: { bookingId } });

    const guaranteeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    if (existing) {
      return this.prisma.escrowVault.update({
        where: { id: existing.id },
        data: {
          status: 'HELD_IN_ESCROW',
          guaranteeExpiresAt,
        },
      });
    }

    const created = await this.prisma.escrowVault.create({
      data: {
        bookingId,
        totalAmount: booking.amount,
        providerEarnings: booking.providerEarnings,
        platformFee: booking.platformFee,
        status: 'HELD_IN_ESCROW',
        guaranteeExpiresAt,
        insuranceCovered: true,
      },
    });

    // Registrar en la línea de tiempo
    await this.prisma.bookingTimeline.create({
      data: {
        bookingId,
        status: 'escrow_held',
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        label: `🔒 Fondos resguardados en Bóveda de Garantía ChambaYa ($${booking.amount} MXN)`,
      },
    });

    return created;
  }

  /**
   * Cliente confirma satisfacción y libera los fondos de la bóveda al proveedor
   */
  async confirmSatisfactionAndRelease(
    bookingId: string,
    rating = 5,
    reviewText = '¡Excelente servicio y trabajo garantizado!'
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { escrowVault: true, provider: true },
    });

    if (!booking) throw new NotFoundException(`Orden ${bookingId} no encontrada`);

    // Validar bóveda
    let vault = booking.escrowVault;
    if (!vault) {
      vault = await this.holdInEscrow(bookingId);
    }

    if (vault.status === 'RELEASED') {
      return { success: true, message: 'Los fondos ya fueron liberados con anterioridad.', vault };
    }

    // 1. Actualizar estatus de Bóveda Escrow
    const updatedVault = await this.prisma.escrowVault.update({
      where: { id: vault.id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
    });

    // 2. Acreditar ganancias a la billetera del proveedor
    if (booking.provider) {
      await this.prisma.provider.update({
        where: { id: booking.providerId },
        data: {
          walletBalance: booking.provider.walletBalance + booking.providerEarnings,
          totalEarnings: booking.provider.totalEarnings + booking.providerEarnings,
        },
      });
    }

    // 3. Registrar calificación y estatus en Booking
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'completed',
        rating: Number(rating),
        reviewText,
      },
    });

    const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    await this.prisma.bookingTimeline.create({
      data: {
        bookingId,
        status: 'funds_released',
        time: timeStr,
        label: `✅ Cliente confirmó satisfacción total. Fondos liberados ($${booking.providerEarnings} MXN)`,
      },
    });

    // 4. Notificaciones Push al Proveedor y Técnico
    this.notificationsService.sendNotification({
      title: `💰 Fondos Liberados del Escrow: $${booking.providerEarnings} MXN`,
      body: `El cliente confirmó su entera satisfacción para la orden ${bookingId}. Los fondos están en tu balance.`,
      url: '/provider',
      role: 'PROVIDER',
    }).catch(() => {});

    this.notificationsService.sendNotification({
      title: '⭐ ¡Satisfacción Confirmada por el Cliente!',
      body: `Calificación recibida: ${rating} estrellas para la orden ${bookingId}. ¡Gran trabajo!`,
      url: '/serviceman',
      role: 'SERVICEMAN',
    }).catch(() => {});

    return {
      success: true,
      releasedAmount: booking.providerEarnings,
      vault: updatedVault,
    };
  }

  /**
   * Cliente abre disputa / reclamo de garantía de satisfacción
   */
  async openDispute(
    bookingId: string,
    data: {
      reason: string;
      description: string;
      evidencePhotos?: string;
      requestedRefund?: number;
    }
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { escrowVault: true },
    });

    if (!booking) throw new NotFoundException(`Orden ${bookingId} no encontrada`);

    let vault = booking.escrowVault;
    if (!vault) {
      vault = await this.holdInEscrow(bookingId);
    }

    // Actualizar bóveda a estado DISPUTED (fondos congelados)
    await this.prisma.escrowVault.update({
      where: { id: vault.id },
      data: { status: 'DISPUTED' },
    });

    // Crear registro de disputa
    const dispute = await this.prisma.escrowDispute.create({
      data: {
        escrowVaultId: vault.id,
        bookingId,
        reason: data.reason || 'TRABAJO_DEFECTUOSO',
        description: data.description,
        evidencePhotos: data.evidencePhotos || '/images/evidence_sample.jpg',
        requestedRefund: data.requestedRefund || booking.amount,
        status: 'OPEN',
      },
    });

    const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    // Línea de tiempo
    await this.prisma.bookingTimeline.create({
      data: {
        bookingId,
        status: 'disputed',
        time: timeStr,
        label: `⚠️ Reclamo de Garantía Abierto: ${data.reason}. Fondos congelados en mediación.`,
      },
    });

    // 📲 Push al Administrador (Torre de Control)
    this.notificationsService.sendNotification({
      title: `🚨 Reclamo de Garantía en Orden #${bookingId}`,
      body: `Cliente reporta "${data.reason}". Se requiere mediación en Torre de Control.`,
      url: '/admin',
      role: 'ADMIN',
    }).catch(() => {});

    // 📲 Push al Proveedor avisando de la retención preventiva
    this.notificationsService.sendNotification({
      title: `⚠️ Disputa de Garantía en Orden #${bookingId}`,
      body: `Se abrió una mediación por inconformidad. Fondos en resguardo temporal.`,
      url: '/provider',
      role: 'PROVIDER',
    }).catch(() => {});

    return {
      success: true,
      dispute,
      message: 'Reclamo abierto con éxito. Un mediador de ChambaYa revisará el caso.',
    };
  }

  /**
   * Super Admin resuelve la disputa de garantía
   */
  async adminResolveDispute(
    disputeId: string,
    resolution: {
      decision: 'RELEASE_TO_PROVIDER' | 'REFUND_CUSTOMER_FULL' | 'SPLIT_SETTLEMENT' | 'INSURANCE_CLAIM';
      adminNotes: string;
      refundAmount?: number;
      releaseAmount?: number;
      mediatorName?: string;
    }
  ) {
    const dispute = await this.prisma.escrowDispute.findUnique({
      where: { id: disputeId },
      include: {
        escrowVault: {
          include: {
            booking: {
              include: { provider: true, customer: true },
            },
          },
        },
      },
    });

    if (!dispute) throw new NotFoundException(`Disputa ${disputeId} no encontrada`);

    const vault = dispute.escrowVault;
    const booking = vault.booking;
    const provider = booking.provider;

    let nextVaultStatus = 'RELEASED';
    let nextDisputeStatus = 'RESOLVED_RELEASE';
    let refundToCustomer = 0;
    let releaseToProvider = 0;

    switch (resolution.decision) {
      case 'RELEASE_TO_PROVIDER':
        nextVaultStatus = 'RELEASED';
        nextDisputeStatus = 'RESOLVED_RELEASE';
        releaseToProvider = vault.providerEarnings;
        refundToCustomer = 0;
        break;

      case 'REFUND_CUSTOMER_FULL':
        nextVaultStatus = 'REFUNDED_FULL';
        nextDisputeStatus = 'RESOLVED_REFUND';
        refundToCustomer = booking.amount;
        releaseToProvider = 0;
        break;

      case 'SPLIT_SETTLEMENT':
        nextVaultStatus = 'REFUNDED_PARTIAL';
        nextDisputeStatus = 'RESOLVED_SPLIT';
        refundToCustomer = resolution.refundAmount || Number((booking.amount * 0.5).toFixed(2));
        releaseToProvider = resolution.releaseAmount || Number((vault.providerEarnings * 0.5).toFixed(2));
        break;

      case 'INSURANCE_CLAIM':
        // Seguro ChambaYa cubre daños materiales sin penalizar el trabajo honesto del técnico
        nextVaultStatus = 'RELEASED';
        nextDisputeStatus = 'RESOLVED_INSURANCE';
        refundToCustomer = resolution.refundAmount || Math.min(booking.amount * 2, 25000);
        releaseToProvider = vault.providerEarnings;
        break;
    }

    // 1. Acreditar al proveedor si aplica
    if (releaseToProvider > 0 && provider) {
      await this.prisma.provider.update({
        where: { id: provider.id },
        data: {
          walletBalance: provider.walletBalance + releaseToProvider,
          totalEarnings: provider.totalEarnings + releaseToProvider,
        },
      });
    }

    // 2. Acreditar reembolso a billetera del cliente si aplica
    if (refundToCustomer > 0 && booking.customerId) {
      await this.prisma.user.update({
        where: { id: booking.customerId },
        data: {
          walletBalance: { increment: refundToCustomer },
        },
      });
    }

    // 3. Actualizar Disputa
    const updatedDispute = await this.prisma.escrowDispute.update({
      where: { id: disputeId },
      data: {
        status: nextDisputeStatus,
        resolvedRefund: refundToCustomer,
        resolvedRelease: releaseToProvider,
        adminNotes: resolution.adminNotes,
        mediatorName: resolution.mediatorName || 'Mediación ChambaYa México',
        resolvedAt: new Date(),
      },
    });

    // 4. Actualizar Bóveda Escrow
    await this.prisma.escrowVault.update({
      where: { id: vault.id },
      data: {
        status: nextVaultStatus,
        releasedAt: new Date(),
      },
    });

    const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    // 5. Línea de tiempo
    await this.prisma.bookingTimeline.create({
      data: {
        bookingId: booking.id,
        status: 'dispute_resolved',
        time: timeStr,
        label: `⚖️ Dictamen de Mediación: ${resolution.decision}. ${resolution.adminNotes}`,
      },
    });

    // 6. Push Notifications
    this.notificationsService.sendNotification({
      title: '⚖️ Dictamen de Garantía ChambaYa Emitido',
      body: `Resolución: ${resolution.decision}. Reembolso: $${refundToCustomer} MXN. ${resolution.adminNotes}`,
      url: '/marketplace',
      role: 'CUSTOMER',
    }).catch(() => {});

    this.notificationsService.sendNotification({
      title: '⚖️ Resolución de Disputa por Mediación',
      body: `Fondos asignados: $${releaseToProvider} MXN. Caso concluido.`,
      url: '/provider',
      role: 'PROVIDER',
    }).catch(() => {});

    return {
      success: true,
      decision: resolution.decision,
      refundToCustomer,
      releaseToProvider,
      dispute: updatedDispute,
    };
  }

  /**
   * Listar disputas para la Torre de Control
   */
  async getAdminDisputes(status?: string) {
    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    return this.prisma.escrowDispute.findMany({
      where,
      include: {
        escrowVault: {
          include: {
            booking: {
              include: { provider: true, serviceman: true },
            },
          },
        },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  /**
   * Métricas globales de Bóveda Escrow y Garantía
   */
  async getStats() {
    const totalVaults = await this.prisma.escrowVault.count();
    const heldVaults = await this.prisma.escrowVault.count({ where: { status: 'HELD_IN_ESCROW' } });
    const releasedVaults = await this.prisma.escrowVault.count({ where: { status: 'RELEASED' } });
    const disputedVaults = await this.prisma.escrowVault.count({ where: { status: 'DISPUTED' } });
    const refundedVaults = await this.prisma.escrowVault.count({
      where: { status: { in: ['REFUNDED_FULL', 'REFUNDED_PARTIAL'] } },
    });

    const activeDisputes = await this.prisma.escrowDispute.count({ where: { status: 'OPEN' } });

    // Sumar montos retenidos y liberados
    const vaults = await this.prisma.escrowVault.findMany();
    const totalHeldAmount = vaults
      .filter((v) => v.status === 'HELD_IN_ESCROW')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalReleasedAmount = vaults
      .filter((v) => v.status === 'RELEASED')
      .reduce((acc, curr) => acc + curr.providerEarnings, 0);

    return {
      totalBovedas: totalVaults,
      fondosEnCustodiaMXN: Number(totalHeldAmount.toFixed(2)),
      fondosLiberadosMXN: Number(totalReleasedAmount.toFixed(2)),
      bovedasEnRetencion: heldVaults,
      bovedasLiberadas: releasedVaults,
      bovedasEnDisputa: disputedVaults,
      bovedasReembolsadas: refundedVaults,
      disputasActivas: activeDisputes,
      coberturaSeguroDanosMax: 25000.0,
      tasaResolucionGarantia: totalVaults > 0 ? Number((((releasedVaults + refundedVaults) / totalVaults) * 100).toFixed(1)) : 100,
    };
  }

  /**
   * Sembrar datos de prueba para órdenes existentes
   */
  async seedInitialEscrows() {
    const bookings = await this.prisma.booking.findMany({
      include: { escrowVault: true },
    });

    for (const b of bookings) {
      if (!b.escrowVault) {
        const isCompleted = b.status === 'completed';
        const vault = await this.prisma.escrowVault.create({
          data: {
            bookingId: b.id,
            totalAmount: b.amount,
            providerEarnings: b.providerEarnings,
            platformFee: b.platformFee,
            status: isCompleted ? 'RELEASED' : 'HELD_IN_ESCROW',
            guaranteeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            releasedAt: isCompleted ? new Date() : null,
          },
        });

        // Crear una disputa demo de ejemplo si es CHAMBA-9021 o la primera
        if (b.id === 'CHAMBA-9021') {
          await this.prisma.escrowDispute.create({
            data: {
              escrowVaultId: vault.id,
              bookingId: b.id,
              reason: 'TRABAJO_DEFECTUOSO',
              description: 'Persiste un ligero goteo en la tubería de desagüe tras la reparación.',
              evidencePhotos: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400',
              requestedRefund: 250.0,
              status: 'OPEN',
            },
          });

          await this.prisma.escrowVault.update({
            where: { id: vault.id },
            data: { status: 'DISPUTED' },
          });
        }
      }
    }
  }
}
