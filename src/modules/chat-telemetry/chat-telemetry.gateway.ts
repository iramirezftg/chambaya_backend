import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatTelemetryService } from './chat-telemetry.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatTelemetryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private chatService: ChatTelemetryService,
    private notificationsService: NotificationsService,
  ) {}

  handleConnection(client: Socket) {
    // console.log(`🔌 WebSocket conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // console.log(`🔌 WebSocket desconectado: ${client.id}`);
  }

  @SubscribeMessage('join_booking')
  handleJoinBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string; userRole?: string; userName?: string },
  ) {
    const room = `booking_${data.bookingId}`;
    client.join(room);

    client.to(room).emit('user_joined', {
      userRole: data.userRole || 'CLIENTE',
      userName: data.userName || 'Usuario ChambaYa',
      time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    });

    return { status: 'joined', room };
  }

  @SubscribeMessage('send_chat_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      bookingId: string;
      senderId: string;
      senderName: string;
      senderRole: string;
      text: string;
      attachmentUrl?: string;
    },
  ) {
    const saved = await this.chatService.saveMessage(data);
    const room = `booking_${data.bookingId}`;

    // Emit to all users in the room (client, technician, provider)
    this.server.to(room).emit('new_chat_message', saved);

    // 📲 Despachar Push Notification al receptor en caso de que tenga el teléfono bloqueado
    const targetRole = data.senderRole === 'CUSTOMER' ? 'SERVICEMAN' : 'CUSTOMER';
    this.notificationsService.sendNotification({
      title: `💬 Mensaje de ${data.senderName}`,
      body: data.text.length > 60 ? `${data.text.substring(0, 57)}...` : data.text,
      url: targetRole === 'SERVICEMAN' ? '/serviceman' : '/marketplace',
      role: targetRole,
    }).catch(() => {});

    return saved;
  }

  @SubscribeMessage('send_gps_telemetry')
  async handleGpsTelemetry(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      bookingId: string;
      servicemanId: string;
      servicemanName: string;
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      address?: string;
      etaMinutes?: number;
    },
  ) {
    if (data.servicemanId && data.lat && data.lng) {
      await this.chatService.updateGps(data.servicemanId, data.lat, data.lng, data.address).catch(() => null);
    }

    const room = `booking_${data.bookingId}`;
    // Broadcast live telemetry to everyone tracking the booking
    this.server.to(room).emit('gps_telemetry_updated', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }
}
