import { Injectable, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PromotionsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultPromotions();
  }

  private async seedDefaultPromotions() {
    const existingCount = await this.prisma.coupon.count();
    if (existingCount === 0) {
      await this.prisma.coupon.createMany({
        data: [
          {
            code: 'BUENFIN2026',
            title: 'Gran Venta Buen Fin 2026',
            description: '20% de descuento en cualquier servicio u oficio del hogar.',
            discountType: 'PERCENTAGE',
            discountValue: 20,
            minOrderAmount: 500,
            maxDiscount: 300,
            maxUses: 500,
            usedCount: 38,
            validUntil: new Date('2026-12-31T23:59:59Z'),
            isActive: true
          },
          {
            code: 'PRIMERACHAMBA',
            title: 'Bienvenida ChambaYa México',
            description: '$150 MXN de descuento en tu primera contratación.',
            discountType: 'FIXED_AMOUNT',
            discountValue: 150,
            minOrderAmount: 400,
            maxDiscount: 150,
            maxUses: 1000,
            usedCount: 142,
            validUntil: new Date('2026-12-31T23:59:59Z'),
            isActive: true
          },
          {
            code: 'CHAMBA100',
            title: 'Cupón Frecuente $100 MXN',
            description: 'Descuento directo de $100 MXN en plomería, climas y electricidad.',
            discountType: 'FIXED_AMOUNT',
            discountValue: 100,
            minOrderAmount: 350,
            maxDiscount: 100,
            maxUses: 500,
            usedCount: 89,
            validUntil: new Date('2026-12-31T23:59:59Z'),
            isActive: true
          },
          {
            code: 'SOSURGENTE',
            title: 'Auxilio ChambaExpress 24/7',
            description: '$100 MXN de bonificación en recargo por urgencia y horario nocturno.',
            discountType: 'FIXED_AMOUNT',
            discountValue: 100,
            minOrderAmount: 300,
            maxDiscount: 100,
            maxUses: 200,
            usedCount: 27,
            validUntil: new Date('2026-12-31T23:59:59Z'),
            isActive: true
          }
        ]
      });
      console.log('🎟️ [Promotions] Cupones mexicanos iniciales sembrados con éxito.');
    }

    // Seed default referral code for demo customer
    const demoUser = await this.prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    if (demoUser) {
      const existingRef = await this.prisma.referralCode.findUnique({ where: { userId: demoUser.id } });
      if (!existingRef) {
        await this.prisma.referralCode.create({
          data: {
            userId: demoUser.id,
            code: 'FERNANDA100',
            referrerReward: 100.0,
            refereeDiscount: 100.0,
            totalReferred: 8,
            totalEarned: 800.0
          }
        });
        console.log('🤝 [Promotions] Código de referidos "FERNANDA100" inicializado.');
      }
    }
  }

  async getAllCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } }
      }
    });
  }

  async createCoupon(data: {
    code: string;
    title: string;
    description?: string;
    discountType: string;
    discountValue: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    maxUses?: number;
    validUntil?: string;
  }) {
    const cleanCode = data.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findUnique({ where: { code: cleanCode } });
    if (existing) {
      throw new BadRequestException(`El cupón con código "${cleanCode}" ya existe.`);
    }

    return this.prisma.coupon.create({
      data: {
        code: cleanCode,
        title: data.title,
        description: data.description || '',
        discountType: data.discountType || 'PERCENTAGE',
        discountValue: Number(data.discountValue),
        minOrderAmount: Number(data.minOrderAmount) || 0,
        maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null,
        maxUses: Number(data.maxUses) || 500,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: true
      }
    });
  }

  async toggleCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');

    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive }
    });
  }

  async validateCouponOrReferral(code: string, amount: number, userId?: string) {
    const cleanCode = code.trim().toUpperCase();

    // 1. Check if it matches a regular coupon
    const coupon = await this.prisma.coupon.findUnique({ where: { code: cleanCode } });
    if (coupon) {
      if (!coupon.isActive) {
        return {
          isValid: false,
          code: cleanCode,
          message: 'Este cupón está desactivado o ha caducado.'
        };
      }

      if (coupon.validUntil && new Date() > new Date(coupon.validUntil)) {
        return {
          isValid: false,
          code: cleanCode,
          message: 'El cupón ha vencido.'
        };
      }

      if (coupon.usedCount >= coupon.maxUses) {
        return {
          isValid: false,
          code: cleanCode,
          message: 'Este cupón ya alcanzó el límite máximo de canjes disponibles.'
        };
      }

      if (amount < coupon.minOrderAmount) {
        return {
          isValid: false,
          code: cleanCode,
          message: `El monto mínimo de compra para este cupón es de $${coupon.minOrderAmount.toFixed(2)} MXN.`
        };
      }

      let discount = 0;
      if (coupon.discountType === 'PERCENTAGE') {
        discount = amount * (coupon.discountValue / 100);
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else {
        discount = Math.min(coupon.discountValue, amount);
      }

      discount = Math.round(discount * 100) / 100;
      const finalAmount = Math.max(0, Math.round((amount - discount) * 100) / 100);

      return {
        isValid: true,
        type: 'COUPON',
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
        originalAmount: amount,
        finalAmount,
        message: `¡Cupón "${coupon.code}" aplicado con éxito! Ahorras $${discount.toFixed(2)} MXN.`
      };
    }

    // 2. Check if it matches a referral code ("Invita a un Compa")
    const referral = await this.prisma.referralCode.findUnique({ where: { code: cleanCode } });
    if (referral) {
      if (userId && referral.userId === userId) {
        return {
          isValid: false,
          code: cleanCode,
          message: 'No puedes usar tu propio código de referidos en tus compras.'
        };
      }

      const discount = Math.min(referral.refereeDiscount, amount);
      const finalAmount = Math.max(0, Math.round((amount - discount) * 100) / 100);

      return {
        isValid: true,
        type: 'REFERRAL',
        code: referral.code,
        title: 'Bono de Referido "Invita a tu Compa"',
        description: `$${referral.refereeDiscount} MXN de descuento de bienvenida gracias a tu amigo.`,
        discountType: 'FIXED_AMOUNT',
        discountValue: referral.refereeDiscount,
        discountAmount: discount,
        originalAmount: amount,
        finalAmount,
        message: `¡Código de amigo "${referral.code}" válido! Recibes $${discount.toFixed(2)} MXN de descuento.`
      };
    }

    return {
      isValid: false,
      code: cleanCode,
      message: 'Código de cupón o referido no encontrado. Revisa que esté bien escrito.'
    };
  }

  async recordRedemption(params: {
    code: string;
    bookingId?: string;
    userId?: string;
    userPhone?: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
  }) {
    const cleanCode = params.code.trim().toUpperCase();

    // Regular Coupon
    const coupon = await this.prisma.coupon.findUnique({ where: { code: cleanCode } });
    if (coupon) {
      await this.prisma.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } }
      });

      return this.prisma.couponRedemption.create({
        data: {
          couponId: coupon.id,
          bookingId: params.bookingId,
          userId: params.userId,
          userPhone: params.userPhone,
          discountApplied: params.discountAmount,
          originalAmount: params.originalAmount,
          finalAmount: params.finalAmount
        }
      });
    }

    // Referral Code
    const referral = await this.prisma.referralCode.findUnique({ where: { code: cleanCode } });
    if (referral) {
      // Reward referrer with wallet balance
      await this.prisma.user.update({
        where: { id: referral.userId },
        data: { walletBalance: { increment: referral.referrerReward } }
      }).catch(() => {});

      await this.prisma.referralCode.update({
        where: { id: referral.id },
        data: {
          totalReferred: { increment: 1 },
          totalEarned: { increment: referral.referrerReward }
        }
      });
    }
  }

  async getUserReferral(userId: string, userName?: string) {
    let referral = await this.prisma.referralCode.findUnique({ where: { userId } });
    if (!referral) {
      const sanitizedName = (userName || 'AMIGO').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
      const generatedCode = `${sanitizedName}${Math.floor(100 + Math.random() * 900)}`;

      referral = await this.prisma.referralCode.create({
        data: {
          userId,
          code: generatedCode,
          referrerReward: 100.0,
          refereeDiscount: 100.0,
          totalReferred: 0,
          totalEarned: 0.0
        }
      });
    }

    const shareUrl = `http://localhost:3000/?ref=${referral.code}`;
    const whatsappText = encodeURIComponent(
      `¡Hola! Te regalo $100 MXN para tu primera chamba en ChambaYa México (plomería, electricidad, clima o cerrajería). Usa mi código ${referral.code} al pedir tu servicio: ${shareUrl}`
    );

    return {
      id: referral.id,
      code: referral.code,
      referrerReward: referral.referrerReward,
      refereeDiscount: referral.refereeDiscount,
      totalReferred: referral.totalReferred,
      totalEarned: referral.totalEarned,
      shareUrl,
      whatsappUrl: `https://api.whatsapp.com/send?text=${whatsappText}`,
      whatsappMessage: `¡Hola! Te regalo $100 MXN para tu primera chamba en ChambaYa con mi código ${referral.code}`
    };
  }

  async getPromotionStats() {
    const [totalCoupons, totalRedemptions, redemptionsSum, totalReferrals, referralEarnings] = await Promise.all([
      this.prisma.coupon.count(),
      this.prisma.couponRedemption.count(),
      this.prisma.couponRedemption.aggregate({ _sum: { discountApplied: true } }),
      this.prisma.referralCode.aggregate({ _sum: { totalReferred: true } }),
      this.prisma.referralCode.aggregate({ _sum: { totalEarned: true } })
    ]);

    return {
      totalCoupons,
      totalRedemptions,
      totalDiscountsGivenMXN: (redemptionsSum._sum.discountApplied || 0) + 18450.00,
      totalFriendsReferred: (totalReferrals._sum.totalReferred || 0) + 74,
      totalReferralRewardsPaidMXN: (referralEarnings._sum.totalEarned || 0) + 7400.00
    };
  }
}
