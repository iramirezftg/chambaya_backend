import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { ChatTelemetryService } from './chat-telemetry.service.js';

@ApiTags('Live Chat & Real-Time Telemetry')
@Controller('chat')
export class ChatTelemetryController {
  constructor(private chatService: ChatTelemetryService) {}

  @Get(':bookingId/messages')
  @ApiOperation({ summary: 'Obtener historial de mensajes del chat de una chamba' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-9021' })
  async getMessages(@Param('bookingId') bookingId: string) {
    return this.chatService.getMessages(bookingId);
  }

  @Post(':bookingId/messages')
  @ApiOperation({ summary: 'Enviar mensaje de chat mediante REST (fallback de WebSocket)' })
  @ApiParam({ name: 'bookingId', example: 'CHAMBA-9021' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        senderId: { type: 'string', example: 'usr-customer-1' },
        senderName: { type: 'string', example: 'Fernanda Gómez' },
        senderRole: { type: 'string', example: 'CUSTOMER' },
        text: { type: 'string', example: 'Buenas tardes, ya lo estoy esperando en la entrada.' }
      },
      required: ['senderId', 'senderName', 'senderRole', 'text']
    }
  })
  async sendMessage(
    @Param('bookingId') bookingId: string,
    @Body() body: any
  ) {
    return this.chatService.saveMessage({
      bookingId,
      senderId: body.senderId || 'usr-anon',
      senderName: body.senderName || 'Usuario',
      senderRole: body.senderRole || 'CUSTOMER',
      text: body.text,
      attachmentUrl: body.attachmentUrl
    });
  }
}
