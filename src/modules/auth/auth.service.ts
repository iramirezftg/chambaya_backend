import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Envía un código OTP de 6 dígitos al celular del usuario (Twilio / SMS)
   */
  async sendOtp(phone: string) {
    if (!phone) throw new BadRequestException('El número de celular es requerido');

    const cleanPhone = phone.trim();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    let user = await this.prisma.user.findUnique({
      where: { phone: cleanPhone }
    });

    if (!user) {
      // Auto-registro como cliente nuevo
      user = await this.prisma.user.create({
        data: {
          name: `Usuario ${cleanPhone.slice(-4)}`,
          phone: cleanPhone,
          email: `${cleanPhone.replace(/[^0-9]/g, '')}@chambaya.mx`,
          role: 'CUSTOMER',
          otpCode,
          otpExpiresAt: expiresAt,
          walletBalance: 200.00 // Bono de bienvenida $200 MXN
        }
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otpCode,
          otpExpiresAt: expiresAt
        }
      });
    }

    // Registrar en bitácora SMS
    await this.prisma.smsLog.create({
      data: {
        to: cleanPhone,
        text: `ChambaYa: Tu código de verificación de acceso es ${otpCode}. Válido por 10 minutos.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    });

    return {
      success: true,
      message: `Código SMS enviado al ${cleanPhone}`,
      otpPreview: otpCode // Expuesto para facilidad de prueba en ambiente de desarrollo
    };
  }

  /**
   * Valida el código OTP e inicia sesión generando token JWT
   */
  async verifyOtp(phone: string, code: string) {
    if (!phone || !code) throw new BadRequestException('Teléfono y código requeridos');

    const user = await this.prisma.user.findUnique({
      where: { phone: phone.trim() },
      include: {
        provider: true,
        serviceman: true
      }
    });

    if (!user || !user.otpCode) {
      throw new UnauthorizedException('Código de verificación no solicitado o expirado');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('El código de verificación ha expirado. Solicita uno nuevo.');
    }

    if (user.otpCode !== code.trim()) {
      throw new UnauthorizedException('Código de verificación incorrecto');
    }

    // Limpiar OTP tras validación exitosa
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiresAt: null }
    });

    return this.generateAuthResponse(user);
  }

  /**
   * Inicio de sesión con correo y contraseña
   */
  async loginWithEmail(email: string, pass: string) {
    if (!email || !pass) throw new BadRequestException('Correo y contraseña requeridos');

    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        provider: true,
        serviceman: true
      }
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = bcrypt.compareSync(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateAuthResponse(user);
  }

  /**
   * Registro de nuevo usuario (Cliente, Proveedor o Chambeador)
   */
  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role?: string;
    address?: string;
  }) {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) throw new ConflictException('Ya existe un usuario con este correo electrónico');

    const existingPhone = await this.prisma.user.findUnique({ where: { phone: data.phone } });
    if (existingPhone) throw new ConflictException('Ya existe un usuario con este número de teléfono');

    const passwordHash = bcrypt.hashSync(data.password, 10);
    const role = data.role?.toUpperCase() || 'CUSTOMER';

    const newUser = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash,
        role,
        address: data.address || 'CDMX, México',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80',
        walletBalance: 200.00 // Bono de bienvenida $200 MXN
      },
      include: {
        provider: true,
        serviceman: true
      }
    });

    return this.generateAuthResponse(newUser);
  }

  /**
   * Genera el payload y token JWT firmado
   */
  private generateAuthResponse(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      providerId: user.provider?.id || null,
      servicemanId: user.serviceman?.id || null
    };

    const accessToken = this.jwtService.sign(payload);
    const { passwordHash, otpCode, otpExpiresAt, ...safeUser } = user;

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '7d',
      user: safeUser
    };
  }

  /**
   * Obtiene el perfil completo del usuario autenticado
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        provider: true,
        serviceman: true,
        customerBookings: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    const { passwordHash, otpCode, otpExpiresAt, ...safeUser } = user;
    return safeUser;
  }
}
