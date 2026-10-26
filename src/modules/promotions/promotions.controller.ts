import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service.js';

@ApiTags('Promotions & Referral Program')
@Controller('promotions')
export class PromotionsController {
  constructor(private promotionsService: PromotionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all promotional coupons' })
  async getCoupons() {
    return this.promotionsService.getAllCoupons();
  }

  @Post()
  @ApiOperation({ summary: 'Admin: Create a new promotional coupon' })
  async createCoupon(@Body() body: any) {
    return this.promotionsService.createCoupon(body);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Admin: Toggle coupon active/inactive status' })
  async toggleCoupon(@Param('id') id: string) {
    return this.promotionsService.toggleCoupon(id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon or referral code against an order amount' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'BUENFIN2026' },
        amount: { type: 'number', example: 850 },
        userId: { type: 'string', example: 'usr-123', nullable: true }
      },
      required: ['code', 'amount']
    }
  })
  async validateCode(@Body() body: { code: string; amount: number; userId?: string }) {
    return this.promotionsService.validateCouponOrReferral(body.code, body.amount, body.userId);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Record coupon redemption and reward referral' })
  async recordRedemption(@Body() body: {
    code: string;
    bookingId?: string;
    userId?: string;
    userPhone?: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
  }) {
    return this.promotionsService.recordRedemption(body);
  }

  @Get('referral/:userId')
  @ApiOperation({ summary: 'Get or generate user referral link and stats ("Invita a un Compa")' })
  async getReferral(
    @Param('userId') userId: string,
    @Query('userName') userName?: string
  ) {
    return this.promotionsService.getUserReferral(userId, userName);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Torre de Control: Get promotions & referral impact statistics' })
  async getStats() {
    return this.promotionsService.getPromotionStats();
  }
}
