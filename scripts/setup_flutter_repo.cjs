const fs = require('fs');
const path = require('path');

const flutterAppDir = path.resolve(__dirname, '../flutter_app');

if (!fs.existsSync(flutterAppDir)) {
  fs.mkdirSync(flutterAppDir, { recursive: true });
}

// 1. Write pubspec.yaml
const pubspecContent = `name: manabros
description: ManaBros MTG Purchasing & Order Consolidation App
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.6
  firebase_core: ^2.24.2
  firebase_auth: ^4.16.0
  cloud_firestore: ^4.14.0
  intl: ^0.18.1
  http: ^1.1.0
  webview_flutter: ^4.4.2
  flutter_spinkit: ^5.2.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.1

flutter:
  uses-material-design: true
`;

fs.writeFileSync(path.join(flutterAppDir, 'pubspec.yaml'), pubspecContent, 'utf-8');

// 2. Write analysis_options.yaml
const analysisOptionsContent = `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    prefer_const_constructors: true
    prefer_const_declarations: true
    avoid_print: false
`;

fs.writeFileSync(path.join(flutterAppDir, 'analysis_options.yaml'), analysisOptionsContent, 'utf-8');

// 3. Write README.md
const readmeContent = `# ManaBros - Aplicación Flutter (Dart)

Proyecto móvil nativo de ManaBros para consolidación de pedidos de Magic: The Gathering en Card Kingdom, basado en la especificación técnica §5.

## Estructura del Proyecto

\`\`\`
flutter_app/
├── pubspec.yaml                 # Dependencias (Firebase, Webview, HTTP, Intl)
├── analysis_options.yaml        # Reglas de linter Flutter
├── firestore.rules              # Reglas de seguridad Firestore de la app
└── lib/
    ├── main.dart                # Punto de entrada y autenticación
    ├── models/
    │   └── purchases_models.dart # Modelos fuertemente tipados con fromMap/toMap
    ├── screens/
    │   ├── order_detail_screen.dart   # Pantalla principal de orden activa (§5.1, §5.2)
    │   ├── orders_history_screen.dart # Historial de órdenes finalizadas (§5.7)
    │   ├── mass_entry_screen.dart     # Entrada masiva de listas de cartas (§5.5)
    │   └── ck_webview_screen.dart     # Navegador Card Kingdom con inyección JS (§5.6)
    ├── widgets/
    │   ├── order_card.dart              # Tarjeta de orden con indicador de urgencia (§5.4)
    │   ├── buyer_breakdown_card.dart    # Desglose individual por comprador
    │   ├── shipping_management_card.dart# Asignación de flete y tracking (§5.3)
    │   ├── order_payments_modal.dart    # Modal de registro y liquidación de abonos (§5.2)
    │   └── settings_dialog.dart         # Diálogo de ajustes de usuario y admin (§5.9)
    └── services/
        ├── firestore_service.dart       # CRUD Firestore con regla de upsert (§1.2)
        ├── price_rescraper_service.dart # Re-escaneo de precios elegibles (§2.4)
        └── ck_cart_pusher.dart          # Automatización de carrito en Card Kingdom
\`\`\`

## Ejecución

\`\`\`bash
flutter pub get
flutter run
\`\`\`
`;

fs.writeFileSync(path.join(flutterAppDir, 'README.md'), readmeContent, 'utf-8');

// 4. Create models: lib/models/purchases_models.dart
const modelsDir = path.join(flutterAppDir, 'lib/models');
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

const modelsContent = `import 'package:cloud_firestore/cloud_firestore.dart';

/// Tipos y enumeraciones de ManaBros
typedef CardCondition = String; // 'NM' | 'EX' | 'VG' | 'G'
typedef UserRole = String;      // 'admin' | 'colaborador' | 'comprador'
typedef UserStatus = String;    // 'unconfirmed' | 'confirmed'
typedef PurchaseOrderStatus = String; // 'pending' | 'active' | 'purchased' | 'finalized'
typedef PaymentType = String;   // 'cards' | 'shipping'

/// Perfil de Usuario (§1.1)
class UserProfile {
  final String uid;
  final String email;
  final String displayName;
  final String photoURL;
  final String role;
  final String status;
  final double balance;
  final DateTime createdAt;

  UserProfile({
    required this.uid,
    required this.email,
    required this.displayName,
    required this.photoURL,
    required this.role,
    required this.status,
    required this.balance,
    required this.createdAt,
  });

  bool get isAdmin => role == 'admin';
  bool get isConfirmed => status == 'confirmed';

  factory UserProfile.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return UserProfile(
      uid: doc.id,
      email: data['email'] ?? '',
      displayName: data['displayName'] ?? '',
      photoURL: data['photoURL'] ?? '',
      role: data['role'] ?? 'comprador',
      status: data['status'] ?? 'unconfirmed',
      balance: (data['balance'] is num) ? (data['balance'] as num).toDouble() : 0.0,
      createdAt: data['createdAt'] != null
          ? (data['createdAt'] is Timestamp
              ? (data['createdAt'] as Timestamp).toDate()
              : DateTime.tryParse(data['createdAt'].toString()) ?? DateTime.now())
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'email': email,
      'displayName': displayName,
      'photoURL': photoURL,
      'role': role,
      'status': status,
      'balance': balance,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }
}

/// Orden de Compra (§1.1, §4, §5.1)
class PurchaseOrder {
  final String id;
  final String status;
  final DateTime? estimatedPurchaseDate;
  final double? shippingCost;
  final DateTime createdAt;

  PurchaseOrder({
    required this.id,
    required this.status,
    this.estimatedPurchaseDate,
    this.shippingCost,
    required this.createdAt,
  });

  factory PurchaseOrder.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return PurchaseOrder(
      id: doc.id,
      status: data['status'] ?? 'pending',
      estimatedPurchaseDate: data['estimatedPurchaseDate'] != null
          ? (data['estimatedPurchaseDate'] is Timestamp
              ? (data['estimatedPurchaseDate'] as Timestamp).toDate()
              : DateTime.tryParse(data['estimatedPurchaseDate'].toString()))
          : null,
      shippingCost: (data['shippingCost'] is num) ? (data['shippingCost'] as num).toDouble() : 0.0,
      createdAt: data['createdAt'] != null
          ? (data['createdAt'] is Timestamp
              ? (data['createdAt'] as Timestamp).toDate()
              : DateTime.tryParse(data['createdAt'].toString()) ?? DateTime.now())
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'status': status,
      if (estimatedPurchaseDate != null)
        'estimatedPurchaseDate': Timestamp.fromDate(estimatedPurchaseDate!),
      'shippingCost': shippingCost ?? 0.0,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }
}

/// Ítem de Orden (§1.1, §1.2 Regla de Upsert)
class OrderItem {
  final String id;
  final String orderId;
  final String buyerEmail;
  final String buyerName;
  final String cardName;
  final String edition;
  final String cardType;
  final String imageUrl;
  final String pageUrl;
  final String productId;
  final bool foil;
  final String condition;
  final double price;
  final int quantity;
  final bool inStock;
  final int availableQty;
  final String? refreshStatus;
  final DateTime createdAt;
  final DateTime lastCheckedAt;
  final double? previousPrice;
  final double? priceDelta;
  final String? stockChanged;

  OrderItem({
    required this.id,
    required this.orderId,
    required this.buyerEmail,
    required this.buyerName,
    required this.cardName,
    required this.edition,
    required this.cardType,
    required this.imageUrl,
    required this.pageUrl,
    required this.productId,
    required this.foil,
    required this.condition,
    required this.price,
    required this.quantity,
    required this.inStock,
    required this.availableQty,
    this.refreshStatus,
    required this.createdAt,
    required this.lastCheckedAt,
    this.previousPrice,
    this.priceDelta,
    this.stockChanged,
  });

  factory OrderItem.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return OrderItem(
      id: doc.id,
      orderId: data['orderId'] ?? '',
      buyerEmail: data['buyerEmail'] ?? '',
      buyerName: data['buyerName'] ?? '',
      cardName: data['cardName'] ?? '',
      edition: data['edition'] ?? '',
      cardType: data['cardType'] ?? '',
      imageUrl: data['imageUrl'] ?? '',
      pageUrl: data['pageUrl'] ?? '',
      productId: data['productId'] ?? '',
      foil: data['foil'] == true,
      condition: data['condition'] ?? 'NM',
      price: (data['price'] is num) ? (data['price'] as num).toDouble() : 0.0,
      quantity: (data['quantity'] is num) ? (data['quantity'] as num).toInt() : 1,
      inStock: data['inStock'] != false,
      availableQty: (data['availableQty'] is num) ? (data['availableQty'] as num).toInt() : 0,
      refreshStatus: data['refreshStatus'],
      createdAt: data['createdAt'] != null
          ? (data['createdAt'] is Timestamp
              ? (data['createdAt'] as Timestamp).toDate()
              : DateTime.tryParse(data['createdAt'].toString()) ?? DateTime.now())
          : DateTime.now(),
      lastCheckedAt: data['lastCheckedAt'] != null
          ? (data['lastCheckedAt'] is Timestamp
              ? (data['lastCheckedAt'] as Timestamp).toDate()
              : DateTime.tryParse(data['lastCheckedAt'].toString()) ?? DateTime.now())
          : DateTime.now(),
      previousPrice: (data['previousPrice'] is num) ? (data['previousPrice'] as num).toDouble() : null,
      priceDelta: (data['priceDelta'] is num) ? (data['priceDelta'] as num).toDouble() : null,
      stockChanged: data['stockChanged'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'orderId': orderId,
      'buyerEmail': buyerEmail,
      'buyerName': buyerName,
      'cardName': cardName,
      'edition': edition,
      'cardType': cardType,
      'imageUrl': imageUrl,
      'pageUrl': pageUrl,
      'productId': productId,
      'foil': foil,
      'condition': condition,
      'price': price,
      'quantity': quantity,
      'inStock': inStock,
      'availableQty': availableQty,
      'refreshStatus': refreshStatus,
      'createdAt': Timestamp.fromDate(createdAt),
      'lastCheckedAt': Timestamp.fromDate(lastCheckedAt),
      if (previousPrice != null) 'previousPrice': previousPrice,
      if (priceDelta != null) 'priceDelta': priceDelta,
      if (stockChanged != null) 'stockChanged': stockChanged,
    };
  }
}

/// Registro de Abono (§1.1, §5.2)
class Payment {
  final String id;
  final String orderId;
  final String buyerEmail;
  final double amount;
  final String note;
  final String registeredBy;
  final String type; // 'cards' | 'shipping'
  final DateTime createdAt;

  Payment({
    required this.id,
    required this.orderId,
    required this.buyerEmail,
    required this.amount,
    required this.note,
    required this.registeredBy,
    required this.type,
    required this.createdAt,
  });

  factory Payment.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return Payment(
      id: doc.id,
      orderId: data['orderId'] ?? '',
      buyerEmail: data['buyerEmail'] ?? '',
      amount: (data['amount'] is num) ? (data['amount'] as num).toDouble() : 0.0,
      note: data['note'] ?? '',
      registeredBy: data['registeredBy'] ?? '',
      type: data['type'] ?? 'cards',
      createdAt: data['createdAt'] != null
          ? (data['createdAt'] is Timestamp
              ? (data['createdAt'] as Timestamp).toDate()
              : DateTime.tryParse(data['createdAt'].toString()) ?? DateTime.now())
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'orderId': orderId,
      'buyerEmail': buyerEmail,
      'amount': amount,
      'note': note,
      'registeredBy': registeredBy,
      'type': type,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }
}

/// Ajustes de la Aplicación (§5.9)
class AppSettings {
  final bool historyEnabled;
  final bool buyersViewHistory;
  final bool useProxy;
  final String theme;

  AppSettings({
    required this.historyEnabled,
    required this.buyersViewHistory,
    required this.useProxy,
    required this.theme,
  });

  factory AppSettings.fromMap(Map<String, dynamic>? data) {
    return AppSettings(
      historyEnabled: data?['historyEnabled'] != false,
      buyersViewHistory: data?['buyersViewHistory'] != false,
      useProxy: data?['useProxy'] == true,
      theme: data?['theme'] ?? 'dark',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'historyEnabled': historyEnabled,
      'buyersViewHistory': buyersViewHistory,
      'useProxy': useProxy,
      'theme': theme,
    };
  }
}

/// Regla de elegibilidad de refresco (§2.4)
bool needsPriceRefresh(OrderItem item) {
  if (item.pageUrl.trim().isEmpty) return false;
  if (item.refreshStatus != 'ok') return true;
  final diffHours = DateTime.now().difference(item.lastCheckedAt).inMinutes / 60.0;
  return diffHours >= 1.0;
}

/// Helper para urgencia de orden (§4)
class OrderUrgency {
  final String label;
  final String urgency; // 'overdue' | 'today' | 'upcoming' | 'none'
  final int days;

  OrderUrgency({required this.label, required this.urgency, required this.days});
}

OrderUrgency getOrderUrgency(DateTime? estimatedDate) {
  if (estimatedDate == null) {
    return OrderUrgency(label: '', urgency: 'none', days: 0);
  }
  final now = DateTime.now();
  final targetMidnight = DateTime(estimatedDate.year, estimatedDate.month, estimatedDate.day);
  final nowMidnight = DateTime(now.year, now.month, now.day);
  final diffDays = targetMidnight.difference(nowMidnight).inDays;

  if (diffDays < 0) {
    final abs = diffDays.abs();
    return OrderUrgency(
      label: 'Vencida hace $abs día\${abs == 1 ? "" : "s"}',
      urgency: 'overdue',
      days: diffDays,
    );
  } else if (diffDays == 0) {
    return OrderUrgency(label: 'Compra es hoy', urgency: 'today', days: 0);
  } else {
    return OrderUrgency(
      label: 'En $diffDays día\${diffDays == 1 ? "" : "s"}',
      urgency: 'upcoming',
      days: diffDays,
    );
  }
}
`;

fs.writeFileSync(path.join(modelsDir, 'purchases_models.dart'), modelsContent, 'utf-8');

// 5. Create main.dart
const libDir = path.join(flutterAppDir, 'lib');
const mainContent = `import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'screens/order_detail_screen.dart';
import 'models/purchases_models.dart';
import 'services/firestore_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const ManaBrosApp());
}

class ManaBrosApp extends StatelessWidget {
  const ManaBrosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ManaBros',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0D1117),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFBBF24),
          surface: Color(0xFF161B22),
        ),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator(color: Color(0xFFFBBF24))),
          );
        }

        final user = snapshot.data;
        if (user == null) {
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.shield_rounded, size: 64, color: Color(0xFFFBBF24)),
                  const SizedBox(height: 16),
                  const Text('ManaBros Consolidador', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.login),
                    label: const Text('Iniciar Sesión con Google'),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFBBF24), foregroundColor: Colors.black),
                    onPressed: () {
                      // Login flow con GoogleSignIn
                    },
                  ),
                ],
              ),
            ),
          );
        }

        return FutureBuilder<UserProfile?>(
          future: FirestoreService().getUserProfile(user.uid),
          builder: (context, userSnap) {
            final profile = userSnap.data;
            final isAdmin = profile?.isAdmin ?? false;

            return FutureBuilder<PurchaseOrder?>(
              future: FirestoreService().getActiveOrder(),
              builder: (context, orderSnap) {
                if (orderSnap.connectionState == ConnectionState.waiting) {
                  return const Scaffold(
                    body: Center(child: CircularProgressIndicator(color: Color(0xFFFBBF24))),
                  );
                }

                final activeOrder = orderSnap.data;
                if (activeOrder == null) {
                  return Scaffold(
                    body: Center(
                      child: Text('No hay orden activa en este momento', style: TextStyle(color: Colors.white70)),
                    ),
                  );
                }

                return OrderDetailScreen(
                  orderId: activeOrder.id,
                  isAdmin: isAdmin,
                  currentUserEmail: user.email ?? '',
                );
              },
            );
          },
        );
      },
    );
  }
}
`;

fs.writeFileSync(path.join(libDir, 'main.dart'), mainContent, 'utf-8');

console.log('Main, pubspec, models and readme written successfully.');
