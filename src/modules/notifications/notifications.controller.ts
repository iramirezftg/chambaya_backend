import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';

@ApiTags('PWA Mobile & Push Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private notifService: NotificationsService) {}

  @Get('vapid-key')
  @ApiOperation({ summary: 'Obtener clave pública VAPID para suscripción Web Push' })
  getVapidKey() {
    return this.notifService.getVapidPublicKey();
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Registrar suscripción PWA Web Push de dispositivo móvil' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'usr-customer-1' },
        role: { type: 'string', example: 'CUSTOMER' },
        endpoint: { type: 'string', example: 'https://fcm.googleapis.com/fcm/send/...' },
        p256dh: { type: 'string', example: 'BK71aQv...' },
        auth: { type: 'string', example: 'tBHIt8m...' },
        userAgent: { type: 'string', example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
      },
      required: ['endpoint', 'p256dh', 'auth'],
    },
  })
  async subscribe(
    @Body()
    body: {
      userId?: string;
      role?: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string;
    },
  ) {
    return this.notifService.saveSubscription(body);
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar notificación Push a dispositivos suscritos' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: '¡Pedro va en camino! 🛵' },
        body: { type: 'string', example: 'Tu chambeador llegará en aproximadamente 8 minutos.' },
        url: { type: 'string', example: '/mobile' },
        role: { type: 'string', example: 'CUSTOMER' },
      },
      required: ['title', 'body'],
    },
  })
  async sendNotification(
    @Body()
    body: {
      title: string;
      body: string;
      icon?: string;
      url?: string;
      role?: string;
      userId?: string;
    },
  ) {
    return this.notifService.sendNotification(body);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Obtener historial de notificaciones recientes para el Notification Center' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getFeed(@Query('role') role?: string, @Query('limit') limit?: number) {
    return this.notifService.getNotificationFeed(role, limit);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Background Sync API: Procesar cola de operaciones realizadas offline' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'UPDATE_STATUS' },
              payload: { type: 'object' },
            },
          },
        },
      },
    },
  })
  async processSync(
    @Body()
    body: {
      actions: Array<{ type: string; payload: any; clientTimestamp?: string }>;
      userId?: string;
    },
  ) {
    return this.notifService.processOfflineSync(body);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Torre de Control: Dispositivos PWA registrados y métricas' })
  async getStats() {
    return this.notifService.getStats();
  }
}
