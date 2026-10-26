import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AiDiagnosticService } from './ai-diagnostic.service.js';
import { AnalyzeRequestDto, ConvertToBookingDto } from './dto/ai-diagnostic.dto.js';

@Controller('ai-diagnostic')
export class AiDiagnosticController {
  constructor(private readonly aiDiagnosticService: AiDiagnosticService) {}

  @Get('presets')
  getPresets() {
    return this.aiDiagnosticService.getPresets();
  }

  @Post('analyze')
  analyzeProblem(@Body() dto: AnalyzeRequestDto) {
    return this.aiDiagnosticService.analyzeProblem(dto);
  }

  @Get(':diagnosticId')
  getDiagnostic(@Param('diagnosticId') diagnosticId: string) {
    return this.aiDiagnosticService.getDiagnostic(diagnosticId);
  }

  @Post('convert-to-booking')
  convertToBooking(@Body() dto: ConvertToBookingDto) {
    return this.aiDiagnosticService.convertToBooking(dto);
  }
}
