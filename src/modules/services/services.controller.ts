import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('Services Catalog')
@Controller('services')
export class ServicesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List services with optional category or provider filters' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'providerId', required: false })
  async getServices(
    @Query('categoryId') categoryId?: string,
    @Query('providerId') providerId?: string,
  ) {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (providerId) where.providerId = providerId;

    return this.prisma.service.findMany({
      where,
      include: {
        variants: true
      }
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create new service under a provider catalog' })
  async createService(@Body() body: any) {
    const newId = `srv-${Date.now()}`;
    const variants = body.variants && body.variants.length > 0
      ? body.variants
      : [{ name: 'Paquete Estándar', priceAdd: 0 }];

    // Ensure valid providerId
    let providerId = body.providerId || 'prov-1';
    const provExists = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provExists) {
      const firstProv = await this.prisma.provider.findFirst();
      providerId = firstProv ? firstProv.id : 'prov-1';
    }

    // Ensure valid categoryId
    let categoryId = body.categoryId || 'cat-ac';
    const catExists = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!catExists) {
      const firstCat = await this.prisma.category.findFirst();
      categoryId = firstCat ? firstCat.id : 'cat-ac';
    }

    return this.prisma.service.create({
      data: {
        id: newId,
        providerId,
        categoryId,
        title: body.title || 'Nueva Chamba',
        description: body.description || '',
        price: Number(body.price) || 500,
        discountPrice: body.discountPrice ? Number(body.discountPrice) : null,
        duration: body.duration || '60 mins',
        rating: 5.0,
        reviewsCount: 1,
        image: body.image || '/images/ac_repair.jpg',
        badge: 'Nuevo Servicio',
        variants: {
          create: variants.map((v: any) => ({
            name: v.name,
            priceAdd: Number(v.priceAdd) || 0
          }))
        }
      },
      include: {
        variants: true
      }
    });
  }
}
