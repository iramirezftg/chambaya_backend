import { Controller, Get, Post, Patch, Param, Body, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@ApiTags('Bookings & Dispatch')
@Controller('bookings')
export class BookingsController {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List bookings with optional filters' })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'servicemanId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getBookings(
    @Query('providerId') providerId?: string,
    @Query('servicemanId') servicemanId?: string,
    @Query('status') status?: string,
  ) {
    const where: any = {};
    if (providerId) where.providerId = providerId;
    if (servicemanId) where.servicemanId = servicemanId;
    if (status) where.status = status;

    return this.prisma.booking.findMany({
      where,
      include: {
        timeline: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  @Post()
  @ApiOperation({ summary: 'Customer: Place a new booking with commission split & SMS alert' })
  async createBooking(@Body() body: any) {
    const service = await this.prisma.service.findFirst({
      where: body.serviceId ? { id: body.serviceId } : undefined
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const provider = await this.prisma.provider.findUnique({
      where: { id: service.providerId }
    });

    const amount = Number(body.amount) || service.discountPrice || service.price;
    const commRate = provider?.commissionRate || 15;
    const platformFee = Number(((amount * commRate) / 100).toFixed(2));
    const providerEarnings = Number((amount - platformFee).toFixed(2));
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const newId = `CHAMBA-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBooking = await this.prisma.booking.create({
      data: {
        id: newId,
        customerName: body.customerName || 'Fernanda Gómez',
        customerPhone: body.customerPhone || '+52 55 7281 1933',
        customerEmail: body.customerEmail || 'fernanda.gomez@gmail.com',
        customerAddress: body.customerAddress || 'Calle Orizaba 142, Depto 4B, Col. Roma Norte, CDMX',
        serviceId: service.id,
        serviceTitle: service.title,
        serviceImage: service.image,
        providerId: service.providerId,
        providerName: provider?.name || 'Taller Certificado',
        status: 'pending',
        scheduledDate: body.scheduledDate || '2026-10-23',
        scheduledTimeSlot: body.scheduledTimeSlot || '10:00 AM - 11:30 AM',
        amount,
        platformFee,
        providerEarnings,
        paymentMethod: body.paymentMethod || 'oxxo',
        paymentStatus: body.paymentMethod === 'cod' ? 'unpaid' : 'paid',
        transactionId: `TXN-${(body.paymentMethod || 'OXXO').toUpperCase()}-${Date.now().toString().slice(-6)}`,
        otp,
        timeline: {
          create: [
            {
              status: 'pending',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              label: 'Chamba solicitada en ChambaYa'
            }
          ]
        }
      },
      include: {
        timeline: true
      }
    });

    // Simulated SMS trigger in DB
    await this.prisma.smsLog.create({
      data: {
        to: newBooking.customerPhone,
        text: `ChambaYa: Chamba ${newId} confirmada para ${service.title}. Tu PIN de seguridad es ${otp}.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    });

    // 📲 PWA Push: Notificar a chambeadores de la zona y proveedores
    this.notificationsService.sendNotification({
      title: `🛠️ ¡Nueva Chamba Solicitada! (${service.title})`,
      body: `Cliente solicita servicio por $${amount} MXN en ${body.address || 'tu zona'}. ¡Postúlate o tómala ahora!`,
      url: '/serviceman',
      role: 'SERVICEMAN',
    }).catch(() => {});

    this.notificationsService.sendNotification({
      title: `📋 Nueva Orden ChambaYa: ${newId}`,
      body: `Se ha generado una orden para "${service.title}" de $${amount} MXN.`,
      url: '/provider',
      role: 'PROVIDER',
    }).catch(() => {});

    // 📲 PWA Push: Confirmación al cliente
    this.notificationsService.sendNotification({
      title: `✅ Chamba Agendada: ${newId}`,
      body: `Tu orden de ${service.title} fue confirmada. Tu PIN de seguridad es ${otp}.`,
      url: '/marketplace',
      role: 'CUSTOMER',
    }).catch(() => {});

    return newBooking;
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Provider: Accept incoming booking' })
  @ApiParam({ name: 'id', example: 'CHAMBA-9021' })
  async acceptBooking(@Param('id') id: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException(`Booking ${id} not found`);

    await this.prisma.bookingTimeline.create({
      data: {
        bookingId: id,
        status: 'accepted',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        label: `Aceptada por ${b.providerName}`
      }
    });

    // 📲 PWA Push al Cliente
    this.notificationsService.sendNotification({
      title: `🤝 ¡Chamba Confirmada!`,
      body: `${b.providerName} ha aceptado tu servicio (${b.serviceTitle}). En breve te asignarán técnico.`,
      url: '/marketplace',
      role: 'CUSTOMER',
    }).catch(() => {});

    return this.prisma.booking.update({
      where: { id },
      data: { status: 'accepted' },
      include: { timeline: true }
    });
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Provider: Assign serviceman to booking' })
  @ApiParam({ name: 'id', example: 'CHAMBA-9021' })
  @ApiBody({ schema: { type: 'object', properties: { servicemanId: { type: 'string', example: 'sm-1' } } } })
  async assignServiceman(
    @Param('id') id: string,
    @Body('servicemanId') servicemanId: string
  ) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException(`Booking ${id} not found`);

    const tech = await this.prisma.serviceman.findUnique({ where: { id: servicemanId } });
    if (!tech) throw new NotFoundException(`Serviceman ${servicemanId} not found`);

    await this.prisma.bookingTimeline.create({
      data: {
        bookingId: id,
        status: 'assigned',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        label: `Asignada al chambeador ${tech.name}`
      }
    });

    await this.prisma.serviceman.update({
      where: { id: servicemanId },
      data: {
        status: 'busy',
        activeBookingId: b.id
      }
    });

    // 📲 PWA Push al Cliente: Técnico asignado
    this.notificationsService.sendNotification({
      title: `👷 Técnico Asignado: ${tech.name}`,
      body: `${tech.name} (${tech.phone}) se prepara para tu servicio "${b.serviceTitle}".`,
      url: '/marketplace',
      role: 'CUSTOMER',
    }).catch(() => {});

    // 📲 PWA Push al Chambeador: Nueva tarea asignada
    this.notificationsService.sendNotification({
      title: `⚡ Tienes una Nueva Chamba Asignada`,
      body: `Orden ${id}: ${b.serviceTitle} en ${b.customerAddress}. Toca para abrir mapa y ruta.`,
      url: '/serviceman',
      role: 'SERVICEMAN',
    }).catch(() => {});

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: 'assigned',
        servicemanId: tech.id,
        servicemanName: tech.name,
        servicemanPhone: tech.phone,
        servicemanAvatar: tech.avatar
      },
      include: {
        timeline: true
      }
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Serviceman: Advance order status (on_the_way -> in_progress [with OTP check] -> completed)' })
  @ApiParam({ name: 'id', example: 'CHAMBA-9021' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', example: 'completed' }, otp: { type: 'string', example: '4829' } } } })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('otp') otp?: string
  ) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException(`Booking ${id} not found`);

    // If starting in_progress, verify customer OTP
    if (status === 'in_progress' && otp && otp !== b.otp) {
      throw new BadRequestException(`PIN de seguridad inválido. Se esperaba ${b.otp}`);
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (status === 'completed') {
      // Disburse earnings to provider
      const prov = await this.prisma.provider.findUnique({ where: { id: b.providerId } });
      if (prov) {
        await this.prisma.provider.update({
          where: { id: b.providerId },
          data: {
            totalEarnings: prov.totalEarnings + b.providerEarnings,
            walletBalance: prov.walletBalance + b.providerEarnings
          }
        });
      }

      // Free technician
      if (b.servicemanId) {
        const tech = await this.prisma.serviceman.findUnique({ where: { id: b.servicemanId } });
        if (tech) {
          await this.prisma.serviceman.update({
            where: { id: b.servicemanId },
            data: {
              status: 'available',
              activeBookingId: null,
              completedJobs: tech.completedJobs + 1
            }
          });
        }
      }

      await this.prisma.bookingTimeline.create({
        data: {
          bookingId: id,
          status: 'completed',
          time: timeStr,
          label: 'Chamba Finalizada y Verificada'
        }
      });

      // 📲 PWA Push: Notificar a Cliente y Proveedor
      this.notificationsService.sendNotification({
        title: '🎉 ¡Chamba Finalizada con Éxito!',
        body: `El técnico concluyó el servicio "${b.serviceTitle}". ¡Por favor califica su trabajo!`,
        url: '/marketplace',
        role: 'CUSTOMER',
      }).catch(() => {});

      this.notificationsService.sendNotification({
        title: `💰 Pago Acreditado: $${b.providerEarnings} MXN`,
        body: `La orden ${id} se marcó como completada y los fondos ya están en tu balance.`,
        url: '/provider',
        role: 'PROVIDER',
      }).catch(() => {});

      return this.prisma.booking.update({
        where: { id },
        data: {
          status: 'completed',
          paymentStatus: 'paid'
        },
        include: {
          timeline: true
        }
      });
    }

    const labelMap: Record<string, string> = {
      on_the_way: 'Chambeador va en camino con GPS activado',
      in_progress: 'PIN validado. Chamba en progreso en el domicilio'
    };

    await this.prisma.bookingTimeline.create({
      data: {
        bookingId: id,
        status,
        time: timeStr,
        label: labelMap[status] || `Estatus actualizado a ${status}`
      }
    });

    // 📲 PWA Push según estatus en ruta o en progreso
    if (status === 'on_the_way') {
      this.notificationsService.sendNotification({
        title: '🛵 ¡Tu Chambeador va en Camino!',
        body: `${b.servicemanName || 'Tu técnico'} va en ruta hacia tu domicilio con rastreo en vivo.`,
        url: '/marketplace',
        role: 'CUSTOMER',
      }).catch(() => {});
    } else if (status === 'in_progress') {
      this.notificationsService.sendNotification({
        title: '🔨 Chamba en Progreso',
        body: `PIN verificado. El técnico inició la labor de "${b.serviceTitle}".`,
        url: '/marketplace',
        role: 'CUSTOMER',
      }).catch(() => {});
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status },
      include: { timeline: true }
    });
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Customer: Rate and review finished service' })
  @ApiParam({ name: 'id', example: 'CHAMBA-9021' })
  @ApiBody({ schema: { type: 'object', properties: { rating: { type: 'number', example: 5 }, reviewText: { type: 'string', example: '¡Excelente servicio!' } } } })
  async submitReview(
    @Param('id') id: string,
    @Body('rating') rating: number,
    @Body('reviewText') reviewText: string
  ) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException(`Booking ${id} not found`);

    // 📲 PWA Push al Chambeador felicitándolo por la calificación
    this.notificationsService.sendNotification({
      title: `⭐ ¡Nueva Calificación Recibida!`,
      body: `El cliente te calificó con ${rating} estrellas: "${reviewText || 'Excelente trabajo'}".`,
      url: '/serviceman',
      role: 'SERVICEMAN',
    }).catch(() => {});

    return this.prisma.booking.update({
      where: { id },
      data: {
        rating: Number(rating),
        reviewText
      },
      include: {
        timeline: true
      }
    });
  }
}
