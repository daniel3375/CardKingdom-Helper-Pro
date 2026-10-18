import 'package:flutter/material.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';
import '../widgets/order_card.dart';
import 'order_detail_screen.dart';

/// Pantalla de Historial de Órdenes de Compra (§5.4)
class OrdersHistoryScreen extends StatefulWidget {
  final bool isAdmin;
  final String currentUserEmail;

  const OrdersHistoryScreen({
    super.key,
    required this.isAdmin,
    required this.currentUserEmail,
  });

  @override
  State<OrdersHistoryScreen> createState() => _OrdersHistoryScreenState();
}

class _OrdersHistoryScreenState extends State<OrdersHistoryScreen>
    with SingleTickerProviderStateMixin {
  final FirestoreService _firestore = FirestoreService();
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        elevation: 0,
        title: const Text('Historial de Órdenes', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          if (widget.isAdmin)
            IconButton(
              icon: const Icon(Icons.add_circle_outline, color: Color(0xFFFBBF24)),
              tooltip: 'Nueva Orden',
              onPressed: () => _showCreateOrderDialog(context),
            ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFFBBF24),
          indicatorWeight: 3,
          labelColor: const Color(0xFFFBBF24),
          unselectedLabelColor: const Color(0xFF8B949E),
          isScrollable: true,
          tabs: const [
            Tab(text: 'Activas'),
            Tab(text: 'Pendientes'),
            Tab(text: 'Compradas'),
            Tab(text: 'Finalizadas'),
          ],
        ),
      ),
      body: StreamBuilder<List<PurchaseOrder>>(
        stream: _firestore.getAllOrders(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFFFBBF24)));
          }

          final allOrders = snapshot.data ?? [];

          return TabBarView(
            controller: _tabController,
            children: [
              _buildOrdersList(allOrders.where((o) => o.status == 'active').toList()),
              _buildOrdersList(allOrders.where((o) => o.status == 'pending').toList()),
              _buildOrdersList(allOrders.where((o) => o.status == 'purchased').toList()),
              _buildOrdersList(allOrders.where((o) => o.status == 'finalized').toList()),
            ],
          );
        },
      ),
    );
  }

  Widget _buildOrdersList(List<PurchaseOrder> orders) {
    if (orders.isEmpty) {
      return const Center(
        child: Text('No hay órdenes en esta categoría.', style: TextStyle(color: Color(0xFF8B949E))),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final order = orders[index];

        return StreamBuilder<List<OrderItem>>(
          stream: _firestore.getOrderItemsStream(order.id),
          builder: (context, itemsSnap) {
            final items = itemsSnap.data ?? [];
            final totalCards = items.fold<int>(0, (s, i) => s + i.quantity);
            final totalAmount = items.fold<double>(0.0, (s, i) => s + (i.price * i.quantity)) +
                (order.shippingCost ?? 0.0);

            return PurchaseOrderCard(
              order: order,
              totalCards: totalCards,
              totalAmount: totalAmount,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => OrderDetailScreen(
                      orderId: order.id,
                      isAdmin: widget.isAdmin,
                      currentUserEmail: widget.currentUserEmail,
                    ),
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  void _showCreateOrderDialog(BuildContext context) {
    DateTime? selectedDate;

    showDialog(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF161B22),
          title: const Text('Crear Nueva Orden (§5.4)', style: TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Toda orden nueva se crea en estado Pendiente. Podrás activarla cuando esté lista para recibir cartas.',
                style: TextStyle(fontSize: 12, color: Color(0xFF8B949E)),
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today, color: Color(0xFFFBBF24)),
                title: Text(
                  selectedDate == null ? 'Fecha estimada de compra' : '\${selectedDate!.day}/\${selectedDate!.month}/\${selectedDate!.year}',
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
                trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.white54),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now().add(const Duration(days: 7)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 90)),
                  );
                  if (picked != null) {
                    setDialogState(() => selectedDate = picked);
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: const Text('Cancelar', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFBBF24), foregroundColor: const Color(0xFF0D1117)),
              onPressed: () async {
                await _firestore.createOrder(estimatedPurchaseDate: selectedDate);
                if (dialogCtx.mounted) Navigator.of(dialogCtx).pop();
              },
              child: const Text('Crear Orden', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
