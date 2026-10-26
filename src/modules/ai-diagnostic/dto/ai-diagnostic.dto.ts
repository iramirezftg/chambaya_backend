export class AnalyzeRequestDto {
  photoUrl?: string;
  description?: string;
  categoryHint?: string;
  city?: string;
}

export class ConvertToBookingDto {
  diagnosticId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  isEmergency?: boolean;
}
