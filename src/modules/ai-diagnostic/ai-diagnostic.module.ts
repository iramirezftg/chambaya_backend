import { Module } from '@nestjs/common';
import { AiDiagnosticController } from './ai-diagnostic.controller.js';
import { AiDiagnosticService } from './ai-diagnostic.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AiDiagnosticController],
  providers: [AiDiagnosticService],
  exports: [AiDiagnosticService],
})
export class AiDiagnosticModule {}
