import React, { useState } from 'react';
import { Copy, Check, Code2, Smartphone, Terminal, CheckCircle2, Database, ShieldCheck, ShoppingCart } from 'lucide-react';

export const FlutterCodeHub: React.FC = () => {
  const [activeFile, setActiveFile] = useState<string>('firestore_service');
  const [copied, setCopied] = useState<boolean>(false);

  const flutterFiles: Record<string, { title: string; filename: string; language: string; code: string; desc: string }> = {
    firestore_service: {
      title: 'FirestoreService & Reglas de Negocio',
      filename: 'lib/services/firestore_service.dart',
      language: 'dart',
      desc: 'Servicio central con todas las operaciones: órdenes, items con regla de upsert, pagos, saldos a favor por finalización y confirmación de usuarios.',
      code: `import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/purchases_models.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // ==========================================
  // ÓRDENES (purchase_orders)
  // ==========================================

  /// Obtiene la primera orden activa
  Future<String?> getActiveOrderId() async {
    final snapshot = await _db
        .collection('purchase_orders')
        .where('status', isEqualTo: 'active')
        .limit(1)
        .get();
    if (snapshot.docs.isEmpty) return null;
    return snapshot.docs.first.id;
  }

  /// Lista todas las órdenes ordenadas por fecha de creación desc
  Stream<List<PurchaseOrder>> getAllOrders() {
    return _db
        .collection('purchase_orders')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map((doc) => PurchaseOrder.fromFirestore(doc)).toList());
  }

  /// Crea una nueva orden (SIEMPRE nace en estado 'pending')
  Future<String> createOrder({DateTime? estimatedPurchaseDate}) async {
    final docRef = await _db.collection('purchase_orders').add({
      'status': 'pending',
      'estimatedPurchaseDate': estimatedPurchaseDate != null
          ? Timestamp.fromDate(estimatedPurchaseDate)
          : null,
      'shippingCost': null,
      'createdAt': FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  /// Actualiza estado de orden
  Future<void> updateOrderStatus(String orderId, String newStatus) async {
    await _db.collection('purchase_orders').doc(orderId).update({
      'status': newStatus,
    });
  }

  /// Define el costo total del courier/envío
  Future<void> updateOrderShippingCost(String orderId, double shippingCost) async {
    await _db.collection('purchase_orders').doc(orderId).update({
      'shippingCost': max(0.0, shippingCost),
    });
  }

  // ==========================================
  // FINALIZACIÓN DE ORDEN Y EXCEDENTES (§4 & §6.6)
  // ==========================================

  /// Finaliza una orden: calcula excedentes y acredita a los perfiles de usuario
  Future<List<Map<String, dynamic>>> finalizeOrder(String orderId) async {
    final orderDoc = await _db.collection('purchase_orders').doc(orderId).get();
    final shippingCost = (orderDoc.data()?['shippingCost'] as num?)?.toDouble() ?? 0.0;

    final itemsSnap = await _db.collection('purchase_orders').doc(orderId).collection('items').get();
    final items = itemsSnap.docs.map((d) => OrderItem.fromFirestore(d)).toList();

    final paymentsSnap = await _db.collection('purchase_orders').doc(orderId).collection('payments').get();
    final payments = paymentsSnap.docs.map((d) => Payment.fromFirestore(d)).toList();

    final totalOrderCards = items.fold<int>(0, (sum, i) => sum + i.quantity);
    final buyers = items.map((i) => i.buyerEmail.toLowerCase()).toSet();

    final surplusResults = <Map<String, dynamic>>[];

    for (final email in buyers) {
      final buyerItems = items.where((i) => i.buyerEmail.toLowerCase() == email).toList();
      final buyerCards = buyerItems.fold<int>(0, (sum, i) => sum + i.quantity);
      final userAmount = buyerItems.fold<double>(0.0, (sum, i) => sum + (i.price * i.quantity));

      final buyerPayments = payments.where((p) => p.buyerEmail.toLowerCase() == email).toList();
      final cardsPaid = buyerPayments.where((p) => p.type == 'cards').fold<double>(0.0, (sum, p) => sum + p.amount);
      final shippingPaid = buyerPayments.where((p) => p.type == 'shipping').fold<double>(0.0, (sum, p) => sum + p.amount);

      final shippingShare = totalOrderCards > 0 ? (shippingCost / totalOrderCards) * buyerCards : 0.0;

      final cardsSurplus = cardsPaid - userAmount;
      final shippingSurplus = shippingPaid - shippingShare;
      final totalSurplus = max(cardsSurplus, 0.0) + max(shippingSurplus, 0.0);

      // Solo saldos positivos generan crédito (§6.6)
      if (totalSurplus > 0) {
        final userQuery = await _db.collection('users').where('email', isEqualTo: email).limit(1).get();
        if (userQuery.docs.isNotEmpty) {
          final userDoc = userQuery.docs.first;
          await userDoc.reference.update({
            'balance': FieldValue.increment(totalSurplus),
          });

          await _db.collection('balance_movements').add({
            'email': email,
            'type': 'credit',
            'amount': totalSurplus,
            'description': 'Saldo a favor por finalizar orden',
            'orderId': orderId,
            'registeredBy': '',
            'createdAt': FieldValue.serverTimestamp(),
          });
        }
        surplusResults.add({'email': email, 'surplus': totalSurplus});
      }
    }

    await _db.collection('purchase_orders').doc(orderId).update({
      'status': 'finalized',
    });

    return surplusResults;
  }

  // ==========================================
  // ITEMS CON REGLA DE UPSERT (§2.8)
  // ==========================================

  /// Upsert: coincide buyerEmail + cardName + condition + foil
  Future<void> upsertItem({
    required String orderId,
    required OrderItem newItem,
  }) async {
    final itemsRef = _db.collection('purchase_orders').doc(orderId).collection('items');

    final existing = await itemsRef
        .where('buyerEmail', isEqualTo: newItem.buyerEmail)
        .where('cardName', isEqualTo: newItem.cardName)
        .where('condition', isEqualTo: newItem.condition)
        .where('foil', isEqualTo: newItem.foil)
        .limit(1)
        .get();

    if (existing.docs.isNotEmpty) {
      final doc = existing.docs.first;
      final currentQty = (doc.data()['quantity'] as num?)?.toInt() ?? 1;
      await doc.reference.update({
        'quantity': currentQty + newItem.quantity,
        'price': newItem.price,
        'pageUrl': newItem.pageUrl,
        'imageUrl': newItem.imageUrl,
        'productId': newItem.productId,
      });
    } else {
      await itemsRef.add(newItem.toMap());
    }
  }

  /// Vaciar carrito de un usuario específico (§3.3 & §5.3)
  Future<void> deleteUserItems(String orderId, String buyerEmail) async {
    final itemsRef = _db.collection('purchase_orders').doc(orderId).collection('items');
    final snap = await itemsRef.where('buyerEmail', isEqualTo: buyerEmail).get();
    for (final doc in snap.docs) {
      await doc.reference.delete();
    }
  }

  // ==========================================
  // USUARIOS & SALDO (§2.2 & §5.8)
  // ==========================================

  /// Confirma un usuario nuevo
  Future<void> confirmUser(String uid) async {
    await _db.collection('users').doc(uid).update({
      'status': 'confirmed',
    });
  }

  /// Agregar saldo (credit)
  Future<void> addBalance({
    required String email,
    required double amount,
    required String description,
    required String registeredBy,
  }) async {
    assert(amount > 0, 'El monto debe ser mayor a 0');
    assert(description.isNotEmpty, 'La descripción es obligatoria');

    final userQuery = await _db.collection('users').where('email', isEqualTo: email).limit(1).get();
    if (userQuery.docs.isEmpty) return;

    await userQuery.docs.first.reference.update({
      'balance': FieldValue.increment(amount),
    });

    await _db.collection('balance_movements').add({
      'email': email,
      'type': 'credit',
      'amount': amount,
      'description': description,
      'registeredBy': registeredBy,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  /// Registrar salida de saldo (outflow)
  Future<void> outflowBalance({
    required String email,
    required double amount,
    required String description,
    required String registeredBy,
  }) async {
    assert(amount > 0, 'El monto debe ser mayor a 0');
    assert(description.isNotEmpty, 'La descripción es obligatoria');

    final userQuery = await _db.collection('users').where('email', isEqualTo: email).limit(1).get();
    if (userQuery.docs.isEmpty) return;

    final currentBalance = (userQuery.docs.first.data()['balance'] as num?)?.toDouble() ?? 0.0;
    if (amount > currentBalance) throw Exception('No puede superar el saldo actual');

    await userQuery.docs.first.reference.update({
      'balance': FieldValue.increment(-amount),
    });

    await _db.collection('balance_movements').add({
      'email': email,
      'type': 'outflow',
      'amount': amount,
      'description': description,
      'registeredBy': registeredBy,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
`
    },
    models: {
      title: 'Modelos de Datos Firestore',
      filename: 'lib/models/purchases_models.dart',
      language: 'dart',
      desc: 'Clases Dart para UserProfile, PurchaseOrder, OrderItem, Payment, BalanceMovement y AppSettings según la especificación.',
      code: `import 'package:cloud_firestore/cloud_firestore.dart';

class UserProfile {
  final String uid;
  final String email;
  final String displayName;
  final String photoURL;
  final String role; // 'admin' | 'colaborador' | 'comprador'
  final String status; // 'unconfirmed' | 'confirmed'
  final double balance;
  final DateTime createdAt;

  UserProfile({
    required this.uid,
    required this.email,
    required this.displayName,
    this.photoURL = '',
    this.role = 'comprador',
    this.status = 'unconfirmed',
    this.balance = 0.0,
    required this.createdAt,
  });

  factory UserProfile.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return UserProfile(
      uid: doc.id,
      email: data['email'] ?? '',
      displayName: data['displayName'] ?? '',
      photoURL: data['photoURL'] ?? '',
      role: data['role'] ?? 'comprador',
      status: data['status'] ?? 'confirmed', // Fallback si no existe
      balance: (data['balance'] as num?)?.toDouble() ?? 0.0,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}

class PurchaseOrder {
  final String id;
  final String status; // 'pending' | 'active' | 'purchased' | 'finalized'
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
      estimatedPurchaseDate: (data['estimatedPurchaseDate'] as Timestamp?)?.toDate(),
      shippingCost: (data['shippingCost'] as num?)?.toDouble(),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}

class OrderItem {
  final String id;
  final String buyerEmail;
  final String buyerName;
  final String cardName;
  final String edition;
  final String cardType;
  final String imageUrl;
  final String pageUrl;
  final String productId;
  final bool foil;
  final String condition; // NM | EX | VG | G
  final double price;
  final int quantity;
  final bool inStock;
  final int availableQty;
  final String? refreshStatus; // null | 'ok' | 'error'
  final DateTime createdAt;
  final DateTime lastCheckedAt;

  OrderItem({
    required this.id,
    required this.buyerEmail,
    required this.buyerName,
    required this.cardName,
    required this.edition,
    required this.cardType,
    required this.imageUrl,
    required this.pageUrl,
    this.productId = '',
    this.foil = false,
    required this.condition,
    required this.price,
    required this.quantity,
    this.inStock = true,
    this.availableQty = 0,
    this.refreshStatus,
    required this.createdAt,
    required this.lastCheckedAt,
  });

  bool get needsPriceRefresh {
    if (pageUrl.isEmpty) return false;
    if (refreshStatus != 'ok') return true;
    final diff = DateTime.now().difference(lastCheckedAt);
    return diff.inHours >= 1;
  }

  Map<String, dynamic> toMap() {
    return {
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
    };
  }

  factory OrderItem.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return OrderItem(
      id: doc.id,
      buyerEmail: data['buyerEmail'] ?? '',
      buyerName: data['buyerName'] ?? '',
      cardName: data['cardName'] ?? '',
      edition: data['edition'] ?? '',
      cardType: data['cardType'] ?? '',
      imageUrl: data['imageUrl'] ?? '',
      pageUrl: data['pageUrl'] ?? '',
      productId: data['productId'] ?? '',
      foil: data['foil'] ?? false,
      condition: data['condition'] ?? 'NM',
      price: (data['price'] as num?)?.toDouble() ?? 0.0,
      quantity: (data['quantity'] as num?)?.toInt() ?? 1,
      inStock: data['inStock'] ?? true,
      availableQty: (data['availableQty'] as num?)?.toInt() ?? 0,
      refreshStatus: data['refreshStatus'],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      lastCheckedAt: (data['lastCheckedAt'] as Timestamp?)?.toDate() ?? DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

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
    this.note = '',
    this.registeredBy = '',
    this.type = 'cards',
    required this.createdAt,
  });

  factory Payment.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return Payment(
      id: doc.id,
      orderId: data['orderId'] ?? '',
      buyerEmail: data['buyerEmail'] ?? '',
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      note: data['note'] ?? '',
      registeredBy: data['registeredBy'] ?? '',
      type: data['type'] ?? 'cards',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
`
    },
    rescraper: {
      title: 'Servicio de Refresco de Precios & Throttling (§7.1)',
      filename: 'lib/services/price_rescraper_service.dart',
      language: 'dart',
      desc: 'Consulta Card Kingdom respetando el throttling de 5s entre llamadas y actualiza precio, stock y timestamp.',
      code: `import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:html/parser.dart' as html_parser;
import '../models/purchases_models.dart';

class RescrapeResult {
  final OrderItem item;
  final double currentPrice;
  final double delta;
  final bool inStock;
  final int stockCount;

  RescrapeResult({
    required this.item,
    required this.currentPrice,
    required this.delta,
    required this.inStock,
    required this.stockCount,
  });
}

class PriceRescraperService {
  /// Re-escanea items elegibles con cooldown y throttling de 5 segundos (§7.1)
  static Stream<RescrapeResult> rescrapeEligibleItems(
    List<OrderItem> items, {
    Duration delay = const Duration(seconds: 5),
  }) async* {
    final client = http.Client();

    try {
      for (final item in items) {
        if (!item.needsPriceRefresh) continue;

        try {
          final response = await client.get(
            Uri.parse(item.pageUrl),
            headers: {
              'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36',
            },
          );

          if (response.statusCode == 200) {
            final document = html_parser.parse(response.body);
            double foundPrice = item.price;
            bool inStock = true;
            int stockCount = 1;

            final rows = document.querySelectorAll('.itemQty, .styleList tr, .variation-row');
            for (final row in rows) {
              final text = row.text;
              if (text.toUpperCase().contains(item.condition.toUpperCase())) {
                final match = RegExp(r'\\$\\s*([0-9]+\\.[0-9]{2})').firstMatch(text);
                if (match != null) {
                  foundPrice = double.tryParse(match.group(1) ?? '') ?? item.price;
                }
                if (text.toLowerCase().contains('out of stock') || text.toLowerCase().contains('sold out')) {
                  inStock = false;
                  stockCount = 0;
                }
                break;
              }
            }

            final delta = double.parse((foundPrice - item.price).toStringAsFixed(2));

            yield RescrapeResult(
              item: item,
              currentPrice: foundPrice,
              delta: delta,
              inStock: inStock,
              stockCount: stockCount,
            );
          }
        } catch (_) {
          yield RescrapeResult(
            item: item,
            currentPrice: item.price,
            delta: 0.0,
            inStock: true,
            stockCount: 1,
          );
        }

        await Future.delayed(delay);
      }
    } finally {
      client.close();
    }
  }
}
`
    },
    pusher: {
      title: 'Lanzador 1 a 1 al Carrito Online de Card Kingdom (§5.10)',
      filename: 'lib/services/ck_cart_pusher.dart',
      language: 'dart',
      desc: 'Inyecta las cartas al carrito Laravel dentro del WebView de Card Kingdom con product_id, estilo y throttle de 5s.',
      code: `import 'dart:async';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/purchases_models.dart';

class CkCartPusher {
  /// Agrega cartas al carrito de Card Kingdom vía POST /api/cart/add en sesión autenticada
  static Future<void> pushItemsToCardKingdom({
    required WebViewController controller,
    required List<OrderItem> items,
    required Function(int current, int total, OrderItem item) onProgress,
    required Function(String error, OrderItem item) onError,
  }) async {
    final validItems = items.where((i) => i.productId.isNotEmpty).toList();

    for (int i = 0; i < validItems.length; i++) {
      final item = validItems[i];
      onProgress(i + 1, validItems.length, item);

      final jsCall = '''
        (async function() {
          try {
            const res = await fetch('/api/cart/add', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({
                product_id: '\${item.productId}',
                style: '\${item.condition}',
                quantity: \${item.quantity}
              })
            });
            return await res.json();
          } catch(e) {
            return { error: e.toString() };
          }
        })();
      ''';

      try {
        await controller.runJavaScript(jsCall);
      } catch (e) {
        onError(e.toString(), item);
      }

      // Throttle de 5 segundos entre agregados (§9)
      await Future.delayed(const Duration(seconds: 5));
    }
  }
}
`
    },
    rules: {
      title: 'Reglas de Seguridad Firestore',
      filename: 'firestore.rules',
      language: 'javascript',
      desc: 'Reglas de seguridad para las colecciones users, purchase_orders, balance_movements y app_settings.',
      code: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isConfirmed() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.status == 'confirmed';
    }

    // Perfiles de usuario
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAdmin() || (isAuthenticated() && request.auth.uid == userId && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status', 'balance']));
      allow delete: if isAdmin();
    }

    // Órdenes de compra y subcolecciones
    match /purchase_orders/{orderId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
      
      // Items dentro de la orden
      match /items/{itemId} {
        allow read: if isAuthenticated();
        allow create, update: if isConfirmed() && resource.data.status != 'finalized';
        allow delete: if (isAdmin() || (isAuthenticated() && resource.data.buyerEmail == request.auth.token.email)) && resource.data.status != 'finalized';
      }

      // Abonos (pagos)
      match /payments/{paymentId} {
        allow read: if isAuthenticated();
        allow write: if isAdmin() && get(/databases/$(database)/documents/purchase_orders/$(orderId)).data.status != 'finalized';
      }
    }

    // Movimientos de saldo
    match /balance_movements/{movementId} {
      allow read: if isAuthenticated() && (isAdmin() || resource.data.email == request.auth.token.email);
      allow write: if isAdmin();
    }

    // Ajustes globales
    match /app_settings/{document} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
`
    }
  };

  const currentFile = flutterFiles[activeFile] || flutterFiles['firestore_service'];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Intro info */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-3 py-1 rounded-full mb-3">
            <Smartphone className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">PurchasesManabros · Arquitectura Flutter & Dart</span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Repositorio de Código Flutter & Firebase
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Código fuente compilado y adaptado según la especificación funcional oficial: reglas de upsert, FirestoreService, rescraper con throttling de 5s, pusher al WebView de Card Kingdom y reglas de seguridad.
          </p>
        </div>

        <button
          onClick={copyToClipboard}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-xl transition-colors shadow-sm shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '¡Copiado!' : 'Copiar Archivo Actual'}</span>
        </button>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#30363D]">
        {Object.entries(flutterFiles).map(([key, f]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveFile(key)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeFile === key
                ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                : 'bg-[#161B22] text-slate-400 hover:text-white border border-[#30363D]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{f.title}</span>
          </button>
        ))}
      </div>

      {/* Code Editor Preview */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-white">{currentFile.filename}</span>
          </div>
          <span className="text-xs text-slate-400">{currentFile.desc}</span>
        </div>

        <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[600px] overflow-y-auto">
          <code>{currentFile.code}</code>
        </pre>
      </div>

    </div>
  );
};
