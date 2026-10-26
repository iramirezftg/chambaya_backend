export class Category {
  id!: string;
  name!: string;
  badge!: string;
  image!: string;
  description!: string;
  servicesCount!: number;
}

export class Provider {
  id!: string;
  name!: string;
  owner!: string;
  email!: string;
  phone!: string;
  zone!: string;
  rating!: number;
  reviewsCount!: number;
  servicesCount!: number;
  servicemenCount!: number;
  status!: 'active' | 'pending' | 'suspended';
  commissionRate!: number;
  totalEarnings!: number;
  walletBalance!: number;
  avatar!: string;
  categories!: string[];
}

export class Serviceman {
  id!: string;
  providerId!: string;
  name!: string;
  title!: string;
  phone!: string;
  rating!: number;
  completedJobs!: number;
  avatar!: string;
  status!: 'available' | 'busy' | 'offline';
  currentLocation!: { lat: number; lng: number; address: string };
  activeBookingId!: string | null;
}

export class ServiceItem {
  id!: string;
  providerId!: string;
  categoryId!: string;
  title!: string;
  description!: string;
  price!: number;
  discountPrice?: number;
  duration!: string;
  rating!: number;
  reviewsCount!: number;
  image!: string;
  badge!: string;
  variants!: { name: string; priceAdd: number }[];
}

export class Booking {
  id!: string;
  customerName!: string;
  customerPhone!: string;
  customerEmail!: string;
  customerAddress!: string;
  serviceId!: string;
  serviceTitle!: string;
  serviceImage!: string;
  providerId!: string;
  providerName!: string;
  servicemanId!: string | null;
  servicemanName!: string | null;
  servicemanPhone!: string | null;
  servicemanAvatar!: string | null;
  status!: 'pending' | 'accepted' | 'assigned' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate!: string;
  scheduledTimeSlot!: string;
  createdAt!: string;
  amount!: number;
  platformFee!: number;
  providerEarnings!: number;
  paymentMethod!: string;
  paymentStatus!: 'paid' | 'unpaid';
  transactionId!: string;
  otp!: string;
  rating?: number | null;
  reviewText?: string;
  timeline!: { status: string; time: string; label: string }[];
}

export class DataStore {
  private static instance: DataStore;

  public categories: Category[] = [
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

  public providers: Provider[] = [
    {
      id: 'prov-1',
      name: 'Técnicos del Valle & Climas CDMX',
      owner: 'Alejandro Morales',
      email: 'contacto@tecnicosdelvalle.mx',
      phone: '+52 55 2345 8901',
      zone: 'CDMX - Benito Juárez y Roma-Condesa',
      rating: 4.95,
      reviewsCount: 1420,
      servicesCount: 8,
      servicemenCount: 12,
      status: 'active',
      commissionRate: 15,
      totalEarnings: 384500.00,
      walletBalance: 42100.50,
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=160&auto=format&fit=crop&q=80',
      categories: ['cat-ac']
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
      servicesCount: 10,
      servicemenCount: 8,
      status: 'active',
      commissionRate: 15,
      totalEarnings: 298000.00,
      walletBalance: 31200.00,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
      categories: ['cat-cleaning']
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
      servicesCount: 6,
      servicemenCount: 15,
      status: 'active',
      commissionRate: 15,
      totalEarnings: 524000.00,
      walletBalance: 68400.25,
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&auto=format&fit=crop&q=80',
      categories: ['cat-plumbing']
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
      servicesCount: 4,
      servicemenCount: 3,
      status: 'pending', // Pendiente de verificación KYC
      commissionRate: 15,
      totalEarnings: 14000.00,
      walletBalance: 3500.00,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
      categories: ['cat-ac']
    }
  ];

  public servicemen: Serviceman[] = [
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
      currentLocation: { lat: 19.4194, lng: -99.1634, address: 'Col. Roma Norte, CDMX' },
      activeBookingId: 'CHAMBA-9021'
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
      currentLocation: { lat: 19.3512, lng: -99.1628, address: 'Col. del Carmen, Coyoacán' },
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
      currentLocation: { lat: 20.6736, lng: -103.3740, address: 'Col. Providencia, Zapopan' },
      activeBookingId: null
    }
  ];

  public services: ServiceItem[] = [
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
      variants: [{ name: '1 Unidad Minisplit', priceAdd: 0 }, { name: 'Paquete 2 Unidades', priceAdd: 550 }]
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
      variants: [{ name: 'Depa 1 a 2 Recámaras', priceAdd: 0 }, { name: 'Casa 3 a 4 Recámaras', priceAdd: 600 }]
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
      variants: [{ name: 'Fregadero o WC Individual', priceAdd: 0 }, { name: 'Línea de Descarga Principal', priceAdd: 450 }]
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
      variants: [{ name: 'Corte y Barba Tradicional', priceAdd: 0 }, { name: 'Tratamiento Spa Deluxe', priceAdd: 200 }]
    }
  ];

  public bookings: Booking[] = [
    {
      id: 'CHAMBA-9021',
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
      createdAt: '2026-10-22T09:15:00Z',
      amount: 699.00,
      platformFee: 104.85,
      providerEarnings: 594.15,
      paymentMethod: 'oxxo',
      paymentStatus: 'paid',
      transactionId: 'TXN-OXXO-882194',
      otp: '4829',
      timeline: [
        { status: 'pending', time: '09:15 AM', label: 'Chamba solicitada por Fernanda' },
        { status: 'accepted', time: '09:18 AM', label: 'Aceptada por Técnicos del Valle' },
        { status: 'assigned', time: '09:20 AM', label: 'Asignada al chambeador Carlos Mendoza' },
        { status: 'in_progress', time: '01:58 PM', label: 'Carlos llegó e ingresó el PIN de seguridad' }
      ]
    }
  ];

  public gateways: Record<string, { name: string; enabled: boolean; feePercent: number }> = {
    tarjeta: { name: 'Tarjeta Débito/Crédito (Visa, Mastercard, Amex)', enabled: true, feePercent: 2.9 },
    spei: { name: 'Transferencia Interbancaria SPEI (Sin Comisión)', enabled: true, feePercent: 0.0 },
    oxxo: { name: 'OXXO Pay en Efectivo', enabled: true, feePercent: 1.5 },
    wallet: { name: 'Monedero Digital ChambaYa', enabled: true, feePercent: 0.0 },
    efectivo: { name: 'Pago en Efectivo al Terminar la Chamba', enabled: true, feePercent: 0.0 }
  };

  public smsLogs: { id: string; to: string; text: string; time: string }[] = [
    {
      id: 'sms-1',
      to: '+52 55 7281 1933',
      text: 'ChambaYa: Tu técnico Carlos Mendoza va en camino. Tu PIN de seguridad es 4829.',
      time: '1:35 PM'
    }
  ];

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }
}
