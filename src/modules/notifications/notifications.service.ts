import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import webpush from 'web-push';

@Injectable()
export class NotificationsService {
  // Claves criptográficas VAPID RFC 8292 para Web Push
  private readonly vapidPublicKey = 'BK71aQvIOd1lsQkyrFd8pBPSc-WrE8nb_jjmLSumx9Db7yURmcv9CkzM1tOI2DQeJSkQRDsTUQoRDJrkeUizJuY';
  private readonly vapidPrivateKey = 'l97ruHgf_MlMH6JwRKj_QQixIJTInheZ2PfQDBjqxh4';

  constructor(private prisma: PrismaService) {
    try {
      webpush.setVapidDetails(
        'mailto:contacto@chambaya.mx',
        this.vapidPublicKey,
        this.vapidPrivateKey
      );
    } catch (e) {
      console.warn('⚠️ [WebPush] Error al configurar detalles VAPID:', e);
    }
  }

  getVapidPublicKey() {
    return {
      publicKey: this.vapidPublicKey,
    };
  }

  /**
   * Registrar o actualizar suscripción Web Push de un dispositivo móvil o navegador
   */
  async saveSubscription(data: {
    userId?: string;
    role?: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }) {
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: data.endpoint },
    });

    if (existing) {
      return this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userId: data.userId || existing.userId,
          role: data.role || existing.role,
          p256dh: data.p256dh,
          auth: data.auth,
          userAgent: data.userAgent || existing.userAgent,
        },
      });
    }

    return this.prisma.pushSubscription.create({
      data: {
        userId: data.userId,
        role: data.role || 'CUSTOMER',
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent,
      },
    });
  }

  /**
   * Despachar notificación Push nativa a dispositivos suscritos
   */
  async sendNotification(payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    role?: string;
    userId?: string;
  }) {
    // 1. Registrar en el historial de notificaciones
    const log = await this.prisma.pushNotificationLog.create({
      data: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192.png',
        url: payload.url || '/mobile',
        role: payload.role || null,
        userId: payload.userId || null,
      },
    });

    // 2. Localizar suscripciones objetivo
    const where: any = {};
    if (payload.userId) {
      where.userId = payload.userId;
    } else if (payload.role) {
      where.role = payload.role;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({ where });

    console.log(`📲 [WebPush] Despachando notificación "${payload.title}" (${payload.role || 'GLOBAL'}) a ${subscriptions.length} dispositivos`);

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/icon-192.png',
      data: {
        url: payload.url || '/mobile',
        timestamp: Date.now(),
        logId: log.id,
      },
    });

    let successCount = 0;

    // 3. Envío real a cada suscriptor mediante web-push
    const sendPromises = subscriptions.map(async (sub) => {
      // Si es un endpoint simulado local (pruebas sin FCM real)
      if (sub.endpoint.includes('mock-client') || !sub.endpoint.startsWith('http')) {
        successCount++;
        return;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        );
        successCount++;
      } catch (err: any) {
        // Si el endpoint expiró o fue revocado por el usuario
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`🧹 [WebPush] Eliminando suscripción inactiva: ${sub.id}`);
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.warn(`⚠️ [WebPush] Falla al despachar a ${sub.endpoint.substring(0, 30)}... :`, err.message);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return {
      success: true,
      deliveredDevices: subscriptions.length,
      realDelivered: successCount,
      logId: log.id,
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192.png',
        url: payload.url || '/mobile',
        role: payload.role,
      },
    };
  }

  /**
   * Obtener feed de notificaciones recientes para el Notification Center
   */
  async getNotificationFeed(role?: string, limit = 20) {
    const where: any = {};
    if (role) {
      where.OR = [{ role }, { role: null }];
    }

    return this.prisma.pushNotificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 20,
    });
  }

  /**
   * Background Sync: Procesar cola de acciones generadas offline cuando se restablece la red
   */
  async processOfflineSync(data: {
    actions: Array<{
      type: string;
      payload: any;
      clientTimestamp?: string;
    }>;
    userId?: string;
  }) {
    const results: any[] = [];

    for (const act of data.actions || []) {
      try {
        if (act.type === 'UPDATE_STATUS' && act.payload?.bookingId) {
          const { bookingId, status, otp } = act.payload;
          // Actualizar estatus
          const updated = await this.prisma.booking.update({
            where: { id: bookingId },
            data: { status },
          });

          await this.prisma.bookingTimeline.create({
            data: {
              bookingId,
              status,
              time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              label: `[Sync Offline] Estatus sincronizado a ${status}`,
            },
          });

          results.push({ action: act.type, bookingId, status: 'synced', updated });
        } else if (act.type === 'SUBMIT_REVIEW' && act.payload?.bookingId) {
          const { bookingId, rating, reviewText } = act.payload;
          await this.prisma.booking.update({
            where: { id: bookingId },
            data: { rating: Number(rating), reviewText },
          });
          results.push({ action: act.type, bookingId, status: 'synced' });
        } else {
          results.push({ action: act.type, status: 'ignored_unknown_type' });
        }
      } catch (err: any) {
        results.push({ action: act.type, status: 'error', error: err.message });
      }
    }

    // Emitir notificación push avisando que la sincronización offline concluyó
    if (data.actions && data.actions.length > 0) {
      await this.sendNotification({
        title: '🔄 Sincronización en Segundo Plano Completa',
        body: `Se aplicaron ${results.filter(r => r.status === 'synced').length} cambios pendientes que realizaste sin conexión.`,
        url: '/mobile',
        role: 'CUSTOMER',
      });
    }

    return {
      syncedCount: results.filter(r => r.status === 'synced').length,
      totalReceived: data.actions?.length || 0,
      details: results,
    };
  }

  /**
   * Estadísticas de dispositivos PWA activos
   */
  async getStats() {
    const total = await this.prisma.pushSubscription.count();
    const byRole = await this.prisma.pushSubscription.groupBy({
      by: ['role'],
      _count: { id: true },
    });
    const totalDispatched = await this.prisma.pushNotificationLog.count();

    return {
      totalDispositivosPwa: total,
      totalNotificacionesEnviadas: totalDispatched,
      distribucionRoles: byRole.map(r => ({ role: r.role, dispositivos: r._count.id })),
    };
  }
}
