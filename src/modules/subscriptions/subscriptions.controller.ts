import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('stats')
  getStats() {
    return this.subscriptionsService.getSubscriptionStats();
  }

  @Get('provider/:providerId')
  getProviderSubscription(@Param('providerId') providerId: string) {
    return this.subscriptionsService.getProviderSubscription(providerId);
  }

  @Post('subscribe')
  subscribe(@Body() dto: {
    providerId: string;
    plan: 'PRO' | 'ENTERPRISE';
    paymentMethod?: string;
    cardLast4?: string;
    cardBrand?: string;
  }) {
    return this.subscriptionsService.subscribe(dto.providerId, dto);
  }

  @Post('cancel')
  cancel(@Body() dto: { providerId: string }) {
    return this.subscriptionsService.cancelSubscription(dto.providerId);
  }

  @Post('simulate-renewal')
  simulateRenewal(@Body() dto: { providerId: string }) {
    return this.subscriptionsService.simulateRenewal(dto.providerId);
  }

  @Post('admin/assign-plan')
  adminAssignPlan(@Body() dto: { providerId: string; plan: 'BASIC' | 'PRO' | 'ENTERPRISE' }) {
    if (dto.plan === 'BASIC') {
      return this.subscriptionsService.cancelSubscription(dto.providerId);
    } else {
      return this.subscriptionsService.subscribe(dto.providerId, {
        plan: dto.plan,
        paymentMethod: 'ADMIN_OVERRIDE',
        cardLast4: '0000',
        cardBrand: 'Admin Manual'
      });
    }
  }
}
