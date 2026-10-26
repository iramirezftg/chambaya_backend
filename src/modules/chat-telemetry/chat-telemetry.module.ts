import { Module } from '@nestjs/common';
import { ChatTelemetryGateway } from './chat-telemetry.gateway.js';
import { ChatTelemetryService } from './chat-telemetry.service.js';
import { ChatTelemetryController } from './chat-telemetry.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [ChatTelemetryController],
  providers: [ChatTelemetryGateway, ChatTelemetryService],
  exports: [ChatTelemetryGateway, ChatTelemetryService],
})
export class ChatTelemetryModule {}
