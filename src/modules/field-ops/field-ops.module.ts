import { Module } from '@nestjs/common';
import { FieldOpsController } from './field-ops.controller.js';
import { FieldOpsService } from './field-ops.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [FieldOpsController],
  providers: [FieldOpsService],
  exports: [FieldOpsService],
})
export class FieldOpsModule {}
