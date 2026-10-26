import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChatTelemetryModule } from './modules/chat-telemetry/chat-telemetry.module.js';
import { FiscalModule } from './modules/fiscal/fiscal.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { KycModule } from './modules/kyc/kyc.module.js';
import { EscrowModule } from './modules/escrow/escrow.module.js';
import { FieldOpsModule } from './modules/field-ops/field-ops.module.js';
import { EmergencyModule } from './modules/emergency/emergency.module.js';
import { AiDiagnosticModule } from './modules/ai-diagnostic/ai-diagnostic.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { UploadModule } from './modules/upload/upload.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CategoriesController } from './modules/categories/categories.controller.js';
import { ServicesController } from './modules/services/services.controller.js';
import { ProvidersController } from './modules/providers/providers.controller.js';
import { ServicemenController } from './modules/servicemen/servicemen.controller.js';
import { BookingsController } from './modules/bookings/bookings.controller.js';
import { PaymentsController } from './modules/payments/payments.controller.js';
import { PaymentsService } from './modules/payments/payments.service.js';
import { SmsController } from './modules/sms/sms.controller.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ChatTelemetryModule,
    FiscalModule,
    NotificationsModule,
    KycModule,
    EscrowModule,
    FieldOpsModule,
    EmergencyModule,
    AiDiagnosticModule,
    PromotionsModule,
    SubscriptionsModule,
    UploadModule,
  ],

  controllers: [
    AppController,
    CategoriesController,
    ServicesController,
    ProvidersController,
    ServicemenController,
    BookingsController,
    PaymentsController,
    SmsController
  ],
  providers: [AppService, PaymentsService],
})
export class AppModule {}
