export class EmergencyQuoteDto {
  emergencyType: 'FUGA_AGUA' | 'CORTO_CIRCUITO' | 'CERRADURA' | 'GAS_LP' | 'OTRO';
  severity?: 'CRITICA' | 'ALTA' | 'MEDIA';
  address: string;
}

export class CreateEmergencyDto {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  emergencyType: 'FUGA_AGUA' | 'CORTO_CIRCUITO' | 'CERRADURA' | 'GAS_LP' | 'OTRO';
  severity?: 'CRITICA' | 'ALTA' | 'MEDIA';
  incidentDescription: string;
  paymentMethod?: string;
}
