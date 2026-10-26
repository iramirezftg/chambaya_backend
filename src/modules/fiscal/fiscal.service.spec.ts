import { describe, it, expect } from 'vitest';
import { FiscalService } from './fiscal.service.js';

describe('FiscalService - Retenciones SAT Plataformas Tecnológicas', () => {
  const fiscalService = new FiscalService({} as any);

  it('debe calcular retenciones reducidas del SAT para un proveedor CON RFC (1.0% ISR y 8.0% IVA)', () => {
    // Monto del servicio: $1,000 MXN con 15% de comisión
    const result = fiscalService.calculateRetentions(1000, true, 15);

    expect(result.grossAmount).toBe(1000);
    expect(result.platformFee).toBe(150); // 15%
    expect(result.platformFeeIva).toBe(24); // 16% de 150
    expect(result.totalPlatformFee).toBe(174);

    expect(result.isrRetentionRate).toBe(0.01); // 1%
    expect(result.isrRetained).toBe(10); // 1% de 1000

    expect(result.ivaRetentionRate).toBe(0.08); // 8% (50% del IVA causado)
    expect(result.ivaRetained).toBe(80); // 8% de 1000

    expect(result.totalRetentions).toBe(90); // 10 + 80
    // Dispersión neta en cuenta CLABE: 1000 - 174 - 90 = $736 MXN
    expect(result.netPayout).toBe(736);
  });

  it('debe calcular retenciones punitivas del SAT para un proveedor SIN RFC (20.0% ISR y 16.0% IVA)', () => {
    // Monto del servicio: $1,000 MXN sin RFC registrado
    const result = fiscalService.calculateRetentions(1000, false, 15);

    expect(result.hasRfc).toBe(false);
    expect(result.isrRetentionRate).toBe(0.20); // 20%
    expect(result.isrRetained).toBe(200);

    expect(result.ivaRetentionRate).toBe(0.16); // 16%
    expect(result.ivaRetained).toBe(160);

    expect(result.totalRetentions).toBe(360);
    // Dispersión neta: 1000 - 174 - 360 = $466 MXN
    expect(result.netPayout).toBe(466);
  });
});
