# ==============================================================================
# ChambaYa México 🇲🇽 - Backend API Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para compilar módulos nativos si se requieren
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --prefer-offline --no-audit

COPY . .

# Generar cliente de Prisma y compilar TypeScript con NestJS
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# ==============================================================================
# Stage 2: Minimal Production Runner
# ==============================================================================
FROM node:22-alpine AS runner

# Instalar dumb-init para manejo limpio de señales POSIX (SIGTERM, SIGINT) y curl para healthchecks
RUN apk add --no-cache curl dumb-init openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Crear directorio para subidas de archivos
RUN mkdir -p /app/uploads && chown -R node:node /app

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

RUN chmod -R 777 /app/uploads

# Ejecutar como usuario sin privilegios 'node' para máxima seguridad
USER node

EXPOSE 4000

# Docker Healthcheck nativo consultando /api/health
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-4000}/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "-c", "npx prisma db push --skip-generate 2>&1 || true; exec node dist/main.js"]
