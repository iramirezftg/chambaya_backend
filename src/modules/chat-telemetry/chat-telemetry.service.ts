import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ChatTelemetryService {
  constructor(private prisma: PrismaService) {}

  async getMessages(bookingId: string) {
    return this.prisma.chatMessage.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async saveMessage(data: {
    bookingId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    text: string;
    attachmentUrl?: string;
  }) {
    return this.prisma.chatMessage.create({
      data: {
        bookingId: data.bookingId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderRole: data.senderRole,
        text: data.text,
        attachmentUrl: data.attachmentUrl
      }
    });
  }

  async updateGps(servicemanId: string, lat: number, lng: number, address?: string) {
    return this.prisma.serviceman.update({
      where: { id: servicemanId },
      data: {
        currentLat: lat,
        currentLng: lng,
        currentAddress: address
      }
    });
  }
}
