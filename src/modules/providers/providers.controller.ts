import { Controller, Get, Post, Patch, Delete, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('Multi-Vendor Providers')
@Controller('providers')
export class ProvidersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all multi-vendor providers' })
  async getProviders() {
    return this.prisma.provider.findMany({
      include: {
        services: true,
        servicemen: true
      },
      orderBy: {
        id: 'asc'
      }
    });
  }

  @Get('admin/payouts')
  @ApiOperation({ summary: 'Super Admin: List all provider payout withdrawal requests' })
  async getAdminPayouts() {
    return this.prisma.payoutRequest.findMany({
      include: {
        provider: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  @Patch('admin/payouts/:payoutId/approve')
  @ApiOperation({ summary: 'Super Admin: Approve and execute SPEI STP bank transfer' })
  async approvePayout(@Param('payoutId') payoutId: string) {
    const req = await this.prisma.payoutRequest.findUnique({ where: { id: payoutId } });
    if (!req) throw new NotFoundException(`Solicitud de retiro ${payoutId} no encontrada.`);

    return this.prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: 'transferred'
      }
    });
  }

  @Post()
  @ApiOperation({ summary: 'Super Admin: Onboard/Register a new provider business' })
  async createProvider(@Body() body: any) {
    const id = body.id || `prov-${Date.now().toString().slice(-4)}`;
    const plan = body.subscriptionPlan || 'BASIC';
    const badge = plan === 'PRO' ? 'DIAMOND' : plan === 'ENTERPRISE' ? 'ENTERPRISE' : 'STANDARD';
    const commission = body.commissionRate !== undefined 
      ? Number(body.commissionRate) 
      : (plan === 'PRO' ? 8.0 : plan === 'ENTERPRISE' ? 5.0 : 15.0);

    return this.prisma.provider.create({
      data: {
        id,
        name: body.name || 'Nuevo Taller de Oficios',
        owner: body.owner || 'Representante Legal',
        email: body.email || `contacto@${id}.mx`,
        phone: body.phone || '+52 55 0000 0000',
        zone: body.zone || 'Ciudad de México (CDMX)',
        avatar: body.avatar || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=160&auto=format&fit=crop&q=80',
        status: body.status || 'active',
        commissionRate: commission,
        clabeAccount: body.clabeAccount || '012180001234567890',
        bankName: body.bankName || 'BBVA México',
        rfc: body.rfc || 'PRO8501019A1',
        curp: body.curp || 'PROP850101HDFRND01',
        regimenFiscal: body.regimenFiscal || '625',
        isVerified: body.isVerified !== undefined ? body.isVerified : true,
        subscriptionPlan: plan,
        subscriptionStatus: 'ACTIVE',
        subscriptionBadge: badge
      }
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single provider details by ID' })
  @ApiParam({ name: 'id', example: 'prov-1' })
  async getProviderById(@Param('id') id: string) {
    const prov = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        services: true,
        servicemen: true
      }
    });
    if (!prov) throw new NotFoundException(`Provider ${id} not found`);
    return prov;
  }

  @Post(':id/kyc-approve')
  @ApiOperation({ summary: 'Super Admin: Approve pending provider KYC' })
  @ApiParam({ name: 'id', example: 'prov-4' })
  async approveKyc(@Param('id') id: string) {
    const exists = await this.prisma.provider.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException(`Provider ${id} not found`);

    return this.prisma.provider.update({
      where: { id },
      data: { status: 'active', isVerified: true }
    });
  }

  @Patch(':id/commission')
  @ApiOperation({ summary: 'Super Admin: Update provider commission tier percentage' })
  @ApiParam({ name: 'id', example: 'prov-1' })
  @ApiBody({ schema: { type: 'object', properties: { commissionRate: { type: 'number', example: 18 } } } })
  async updateCommission(
    @Param('id') id: string,
    @Body('commissionRate') commissionRate: number
  ) {
    const exists = await this.prisma.provider.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException(`Provider ${id} not found`);

    return this.prisma.provider.update({
      where: { id },
      data: { commissionRate: Number(commissionRate) }
    });
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Super Admin: Suspend or activate a provider' })
  @ApiParam({ name: 'id', example: 'prov-1' })
  async toggleStatus(@Param('id') id: string) {
    const prov = await this.prisma.provider.findUnique({ where: { id } });
    if (!prov) throw new NotFoundException(`Provider ${id} not found`);

    const newStatus = prov.status === 'active' ? 'suspended' : 'active';
    return this.prisma.provider.update({
      where: { id },
      data: { status: newStatus }
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Super Admin: Set specific provider status (active, suspended, pending)' })
  @ApiParam({ name: 'id', example: 'prov-1' })
  async setStatus(
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    const prov = await this.prisma.provider.findUnique({ where: { id } });
    if (!prov) throw new NotFoundException(`Provider ${id} not found`);

    return this.prisma.provider.update({
      where: { id },
      data: { status }
    });
  }

  @Patch(':id/plan')
  @ApiOperation({ summary: 'Super Admin: Assign/change subscription plan for a provider' })
  async updatePlan(
    @Param('id') id: string,
    @Body('plan') plan: 'BASIC' | 'PRO' | 'ENTERPRISE'
  ) {
    const prov = await this.prisma.provider.findUnique({ where: { id } });
    if (!prov) throw new NotFoundException(`Provider ${id} not found`);

    const badge = plan === 'PRO' ? 'DIAMOND' : plan === 'ENTERPRISE' ? 'ENTERPRISE' : 'STANDARD';
    const newCommission = plan === 'PRO' ? 8.0 : plan === 'ENTERPRISE' ? 5.0 : 15.0;

    return this.prisma.provider.update({
      where: { id },
      data: {
        subscriptionPlan: plan,
        subscriptionBadge: badge,
        commissionRate: newCommission,
        subscriptionStatus: 'ACTIVE'
      }
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Super Admin: Delete provider' })
  async deleteProvider(@Param('id') id: string) {
    const prov = await this.prisma.provider.findUnique({ where: { id } });
    if (!prov) throw new NotFoundException(`Provider ${id} not found`);

    return this.prisma.provider.delete({ where: { id } });
  }

  @Post(':id/payout')
  @ApiOperation({ summary: 'Provider: Request bank withdrawal of wallet balance' })
  @ApiParam({ name: 'id', example: 'prov-1' })
  @ApiBody({ schema: { type: 'object', properties: { amount: { type: 'number', example: 500 } } } })
  async requestPayout(
    @Param('id') id: string,
    @Body('amount') amount: number
  ) {
    const prov = await this.prisma.provider.findUnique({ where: { id } });
    if (!prov) throw new NotFoundException(`Provider ${id} not found`);

    const payoutNum = Number(amount);
    if (isNaN(payoutNum) || payoutNum <= 0) {
      throw new BadRequestException('Monto de retiro inválido.');
    }
    if (prov.walletBalance < payoutNum) {
      throw new BadRequestException(`Saldo insuficiente ($${prov.walletBalance} MXN disponible).`);
    }

    // Deduct wallet and register payout request
    const updatedProv = await this.prisma.provider.update({
      where: { id },
      data: {
        walletBalance: prov.walletBalance - payoutNum
      }
    });

    const payoutRecord = await this.prisma.payoutRequest.create({
      data: {
        providerId: id,
        amount: payoutNum,
        clabe: prov.clabeAccount || '012180001234567890',
        bank: prov.bankName || 'BBVA México',
        status: 'pending'
      }
    });

    return {
      success: true,
      message: `Retiro SPEI por $${payoutNum.toFixed(2)} MXN solicitado hacia cuenta CLABE ${payoutRecord.clabe}`,
      provider: updatedProv,
      payout: payoutRecord
    };
  }
}

