import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

import { EmergencyQuoteDto, CreateEmergencyDto } from './dto/emergency.dto.js';

@Injectable()
export class EmergencyService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.seedInitialEmergencies().catch((err) => {
      console.warn('⚠️ [EmergencyService] Error al inicializar emergencias demo:', err.message);
    });
  }

  /**
   * Cotización dinámica y transparente de recargo de urgencia ChambaExpress 24/7
   */
  quoteEmergencyFee(dto: EmergencyQuoteDto) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 is Sunday, 6 is Saturday

    const isNight = currentHour >= 22 || currentHour < 6;
    const isWeekend = currentDay === 0 || currentDay === 6;

    let baseFee = 200; // Tarifa base de activación inmediata
    let nightSurcharge = 0;
    let weekendSurcharge = 0;
    let severitySurcharge = 0;

    if (isNight) {
      nightSurcharge = 150; // Recargo nocturno por nocturnidad y guardia
    }
    if (isWeekend) {
      weekendSurcharge = 100; // Guardia fin de semana
    }
    if (dto.severity === 'CRITICA') {
      severitySurcharge = 100; // Prioridad cero y aislamiento de riesgo
    }

    const totalSurcharge = baseFee + nightSurcharge + weekendSurcharge + severitySurcharge;

    let estimatedServiceBase = 450;
    let emergencyTitle = 'Atención Urgente';
    let targetEtaMinutes = 30;

    switch (dto.emergencyType) {
      case 'FUGA_AGUA':
        emergencyTitle = 'Fuga de Agua / Inundación Activa 💧';
        estimatedServiceBase = 480;
        targetEtaMinutes = 25;
        break;
      case 'CORTO_CIRCUITO':
        emergencyTitle = 'Cortocircuito / Chispas Sin Luz ⚡';
        estimatedServiceBase = 550;
        targetEtaMinutes = 25;
        break;
      case 'CERRADURA':
        emergencyTitle = 'Apertura de Cerradura Urgente / Llaves Dentro 🔑';
        estimatedServiceBase = 450;
        targetEtaMinutes = 30;
        break;
      case 'GAS_LP':
        emergencyTitle = 'Fuga de Gas LP / Olor en Boiler 💨';
        estimatedServiceBase = 600;
        targetEtaMinutes = 20;
        break;
      default:
        emergencyTitle = 'Auxilio Técnico Doméstico Inmediato 🚨';
        estimatedServiceBase = 450;
        targetEtaMinutes = 35;
        break;
    }

    const totalEstimated = estimatedServiceBase + totalSurcharge;

    return {
      emergencyType: dto.emergencyType,
      emergencyTitle,
      severity: dto.severity || 'ALTA',
      breakdown: {
        estimatedServiceBase,
        baseActivationFee: baseFee,
        nightSurcharge,
        weekendSurcharge,
        severitySurcharge,
        totalSurcharge,
        totalEstimated,
      },
      targetEtaMinutes,
      isNight,
      isWeekend,
      guarantee: 'Arribo garantizado antes de 35 minutos o bonificación del 50% del recargo',
    };
  }

  /**
   * Crear solicitud de emergencia y lanzar despacho flash satelital
   */
  async createEmergency(dto: CreateEmergencyDto) {
    const quote = this.quoteEmergencyFee({
      emergencyType: dto.emergencyType,
      severity: dto.severity,
      address: dto.customerAddress,
    });

    // Buscar proveedor y servicio adecuado para la emergencia
    const serviceCategoryName =
      dto.emergencyType === 'FUGA_AGUA'
        ? 'Plomería'
        : dto.emergencyType === 'CORTO_CIRCUITO'
        ? 'Electricidad'
        : dto.emergencyType === 'CERRADURA'
        ? 'Cerrajería'
        : 'Plomería';

    let service = await this.prisma.service.findFirst({
      where: {
        category: {
          name: { contains: serviceCategoryName },
        },
      },
      include: { provider: true },
    });

    if (!service) {
      service = await this.prisma.service.findFirst({
        include: { provider: true },
      });
    }

    if (!service) {
      throw new BadRequestException('No hay servicios disponibles en el catálogo para despachar emergencias');
    }

    const emergencyBookingId = `SOS-${Math.floor(1000 + Math.random() * 9000)}`;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const totalAmount = quote.breakdown.totalEstimated;
    const platformFee = totalAmount * 0.15;
    const providerEarnings = totalAmount - platformFee;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 45 * 1000); // 45 segundos para aceptación flash

    // Crear la orden con bandera de emergencia
    const booking = await this.prisma.booking.create({
      data: {
        id: emergencyBookingId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        customerAddress: dto.customerAddress,
        serviceId: service.id,
        serviceTitle: `🚨 ChambaExpress: ${quote.emergencyTitle}`,
        serviceImage: service.image,
        providerId: service.providerId,
        providerName: service.provider.name,
        status: 'assigned', // Inicia en búsqueda satelital
        scheduledDate: now.toISOString().split('T')[0],
        scheduledTimeSlot: 'Arribo Inmediato (25-35 mins)',
        amount: totalAmount,
        platformFee,
        providerEarnings,
        paymentMethod: dto.paymentMethod || 'TARJETA_DIGITAL',
        paymentStatus: 'paid',
        transactionId: `TX-SOS-${Date.now()}`,
        otp,
        isEmergency: true,
        emergencySurcharge: quote.breakdown.totalSurcharge,
        emergencyType: dto.emergencyType,
        timeline: {
          create: [
            {
              status: 'sos_broadcast',
              time: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              label: '🚨 Alerta SOS emitida. Transmitiendo por radar a técnicos en un radio de 5 km',
            },
          ],
        },
        escrowVault: {
          create: {
            totalAmount,
            providerEarnings,
            platformFee,
            currency: 'MXN',
            status: 'HELD_IN_ESCROW',
            guaranteeWindowHours: 48,
            guaranteeExpiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
            insuranceCovered: true,
            maxInsuranceCoverage: 25000,
          },
        },
      },
      include: {
        escrowVault: true,
      },
    });

    // Crear el registro de Despacho de Emergencia
    const dispatch = await this.prisma.emergencyDispatch.create({
      data: {
        bookingId: booking.id,
        severity: dto.severity || 'ALTA',
        incidentDescription: dto.incidentDescription,
        emergencyAddress: dto.customerAddress,
        clientPhone: dto.customerPhone,
        targetEtaMinutes: quote.targetEtaMinutes,
        dispatchRadiusKm: 5.0,
        broadcastStartedAt: now,
        broadcastExpiresAt: expiresAt,
        status: 'SEARCHING',
        surchargeAmount: quote.breakdown.totalSurcharge,
      },
    });

    // Enviar notificación masiva a técnicos de guardia
    await this.notificationsService.sendNotification({
      title: `🚨 EMERGENCIA CERCANA: ${quote.emergencyTitle}`,
      body: `Bono urgencia +$${quote.breakdown.totalSurcharge} MXN. ${dto.customerAddress}. ¡Acepta antes de 45s!`,
      role: 'SERVICEMAN',
      url: `/serviceman`,
    });

    return {
      success: true,
      bookingId: booking.id,
      dispatchId: dispatch.id,
      emergencyType: dto.emergencyType,
      status: 'SEARCHING',
      targetEtaMinutes: quote.targetEtaMinutes,
      broadcastExpiresAt: expiresAt,
      totalAmount,
      surcharge: quote.breakdown.totalSurcharge,
      otp,
      message: 'Despacho satelital activado. Alertando a los prestadores verificados más cercanos.',
    };
  }

  /**
   * Obtener detalle de una emergencia activa
   */
  async getEmergency(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        emergencyDispatch: true,
        serviceman: true,
        escrowVault: true,
        timeline: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Emergencia con folio ${bookingId} no encontrada`);
    }

    const availableTechs = await this.prisma.serviceman.findMany({
      where: { status: 'available' },
      select: { id: true, name: true, phone: true, avatar: true, rating: true, isVerified: true },
    });

    return {
      booking,
      dispatch: booking.emergencyDispatch,
      nearbyAvailableTechsCount: Math.max(availableTechs.length, 3),
      nearbyTechs: availableTechs.slice(0, 4),
    };
  }

  /**
   * Listar todas las emergencias activas (Radar de Torre de Control)
   */
  async getActiveEmergencies() {
    const dispatches = await this.prisma.emergencyDispatch.findMany({
      orderBy: { broadcastStartedAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            serviceTitle: true,
            amount: true,
            customerName: true,
            customerPhone: true,
            customerAddress: true,
            servicemanName: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      totalEmergencies: dispatches.length,
      activeCount: dispatches.filter((d) => d.status === 'SEARCHING' || d.status === 'ACCEPTED').length,
      dispatches,
    };
  }

  /**
   * Un prestador acepta el despacho flash de emergencia
   */
  async acceptEmergencyDispatch(bookingId: string, servicemanId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { emergencyDispatch: true },
    });

    if (!booking) {
      throw new NotFoundException(`Emergencia ${bookingId} no encontrada`);
    }

    const serviceman = await this.prisma.serviceman.findUnique({
      where: { id: servicemanId },
    });

    if (!serviceman) {
      throw new NotFoundException(`Prestador con id ${servicemanId} no encontrado`);
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    // Actualizar registro de despacho
    await this.prisma.emergencyDispatch.update({
      where: { bookingId },
      data: {
        status: 'ACCEPTED',
        acceptedServicemanId: serviceman.id,
        acceptedAt: now,
      },
    });

    // Actualizar Booking a estado on_the_way con el técnico asignado
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'on_the_way',
        servicemanId: serviceman.id,
        servicemanName: serviceman.name,
        servicemanPhone: serviceman.phone,
        servicemanAvatar: serviceman.avatar,
        timeline: {
          create: {
            status: 'on_the_way',
            time: timeStr,
            label: `⚡ ${serviceman.name} aceptó el despacho flash. En trayecto prioritario con sirena GPS.`,
          },
        },
      },
    });

    // Actualizar técnico a ocupado
    await this.prisma.serviceman.update({
      where: { id: serviceman.id },
      data: {
        status: 'busy',
        activeBookingId: bookingId,
      },
    });

    // Notificar al cliente con los datos del técnico
    await this.notificationsService.sendNotification({
      title: `🚨 ¡Técnico en camino! ${serviceman.name}`,
      body: `Arribo estimado en 20 minutos. Cel: ${serviceman.phone}. Prepárate para mostrar tu PIN.`,
      role: 'CUSTOMER',
      url: `/marketplace`,
    });

    return {
      success: true,
      status: 'ACCEPTED',
      bookingId: updatedBooking.id,
      serviceman: {
        id: serviceman.id,
        name: serviceman.name,
        phone: serviceman.phone,
        avatar: serviceman.avatar,
      },
      targetEtaMinutes: 20,
      message: '¡Despacho de emergencia asignado! Inicia ruta con geolocalización satelital.',
    };
  }

  /**
   * Semilla inicial con datos de prueba realistas para emergencias en CDMX
   */
  async seedInitialEmergencies() {
    const existing = await this.prisma.emergencyDispatch.findFirst();
    if (existing) return;

    console.log('⚡ [EmergencyService] Sembrando incidentes demo de ChambaExpress 24/7...');

    const provider = await this.prisma.provider.findFirst();
    const service = await this.prisma.service.findFirst();
    const serviceman = await this.prisma.serviceman.findFirst();

    if (!provider || !service) return;

    const now = new Date();

    // 1. Emergencia Activa en búsqueda
    const sos1 = await this.prisma.booking.create({
      data: {
        id: 'SOS-9110',
        customerName: 'Valeria Carrillo',
        customerPhone: '+52 55 9812 3456',
        customerEmail: 'valeria.carrillo@gmail.com',
        customerAddress: 'Av. Insurgentes Sur 1450, Depto 302, Col. San José Insurgentes, CDMX',
        serviceId: service.id,
        serviceTitle: '🚨 ChambaExpress: Fuga de Agua / Inundación Activa 💧',
        serviceImage: service.image,
        providerId: provider.id,
        providerName: provider.name,
        status: 'assigned',
        scheduledDate: now.toISOString().split('T')[0],
        scheduledTimeSlot: 'Arribo Inmediato (< 25 min)',
        amount: 780.0,
        platformFee: 117.0,
        providerEarnings: 663.0,
        paymentMethod: 'TARJETA_DIGITAL',
        paymentStatus: 'paid',
        transactionId: 'TX-SOS-9110',
        otp: '9110',
        isEmergency: true,
        emergencySurcharge: 300.0,
        emergencyType: 'FUGA_AGUA',
        timeline: {
          create: [
            {
              status: 'sos_broadcast',
              time: '12:50 PM',
              label: '🚨 Alerta SOS activada por fuga en baño principal con riesgo de filtración al piso inferior.',
            },
          ],
        },
      },
    });

    await this.prisma.emergencyDispatch.create({
      data: {
        bookingId: sos1.id,
        severity: 'CRITICA',
        incidentDescription: 'Fuga incontrolable en llave de paso de regadera. El agua está saliendo hacia la sala.',
        emergencyAddress: sos1.customerAddress,
        clientPhone: sos1.customerPhone,
        targetEtaMinutes: 20,
        dispatchRadiusKm: 4.5,
        broadcastStartedAt: now,
        broadcastExpiresAt: new Date(now.getTime() + 30 * 1000),
        status: 'SEARCHING',
        surchargeAmount: 300.0,
      },
    });

    // 2. Emergencia Aceptada en camino
    if (serviceman) {
      const sos2 = await this.prisma.booking.create({
        data: {
          id: 'SOS-7721',
          customerName: 'Rodrigo Benítez',
          customerPhone: '+52 55 4123 9988',
          customerEmail: 'rodrigo.benitez@outlook.com',
          customerAddress: 'Calle Sonora 88, Col. Condesa, Cuauhtémoc, CDMX',
          serviceId: service.id,
          serviceTitle: '🚨 ChambaExpress: Cortocircuito / Chispas Sin Luz ⚡',
          serviceImage: service.image,
          providerId: provider.id,
          providerName: provider.name,
          servicemanId: serviceman.id,
          servicemanName: serviceman.name,
          servicemanPhone: serviceman.phone,
          servicemanAvatar: serviceman.avatar,
          status: 'on_the_way',
          scheduledDate: now.toISOString().split('T')[0],
          scheduledTimeSlot: 'Arribo Inmediato (< 20 min)',
          amount: 850.0,
          platformFee: 127.5,
          providerEarnings: 722.5,
          paymentMethod: 'SPEI',
          paymentStatus: 'paid',
          transactionId: 'TX-SOS-7721',
          otp: '4821',
          isEmergency: true,
          emergencySurcharge: 300.0,
          emergencyType: 'CORTO_CIRCUITO',
          timeline: {
            create: [
              {
                status: 'sos_broadcast',
                time: '12:35 PM',
                label: '🚨 Alerta SOS emitida por chispas en pastilla térmica principal.',
              },
              {
                status: 'on_the_way',
                time: '12:37 PM',
                label: `⚡ ${serviceman.name} aceptó el despacho flash. En trayecto GPS prioritario.`,
              },
            ],
          },
        },
      });

      await this.prisma.emergencyDispatch.create({
        data: {
          bookingId: sos2.id,
          severity: 'ALTA',
          incidentDescription: 'Chispas en centro de carga y olor a quemado. Departamento sin energía eléctrica.',
          emergencyAddress: sos2.customerAddress,
          clientPhone: sos2.customerPhone,
          targetEtaMinutes: 20,
          dispatchRadiusKm: 3.8,
          broadcastStartedAt: new Date(now.getTime() - 15 * 60 * 1000),
          broadcastExpiresAt: new Date(now.getTime() - 14 * 60 * 1000),
          status: 'ACCEPTED',
          acceptedServicemanId: serviceman.id,
          acceptedAt: new Date(now.getTime() - 14 * 60 * 1000),
          surchargeAmount: 300.0,
        },
      });
    }

    console.log('✅ [EmergencyService] Semilla de emergencias ChambaExpress 24/7 completada');
  }
}
