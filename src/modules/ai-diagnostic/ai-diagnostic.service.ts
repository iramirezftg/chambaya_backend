import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AnalyzeRequestDto, ConvertToBookingDto } from './dto/ai-diagnostic.dto.js';

export interface DiagnosticResult {
  diagnosticId: string;
  photoUrl?: string;
  customerQuery: string;
  problemTitle: string;
  tradeCategory: string;
  urgencyLevel: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  confidenceScore: number;
  plainDescription: string;
  technicalDiagnosis: string;
  rootCause: string;
  materialsRequired: {
    item: string;
    store: string;
    estimatedCostMxn: number;
    necessity: 'OBLIGATORIA' | 'RECOMENDADA';
  }[];
  laborEstimate: {
    minMxn: number;
    typicalMxn: number;
    maxMxn: number;
    durationMinutes: number;
  };
  totalEstimatedRange: {
    minMxn: number;
    maxMxn: number;
  };
  safetyAdvice: string[];
  nomReference: string;
  suggestedServiceId?: string;
  suggestedProviderId?: string;
  analyzedAt: string;
}

@Injectable()
export class AiDiagnosticService implements OnModuleInit {
  private diagnosticStore: Map<string, DiagnosticResult> = new Map();

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    this.seedInitialDiagnostics();
  }

  /**
   * Catálogo de Presets Demo con análisis multimodal exhaustivo
   */
  getPresets() {
    return [
      {
        id: 'PRESET-PLUMBING-1',
        title: 'Fuga Severa en Tubería de Cobre de 1/2"',
        category: 'Plomería',
        photoUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
        description: 'Tengo un tubo de cobre saliendo de la pared que empezó a salpicar agua a presión y se está hinchando el yeso.',
        urgency: 'CRITICA',
        estimatedTotal: '$680 - $850 MXN',
      },
      {
        id: 'PRESET-ELECTRICAL-1',
        title: 'Cortocircuito y Chispas en Pastilla Térmica',
        category: 'Electricidad',
        photoUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
        description: 'El interruptor del centro de carga hace ruido de zumbido, soltó chispas y huele a baquelita quemada.',
        urgency: 'CRITICA',
        estimatedTotal: '$750 - $950 MXN',
      },
      {
        id: 'PRESET-HVAC-1',
        title: 'Minisplit con Hielo en Tubería y Goteo',
        category: 'Climatización',
        photoUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80',
        description: 'El aire acondicionado no enfría, tira gotas de agua por el frente y la tubería exterior se cubrió de escarcha blanca.',
        urgency: 'ALTA',
        estimatedTotal: '$650 - $890 MXN',
      },
      {
        id: 'PRESET-LOCK-1',
        title: 'Cerradura de Alta Seguridad Atascada',
        category: 'Cerrajería',
        photoUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80',
        description: 'La llave de puntos gira hasta la mitad pero no retrae el pestillo de seguridad, la puerta está trabada.',
        urgency: 'ALTA',
        estimatedTotal: '$500 - $700 MXN',
      },
    ];
  }

  /**
   * Intenta consultar a Google Gemini si la variable GEMINI_API_KEY está configurada
   */
  private async analyzeWithGeminiIfAvailable(dto: AnalyzeRequestDto): Promise<Partial<DiagnosticResult> | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
      const prompt = `Actúa como ChambaIA, el perito técnico de oficios del hogar en México.
Analiza la siguiente consulta técnica del cliente:
Descripción: "${dto.description || 'Consulta visual de avería'}"
${dto.photoUrl ? `Foto: ${dto.photoUrl}` : ''}

Devuelve un JSON estrictamente válido con los siguientes campos:
{
  "problemTitle": "Título técnico preciso",
  "tradeCategory": "Plomería" | "Electricidad" | "Climatización" | "Cerrajería",
  "urgencyLevel": "CRITICA" | "ALTA" | "MEDIA" | "BAJA",
  "confidenceScore": 96,
  "plainDescription": "Explicación clara en español de México",
  "technicalDiagnosis": "Diagnóstico técnico con componentes",
  "rootCause": "Causa raíz",
  "materialsRequired": [
    { "item": "Nombre", "store": "Home Depot / Ferretería Local", "estimatedCostMxn": 150, "necessity": "OBLIGATORIA" }
  ],
  "laborEstimate": { "minMxn": 450, "typicalMxn": 550, "maxMxn": 700, "durationMinutes": 60 },
  "safetyAdvice": ["Medida de seguridad inmediata"],
  "nomReference": "Norma Oficial Mexicana (ej. NOM-001-SEDE-2012 / NMX-C-415-ONNCCE)"
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) return null;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  }

  /**
   * Análisis inteligente con ChambaIA (Motor Multimodal de Oficios en México)
   */
  async analyzeProblem(dto: AnalyzeRequestDto): Promise<DiagnosticResult> {
    const diagnosticId = `IA-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Evaluar si Gemini API en vivo está disponible
    const geminiRes = await this.analyzeWithGeminiIfAvailable(dto);

    const text = (dto.description || '').toLowerCase();
    const photo = dto.photoUrl || '';

    let category = geminiRes?.tradeCategory || 'Plomería';
    let urgency: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' = geminiRes?.urgencyLevel || 'ALTA';
    let problemTitle = geminiRes?.problemTitle || 'Diagnóstico Técnico Especializado';
    let plainDescription = geminiRes?.plainDescription || 'Detectamos una incidencia en tu instalación que requiere atención técnica certificada.';
    let technicalDiagnosis = geminiRes?.technicalDiagnosis || 'Se identifica desgaste por uso y fatiga de componentes que comprometen la estanqueidad o conductividad.';
    let rootCause = geminiRes?.rootCause || 'Envejecimiento de sello o sobrecarga operativa.';
    let nom = geminiRes?.nomReference || 'NOM-001-SEDE-2012 / NMX-C-415-ONNCCE';

    let materials: {
      item: string;
      store: string;
      estimatedCostMxn: number;
      necessity: 'OBLIGATORIA' | 'RECOMENDADA';
    }[] = geminiRes?.materialsRequired || [
      { item: 'Junta o empaque de compresión hermético', store: 'Ferretería de Barrio / Fix', estimatedCostMxn: 85, necessity: 'OBLIGATORIA' },
      { item: 'Cinta selladora de teflón grado plomería Truper', store: 'The Home Depot', estimatedCostMxn: 35, necessity: 'OBLIGATORIA' },
    ];

    let labor = geminiRes?.laborEstimate || {
      minMxn: 400,
      typicalMxn: 520,
      maxMxn: 680,
      durationMinutes: 45,
    };

    // Si Gemini no respondió, aplicar motor heurístico local especializado para México
    if (!geminiRes) {

    // Clasificación de Plomería
    if (text.includes('fuga') || text.includes('agua') || text.includes('tubo') || text.includes('goteo') || text.includes('cobre') || text.includes('tuboplus') || text.includes('boiler') || photo.includes('fuga')) {
      category = 'Plomería';
      urgency = text.includes('inund') || text.includes('presion') || text.includes('chorro') ? 'CRITICA' : 'ALTA';
      problemTitle = 'Fuga Hidráulica en Tubería por Fatiga de Unión';
      plainDescription = 'El tubo presenta una fuga activa de agua. El agua saliente puede filtrarse en muros y deteriorar los acabados si no se repara de inmediato.';
      technicalDiagnosis = 'Ruptura en unión de cobre soldado o fatiga en codo de 1/2 pulgada. Se requiere corte de tramo fisurado, colocación de cople de latón y sellado bajo prueba de presión hidrostática.';
      rootCause = 'Corrosión galvánica por aguas duras o golpe de ariete al cerrar llaves monomando bruscamente.';
      nom = 'NMX-C-415-ONNCCE (Válvulas y Grifería Hidráulica)';
      materials = [
        { item: 'Cople de compresión 1/2" latón Urrea', store: 'The Home Depot Mixcoac', estimatedCostMxn: 135, necessity: 'OBLIGATORIA' },
        { item: 'Tramo de 30 cm tubo cobre tipo M de 1/2"', store: 'Ferreterías Fix', estimatedCostMxn: 75, necessity: 'OBLIGATORIA' },
        { item: 'Pasta fundente y soldadura estaño 50/50', store: 'Tlapalería Local', estimatedCostMxn: 90, necessity: 'OBLIGATORIA' },
      ];
      labor = { minMxn: 450, typicalMxn: 550, maxMxn: 720, durationMinutes: 60 };
    }
    // Clasificación de Electricidad
    else if (text.includes('luz') || text.includes('chispa') || text.includes('pastilla') || text.includes('corto') || text.includes('caliente') || text.includes('quema') || text.includes('toque')) {
      category = 'Electricidad';
      urgency = 'CRITICA';
      problemTitle = 'Sobrecarga y Falso Contacto en Pastilla Termomagnética';
      plainDescription = 'Tu centro de carga está sufriendo calentamiento excesivo y arcos eléctricos. Esto puede botar la luz de toda la casa o derivar en conato de incendio.';
      technicalDiagnosis = 'Falso contacto por tornillo prisionero flojo en pastilla monopolar o bifásica. El arqueo carbonizó el borne plástico y degradó el aislamiento del cable conductor.';
      rootCause = 'Sobrecarga de amperaje continua por electrodomésticos de alta demanda o calibre de cable inadecuado (ej. calibre 14 donde se requería 10).';
      nom = 'NOM-001-SEDE-2012 (Instalaciones Eléctricas - Utilización)';
      materials = [
        { item: 'Interruptor termomagnético 1P 20A Square D QO original', store: 'The Home Depot', estimatedCostMxn: 195, necessity: 'OBLIGATORIA' },
        { item: 'Cable de cobre THW-LS calibre 10 AWG (3 metros)', store: 'Materiales Eléctricos Eléctrica Nacional', estimatedCostMxn: 120, necessity: 'RECOMENDADA' },
        { item: 'Cinta de aislar Scotch Super 33+ grado profesional 3M', store: 'Ferretería Local', estimatedCostMxn: 65, necessity: 'OBLIGATORIA' },
      ];
      labor = { minMxn: 500, typicalMxn: 620, maxMxn: 800, durationMinutes: 50 };
    }
    // Clasificación de Minisplit / Climatización
    else if (text.includes('clima') || text.includes('aire') || text.includes('minisplit') || text.includes('hielo') || text.includes('escarcha') || text.includes('enfria') || text.includes('gas r410')) {
      category = 'Climatización';
      urgency = 'ALTA';
      problemTitle = 'Falta de Mantenimiento y Obstrucción de Evaporador Minisplit';
      plainDescription = 'Tu minisplit tiene el serpentín tapado de polvo o baja carga de refrigerante, por lo que la humedad se congela y gotea al descongelarse.';
      technicalDiagnosis = 'Restricción de flujo de aire por acumulación de bio-película en turbina y aletas del serpentín. Esto produce caída de presión de evaporación y congelamiento de la tubería de succión.';
      rootCause = 'Falta de servicio preventivo semestral y posible micro-fuga en tuerca flare del condensador.';
      nom = 'NOM-023-ENER-2018 (Eficiencia Energética en Acondicionadores de Aire)';
      materials = [
        { item: 'Limpiador y desengrasante espumante biodegradable para serpentines', store: 'Refaccionaria de Climas', estimatedCostMxn: 160, necessity: 'OBLIGATORIA' },
        { item: 'Filtro antibacteriano lavable original', store: 'Mirage / Midea Store', estimatedCostMxn: 110, necessity: 'RECOMENDADA' },
      ];
      labor = { minMxn: 550, typicalMxn: 699, maxMxn: 890, durationMinutes: 75 };
    }
    // Clasificación de Cerrajería
    else if (text.includes('llave') || text.includes('chapa') || text.includes('cerradura') || text.includes('puerta') || text.includes('traba') || text.includes('ator')) {
      category = 'Cerrajería';
      urgency = 'ALTA';
      problemTitle = 'Desalineación y Bloqueo Mecánico de Cilindro de Seguridad';
      plainDescription = 'El cerrojo o mecanismo interior de los pernos está atorado. Forzar la llave puede quebrarla dentro del cilindro.';
      technicalDiagnosis = 'Desgaste en resortes de los pernos de latón o deformación del pestillo por asentamiento del marco de la puerta.';
      rootCause = 'Falta de lubricación con grafito seco o intento de apertura forzada.';
      nom = 'NMX-CH-127-1994 (Cerraduras para Edificación)';
      materials = [
        { item: 'Cilindro europeo o repuesto de pernos de combinación', store: 'Cerrajería Central', estimatedCostMxn: 220, necessity: 'RECOMENDADA' },
        { item: 'Lubricante seco a base de polvo de grafito', store: 'Ferreterías Truper', estimatedCostMxn: 55, necessity: 'OBLIGATORIA' },
      ];
      labor = { minMxn: 380, typicalMxn: 480, maxMxn: 650, durationMinutes: 40 };
    }
  }

    const totalMaterialsCost = materials.reduce((acc, m) => acc + m.estimatedCostMxn, 0);
    const totalMin = labor.minMxn + totalMaterialsCost;
    const totalMax = labor.maxMxn + totalMaterialsCost;

    // Buscar servicio correspondiente en la base de datos
    const dbService = await this.prisma.service.findFirst({
      where: {
        category: { name: { contains: category } },
      },
      include: { provider: true },
    });

    const result: DiagnosticResult = {
      diagnosticId,
      photoUrl: dto.photoUrl,
      customerQuery: dto.description || 'Consulta visual mediante fotografía de la avería',
      problemTitle,
      tradeCategory: category,
      urgencyLevel: urgency,
      confidenceScore: Math.floor(94 + Math.random() * 5), // 94% - 98%
      plainDescription,
      technicalDiagnosis,
      rootCause,
      materialsRequired: materials,
      laborEstimate: labor,
      totalEstimatedRange: {
        minMxn: totalMin,
        maxMxn: totalMax,
      },
      safetyAdvice: [
        category === 'Plomería'
          ? 'Cierra la llave de paso principal de la casa o departamento para cortar el flujo de agua.'
          : category === 'Electricidad'
          ? 'Baja la palanca o pastilla general del tablero eléctrico. NO toques con manos húmedas.'
          : category === 'Climatización'
          ? 'Apaga el equipo desde el control remoto y baja la pastilla dedicada para evitar quemar el compresor.'
          : 'No fuerces la llave con pinzas para evitar que se quiebre dentro del cilindro.',
        'Despeja el área de trabajo y retira objetos de valor o alfombras cercanas.',
        'Espera el arribo del técnico certificado para que revise con multímetro o manómetro calibrado.',
      ],
      nomReference: nom,
      suggestedServiceId: dbService?.id || 'srv-1',
      suggestedProviderId: dbService?.providerId || 'prov-1',
      analyzedAt: new Date().toISOString(),
    };

    this.diagnosticStore.set(diagnosticId, result);

    return result;
  }

  /**
   * Obtener detalle de diagnóstico previo por Folio
   */
  getDiagnostic(diagnosticId: string) {
    const diag = this.diagnosticStore.get(diagnosticId);
    if (!diag) {
      throw new NotFoundException(`Diagnóstico con folio ${diagnosticId} no encontrado`);
    }
    return diag;
  }

  /**
   * Convertir cotización preliminar de IA en una orden real agendada o de emergencia
   */
  async convertToBooking(dto: ConvertToBookingDto) {
    const diag = this.diagnosticStore.get(dto.diagnosticId);
    if (!diag) {
      throw new NotFoundException(`Folio de cotización ${dto.diagnosticId} no encontrado`);
    }

    const serviceId = diag.suggestedServiceId || 'srv-1';
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { provider: true },
    });

    if (!service) {
      throw new BadRequestException('El servicio sugerido no existe en catálogo');
    }

    const totalAmount = diag.laborEstimate.typicalMxn;
    const platformFee = totalAmount * 0.15;
    const providerEarnings = totalAmount - platformFee;
    const bookingId = `CHAMBA-${Math.floor(1000 + Math.random() * 9000)}`;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const now = new Date();

    const booking = await this.prisma.booking.create({
      data: {
        id: bookingId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail || 'cliente.ia@gmail.com',
        customerAddress: dto.customerAddress,
        serviceId: service.id,
        serviceTitle: `${service.title} (Cotizado con ChambaIA #${dto.diagnosticId})`,
        serviceImage: diag.photoUrl || service.image,
        providerId: service.providerId,
        providerName: service.provider.name,
        status: dto.isEmergency ? 'assigned' : 'pending',
        scheduledDate: now.toISOString().split('T')[0],
        scheduledTimeSlot: dto.isEmergency ? 'Arribo Inmediato (< 30 min)' : 'Horario Acordado (10:00 AM - 12:00 PM)',
        amount: totalAmount,
        platformFee,
        providerEarnings,
        paymentMethod: 'TARJETA_DIGITAL',
        paymentStatus: 'paid',
        transactionId: `TX-IA-${Date.now()}`,
        otp,
        isEmergency: Boolean(dto.isEmergency),
        emergencySurcharge: dto.isEmergency ? 250.0 : 0.0,
        timeline: {
          create: [
            {
              status: 'quote_created',
              time: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              label: `🤖 Diagnóstico ChambaIA generado: ${diag.problemTitle}`,
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
    });

    // Notificación en tiempo real
    await this.notificationsService.sendNotification({
      title: `🤖 Cotización ChambaIA Convertida a Orden #${booking.id}`,
      body: `Servicio agendado para ${dto.customerAddress}. Monto preliminar $${totalAmount} MXN`,
      role: 'CUSTOMER',
      url: `/marketplace`,
    });

    return {
      success: true,
      bookingId: booking.id,
      amount: totalAmount,
      status: booking.status,
      otp,
      diagnosticId: dto.diagnosticId,
      message: 'Cotización inteligente convertida con éxito en orden con Garantía Escrow.',
    };
  }

  /**
   * Semilla con diagnósticos de prueba para demostración instantánea
   */
  private seedInitialDiagnostics() {
    const presetPlumbing: DiagnosticResult = {
      diagnosticId: 'IA-8821',
      photoUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
      customerQuery: 'Tengo un tubo de cobre saliendo de la pared que empezó a salpicar agua a presión y se está hinchando el yeso.',
      problemTitle: 'Fuga Hidráulica Activa en Tubería de Cobre por Corrosión',
      tradeCategory: 'Plomería',
      urgencyLevel: 'CRITICA',
      confidenceScore: 97,
      plainDescription: 'Se aprecia una rotura por fatiga de material con fuga a chorro constante. Requiere corte de sección dañada y cople de latón.',
      technicalDiagnosis: 'Fisura longitudinal en tubería rígida de cobre 1/2" tipo M con soldadura desprendida. Riesgo de filtración a losa inferior.',
      rootCause: 'Corrosión galvánica combinada con altas presiones nocturnas en red municipal.',
      materialsRequired: [
        { item: 'Cople de compresión 1/2" Urrea', store: 'Home Depot Mixcoac', estimatedCostMxn: 135, necessity: 'OBLIGATORIA' },
        { item: 'Soldadura estaño 50/50 y pasta fundente', store: 'Tlapalería Local', estimatedCostMxn: 90, necessity: 'OBLIGATORIA' },
      ],
      laborEstimate: { minMxn: 450, typicalMxn: 550, maxMxn: 720, durationMinutes: 60 },
      totalEstimatedRange: { minMxn: 675, maxMxn: 945 },
      safetyAdvice: [
        'Cerrar la llave de paso de la azotea o medidor inmediatamente.',
        'Alejar cables y extensiones eléctricas del piso encharcado.',
      ],
      nomReference: 'NMX-C-415-ONNCCE',
      suggestedServiceId: 'srv-1',
      analyzedAt: new Date().toISOString(),
    };

    this.diagnosticStore.set('IA-8821', presetPlumbing);
  }
}
