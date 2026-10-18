import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/purchases_models.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // ==========================================
  // ÓRDENES (purchase_orders)
  // ==========================================

  Future<String?> getActiveOrderId() async {
    final snapshot = await _db
        .collection('purchase_orders')
        .where('status', isEqualTo: 'active')
        .limit(1)
        .get();
    if (snapshot.docs.isEmpty) return null;
    return snapshot.docs.first.id;
  }

  Stream<List<PurchaseOrder>> getAllOrders() {
    return _db
        .collection('purchase_orders')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map((doc) => PurchaseOrder.fromFirestore(doc)).toList());
  }

  Stream<PurchaseOrder?> getOrderStream(String orderId) {
    return _db.collection('purchase_orders').doc(orderId).snapshots().map((doc) {
      if (!doc.exists) return null;
      return PurchaseOrder.fromFirestore(doc);
    });
  }

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

  Future<void> updateOrderStatus(String orderId, String newStatus) async {
    await _db.collection('purchase_orders').doc(orderId).update({
      'status': newStatus,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateShippingCost(String orderId, double cost) async {
    await _db.collection('purchase_orders').doc(orderId).update({
      'shippingCost': cost,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  // ==========================================
  // ITEMS CON REGLA DE UPSERT (§5.10 / §8.3)
  // ==========================================

  Stream<List<OrderItem>> getOrderItemsStream(String orderId) {
    return _db
        .collection('purchase_orders')
        .doc(orderId)
        .collection('items')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map((doc) => OrderItem.fromFirestore(doc)).toList());
  }

  Future<void> addOrUpsertOrderItem({
    required String orderId,
    required String buyerEmail,
    required String buyerName,
    required String cardName,
    required String edition,
    required String condition,
    required bool foil,
    required double price,
    required int quantityToAdd,
    required String imageUrl,
    required String pageUrl,
    String productId = '',
  }) async {
    final itemsCol = _db.collection('purchase_orders').doc(orderId).collection('items');

    final existingQuery = await itemsCol
        .where('buyerEmail', isEqualTo: buyerEmail)
        .where('cardName', isEqualTo: cardName)
        .where('edition', isEqualTo: edition)
        .where('condition', isEqualTo: condition)
        .where('foil', isEqualTo: foil)
        .limit(1)
        .get();

    if (existingQuery.docs.isNotEmpty) {
      final doc = existingQuery.docs.first;
      final currentQty = (doc.data()['quantity'] as num?)?.toInt() ?? 1;
      await doc.reference.update({
        'quantity': currentQty + quantityToAdd,
        'price': price,
        'lastCheckedAt': FieldValue.serverTimestamp(),
      });
    } else {
      await itemsCol.add({
        'buyerEmail': buyerEmail,
        'buyerName': buyerName,
        'cardName': cardName,
        'edition': edition,
        'condition': condition,
        'foil': foil,
        'price': price,
        'quantity': quantityToAdd,
        'imageUrl': imageUrl,
        'pageUrl': pageUrl,
        'productId': productId,
        'inStock': true,
        'availableQty': 1,
        'createdAt': FieldValue.serverTimestamp(),
        'lastCheckedAt': FieldValue.serverTimestamp(),
      });
    }
  }

  Future<void> updateItemPriceAndStock({
    required String orderId,
    required String itemId,
    required double newPrice,
    required bool inStock,
    required int availableQty,
  }) async {
    await _db.collection('purchase_orders').doc(orderId).collection('items').doc(itemId).update({
      'price': newPrice,
      'inStock': inStock,
      'availableQty': availableQty,
      'refreshStatus': 'ok',
      'lastCheckedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> deleteOrderItem(String orderId, String itemId) async {
    await _db.collection('purchase_orders').doc(orderId).collection('items').doc(itemId).delete();
  }

  // ==========================================
  // PAGOS / ABONOS (payments)
  // ==========================================

  Stream<List<Payment>> getOrderPaymentsStream(String orderId) {
    return _db
        .collection('purchase_orders')
        .doc(orderId)
        .collection('payments')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map((doc) => Payment.fromFirestore(doc)).toList());
  }

  Future<void> addPayment({
    required String orderId,
    required String buyerEmail,
    required double amount,
    required String type,
    String note = '',
    String registeredBy = '',
  }) async {
    await _db.collection('purchase_orders').doc(orderId).collection('payments').add({
      'orderId': orderId,
      'buyerEmail': buyerEmail,
      'amount': amount,
      'type': type,
      'note': note,
      'registeredBy': registeredBy,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> deletePayment(String orderId, String paymentId) async {
    await _db.collection('purchase_orders').doc(orderId).collection('payments').doc(paymentId).delete();
  }

  // ==========================================
  // USUARIOS Y SALDOS (§1.1, §3.2, §5.8)
  // ==========================================

  Stream<List<UserProfile>> getUsersStream() {
    return _db
        .collection('users')
        .orderBy('displayName')
        .snapshots()
        .map((snap) => snap.docs.map((doc) => UserProfile.fromFirestore(doc)).toList());
  }

  Future<void> confirmUser(String uid) async {
    await _db.collection('users').doc(uid).update({
      'status': 'confirmed',
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateUserRole(String uid, String newRole) async {
    await _db.collection('users').doc(uid).update({
      'role': newRole,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Stream<List<BalanceMovement>> getUserMovementsStream(String email) {
    return _db
        .collection('balance_movements')
        .where('email', isEqualTo: email)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map((doc) => BalanceMovement.fromFirestore(doc)).toList());
  }

  Future<void> addBalanceMovement({
    required String userUid,
    required String userEmail,
    required double amount,
    required String type, // 'credit' | 'outflow'
    required String description,
    required String registeredBy,
    String? orderId,
  }) async {
    final userRef = _db.collection('users').doc(userUid);
    final movementRef = _db.collection('balance_movements').doc();

    await _db.runTransaction((transaction) async {
      final userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw Exception('El usuario no existe');
      }

      final currentBalance = (userDoc.data()?['balance'] as num?)?.toDouble() ?? 0.0;
      final newBalance = type == 'credit'
          ? (currentBalance + amount)
          : (currentBalance - amount);

      if (type == 'outflow' && newBalance < -0.001) {
        throw Exception('El monto supera el saldo disponible');
      }

      transaction.update(userRef, {
        'balance': max(0.0, newBalance),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      transaction.set(movementRef, {
        'email': userEmail,
        'type': type,
        'amount': amount,
        'description': description,
        'orderId': orderId,
        'registeredBy': registeredBy,
        'createdAt': FieldValue.serverTimestamp(),
      });
    });
  }
}
