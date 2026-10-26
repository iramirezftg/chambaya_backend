import { describe, it, expect } from 'vitest';
import { MexicanIdentityValidator } from './kyc.validator.js';

describe('MexicanIdentityValidator - RENAPO y SAT', () => {
  it('debe validar un RFC de Persona Física correctamente', () => {
    const validRfc = 'GARM8504128X9';
    const result = MexicanIdentityValidator.validateRfc(validRfc);
    expect(result.valid).toBe(true);
    expect(result.rfc).toBe('GARM8504128X9');
    expect(result.type).toBe('PERSONA_FISICA');
    expect(result.birthDate).toBe('12/04/1985');
  });

  it('debe rechazar un RFC inválido', () => {
    const invalidRfc = 'RFC_INVALIDO_123';
    const result = MexicanIdentityValidator.validateRfc(invalidRfc);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('debe calcular el Trust Score ponderado al 100% cuando todos los documentos están presentes', () => {
    const score = MexicanIdentityValidator.calculateTrustScore({
      curpValidated: true,
      rfcValidated: true,
      ineValidated: true,
      faceMatchPassed: true,
      antecedentesPassed: true,
      domicilioPassed: true,
    });
    expect(score).toBe(100);
  });

  it('debe calcular un Trust Score parcial si faltan antecedentes y biometría', () => {
    const score = MexicanIdentityValidator.calculateTrustScore({
      curpValidated: true,
      rfcValidated: true,
      ineValidated: true,
      faceMatchPassed: false,
      antecedentesPassed: false,
      domicilioPassed: true,
    });
    expect(score).toBe(50);
  });
});
