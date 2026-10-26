import { Controller, Get, Post, Patch, Delete, Param, Body, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('Field Servicemen & Technicians')
@Controller('servicemen')
export class ServicemenController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List field servicemen with optional providerId filter' })
  @ApiQuery({ name: 'providerId', required: false })
  async getServicemen(@Query('providerId') providerId?: string) {
    const where: any = {};
    if (providerId) where.providerId = providerId;

    return this.prisma.serviceman.findMany({
      where,
      include: {
        provider: true
      },
      orderBy: {
        id: 'asc'
      }
    });
  }

  @Post()
  @ApiOperation({ summary: 'Provider / Admin: Onboard a new field serviceman' })
  async createServiceman(@Body() body: any) {
    const newId = body.id || `sm-${Date.now().toString().slice(-4)}`;
    let providerId = body.providerId || 'prov-1';
    const provExists = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provExists) {
      const firstProv = await this.prisma.provider.findFirst();
      providerId = firstProv ? firstProv.id : 'prov-1';
    }

    return this.prisma.serviceman.create({
      data: {
        id: newId,
        providerId,
        name: body.name || 'Nuevo Chambeador',
        title: body.title || 'Técnico Especialista Certificado',
        phone: body.phone || '+52 55 0000 0000',
        rating: body.rating ? Number(body.rating) : 5.0,
        completedJobs: body.completedJobs ? Number(body.completedJobs) : 0,
        avatar: body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80',
        status: body.status || 'available',
        currentLat: body.currentLat || 19.4194,
        currentLng: body.currentLng || -99.1634,
        currentAddress: body.currentAddress || 'CDMX',
        isVerified: body.isVerified !== undefined ? body.isVerified : true,
        verificationBadge: body.verificationBadge || 'Técnico Verificado KYC',
        trustScore: body.trustScore ? Number(body.trustScore) : 95
      }
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Serviceman / Admin: Set online / busy / offline / suspended status' })
  @ApiParam({ name: 'id', example: 'sm-1' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', example: 'available' } } } })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    const tech = await this.prisma.serviceman.findUnique({ where: { id } });
    if (!tech) throw new NotFoundException(`Serviceman ${id} not found`);

    return this.prisma.serviceman.update({
      where: { id },
      data: { status }
    });
  }

  @Patch(':id/toggle-block')
  @ApiOperation({ summary: 'Super Admin: Toggle block / suspend a technician' })
  @ApiParam({ name: 'id', example: 'sm-1' })
  async toggleBlock(@Param('id') id: string) {
    const tech = await this.prisma.serviceman.findUnique({ where: { id } });
    if (!tech) throw new NotFoundException(`Serviceman ${id} not found`);

    const newStatus = tech.status === 'suspended' ? 'available' : 'suspended';
    return this.prisma.serviceman.update({
      where: { id },
      data: { status: newStatus }
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Super Admin: Delete serviceman' })
  @ApiParam({ name: 'id', example: 'sm-1' })
  async deleteServiceman(@Param('id') id: string) {
    const tech = await this.prisma.serviceman.findUnique({ where: { id } });
    if (!tech) throw new NotFoundException(`Serviceman ${id} not found`);

    return this.prisma.serviceman.delete({ where: { id } });
  }
}

