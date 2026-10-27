import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import path from 'path';

// Sanitizar CLOUDINARY_URL para evitar caídas si contiene comillas, prefijos o formato inválido
if (process.env.CLOUDINARY_URL) {
  let val = process.env.CLOUDINARY_URL.trim();
  if (val.startsWith('CLOUDINARY_URL=')) {
    val = val.replace(/^CLOUDINARY_URL=\s*/, '');
  }
  val = val.replace(/^["']|["']$/g, '').trim();
  if (!val.startsWith('cloudinary://')) {
    console.warn(`⚠️ [Cloudinary] CLOUDINARY_URL no comienza con 'cloudinary://'. Se detectó: "${val.slice(0, 15)}...". Desactivando variable para evitar caídas del servidor.`);
    delete process.env.CLOUDINARY_URL;
  } else {
    process.env.CLOUDINARY_URL = val;
  }
}

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Servir archivos estáticos subidos (evidencias, KYC, tickets, avatars)
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Habilitar CORS para clientes Next.js, móviles y web
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Prefijo global de API
  app.setGlobalPrefix('api');

  // Configuración de OpenAPI 3.0 / Swagger en Español
  const config = new DocumentBuilder()
    .setTitle('ChambaYa API - Servicios y Oficios a Domicilio')
    .setDescription('API REST desacoplada para el mercado mexicano y latinoamericano. Conecta clientes con profesionales independientes, asignación de chambas con GPS y liquidación de comisiones.')
    .setVersion('2.0.0')
    .addTag('Categorías')
    .addTag('Catálogo de Servicios')
    .addTag('Proveedores y Negocios')
    .addTag('Chambeadores y Técnicos')
    .addTag('Chambas y Despacho')
    .addTag('Pagos y OXXO/SPEI')
    .addTag('Notificaciones y SMS')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 ChambaYa NestJS Backend corriendo en: http://0.0.0.0:${port}/api`);
  console.log(`📑 Documentación Swagger disponible en: http://localhost:${port}/api/docs`);
}

await bootstrap();
