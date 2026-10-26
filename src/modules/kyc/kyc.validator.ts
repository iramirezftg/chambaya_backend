/**
 * Algoritmos y Reglas Oficiales de Validación de Identidad Mexicana
 * RENAPO (CURP), SAT (RFC) e INE / Biometría
 */

export interface CurpDecoded {
  valid: boolean;
  curp: string;
  birthDate?: string;
  gender?: 'Hombre' | 'Mujer';
  stateOfBirth?: string;
  stateCode?: string;
  error?: string;
}

export interface RfcDecoded {
  valid: boolean;
  rfc: string;
  type: 'PERSONA_FISICA' | 'PERSONA_MORAL';
  birthDate?: string;
  error?: string;
}

const RENAPO_STATES: Record<string, string> = {
  AS: 'Aguascalientes',
  BC: 'Baja California',
  BS: 'Baja California Sur',
  CC: 'Campeche',
  CL: 'Coahuila',
  CM: 'Colima',
  CS: 'Chiapas',
  CH: 'Chihuahua',
  DF: 'Ciudad de México',
  DG: 'Durango',
  GT: 'Guanajuato',
  GR: 'Guerrero',
  HG: 'Hidalgo',
  JC: 'Jalisco',
  MC: 'Estado de México',
  MN: 'Michoacán',
  MS: 'Morelos',
  NT: 'Nayarit',
  NL: 'Nuevo León',
  OC: 'Oaxaca',
  PL: 'Puebla',
  QT: 'Querétaro',
  QR: 'Quintana Roo',
  SP: 'San Luis Potosí',
  SL: 'Sinaloa',
  SR: 'Sonora',
  TC: 'Tabasco',
  TS: 'Tamaulipas',
  TL: 'Tlaxcala',
  VZ: 'Veracruz',
  YN: 'Yucatán',
  ZS: 'Zacatecas',
  NE: 'Nacido en el Extranjero',
};

export class MexicanIdentityValidator {
  /**
   * Validación Oficial de CURP con Desglose RENAPO
   */
  static validateCurp(curpInput: string): CurpDecoded {
    if (!curpInput) {
      return { valid: false, curp: '', error: 'CURP requerida' };
    }

    const curp = curpInput.trim().toUpperCase();
    const regex = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;

    if (!regex.test(curp)) {
      return {
        valid: false,
        curp,
        error: 'Formato de CURP inválido (debe tener 18 caracteres alfanuméricos oficiales)',
      };
    }

    // Extraer fecha: YYMMDD
    const yy = curp.substring(4, 6);
    const mm = curp.substring(6, 8);
    const dd = curp.substring(8, 10);
    // Siglo: si la posición 16 es letra, nació a partir del año 2000
    const isCentury21 = isNaN(Number(curp.charAt(16)));
    const fullYear = (isCentury21 ? '20' : '19') + yy;
    const birthDate = `${dd}/${mm}/${fullYear}`;

    // Género
    const genderLetter = curp.charAt(10);
    const gender = genderLetter === 'H' ? 'Hombre' : 'Mujer';

    // Entidad Federativa
    const stateCode = curp.substring(11, 13);
    const stateOfBirth = RENAPO_STATES[stateCode] || 'Entidad no catalogada';

    // Dígito verificador oficial
    const chars = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      const pos = chars.indexOf(curp.charAt(i));
      if (pos === -1) return { valid: false, curp, error: 'Carácter inválido en CURP' };
      sum += pos * (18 - i);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const expectedDigit = Number(curp.charAt(17));

    if (checkDigit !== expectedDigit) {
      return {
        valid: false,
        curp,
        error: `Dígito verificador RENAPO incorrecto (calculado: ${checkDigit}, recibido: ${expectedDigit})`,
      };
    }

    return {
      valid: true,
      curp,
      birthDate,
      gender,
      stateCode,
      stateOfBirth,
    };
  }

  /**
   * Validación Oficial de RFC Persona Física (SAT)
   */
  static validateRfc(rfcInput: string): RfcDecoded {
    if (!rfcInput) {
      return { valid: false, rfc: '', type: 'PERSONA_FISICA', error: 'RFC requerido' };
    }

    const rfc = rfcInput.trim().toUpperCase();
    const regexFisica = /^[A-Z&Ñ]{4}\d{6}[A-Z0-9]{3}$/;

    if (!regexFisica.test(rfc)) {
      return {
        valid: false,
        rfc,
        type: 'PERSONA_FISICA',
        error: 'El RFC debe contener 13 caracteres con homoclave del SAT (4 letras, 6 números, 3 alfanuméricos)',
      };
    }

    const yy = rfc.substring(4, 6);
    const mm = rfc.substring(6, 8);
    const dd = rfc.substring(8, 10);
    const birthDate = `${dd}/${mm}/19${yy}`;

    return {
      valid: true,
      rfc,
      type: 'PERSONA_FISICA',
      birthDate,
    };
  }

  /**
   * Simulación Inteligente de OCR para Credencial para Votar INE / IFE
   */
  static simulateIneOcr(nameHint?: string) {
    const randomCic = Math.floor(100000000 + Math.random() * 900000000).toString();
    const randomOcr = `IDMEX${Math.floor(1000000000 + Math.random() * 9000000000)}<<`;
    const randomClaveElector = `${(nameHint || 'MENDOZA').slice(0, 4).toUpperCase()}85041209H500`;

    return {
      success: true,
      documentType: 'INE_MODELO_G_H',
      claveElector: randomClaveElector,
      cic: randomCic,
      ocrNumber: randomOcr,
      vigencia: '2024-2034 (VIGENTE PARA VOTAR Y TRÁMITES)',
      emisionYear: 2024,
      seccionElectoral: '3492',
      entidad: 'CIUDAD DE MÉXICO (09)',
      confidence: 0.985,
    };
  }

  /**
   * Simulación de Biometría Facial y Prueba de Vida (Liveness Detection)
   */
  static simulateBiometricFaceMatch() {
    // Genera un porcentaje de coincidencia entre 96.5% y 99.4%
    const score = Number((96.0 + Math.random() * 3.5).toFixed(2));
    const passed = score >= 90.0;

    return {
      passed,
      faceMatchScore: score,
      livenessDetection: {
        antiSpoofingPassed: true,
        blinkDetected: true,
        headPoseValid: true,
        qualityScore: 0.97,
      },
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Cálculo de Nivel de Confianza (Trust Score 0-100)
   */
  static calculateTrustScore(data: {
    curpValidated?: boolean;
    rfcValidated?: boolean;
    ineValidated?: boolean;
    faceMatchPassed?: boolean;
    antecedentesPassed?: boolean;
    domicilioPassed?: boolean;
  }): number {
    let score = 0;
    if (data.ineValidated) score += 25; // 25 pts INE
    if (data.curpValidated && data.rfcValidated) score += 25; // 25 pts Identidad Fiscal
    if (data.faceMatchPassed) score += 25; // 25 pts Biometría Facial
    if (data.antecedentesPassed) score += 25; // 25 pts Carta No Antecedentes
    return Math.min(100, score);
  }
}
