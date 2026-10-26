import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MexicanIdentityValidator } from './kyc.validator.js';

@Injectable()
export class KycService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    // Inicializar expedientes demo si la base de datos está vacía
    await this.seedInitialExpedientes().catch((err) => {
      console.warn('⚠️ [KYC] Error al sembrar expedientes demo:', err.message);
    });
  }

  /**
   * Validación formal de CURP mexicana
   */
  validateCurp(curp: string) {
    return MexicanIdentityValidator.validateCurp(curp);
  }

  /**
   * Validación formal de RFC mexicano
   */
  validateRfc(rfc: string) {
    return MexicanIdentityValidator.validateRfc(rfc);
  }

  /**
   * Simulación de OCR sobre credencial de elector INE
   */
  simulateIneOcr(nameHint?: string) {
    return MexicanIdentityValidator.simulateIneOcr(nameHint);
  }

  /**
   * Simulación de Biometría Facial con Prueba de Vida
   */
  simulateFacematch() {
    return MexicanIdentityValidator.simulateBiometricFaceMatch();
  }

  /**
   * Obtener expediente KYC de un chambeador
   */
  async getExpedienteByServiceman(servicemanId: string) {
    const serviceman = await this.prisma.serviceman.findUnique({
      where: { id: servicemanId },
      include: { kycVerification: true, provider: true },
    });

    if (!serviceman) {
      throw new NotFoundException(`Chambeador ${servicemanId} no encontrado`);
    }

    if (!serviceman.kycVerification) {
      // Crear registro inicial en estado PENDING
      const created = await this.prisma.kycVerification.create({
        data: {
          servicemanId: serviceman.id,
          status: 'PENDING',
          trustScore: 0,
        },
      });
      return { ...serviceman, kycVerification: created };
    }

    return serviceman;
  }

  /**
   * Enviar o actualizar expediente KYC de un chambeador
   */
  async submitExpediente(
    servicemanId: string,
    data: {
      curp?: string;
      rfc?: string;
      ineClaveElector?: string;
      ineCic?: string;
      ineOcrNumber?: string;
      ineFrontUrl?: string;
      ineBackUrl?: string;
      selfieUrl?: string;
      antecedentesDocUrl?: string;
      antecedentesFolio?: string;
      comprobanteDomicilioUrl?: string;
    },
  ) {
    const serviceman = await this.prisma.serviceman.findUnique({
      where: { id: servicemanId },
      include: { kycVerification: true },
    });

    if (!serviceman) {
      throw new NotFoundException(`Chambeador ${servicemanId} no encontrado`);
    }

    // 1. Validar CURP
    let curpValidated = false;
    let curpDetails: any = null;
    if (data.curp) {
      const curpRes = MexicanIdentityValidator.validateCurp(data.curp);
      if (curpRes.valid) {
        curpValidated = true;
        curpDetails = JSON.stringify({
          birthDate: curpRes.birthDate,
          gender: curpRes.gender,
          stateOfBirth: curpRes.stateOfBirth,
        });
      }
    }

    // 2. Validar RFC
    let rfcValidated = false;
    if (data.rfc) {
      const rfcRes = MexicanIdentityValidator.validateRfc(data.rfc);
      rfcValidated = rfcRes.valid;
    }

    // 3. Validar INE
    const ineValidated = Boolean(
      (data.ineClaveElector && data.ineClaveElector.length >= 10) ||
      (data.ineCic && data.ineCic.length >= 8) ||
      (data.ineFrontUrl && data.ineBackUrl)
    );

    // 4. Biometría Facial
    const faceMatch = MexicanIdentityValidator.simulateBiometricFaceMatch();

    // 5. Antecedentes Penales
    const antecedentesPassed = Boolean(data.antecedentesDocUrl || data.antecedentesFolio);

    // 6. Comprobante de domicilio
    const domicilioPassed = Boolean(data.comprobanteDomicilioUrl);

    // Calcular Trust Score (0-100)
    const trustScore = MexicanIdentityValidator.calculateTrustScore({
      curpValidated,
      rfcValidated,
      ineValidated,
      faceMatchPassed: faceMatch.passed,
      antecedentesPassed,
      domicilioPassed,
    });

    // Estado resultante
    const nextStatus = trustScore >= 75 ? 'UNDER_REVIEW' : 'PENDING';

    const kycData = {
      curp: data.curp,
      curpValidated,
      curpDetails,
      rfc: data.rfc,
      rfcValidated,
      ineClaveElector: data.ineClaveElector || (ineValidated ? 'MEND85041209H500' : null),
      ineCic: data.ineCic || (ineValidated ? '489201948' : null),
      ineOcrNumber: data.ineOcrNumber || (ineValidated ? 'IDMEX1928471928<<' : null),
      ineFrontUrl: data.ineFrontUrl || '/images/ine_front_sample.jpg',
      ineBackUrl: data.ineBackUrl || '/images/ine_back_sample.jpg',
      ineValidated,
      selfieUrl: data.selfieUrl || '/images/selfie_sample.jpg',
      faceMatchScore: faceMatch.faceMatchScore,
      faceMatchPassed: faceMatch.passed,
      antecedentesDocUrl: data.antecedentesDocUrl || '/images/antecedentes_sample.pdf',
      antecedentesFolio: data.antecedentesFolio || 'FGR-CDMX-2026-88912',
      antecedentesPassed,
      comprobanteDomicilioUrl: data.comprobanteDomicilioUrl || '/images/comprobante_cfe.pdf',
      domicilioPassed,
      trustScore,
      status: nextStatus,
    };

    let kyc;
    if (serviceman.kycVerification) {
      kyc = await this.prisma.kycVerification.update({
        where: { id: serviceman.kycVerification.id },
        data: kycData,
      });
    } else {
      kyc = await this.prisma.kycVerification.create({
        data: {
          servicemanId: serviceman.id,
          ...kycData,
        },
      });
    }

    // Actualizar pre-score en el modelo serviceman
    await this.prisma.serviceman.update({
      where: { id: servicemanId },
      data: {
        trustScore,
        verificationBadge: trustScore >= 75 ? 'En Revisión Oficial' : 'Incompleto',
      },
    });

    // 📲 Despachar Push Notification al Administrador
    this.notificationsService.sendNotification({
      title: `📑 Nuevo Expediente KYC para Revisión`,
      body: `El chambeador ${serviceman.name} envió su documentación (Trust Score: ${trustScore}%).`,
      url: '/admin',
      role: 'ADMIN',
    }).catch(() => {});

    return {
      success: true,
      trustScore,
      status: nextStatus,
      kyc,
    };
  }

  /**
   * Dictamen Administrativo del Expediente KYC (Aprobar o Rechazar)
   */
  async adminDictamen(
    expedienteId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes: string,
    adminUser = 'SuperAdmin ChambaYa'
  ) {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { id: expedienteId },
      include: { serviceman: true },
    });

    if (!kyc) {
      throw new NotFoundException(`Expediente KYC ${expedienteId} no encontrado`);
    }

    const isApproved = decision === 'APPROVED';

    const updatedKyc = await this.prisma.kycVerification.update({
      where: { id: expedienteId },
      data: {
        status: isApproved ? 'APPROVED' : 'REJECTED',
        reviewedBy: adminUser,
        reviewNotes: notes || (isApproved ? 'Expediente validado contra bases del SAT, RENAPO e INE.' : 'Faltan documentos legibles.'),
        reviewedAt: new Date(),
        trustScore: isApproved ? Math.max(kyc.trustScore, 100) : kyc.trustScore,
      },
    });

    if (kyc.servicemanId) {
      await this.prisma.serviceman.update({
        where: { id: kyc.servicemanId },
        data: {
          isVerified: isApproved,
          verificationBadge: isApproved ? 'Chambeador Verificado ⭐' : 'Verificación Rechazada',
          trustScore: isApproved ? 100 : kyc.trustScore,
        },
      });

      // 📲 Notificación Push al Chambeador con el resultado de su verificación
      if (isApproved) {
        this.notificationsService.sendNotification({
          title: '🎉 ¡Felicidades! Verificación Aprobada',
          body: 'Tu cuenta de Chambeador cuenta con Insignia Dorada Oficial y máxima prioridad en asignación de órdenes.',
          url: '/serviceman',
          role: 'SERVICEMAN',
          userId: kyc.serviceman?.userId || undefined,
        }).catch(() => {});
      } else {
        this.notificationsService.sendNotification({
          title: '⚠️ Observaciones en tu Expediente KYC',
          body: `Motivo: ${notes || 'Documentos no legibles'}. Por favor sube tus documentos corregidos en la app.`,
          url: '/serviceman',
          role: 'SERVICEMAN',
          userId: kyc.serviceman?.userId || undefined,
        }).catch(() => {});
      }
    }

    return updatedKyc;
  }

  /**
   * Listar todos los expedientes para la Torre de Control
   */
  async getAdminExpedientes(status?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.prisma.kycVerification.findMany({
      where,
      include: {
        serviceman: {
          include: { provider: true }
        },
        provider: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Métricas globales de verificación KYC
   */
  async getStats() {
    const total = await this.prisma.kycVerification.count();
    const approved = await this.prisma.kycVerification.count({ where: { status: 'APPROVED' } });
    const underReview = await this.prisma.kycVerification.count({ where: { status: 'UNDER_REVIEW' } });
    const rejected = await this.prisma.kycVerification.count({ where: { status: 'REJECTED' } });
    const pending = await this.prisma.kycVerification.count({ where: { status: 'PENDING' } });

    const totalServicemen = await this.prisma.serviceman.count();
    const verifiedServicemen = await this.prisma.serviceman.count({ where: { isVerified: true } });

    return {
      totalExpedientes: total,
      aprobados: approved,
      enRevision: underReview,
      rechazados: rejected,
      pendientes: pending,
      totalChambeadores: totalServicemen,
      chambeadoresVerificados: verifiedServicemen,
      porcentajeVerificacion: totalServicemen > 0 ? Number(((verifiedServicemen / totalServicemen) * 100).toFixed(1)) : 0,
    };
  }

  /**
   * Sembrar datos realistas para los técnicos existentes
   */
  async seedInitialExpedientes() {
    // 1. Carlos Mendoza (sm-1) -> APROBADO 100%
    const sm1 = await this.prisma.serviceman.findUnique({
      where: { id: 'sm-1' },
      include: { kycVerification: true },
    });

    if (sm1 && !sm1.kycVerification) {
      await this.prisma.kycVerification.create({
        data: {
          servicemanId: 'sm-1',
          status: 'APPROVED',
          trustScore: 100,
          curp: 'MEMC850412HDFRND09',
          curpValidated: true,
          curpDetails: JSON.stringify({ birthDate: '12/04/1985', gender: 'Hombre', stateOfBirth: 'Ciudad de México' }),
          rfc: 'MEMC8504128X9',
          rfcValidated: true,
          ineClaveElector: 'MENCAR85041209H500',
          ineCic: '492019482',
          ineOcrNumber: 'IDMEX1928471928<<',
          ineFrontUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80',
          ineBackUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80',
          ineValidated: true,
          selfieUrl: sm1.avatar,
          faceMatchScore: 98.7,
          faceMatchPassed: true,
          antecedentesDocUrl: '/docs/fgr_carlos_mendoza.pdf',
          antecedentesFolio: 'FGR-CDMX-2026-9021A',
          antecedentesPassed: true,
          comprobanteDomicilioUrl: '/docs/cfe_carlos_mendoza.pdf',
          domicilioPassed: true,
          reviewedBy: 'SuperAdmin ChambaYa',
          reviewNotes: 'Documentación oficial completa, biométricos coincidentes con padrón INE y carta de no antecedentes vigente.',
          reviewedAt: new Date(),
        },
      });

      await this.prisma.serviceman.update({
        where: { id: 'sm-1' },
        data: {
          isVerified: true,
          verificationBadge: 'Chambeador Verificado ⭐',
          trustScore: 100,
        },
      });
    }

    // 2. Elena Rostova (sm-2) -> EN REVISIÓN 75%
    const sm2 = await this.prisma.serviceman.findUnique({
      where: { id: 'sm-2' },
      include: { kycVerification: true },
    });

    if (sm2 && !sm2.kycVerification) {
      await this.prisma.kycVerification.create({
        data: {
          servicemanId: 'sm-2',
          status: 'UNDER_REVIEW',
          trustScore: 75,
          curp: 'ROSE900821MDFNLL03',
          curpValidated: true,
          curpDetails: JSON.stringify({ birthDate: '21/08/1990', gender: 'Mujer', stateOfBirth: 'Nuevo León' }),
          rfc: 'ROSE900821TR2',
          rfcValidated: true,
          ineClaveElector: 'ROSELE90082119M200',
          ineCic: '849201948',
          ineOcrNumber: 'IDMEX2938471029<<',
          ineFrontUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
          ineBackUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
          ineValidated: true,
          selfieUrl: sm2.avatar,
          faceMatchScore: 97.4,
          faceMatchPassed: true,
          antecedentesDocUrl: null,
          antecedentesFolio: null,
          antecedentesPassed: false,
          comprobanteDomicilioUrl: '/docs/cfe_elena.pdf',
          domicilioPassed: true,
        },
      });

      await this.prisma.serviceman.update({
        where: { id: 'sm-2' },
        data: {
          isVerified: false,
          verificationBadge: 'En Revisión Oficial',
          trustScore: 75,
        },
      });
    }

    // 3. Marcos Villegas (sm-3) -> PENDIENTE 25%
    const sm3 = await this.prisma.serviceman.findUnique({
      where: { id: 'sm-3' },
      include: { kycVerification: true },
    });

    if (sm3 && !sm3.kycVerification) {
      await this.prisma.kycVerification.create({
        data: {
          servicemanId: 'sm-3',
          status: 'PENDING',
          trustScore: 25,
          curp: 'VILM820315HJCRRR08',
          curpValidated: true,
          curpDetails: JSON.stringify({ birthDate: '15/03/1982', gender: 'Hombre', stateOfBirth: 'Jalisco' }),
          rfc: null,
          rfcValidated: false,
          ineValidated: false,
          faceMatchPassed: false,
          antecedentesPassed: false,
        },
      });

      await this.prisma.serviceman.update({
        where: { id: 'sm-3' },
        data: {
          isVerified: false,
          verificationBadge: 'Documentación Incompleta',
          trustScore: 25,
        },
      });
    }
  }
}
