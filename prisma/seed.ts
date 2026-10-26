import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ChambaYa Database Seed...');

  const defaultPasswordHash = bcrypt.hashSync('chambaya123', 10);
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);

  // Clean existing records to avoid duplicates
  await prisma.smsLog.deleteMany();
  await prisma.paymentGateway.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.bookingTimeline.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.serviceVariant.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceman.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // 1. Users
  const userCustomer = await prisma.user.create({
    data: {
      id: 'usr-customer-1',
      name: 'Fernanda Gómez',
      email: 'fernanda.gomez@gmail.com',
      phone: '+52 55 7281 1933',
      passwordHash: defaultPasswordHash,
      role: 'CUSTOMER',
      address: 'Calle Orizaba 142, Depto 4B, Col. Roma Norte, CDMX',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80',
      walletBalance: 1850.00
    }
  });

  const userProvider = await prisma.user.create({
    data: {
      id: 'usr-prov-1',
      name: 'Alejandro Morales',
      email: 'contacto@tecnicosdelvalle.mx',
      phone: '+52 55 2345 8901',
      passwordHash: defaultPasswordHash,
      role: 'PROVIDER',
      address: 'Insurgentes Sur 421, Col. Roma Sur, CDMX',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=160&auto=format&fit=crop&q=80',
      walletBalance: 42100.50
    }
  });

  const userServiceman = await prisma.user.create({
    data: {
      id: 'usr-sm-1',
      name: 'Carlos Mendoza',
      email: 'carlos.mendoza@tecnicosdelvalle.mx',
      phone: '+52 55 0192 2811',
      passwordHash: defaultPasswordHash,
      role: 'SERVICEMAN',
      address: 'Col. San Rafael, Cuauhtémoc, CDMX',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
      walletBalance: 2450.00
    }
  });

  const userAdmin = await prisma.user.create({
    data: {
      id: 'usr-admin-1',
      name: 'Admin Central ChambaYa',
      email: 'admin@chambaya.mx',
      phone: '+52 55 9999 0000',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      address: 'Paseo de la Reforma 222, CDMX',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
      walletBalance: 98000.00
    }
  });

  console.log('✅ Users created');

  // 2. Categories
  const categoriesData = [
    {
      id: 'cat-ac',
      name: 'Climas, Aire Acondicionado y Línea Blanca',
      badge: 'Más Solicitado',
      image: '/images/ac_repair.jpg',
      description: 'Mantenimiento preventivo, lavado de serpentín a presión, recarga de gas y reparación de refrigeradores.',
      servicesCount: 14
    },
    {
      id: 'cat-cleaning',
      name: 'Limpieza Profunda y Sanitización',
      badge: 'Tendencia',
      image: '/images/cleaning.jpg',
      description: 'Aseo integral de casas, lavado de salas y alfombras, desinfección de cocinas y baños.',
      servicesCount: 22
    },
    {
      id: 'cat-plumbing',
      name: 'Plomería y Destape de Drenajes',
      badge: 'Urgencias 24/7',
      image: '/images/plumbing.jpg',
      description: 'Detección y reparación de fugas, cambio de llaves, destape con sonda eléctrica e instalación de calentadores.',
      servicesCount: 18
    },
    {
      id: 'cat-salon',
      name: 'Barbería, Estética y Spa a Domicilio',
      badge: 'Exclusivo',
      image: '/images/salon.jpg',
      description: 'Cortes de cabello, tratamientos faciales, masajes relajantes, manicura y pedicura en tu hogar.',
      servicesCount: 16
    }
  ];

  for (const cat of categoriesData) {
    await prisma.category.create({ data: cat });
  }
  console.log('✅ Categories created');

  // 3. Providers
  const providersData = [
    {
      id: 'prov-1',
      name: 'Técnicos del Valle & Climas CDMX',
      owner: 'Alejandro Morales',
      email: 'contacto@tecnicosdelvalle.mx',
      phone: '+52 55 2345 8901',
      zone: 'CDMX - Benito Juárez y Roma-Condesa',
      rating: 4.95,
      reviewsCount: 1420,
      status: 'active',
      commissionRate: 15,
      totalEarnings: 384500.00,
      walletBalance: 42100.50,
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=160&auto=format&fit=crop&q=80',
      clabeAccount: '012180001234567890',
      bankName: 'BBVA México',
      userId: userProvider.id
    },
    {
      id: 'prov-2',
      name: 'Limpieza Exprés & Hogar Impecable',
      owner: 'María Elena Salazar',
      email: 'servicio@limpiezaexpres.mx',
      phone: '+52 55 4893 3321',
      zone: 'CDMX - Coyoacán y San Ángel',
      rating: 4.88,
      reviewsCount: 980,
      status: 'active',
      commissionRate: 15,
      totalEarnings: 298000.00,
      walletBalance: 31200.00,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
      clabeAccount: '072180009876543210',
      bankName: 'Banorte'
    },
    {
      id: 'prov-3',
      name: 'Plomería Azteca & Destapes Express',
      owner: 'Tomás Barrera',
      email: 'urgencias@plomeriaazteca.mx',
      phone: '+52 33 6729 9011',
      zone: 'Guadalajara - Providencia y Zapopan',
      rating: 4.92,
      reviewsCount: 2150,
      status: 'active',
      commissionRate: 15,
      totalEarnings: 524000.00,
      walletBalance: 68400.25,
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&auto=format&fit=crop&q=80',
      clabeAccount: '014180005544332211',
      bankName: 'Santander México'
    },
    {
      id: 'prov-4',
      name: 'Voltia Instalaciones Eléctricas',
      owner: 'David Nava',
      email: 'registro@voltia.mx',
      phone: '+52 81 3028 8819',
      zone: 'Monterrey - San Pedro Garza García',
      rating: 4.70,
      reviewsCount: 120,
      status: 'pending',
      commissionRate: 15,
      totalEarnings: 14000.00,
      walletBalance: 3500.00,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
      clabeAccount: '002180007788990011',
      bankName: 'Citibanamex'
    }
  ];

  for (const prov of providersData) {
    await prisma.provider.create({ data: prov });
  }
  console.log('✅ Providers created');

  // 4. Servicemen
  const servicemenData = [
    {
      id: 'sm-1',
      providerId: 'prov-1',
      name: 'Carlos Mendoza',
      title: 'Técnico Especialista en Climas y Refrigeración',
      phone: '+52 55 0192 2811',
      rating: 4.96,
      completedJobs: 342,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
      status: 'busy',
      currentLat: 19.4194,
      currentLng: -99.1634,
      currentAddress: 'Col. Roma Norte, CDMX',
      activeBookingId: 'CHAMBA-9021',
      userId: userServiceman.id
    },
    {
      id: 'sm-2',
      providerId: 'prov-2',
      name: 'Elena Rostova',
      title: 'Líder en Sanitización y Limpieza de Interiores',
      phone: '+52 55 0144 4902',
      rating: 5.0,
      completedJobs: 412,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
      status: 'available',
      currentLat: 19.3512,
      currentLng: -99.1628,
      currentAddress: 'Col. del Carmen, Coyoacán',
      activeBookingId: null
    },
    {
      id: 'sm-3',
      providerId: 'prov-3',
      name: 'Marcos Villegas',
      title: 'Maestro Plomero Certificado',
      phone: '+52 33 0188 8772',
      rating: 4.91,
      completedJobs: 580,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&auto=format&fit=crop&q=80',
      status: 'available',
      currentLat: 20.6736,
      currentLng: -103.3740,
      currentAddress: 'Col. Providencia, Zapopan',
      activeBookingId: null
    }
  ];

  for (const sm of servicemenData) {
    await prisma.serviceman.create({ data: sm });
  }
  console.log('✅ Servicemen created');

  // 5. Services and Variants
  const servicesData = [
    {
      id: 'srv-1',
      providerId: 'prov-1',
      categoryId: 'cat-ac',
      title: 'Mantenimiento y Lavado a Presión de Minisplit',
      description: 'Limpieza de serpentín con hidrolavadora, desinfección química de turbina, revisión de presiones y gas refrigerante.',
      price: 850.00,
      discountPrice: 699.00,
      duration: '60 mins',
      rating: 4.95,
      reviewsCount: 382,
      image: '/images/ac_repair.jpg',
      badge: 'Más Vendido',
      variants: [
        { name: '1 Unidad Minisplit', priceAdd: 0 },
        { name: 'Paquete 2 Unidades', priceAdd: 550 }
      ]
    },
    {
      id: 'srv-2',
      providerId: 'prov-2',
      categoryId: 'cat-cleaning',
      title: 'Limpieza Profunda de Casa o Departamento Completo',
      description: 'Aspirado con filtro HEPA, desengrasado de cocina y campana, desincrustado de sarro en baños y pulido de pisos.',
      price: 1800.00,
      discountPrice: 1450.00,
      duration: '3 - 4 horas',
      rating: 4.92,
      reviewsCount: 520,
      image: '/images/cleaning.jpg',
      badge: 'Servicio Estrella',
      variants: [
        { name: 'Depa 1 a 2 Recámaras', priceAdd: 0 },
        { name: 'Casa 3 a 4 Recámaras', priceAdd: 600 }
      ]
    },
    {
      id: 'srv-3',
      providerId: 'prov-3',
      categoryId: 'cat-plumbing',
      title: 'Destape de Drenajes con Sonda Eléctrica y Detección de Fugas',
      description: 'Inspección técnica, retiro de obstrucciones severas en tarjas, sanitarios y líneas principales de drenaje.',
      price: 950.00,
      discountPrice: 790.00,
      duration: '45 mins',
      rating: 4.94,
      reviewsCount: 680,
      image: '/images/plumbing.jpg',
      badge: 'Llegada Rápida',
      variants: [
        { name: 'Fregadero o WC Individual', priceAdd: 0 },
        { name: 'Línea de Descarga Principal', priceAdd: 450 }
      ]
    },
    {
      id: 'srv-4',
      providerId: 'prov-1',
      categoryId: 'cat-salon',
      title: 'Barbería & Spa Facial Hidratante a Domicilio',
      description: 'Corte de cabello personalizado, perfilado de barba con toalla caliente, mascarilla de carbón y exfoliación facial.',
      price: 650.00,
      discountPrice: 490.00,
      duration: '60 mins',
      rating: 4.98,
      reviewsCount: 410,
      image: '/images/salon.jpg',
      badge: 'Cuidado Personal',
      variants: [
        { name: 'Corte y Barba Tradicional', priceAdd: 0 },
        { name: 'Tratamiento Spa Deluxe', priceAdd: 200 }
      ]
    }
  ];

  for (const s of servicesData) {
    const { variants, ...srvData } = s;
    const createdSrv = await prisma.service.create({ data: srvData });
    for (const v of variants) {
      await prisma.serviceVariant.create({
        data: {
          serviceId: createdSrv.id,
          name: v.name,
          priceAdd: v.priceAdd
        }
      });
    }
  }
  console.log('✅ Services and variants created');

  // 6. Bookings and Timelines
  const createdBooking = await prisma.booking.create({
    data: {
      id: 'CHAMBA-9021',
      customerId: userCustomer.id,
      customerName: 'Fernanda Gómez',
      customerPhone: '+52 55 7281 1933',
      customerEmail: 'fernanda.gomez@gmail.com',
      customerAddress: 'Calle Orizaba 142, Depto 4B, Col. Roma Norte, CDMX',
      serviceId: 'srv-1',
      serviceTitle: 'Mantenimiento y Lavado a Presión de Minisplit',
      serviceImage: '/images/ac_repair.jpg',
      providerId: 'prov-1',
      providerName: 'Técnicos del Valle & Climas CDMX',
      servicemanId: 'sm-1',
      servicemanName: 'Carlos Mendoza',
      servicemanPhone: '+52 55 0192 2811',
      servicemanAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
      status: 'in_progress',
      scheduledDate: '2026-10-22',
      scheduledTimeSlot: '02:00 PM - 03:30 PM',
      amount: 699.00,
      platformFee: 104.85,
      providerEarnings: 594.15,
      paymentMethod: 'oxxo',
      paymentStatus: 'paid',
      transactionId: 'TXN-OXXO-882194',
      otp: '4829'
    }
  });

  const timelines = [
    { status: 'pending', time: '09:15 AM', label: 'Chamba solicitada por Fernanda' },
    { status: 'accepted', time: '09:18 AM', label: 'Aceptada por Técnicos del Valle' },
    { status: 'assigned', time: '09:20 AM', label: 'Asignada al chambeador Carlos Mendoza' },
    { status: 'in_progress', time: '01:58 PM', label: 'Carlos llegó e ingresó el PIN de seguridad' }
  ];

  for (const t of timelines) {
    await prisma.bookingTimeline.create({
      data: {
        bookingId: createdBooking.id,
        status: t.status,
        time: t.time,
        label: t.label
      }
    });
  }
  console.log('✅ Bookings and timelines created');

  // 7. Payment Gateways
  const gateways = [
    { id: 'gw-1', key: 'tarjeta', name: 'Tarjeta Débito/Crédito (Visa, Mastercard, Amex)', enabled: true, feePercent: 2.9 },
    { id: 'gw-2', key: 'spei', name: 'Transferencia Interbancaria SPEI (Sin Comisión)', enabled: true, feePercent: 0.0 },
    { id: 'gw-3', key: 'oxxo', name: 'OXXO Pay en Efectivo', enabled: true, feePercent: 1.5 },
    { id: 'gw-4', key: 'wallet', name: 'Monedero Digital ChambaYa', enabled: true, feePercent: 0.0 },
    { id: 'gw-5', key: 'efectivo', name: 'Pago en Efectivo al Terminar la Chamba', enabled: true, feePercent: 0.0 }
  ];

  for (const gw of gateways) {
    await prisma.paymentGateway.create({ data: gw });
  }
  console.log('✅ Payment gateways created');

  // 8. SMS Logs
  await prisma.smsLog.create({
    data: {
      id: 'sms-1',
      to: '+52 55 7281 1933',
      text: 'ChambaYa: Tu técnico Carlos Mendoza va en camino. Tu PIN de seguridad es 4829.',
      time: '1:35 PM'
    }
  });
  console.log('✅ SMS logs created');

  console.log('🎉 ChambaYa database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
