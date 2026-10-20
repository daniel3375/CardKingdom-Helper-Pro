import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';
import '../services/price_rescraper_service.dart';
import '../widgets/buyer_breakdown_card.dart';
import '../widgets/shipping_management_card.dart';
import '../widgets/order_payments_modal.dart';
import '../widgets/register_payment_dialog.dart';
import '../widgets/price_rescraper_dialog.dart';
import '../widgets/one_by_one_cart_pusher_dialog.dart';
import 'ck_webview_screen.dart';

/// Pantalla Principal del Detalle de Orden Activa (§5.1, §5.2, §5.3)
class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  final bool isAdmin;
  final String currentUserEmail;

  const OrderDetailScreen({
    super.key,
    required this.orderId,
    required this.isAdmin,
    required this.currentUserEmail,
  });

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen>
    with SingleTickerProviderStateMixin {
  final FirestoreService _firestore = FirestoreService();
  late TabController _tabController;
  bool _isRescraping = false;
  int _rescrapeProgress = 0;
  int _rescrapeTotal = 0;

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
    return StreamBuilder<PurchaseOrder?>(
      stream: _firestore.getOrderStream(widget.orderId),
      builder: (context, orderSnapshot) {
        if (orderSnapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Color(0xFF0D1117),
            body: Center(child: CircularProgressIndicator(color: Color(0xFFFBBF24))),
          );
        }

        final order = orderSnapshot.data;
        if (order == null) {
          return Scaffold(
            backgroundColor: const Color(0xFF0D1117),
            appBar: AppBar(title: const Text('Orden no encontrada')),
            body: const Center(child: Text('No existe la orden solicitada', style: TextStyle(color: Colors.white70))),
          );
        }

        return StreamBuilder<List<OrderItem>>(
          stream: _firestore.getOrderItemsStream(widget.orderId),
          builder: (context, itemsSnapshot) {
            final items = itemsSnapshot.data ?? [];

            return StreamBuilder<List<Payment>>(
              stream: _firestore.getOrderPaymentsStream(widget.orderId),
              builder: (context, paymentsSnapshot) {
                final payments = paymentsSnapshot.data ?? [];

                // Cálculos de Orden
                final totalCards = items.fold<int>(0, (sum, i) => sum + i.quantity);
                final totalCardsAmount = items.fold<double>(0.0, (sum, i) => sum + (i.price * i.quantity));
                final shippingCost = order.shippingCost ?? 0.0;
                final grandTotal = totalCardsAmount + shippingCost;
                final totalPaid = payments.fold<double>(0.0, (sum, p) => sum + p.amount);
                final paymentProgress = grandTotal > 0 ? (totalPaid / grandTotal).clamp(0.0, 1.0) : 0.0;

                // Agrupación por comprador
                final Map<String, List<OrderItem>> buyerItemsMap = {};
                for (final item in items) {
                  buyerItemsMap.putIfAbsent(item.buyerEmail, () => []).add(item);
                }

                return Scaffold(
                  backgroundColor: const Color(0xFF0D1117),
                  appBar: AppBar(
                    backgroundColor: const Color(0xFF161B22),
                    elevation: 0,
                    title: Row(
                      children: [
                        Text(
                          'ORDEN \${order.id.substring(0, order.id.length > 8 ? 8 : order.id.length).toUpperCase()}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 0.5),
                        ),
                        const SizedBox(width: 8),
                        _buildStatusBadge(order.status),
                      ],
                    ),
                    actions: [
                      if (widget.isAdmin) ...[
                        IconButton(
                          icon: const Icon(Icons.price_change_outlined, color: Color(0xFFFBBF24)),
                          tooltip: 'Actualizar Precios CK (§5.9)',
                          onPressed: () => _triggerPriceRescrape(items),
                        ),
                        IconButton(
                          icon: const Icon(Icons.play_circle_fill_rounded, color: Color(0xFF38BDF8)),
                          tooltip: 'Lanzador 1 a 1 a Card Kingdom (§5.10)',
                          onPressed: () => _triggerCartPusher(items),
                        ),
                        IconButton(
                          icon: const Icon(Icons.payments_rounded, color: Color(0xFF34D399)),
                          tooltip: 'Gestión de Abonos',
                          onPressed: () => _openPaymentsModal(context, order, items, payments),
                        ),
                      ],
                    ],
                    bottom: TabBar(
                      controller: _tabController,
                      indicatorColor: const Color(0xFFFBBF24),
                      indicatorWeight: 3,
                      labelColor: const Color(0xFFFBBF24),
                      unselectedLabelColor: const Color(0xFF8B949E),
                      tabs: const [
                        Tab(text: 'Compradores'),
                        Tab(text: 'Cartas'),
                        Tab(text: 'Flete / Envío'),
                        Tab(text: 'Resumen'),
                      ],
                    ),
                  ),
                  body: Column(
                    children: [
                      // Banner de Estado y Progreso Financiero
                      _buildFinancialSummaryBar(
                        totalCards: totalCards,
                        totalAmount: grandTotal,
                        totalPaid: totalPaid,
                        progress: paymentProgress,
                        status: order.status,
                      ),

                      // Re-scrape status banner si está activo
                      if (_isRescraping)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          color: const Color(0xFF1E3A8A),
                          child: Row(
                            children: [
                              const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                'Re-escaneando precios en Card Kingdom ($_rescrapeProgress / $_rescrapeTotal)...',
                                style: const TextStyle(fontSize: 12, color: Colors.white),
                              ),
                            ],
                          ),
                        ),

                      // Contenido de Tabs
                      Expanded(
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            // Tab 1: Compradores
                            _buildBuyersTab(buyerItemsMap, payments, shippingCost, totalCardsAmount, order.status),

                            // Tab 2: Cartas Consolidadas
                            _buildConsolidatedCardsTab(items, order.status),

                            // Tab 3: Envíos y Tracking
                            ShippingManagementCard(
                              order: order,
                              isAdmin: widget.isAdmin,
                              totalCardsAmount: totalCardsAmount,
                            ),

                            // Tab 4: Resumen Global
                            _buildGlobalSummaryTab(order, items, payments, totalCards, totalCardsAmount, shippingCost),
                          ],
                        ),
                      ),
                    ],
                  ),
                  // Barra flotante inferior para Admin
                  bottomNavigationBar: widget.isAdmin ? _buildAdminActionBar(order, items) : null,
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildFinancialSummaryBar({
    required int totalCards,
    required double totalAmount,
    required double totalPaid,
    required double progress,
    required String status,
  }) {
    final bool isCovered = totalPaid >= totalAmount && totalAmount > 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Consolidado', style: TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                  Text(
                    '$\${totalAmount.toStringAsFixed(2)} USD',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'monospace'),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Abonado: $\${totalPaid.toStringAsFixed(2)} USD',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isCovered ? const Color(0xFF34D399) : const Color(0xFFFBBF24))),
                  Text(
                    'Faltante: $\${(totalAmount - totalPaid > 0 ? totalAmount - totalPaid : 0.0).toStringAsFixed(2)} USD',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: const Color(0xFF21262D),
              valueColor: AlwaysStoppedAnimation<Color>(
                isCovered ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBuyersTab(
    Map<String, List<OrderItem>> buyerItemsMap,
    List<Payment> payments,
    double globalShippingCost,
    double totalCardsAmount,
    String orderStatus,
  ) {
    if (buyerItemsMap.isEmpty) {
      return const Center(
        child: Text('No hay cartas añadidas a esta orden aún.', style: TextStyle(color: Color(0xFF8B949E))),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: buyerItemsMap.entries.map((entry) {
        final buyerEmail = entry.key;
        final items = entry.value;
        final buyerName = items.first.buyerName;

        // Subtotal de cartas del comprador
        final buyerCardsTotal = items.fold<double>(0.0, (sum, i) => sum + (i.price * i.quantity));

        // Cuota proporcional de envío (§5.6)
        final shippingShare = totalCardsAmount > 0
            ? (buyerCardsTotal / totalCardsAmount) * globalShippingCost
            : 0.0;

        // Pagos asignados a este comprador
        final buyerPayments = payments.where((p) => p.buyerEmail == buyerEmail).toList();
        final paidCards = buyerPayments.where((p) => p.type == 'cards').fold<double>(0.0, (s, p) => s + p.amount);
        final paidShipping = buyerPayments.where((p) => p.type == 'shipping').fold<double>(0.0, (s, p) => s + p.amount);

        return BuyerBreakdownCard(
          buyerEmail: buyerEmail,
          buyerName: buyerName,
          items: items,
          cardsTotal: buyerCardsTotal,
          shippingShare: shippingShare,
          paidCards: paidCards,
          paidShipping: paidShipping,
          orderStatus: orderStatus,
          canEdit: widget.isAdmin || widget.currentUserEmail == buyerEmail,
          onQuickPayment: widget.isAdmin
              ? () => _openQuickPaymentDialog(buyerEmail, buyerName, buyerCardsTotal - paidCards)
              : null,
          onDeleteItem: (itemId) => _firestore.deleteOrderItem(widget.orderId, itemId),
        );
      }).toList(),
    );
  }

  Widget _buildConsolidatedCardsTab(List<OrderItem> items, String orderStatus) {
    if (items.isEmpty) {
      return const Center(child: Text('No hay cartas registradas.', style: TextStyle(color: Color(0xFF8B949E))));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = items[index];
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF161B22),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: item.imageUrl.isNotEmpty
                    ? Image.network(item.imageUrl, width: 44, height: 60, fit: BoxFit.cover)
                    : Container(width: 44, height: 60, color: const Color(0xFF21262D), child: const Icon(Icons.style, color: Colors.white24)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.cardName, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text('\${item.edition} · \${item.condition} \${item.foil ? "• FOIL" : ""}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                    const SizedBox(height: 4),
                    Text('Comprador: \${item.buyerName}', style: const TextStyle(fontSize: 11, color: Color(0xFF58A6FF))),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('\${item.quantity}x $\${item.price.toStringAsFixed(2)}',
                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 2),
                  Text('$\${(item.price * item.quantity).toStringAsFixed(2)} USD',
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Color(0xFF34D399))),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildGlobalSummaryTab(
    PurchaseOrder order,
    List<OrderItem> items,
    List<Payment> payments,
    int totalCards,
    double totalCardsAmount,
    double shippingCost,
  ) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF161B22),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Column(
              children: [
                _buildSummaryRow('Estado de la Orden', order.status.toUpperCase()),
                _buildSummaryRow('Fecha de Creación', DateFormat('dd/MM/yyyy HH:mm').format(order.createdAt)),
                _buildSummaryRow('Total Cartas', '$totalCards unidades'),
                _buildSummaryRow('Subtotal Cartas', '$\${totalCardsAmount.toStringAsFixed(2)} USD'),
                _buildSummaryRow('Costo de Envío Global', '$\${shippingCost.toStringAsFixed(2)} USD'),
                const Divider(color: Color(0xFF30363D), height: 24),
                _buildSummaryRow('TOTAL GLOBAL A PAGAR', '$\${(totalCardsAmount + shippingCost).toStringAsFixed(2)} USD', isBold: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: const Color(0xFF8B949E), fontSize: 13, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
          Text(value, style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: isBold ? FontWeight.bold : FontWeight.w600, fontFamily: 'monospace')),
        ],
      ),
    );
  }

  Widget _buildAdminActionBar(PurchaseOrder order, List<OrderItem> items) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        border: Border(top: BorderSide(color: Color(0xFF30363D))),
      ),
      child: Row(
        children: [
          // Botón Re-escanear Precios
          Expanded(
            child: OutlinedButton.icon(
              icon: const Icon(Icons.sync_rounded, size: 16),
              label: const Text('Actualizar Precios', style: TextStyle(fontSize: 12)),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF58A6FF),
                side: const BorderSide(color: Color(0xFF30363D)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: _isRescraping ? null : () => _triggerPriceRescrape(items),
            ),
          ),
          const SizedBox(width: 8),

          // Botón Cambiar Estado Orden
          Expanded(
            child: ElevatedButton.icon(
              icon: const Icon(Icons.swap_horiz_rounded, size: 16),
              label: Text(_getNextStatusLabel(order.status), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFBBF24),
                foregroundColor: const Color(0xFF0D1117),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: () => _advanceOrderStatus(order),
            ),
          ),
        ],
      ),
    );
  }

  String _getNextStatusLabel(String current) {
    switch (current) {
      case 'pending': return 'Activar Orden';
      case 'active': return 'Marcar Comprada';
      case 'purchased': return 'Finalizar Orden';
      default: return 'Finalizada';
    }
  }

  Future<void> _advanceOrderStatus(PurchaseOrder order) async {
    String nextStatus;
    if (order.status == 'pending') nextStatus = 'active';
    else if (order.status == 'active') nextStatus = 'purchased';
    else if (order.status == 'purchased') nextStatus = 'finalized';
    else return;

    await _firestore.updateOrderStatus(order.id, nextStatus);
  }

  void _triggerPriceRescrape(List<OrderItem> items) {
    PriceRescraperDialog.show(
      context,
      orderId: widget.orderId,
      items: items,
      onProceedToCartPusher: () {
        _triggerCartPusher(items);
      },
    );
  }

  void _triggerCartPusher(List<OrderItem> items) {
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFEF4444),
          content: Text('No hay cartas en la orden para lanzar al carrito.'),
        ),
      );
      return;
    }

    OneByOneCartPusherDialog.show(
      context,
      orderId: widget.orderId,
      items: items,
      onOpenCart: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => CkWebViewScreen(
              activeOrderId: widget.orderId,
              currentUserEmail: widget.currentUserEmail,
              currentUserName: '',
              isAdmin: widget.isAdmin,
              initialUrl: 'https://www.cardkingdom.com/cart',
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatusBadge(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: status == 'active' ? const Color(0xFF064E3B) : const Color(0xFF21262D),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: status == 'active' ? const Color(0xFF10B981) : const Color(0xFF30363D)),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: status == 'active' ? const Color(0xFF34D399) : const Color(0xFF8B949E)),
      ),
    );
  }

  void _openPaymentsModal(BuildContext context, PurchaseOrder order, List<OrderItem> items, List<Payment> payments) {
    showModalBottomSheet(
      context: context,
      isScrollController: true,
      backgroundColor: Colors.transparent,
      builder: (_) => OrderPaymentsModal(orderId: widget.orderId, order: order, items: items, payments: payments),
    );
  }

  void _openQuickPaymentDialog(String email, String name, double suggested) {
    RegisterPaymentDialog.show(
      context,
      orderId: widget.orderId,
      buyerEmail: email,
      buyerName: name,
      initialType: 'cards',
      suggestedAmount: suggested > 0 ? suggested : null,
      currentUserEmail: widget.currentUserEmail,
    );
  }
}
