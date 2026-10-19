import 'package:cloud_firestore/cloud_firestore.dart';

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

/// Movimiento de Saldo a Favor (§1.1, §5.8)
class BalanceMovement {
  final String id;
  final String email;
  final String type; // 'credit' | 'outflow'
  final double amount;
  final String description;
  final String? orderId;
  final String registeredBy;
  final DateTime createdAt;

  BalanceMovement({
    required this.id,
    required this.email,
    required this.type,
    required this.amount,
    required this.description,
    this.orderId,
    required this.registeredBy,
    required this.createdAt,
  });

  bool get isCredit => type == 'credit';

  factory BalanceMovement.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return BalanceMovement(
      id: doc.id,
      email: data['email'] ?? '',
      type: data['type'] ?? 'credit',
      amount: (data['amount'] is num) ? (data['amount'] as num).toDouble() : 0.0,
      description: data['description'] ?? '',
      orderId: data['orderId'],
      registeredBy: data['registeredBy'] ?? '',
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
      'type': type,
      'amount': amount,
      'description': description,
      if (orderId != null) 'orderId': orderId,
      'registeredBy': registeredBy,
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
      label: 'Vencida hace $abs día${abs == 1 ? "" : "s"}',
      urgency: 'overdue',
      days: diffDays,
    );
  } else if (diffDays == 0) {
    return OrderUrgency(label: 'Compra es hoy', urgency: 'today', days: 0);
  } else {
    return OrderUrgency(
      label: 'En $diffDays día${diffDays == 1 ? "" : "s"}',
      urgency: 'upcoming',
      days: diffDays,
    );
  }
}

/// Variación de Estado y Acabado de Carta Scrapeada (§5.2, §5.9)
class CardVariation {
  final String condition; // 'NM' | 'EX' | 'VG' | 'G'
  final double price;
  final int stock;
  final bool isFoil;

  CardVariation({
    required this.condition,
    required this.price,
    required this.stock,
    required this.isFoil,
  });

  bool get inStock => stock > 0;

  factory CardVariation.fromMap(Map<String, dynamic> map) {
    return CardVariation(
      condition: map['condition'] ?? 'NM',
      price: (map['price'] is num) ? (map['price'] as num).toDouble() : 0.0,
      stock: (map['stock'] is num) ? (map['stock'] as num).toInt() : 0,
      isFoil: map['isFoil'] == true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'condition': condition,
      'price': price,
      'stock': stock,
      'isFoil': isFoil,
    };
  }
}

/// Carta Scrapeada desde Card Kingdom (§5.2, §5.9)
class ScrapedCKCard {
  final String title;
  final String setName;
  final String cardType;
  final String productId;
  final String imageUrl;
  final String url;
  final List<CardVariation> variations;

  ScrapedCKCard({
    required this.title,
    required this.setName,
    this.cardType = 'Magic: The Gathering',
    this.productId = '',
    this.imageUrl = '',
    required this.url,
    required this.variations,
  });

  factory ScrapedCKCard.fromMap(Map<String, dynamic> map) {
    final list = (map['variations'] as List<dynamic>?)
            ?.map((v) => CardVariation.fromMap(Map<String, dynamic>.from(v)))
            .toList() ??
        [];
    return ScrapedCKCard(
      title: map['title'] ?? map['cardName'] ?? map['name'] ?? '',
      setName: map['setName'] ?? map['edition'] ?? 'Card Kingdom',
      cardType: map['cardType'] ?? 'Magic: The Gathering',
      productId: map['productId']?.toString() ?? '',
      imageUrl: map['imageUrl'] ?? '',
      url: map['url'] ?? '',
      variations: list,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'title': title,
      'setName': setName,
      'cardType': cardType,
      'productId': productId,
      'imageUrl': imageUrl,
      'url': url,
      'variations': variations.map((v) => v.toMap()).toList(),
    };
  }
}
