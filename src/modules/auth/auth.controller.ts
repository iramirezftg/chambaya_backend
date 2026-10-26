import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';

@ApiTags('Authentication & Identity')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'Solicitar código de verificación SMS (OTP) al celular' })
  @ApiBody({ schema: { type: 'object', properties: { phone: { type: 'string', example: '+52 55 7281 1933' } }, required: ['phone'] } })
  async sendOtp(@Body('phone') phone: string) {
    return this.authService.sendOtp(phone);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verificar código SMS e iniciar sesión con token JWT' })
  @ApiBody({ schema: { type: 'object', properties: { phone: { type: 'string', example: '+52 55 7281 1933' }, code: { type: 'string', example: '123456' } }, required: ['phone', 'code'] } })
  async verifyOtp(
    @Body('phone') phone: string,
    @Body('code') code: string
  ) {
    return this.authService.verifyOtp(phone, code);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión con correo electrónico y contraseña' })
  @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string', example: 'fernanda.gomez@gmail.com' }, password: { type: 'string', example: 'chambaya123' } }, required: ['email', 'password'] } })
  async login(
    @Body('email') email: string,
    @Body('password') pass: string
  ) {
    return this.authService.loginWithEmail(email, pass);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar nueva cuenta en ChambaYa' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Juan Pérez' },
        email: { type: 'string', example: 'juan.perez@gmail.com' },
        phone: { type: 'string', example: '+52 55 1234 5678' },
        password: { type: 'string', example: 'chambaya123' },
        role: { type: 'string', example: 'CUSTOMER', enum: ['CUSTOMER', 'PROVIDER', 'SERVICEMAN'] },
        address: { type: 'string', example: 'Col. Condesa, CDMX' }
      },
      required: ['name', 'email', 'phone', 'password']
    }
  })
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener datos del usuario autenticado actual mediante JWT' })
  async getMe(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }
}
