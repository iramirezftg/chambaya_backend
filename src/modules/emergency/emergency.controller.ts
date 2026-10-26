import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { EmergencyService } from './emergency.service.js';
import { EmergencyQuoteDto, CreateEmergencyDto } from './dto/emergency.dto.js';

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post('quote')
  quoteSurcharge(@Body() dto: EmergencyQuoteDto) {
    return this.emergencyService.quoteEmergencyFee(dto);
  }

  @Post('request')
  createEmergency(@Body() dto: CreateEmergencyDto) {
    return this.emergencyService.createEmergency(dto);
  }

  @Get('active')
  getActiveEmergencies() {
    return this.emergencyService.getActiveEmergencies();
  }

  @Get(':bookingId')
  getEmergency(@Param('bookingId') bookingId: string) {
    return this.emergencyService.getEmergency(bookingId);
  }

  @Post(':bookingId/accept')
  acceptEmergency(
    @Param('bookingId') bookingId: string,
    @Body('servicemanId') servicemanId: string,
  ) {
    return this.emergencyService.acceptEmergencyDispatch(bookingId, servicemanId || 'sm-1');
  }
}
