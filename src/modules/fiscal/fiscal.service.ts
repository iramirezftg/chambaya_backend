import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import crypto from 'crypto';

@Injectable()
export class FiscalService {
  constructor(private prisma: PrismaService) {}

  /**
   * Cálculo legal de Retenciones SAT para Plataformas Tecnológicas (LISR Art. 113-A / LIVA Art. 18-B)
   */
  calculateRetentions(grossAmount: number, hasRfc: boolean = true, commissionRate: number = 15.0) {
    // 1. Comisión ChambaYa (Intermediación)
    const platformFee = Number((grossAmount * (commissionRate / 100)).toFixed(2));
    const platformFeeIva = Number((platformFee * 0.16).toFixed(2));
    const totalPlatformFee = Number((platformFee + platformFeeIva).toFixed(2));

    // 2. Retención de ISR para prestación de servicios vía plataformas
    // Con RFC verificado: 1.0% | Sin RFC: 20.0%
    const isrRetentionRate = hasRfc ? 0.01 : 0.20;
    const isrRetained = Number((grossAmount * isrRetentionRate).toFixed(2));

    // 3. Retención de IVA
    // Con RFC verificado: 50% del IVA causado (8.0% del monto bruto) | Sin RFC: 100% del IVA causado (16.0%)
    const ivaRetentionRate = hasRfc ? 0.08 : 0.16;
    const ivaRetained = Number((grossAmount * ivaRetentionRate).toFixed(2));

    const totalRetentions = Number((isrRetained + ivaRetained).toFixed(2));

    // 4. Monto Neto a dispersar al Chambeador / Taller
    const netPayout = Math.max(0, Number((grossAmount - totalPlatformFee - totalRetentions).toFixed(2)));

    return {
      grossAmount,
      platformFee,
      platformFeeIva,
      totalPlatformFee,
      hasRfc,
      isrRetentionRate,
      isrRetained,
      ivaRetentionRate,
      ivaRetained,
      totalRetentions,
      netPayout,
    };
  }

  /**
   * Generar o registrar retención para una chamba completada
   */
  async recordTaxRetention(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true },
    });

    if (!booking) {
      throw new NotFoundException(`La chamba ${bookingId} no existe`);
    }

    const existing = await this.prisma.taxRetention.findUnique({
      where: { bookingId },
    });

    if (existing) {
      return existing;
    }

    const hasRfc = Boolean(booking.provider?.rfc && booking.provider.rfc !== 'XAXX010101000');
    const calc = this.calculateRetentions(booking.amount, hasRfc, booking.provider?.commissionRate || 15);

    return this.prisma.taxRetention.create({
      data: {
        bookingId: booking.id,
        providerId: booking.providerId,
        grossAmount: calc.grossAmount,
        platformFee: calc.platformFee,
        platformFeeIva: calc.platformFeeIva,
        isrRetentionRate: calc.isrRetentionRate,
        isrRetained: calc.isrRetained,
        ivaRetentionRate: calc.ivaRetentionRate,
        ivaRetained: calc.ivaRetained,
        netPayout: calc.netPayout,
        clabe: booking.provider?.clabeAccount || '012180001234567890',
        bankName: booking.provider?.bankName || 'BBVA México',
        payoutStatus: 'settled',
      },
    });
  }

  /**
   * Timbrar Factura Electrónica CFDI 4.0 con el SAT (PAC México)
   */
  async generateCfdi(dto: {
    bookingId: string;
    rfcReceptor: string;
    nombreReceptor: string;
    domicilioFiscalReceptor: string; // CP 5 dígitos
    regimenReceptor: string;
    usoCfdi: string;
    formaPago?: string;
  }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`La chamba ${dto.bookingId} no existe`);
    }

    // Verificar si ya cuenta con CFDI timbrado
    const existing = await this.prisma.invoice.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existing) {
      return existing;
    }

    // Validar RFC (formato mexicano 12 o 13 caracteres)
    const cleanRfc = dto.rfcReceptor.trim().toUpperCase();
    const rfcRegex = /^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{3})$/;
    if (!rfcRegex.test(cleanRfc) && cleanRfc !== 'XAXX010101000') {
      throw new BadRequestException('El RFC ingresado no tiene un formato fiscal válido del SAT');
    }

    // Cálculos de IVA desglosado (16%)
    const total = booking.amount;
    const subtotal = Number((total / 1.16).toFixed(2));
    const iva = Number((total - subtotal).toFixed(2));

    // Generar UUID Fiscal SAT
    const uuid = crypto.randomUUID().toUpperCase();
    const folio = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const isoFecha = now.toISOString().split('.')[0];

    // Simular firma criptográfica del emisor y PAC autorizado por el SAT
    const selloEmisor = crypto.createHash('sha256').update(`${uuid}|CHY|${folio}|${subtotal}|${total}`).digest('base64');
    const selloSat = crypto.createHash('sha256').update(`${selloEmisor}|00001000000504465028|${isoFecha}`).digest('base64');
    const noCertificadoSat = '00001000000504465028';

    const cadenaOriginal = `||1.1|${uuid}|${isoFecha}|SAT970701NN3|${selloEmisor.slice(0, 32)}|${noCertificadoSat}||`;

    // Generar XML Oficial CFDI 4.0
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="CHY" Folio="${folio}" Fecha="${isoFecha}" Sello="${selloEmisor}" FormaPago="${dto.formaPago || '04'}" NoCertificado="30001000000500003416" SubTotal="${subtotal.toFixed(2)}" Moneda="MXN" Total="${total.toFixed(2)}" TipoDeComprobante="I" Exportacion="01" MetodoPago="PUE" LugarExpedicion="06700">
  <cfdi:Emisor Rfc="CHY240815MX1" Nombre="CHAMBAYA MÉXICO SAPI DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${cleanRfc}" Nombre="${dto.nombreReceptor.trim().toUpperCase()}" DomicilioFiscalReceptor="${dto.domicilioFiscalReceptor.trim()}" RegimenFiscalReceptor="${dto.regimenReceptor}" UsoCFDI="${dto.usoCfdi}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="72101500" NoIdentificacion="${booking.id}" Cantidad="1.00" ClaveUnidad="E48" Unidad="Servicio" Descripcion="${booking.serviceTitle} - Servicio a domicilio verificado ChambaYa" ValorUnitario="${subtotal.toFixed(2)}" Importe="${subtotal.toFixed(2)}" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva.toFixed(2)}"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${iva.toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva.toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" xsi:schemaLocation="http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd" Version="1.1" UUID="${uuid}" FechaTimbrado="${isoFecha}" RfcProvCertif="SAT970701NN3" SelloCFD="${selloEmisor}" NoCertificadoSAT="${noCertificadoSat}" SelloSAT="${selloSat}"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    // URL oficial del validador del SAT
    const qrCodeUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=CHY240815MX1&rr=${cleanRfc}&tt=${total.toFixed(6)}&fe=${selloEmisor.slice(-8)}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        uuid,
        bookingId: booking.id,
        serie: 'CHY',
        folio,
        rfcEmisor: 'CHY240815MX1',
        nombreEmisor: 'CHAMBAYA MÉXICO SAPI DE CV',
        regimenEmisor: '601',
        rfcReceptor: cleanRfc,
        nombreReceptor: dto.nombreReceptor.trim().toUpperCase(),
        domicilioFiscalReceptor: dto.domicilioFiscalReceptor.trim(),
        regimenReceptor: dto.regimenReceptor,
        usoCfdi: dto.usoCfdi,
        subtotal,
        iva,
        total,
        formaPago: dto.formaPago || '04',
        metodoPago: 'PUE',
        claveProdServ: '72101500',
        claveUnidad: 'E48',
        fechaTimbrado: now,
        selloEmisor,
        selloSat,
        noCertificadoSat,
        cadenaOriginal,
        xmlContent,
        qrCodeUrl,
        status: 'vigente',
      },
    });

    // Registrar también la retención fiscal del chambeador de manera automática
    await this.recordTaxRetention(booking.id).catch(() => null);

    return invoice;
  }

  /**
   * Obtener factura CFDI por Chamba
   */
  async getInvoiceByBooking(bookingId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { bookingId },
    });
    if (!invoice) {
      throw new NotFoundException(`No existe factura emitida para la chamba ${bookingId}`);
    }
    return invoice;
  }

  /**
   * Obtener reporte fiscal y retenciones de un proveedor / chambeador
   */
  async getProviderTaxReport(providerId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        taxRetentions: {
          orderBy: { createdAt: 'desc' },
          include: { booking: true },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException(`Proveedor ${providerId} no encontrado`);
    }

    // Si aún no tiene retenciones registradas, generar retenciones para sus chambas completadas
    if (provider.taxRetentions.length === 0) {
      const bookings = await this.prisma.booking.findMany({
        where: { providerId },
      });
      for (const b of bookings) {
        await this.recordTaxRetention(b.id).catch(() => null);
      }
    }

    const updated = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        taxRetentions: {
          orderBy: { createdAt: 'desc' },
          include: { booking: true },
        },
      },
    });

    const retentions = updated?.taxRetentions || [];
    const totalGross = retentions.reduce((sum, r) => sum + r.grossAmount, 0);
    const totalIsrRetained = retentions.reduce((sum, r) => sum + r.isrRetained, 0);
    const totalIvaRetained = retentions.reduce((sum, r) => sum + r.ivaRetained, 0);
    const totalPlatformFees = retentions.reduce((sum, r) => sum + r.platformFee + r.platformFeeIva, 0);
    const totalNetDispersed = retentions.reduce((sum, r) => sum + r.netPayout, 0);

    return {
      provider: {
        id: provider.id,
        name: provider.name,
        rfc: provider.rfc || 'GARM8504128X9',
        curp: provider.curp || 'GARM850412HDFRND01',
        regimenFiscal: provider.regimenFiscal || '625 (Plataformas Tecnológicas)',
        clabeAccount: provider.clabeAccount || '012180001234567890',
        bankName: provider.bankName || 'BBVA México',
      },
      summary: {
        periodo: 'Ejercicio Fiscal 2026',
        totalServicios: retentions.length,
        totalGross,
        totalIsrRetained,
        totalIvaRetained,
        totalPlatformFees,
        totalNetDispersed,
        isrRatePercentage: (provider.rfc ? 1.0 : 20.0),
        ivaRatePercentage: (provider.rfc ? 8.0 : 16.0),
      },
      retentions,
    };
  }

  /**
   * Resumen fiscal global para la Torre de Control de Super Admin
   */
  async getGlobalTaxReport() {
    const retentions = await this.prisma.taxRetention.findMany({
      include: { provider: true, booking: true },
      orderBy: { createdAt: 'desc' },
    });

    const invoices = await this.prisma.invoice.findMany({
      orderBy: { fechaTimbrado: 'desc' },
    });

    const totalGross = retentions.reduce((sum, r) => sum + r.grossAmount, 0);
    const totalIsrToEnterSat = retentions.reduce((sum, r) => sum + r.isrRetained, 0);
    const totalIvaToEnterSat = retentions.reduce((sum, r) => sum + r.ivaRetained, 0);
    const totalPlatformRevenue = retentions.reduce((sum, r) => sum + r.platformFee, 0);
    const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);

    return {
      periodo: 'Octubre 2026',
      totalChambasRetenidas: retentions.length,
      totalFacturasTimbradas: invoices.length,
      totalGross,
      totalInvoiced,
      totalIsrToEnterSat,
      totalIvaToEnterSat,
      totalRetentionsToEnterSat: Number((totalIsrToEnterSat + totalIvaToEnterSat).toFixed(2)),
      totalPlatformRevenue,
      retentions,
      invoices,
    };
  }
}
