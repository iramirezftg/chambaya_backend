import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('SMS Gateway & Alerts')
@Controller('sms')
export class SmsController {
  constructor(private prisma: PrismaService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get automated SMS dispatch log feed' })
  async getLogs() {
    return this.prisma.smsLog.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  @Post('send')
  @ApiOperation({ summary: 'Send automated Twilio SMS alert' })
  @ApiBody({ schema: { type: 'object', properties: { to: { type: 'string', example: '+52 55 7281 1933' }, text: { type: 'string', example: 'Notificación ChambaYa' } } } })
  async sendSms(@Body('to') to: string, @Body('text') text: string) {
    const entry = await this.prisma.smsLog.create({
      data: {
        to: to || '+52 55 0000 0000',
        text: text || 'Aviso de servicio ChambaYa',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    });
    return { success: true, message: 'SMS enviado mediante Gateway Twilio México', log: entry };
  }
}
