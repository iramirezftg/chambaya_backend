import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PromotionsController],
  exports: [PromotionsService],
  providers: [PromotionsService]
})
export class PromotionsModule {}
