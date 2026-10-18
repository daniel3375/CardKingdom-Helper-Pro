import React, { useState } from 'react';
import { Copy, Check, Code2, Smartphone, Terminal, Layers, Box, Monitor, ShieldCheck, Search, Download, FolderArchive } from 'lucide-react';

interface FlutterFileItem {
  title: string;
  filename: string;
  language: string;
  category: 'widgets' | 'screens' | 'services' | 'rules';
  desc: string;
  code: string;
}

export const FlutterCodeHub: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'widgets' | 'screens' | 'services' | 'rules'>('all');
  const [activeFile, setActiveFile] = useState<string>('order_detail_screen');
  const [copied, setCopied] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const flutterFiles: Record<string, FlutterFileItem> = {
    // ==========================================
    // PANTALLAS (SCREENS)
    // ==========================================
    order_detail_screen: {
      title: 'Screen: Detalle de Orden Activa (§5.1, §5.2)',
      filename: 'lib/screens/order_detail_screen.dart',
      language: 'dart',
      category: 'screens',
      desc: 'Pantalla principal de la orden activa: banner, progress bar de abonos/cartas, tabs (Compradores, Cartas Consolidadas, Envíos, Resumen), re-scaneo de precios y acciones de estado.',
      code: `import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';
import '../services/price_rescraper_service.dart';
import '../widgets/buyer_breakdown_card.dart';
import '../widgets/shipping_management_card.dart';
import '../widgets/order_payments_modal.dart';
import '../widgets/register_payment_dialog.dart';

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
                          'ORDEN \\\${order.id.substring(0, order.id.length > 8 ? 8 : order.id.length).toUpperCase()}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 0.5),
                        ),
                        const SizedBox(width: 8),
                        _buildStatusBadge(order.status),
                      ],
                    ),
                    actions: [
                      if (widget.isAdmin)
                        IconButton(
                          icon: const Icon(Icons.payments_rounded, color: Color(0xFF34D399)),
                          tooltip: 'Gestión de Abonos',
                          onPressed: () => _openPaymentsModal(context, order, items, payments),
                        ),
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
                                'Re-escaneando precios en Card Kingdom (\\$_rescrapeProgress / \\$_rescrapeTotal)...',
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
                    '\\\\$\\\${totalAmount.toStringAsFixed(2)} USD',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'monospace'),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Abonado: \\\\$\\\${totalPaid.toStringAsFixed(2)} USD',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isCovered ? const Color(0xFF34D399) : const Color(0xFFFBBF24))),
                  Text(
                    'Faltante: \\\\$\\\${(totalAmount - totalPaid > 0 ? totalAmount - totalPaid : 0.0).toStringAsFixed(2)} USD',
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
                    Text('\\\${item.edition} · \\\${item.condition} \\\${item.foil ? "• FOIL" : ""}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                    const SizedBox(height: 4),
                    Text('Comprador: \\\${item.buyerName}', style: const TextStyle(fontSize: 11, color: Color(0xFF58A6FF))),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('\\\${item.quantity}x \\\\$\\\${item.price.toStringAsFixed(2)}',
                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 2),
                  Text('\\\\$\\\${(item.price * item.quantity).toStringAsFixed(2)} USD',
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
                _buildSummaryRow('Total Cartas', '\\$totalCards unidades'),
                _buildSummaryRow('Subtotal Cartas', '\\\\$\\\${totalCardsAmount.toStringAsFixed(2)} USD'),
                _buildSummaryRow('Costo de Envío Global', '\\\\$\\\${shippingCost.toStringAsFixed(2)} USD'),
                const Divider(color: Color(0xFF30363D), height: 24),
                _buildSummaryRow('TOTAL GLOBAL A PAGAR', '\\\\$\\\${(totalCardsAmount + shippingCost).toStringAsFixed(2)} USD', isBold: true),
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

  void _triggerPriceRescrape(List<OrderItem> items) async {
    setState(() {
      _isRescraping = true;
      _rescrapeProgress = 0;
      _rescrapeTotal = items.where((i) => i.needsPriceRefresh).length;
    });

    try {
      await for (final res in PriceRescraperService.rescrapeEligibleItems(items)) {
        await _firestore.updateItemPriceAndStock(
          orderId: widget.orderId,
          itemId: res.item.id,
          newPrice: res.currentPrice,
          inStock: res.inStock,
          availableQty: res.stockCount,
        );
        setState(() {
          _rescrapeProgress++;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isRescraping = false;
        });
      }
    }
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
`,
    },

    orders_history_screen: {
      title: 'Screen: Historial de Órdenes (§5.4)',
      filename: 'lib/screens/orders_history_screen.dart',
      language: 'dart',
      category: 'screens',
      desc: 'Pantalla de historial de órdenes con tabs (Activas, Pendientes, Compradas, Finalizadas), creación de nueva orden y navegación al detalle.',
      code: `import 'package:flutter/material.dart';
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
`,
    },

    mass_entry_screen: {
      title: 'Screen: Carga Masiva de Cartas (§5.11, §8.3)',
      filename: 'lib/screens/mass_entry_screen.dart',
      language: 'dart',
      category: 'screens',
      desc: 'Pantalla de importación masiva de listas en texto plano: regex parser de Card Kingdom, selección de condición por defecto y guardado con regla de upsert.',
      code: `import 'package:flutter/material.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';

/// Pantalla de Entrada Masiva de Cartas (§5.11, §8.3)
class MassEntryScreen extends StatefulWidget {
  final String orderId;
  final String currentUserEmail;
  final String currentUserName;

  const MassEntryScreen({
    super.key,
    required this.orderId,
    required this.currentUserEmail,
    required this.currentUserName,
  });

  @override
  State<MassEntryScreen> createState() => _MassEntryScreenState();
}

class _MassEntryScreenState extends State<MassEntryScreen> {
  final TextEditingController _textController = TextEditingController();
  final FirestoreService _firestore = FirestoreService();
  String _defaultCondition = 'NM';
  bool _isFoil = false;
  List<_ParsedCardLine> _parsedCards = [];
  bool _isSaving = false;

  // Regex para formato estándar: "4 Lightning Bolt [M25] NM $2.50" o "4 Sol Ring"
  static final RegExp _cardRegex = RegExp(
    r'^(\\d+)x?\\s+([^\\[\\$\\n]+)(?:\\[([^\\]]+)\\])?(?:\\s+(NM|EX|VG|G))?(?:\\s*\\$\\s*([0-9]+\\.[0-9]{2}))?',
    caseSensitive: false,
  );

  void _parseLines(String text) {
    final lines = text.split('\\n');
    final List<_ParsedCardLine> results = [];

    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.isEmpty) continue;

      final match = _cardRegex.firstMatch(trimmed);
      if (match != null) {
        final qty = int.tryParse(match.group(1) ?? '1') ?? 1;
        final name = match.group(2)?.trim() ?? '';
        final edition = match.group(3)?.trim() ?? 'CK';
        final condition = match.group(4)?.trim().toUpperCase() ?? _defaultCondition;
        final price = double.tryParse(match.group(5) ?? '') ?? 0.0;

        results.add(_ParsedCardLine(
          name: name,
          quantity: qty,
          edition: edition,
          condition: condition,
          price: price,
          foil: _isFoil,
        ));
      } else {
        // Fallback para nombres simples: "Sol Ring"
        results.add(_ParsedCardLine(
          name: trimmed,
          quantity: 1,
          edition: 'CK',
          condition: _defaultCondition,
          price: 0.0,
          foil: _isFoil,
        ));
      }
    }

    setState(() {
      _parsedCards = results;
    });
  }

  Future<void> _commitCardsToOrder() async {
    if (_parsedCards.isEmpty) return;

    setState(() => _isSaving = true);
    try {
      for (final card in _parsedCards) {
        await _firestore.addOrUpsertOrderItem(
          orderId: widget.orderId,
          buyerEmail: widget.currentUserEmail,
          buyerName: widget.currentUserName,
          cardName: card.name,
          edition: card.edition,
          condition: card.condition,
          foil: card.foil,
          price: card.price,
          quantityToAdd: card.quantity,
          imageUrl: '',
          pageUrl: '',
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text('\${_parsedCards.length} cartas agregadas a la orden exitosamente.'),
          ),
        );
        Navigator.of(context).pop();
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        elevation: 0,
        title: const Text('Carga Masiva de Cartas (§5.11)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Controles de Configuración Rápida
            Row(
              children: [
                const Text('Condición default:', style: TextStyle(color: Color(0xFF8B949E), fontSize: 12)),
                const SizedBox(width: 8),
                DropdownButton<String>(
                  value: _defaultCondition,
                  dropdownColor: const Color(0xFF161B22),
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  items: const ['NM', 'EX', 'VG', 'G'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _defaultCondition = val);
                  },
                ),
                const Spacer(),
                FilterChip(
                  label: const Text('FOIL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  selected: _isFoil,
                  selectedColor: const Color(0xFFFBBF24),
                  backgroundColor: const Color(0xFF21262D),
                  onSelected: (val) => setState(() => _isFoil = val),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Textarea para pegar listas
            Expanded(
              flex: 2,
              child: TextField(
                controller: _textController,
                maxLines: null,
                expands: true,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Pega aquí tu lista:\\n4 Lightning Bolt [M25] NM \$2.50\\n2 Counterspell [EMA]\\n1 Sol Ring',
                  hintStyle: const TextStyle(color: Colors.white24, fontSize: 12),
                  filled: true,
                  fillColor: const Color(0xFF161B22),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF30363D))),
                ),
                onChanged: _parseLines,
              ),
            ),
            const SizedBox(height: 12),

            // Vista Previa de Detección
            Text(
              'Vista Previa (\${_parsedCards.length} detectadas)',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 6),
            Expanded(
              flex: 2,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF161B22),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF30363D)),
                ),
                child: _parsedCards.isEmpty
                    ? const Center(child: Text('Escribe o pega una lista arriba', style: TextStyle(color: Color(0xFF8B949E), fontSize: 12)))
                    : ListView.separated(
                        itemCount: _parsedCards.length,
                        separatorBuilder: (_, __) => const Divider(color: Color(0xFF21262D), height: 1),
                        itemBuilder: (context, i) {
                          final c = _parsedCards[i];
                          return ListTile(
                            dense: true,
                            leading: CircleAvatar(
                              radius: 12,
                              backgroundColor: const Color(0xFF21262D),
                              child: Text('\${c.quantity}x', style: const TextStyle(fontSize: 10, color: Color(0xFFFBBF24))),
                            ),
                            title: Text(c.name, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                            subtitle: Text('\${c.edition} · \${c.condition} \${c.foil ? "• FOIL" : ""}',
                                style: const TextStyle(color: Color(0xFF8B949E), fontSize: 10)),
                            trailing: Text('\\$\${c.price.toStringAsFixed(2)}',
                                style: const TextStyle(fontFamily: 'monospace', color: Color(0xFF34D399), fontSize: 12)),
                          );
                        },
                      ),
              ),
            ),
            const SizedBox(height: 16),

            // Botón de Confirmación
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                icon: _isSaving
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Color(0xFF0D1117), strokeWidth: 2))
                    : const Icon(Icons.file_download_done_rounded),
                label: Text(
                  _isSaving ? 'Guardando en Orden...' : 'Importar \${_parsedCards.length} Cartas a la Orden',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFBBF24),
                  foregroundColor: const Color(0xFF0D1117),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _parsedCards.isEmpty || _isSaving ? null : _commitCardsToOrder,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ParsedCardLine {
  final String name;
  final int quantity;
  final String edition;
  final String condition;
  final double price;
  final bool foil;

  _ParsedCardLine({
    required this.name,
    required this.quantity,
    required this.edition,
    required this.condition,
    required this.price,
    required this.foil,
  });
}
`,
    },

    ck_webview_screen: {
      title: 'Screen: Navegador Card Kingdom WebView (§5.9, §5.10)',
      filename: 'lib/screens/ck_webview_screen.dart',
      language: 'dart',
      category: 'screens',
      desc: 'Navegador in-app con webview_flutter: inyección JS para detección de carta actual, badge flotante de adición a orden y pusher al carrito online de CK con throttling de 5s.',
      code: `import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';
import '../services/ck_cart_pusher.dart';

/// Pantalla del Navegador In-App para Card Kingdom (§5.9, §5.10)
class CkWebViewScreen extends StatefulWidget {
  final String activeOrderId;
  final String currentUserEmail;
  final String currentUserName;
  final bool isAdmin;

  const CkWebViewScreen({
    super.key,
    required this.activeOrderId,
    required this.currentUserEmail,
    required this.currentUserName,
    required this.isAdmin,
  });

  @override
  State<CkWebViewScreen> createState() => _CkWebViewScreenState();
}

class _CkWebViewScreenState extends State<CkWebViewScreen> {
  late final WebViewController _controller;
  final FirestoreService _firestore = FirestoreService();
  Map<String, dynamic>? _detectedCard;
  bool _isLoading = true;
  String _selectedCondition = 'NM';
  int _selectedQty = 1;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0D1117))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) => setState(() => _isLoading = true),
          onPageFinished: (url) {
            setState(() => _isLoading = false);
            _injectCardExtractor();
          },
        ),
      )
      ..addJavaScriptChannel(
        'CardDetectorChannel',
        onMessageReceived: (message) {
          try {
            final data = jsonDecode(message.message) as Map<String, dynamic>;
            setState(() {
              _detectedCard = data;
              _selectedCondition = data['style'] ?? 'NM';
            });
          } catch (_) {}
        },
      )
      ..loadRequest(Uri.parse('https://www.cardkingdom.com'));
  }

  /// Script JS inyectado en Card Kingdom para detectar carta actual en pantalla
  void _injectCardExtractor() {
    const js = '''
      (function() {
        function scanCard() {
          const titleEl = document.querySelector('h1.product-title, .product-name');
          if (!titleEl) return;

          const title = titleEl.innerText.trim();
          const imgEl = document.querySelector('.product-image img, .main-image img');
          const imageUrl = imgEl ? imgEl.src : '';
          const pidInput = document.querySelector('input[name="product_id"]');
          const productId = pidInput ? pidInput.value : '';

          CardDetectorChannel.postMessage(JSON.stringify({
            cardName: title,
            imageUrl: imageUrl,
            productId: productId,
            url: window.location.href,
            style: 'NM',
            price: 1.0
          }));
        }

        scanCard();
      })();
    ''';
    _controller.runJavaScript(js);
  }

  Future<void> _addDetectedCardToOrder() async {
    if (_detectedCard == null) return;

    await _firestore.addOrUpsertOrderItem(
      orderId: widget.activeOrderId,
      buyerEmail: widget.currentUserEmail,
      buyerName: widget.currentUserName,
      cardName: _detectedCard!['cardName'] ?? 'Carta CK',
      edition: 'Card Kingdom',
      condition: _selectedCondition,
      foil: false,
      price: (_detectedCard!['price'] as num?)?.toDouble() ?? 1.0,
      quantityToAdd: _selectedQty,
      imageUrl: _detectedCard!['imageUrl'] ?? '',
      pageUrl: _detectedCard!['url'] ?? '',
      productId: _detectedCard!['productId'] ?? '',
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF10B981),
          content: Text('Carta agregada a la orden activa con éxito.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        elevation: 0,
        title: const Text('Navegador Card Kingdom', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        actions: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => _controller.goBack(),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _controller.reload(),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const LinearProgressIndicator(color: Color(0xFFFBBF24), backgroundColor: Colors.transparent),

          // Floating Action Bar de Detección de Carta (§5.9)
          if (_detectedCard != null)
            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF161B22).withOpacity(0.96),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFBBF24)),
                  boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 12, offset: Offset(0, 4))],
                ),
                child: Row(
                  children: [
                    if (_detectedCard!['imageUrl'] != null && _detectedCard!['imageUrl'].isNotEmpty)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.network(_detectedCard!['imageUrl'], width: 36, height: 50, fit: BoxFit.cover),
                      ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _detectedCard!['cardName'] ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              DropdownButton<String>(
                                value: _selectedCondition,
                                dropdownColor: const Color(0xFF161B22),
                                underline: const SizedBox(),
                                style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 11, fontWeight: FontWeight.bold),
                                items: const ['NM', 'EX', 'VG', 'G'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                                onChanged: (v) {
                                  if (v != null) setState(() => _selectedCondition = v);
                                },
                              ),
                              const SizedBox(width: 8),
                              Text('Cant: \$_selectedQty', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      icon: const Icon(Icons.add_shopping_cart, size: 14),
                      label: const Text('Añadir a Orden', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFBBF24),
                        foregroundColor: const Color(0xFF0D1117),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      onPressed: _addDetectedCardToOrder,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
`,
    },

    // ==========================================
    // WIDGETS Y COMPONENTES
    // ==========================================
    buyer_card: {
      title: 'Widget: Tarjeta de Comprador (§5.6)',
      filename: 'lib/widgets/buyer_breakdown_card.dart',
      language: 'dart',
      category: 'widgets',
      desc: 'Tarjeta de resumen y desglose individual por comprador: cartas, cuota proporcional de envío, abonos recibidos, estado de solvencia (PAGADO / PENDIENTE / SOBREPAGO) y acciones.',
      code: `import 'package:flutter/material.dart';
import '../models/purchases_models.dart';

/// Tarjeta de desglose por comprador (§5.6)
class BuyerBreakdownCard extends StatelessWidget {
  final String buyerEmail;
  final String buyerName;
  final List<OrderItem> items;
  final double cardsTotal;
  final double shippingShare;
  final double paidCards;
  final double paidShipping;
  final String orderStatus;
  final bool canEdit;
  final VoidCallback? onQuickPayment;
  final Function(String itemId)? onDeleteItem;

  const BuyerBreakdownCard({
    super.key,
    required this.buyerEmail,
    required this.buyerName,
    required this.items,
    required this.cardsTotal,
    required this.shippingShare,
    required this.paidCards,
    required this.paidShipping,
    required this.orderStatus,
    required this.canEdit,
    this.onQuickPayment,
    this.onDeleteItem,
  });

  @override
  Widget build(BuildContext context) {
    final grandTotal = cardsTotal + shippingShare;
    final totalPaid = paidCards + paidShipping;
    final pendingTotal = (grandTotal - totalPaid).clamp(0.0, double.infinity);
    final isFullyPaid = totalPaid >= grandTotal && grandTotal > 0;
    final isOverpaid = totalPaid > grandTotal;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isFullyPaid ? const Color(0xFF10B981).withOpacity(0.4) : const Color(0xFF30363D),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Comprador
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFF21262D),
                  radius: 18,
                  child: Text(
                    buyerName.isNotEmpty ? buyerName[0].toUpperCase() : '?',
                    style: const TextStyle(color: Color(0xFFFBBF24), fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(buyerName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white)),
                      Text(buyerEmail, style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                    ],
                  ),
                ),
                _buildSolvencyChip(isFullyPaid, isOverpaid, totalPaid, grandTotal),
              ],
            ),
          ),

          const Divider(color: Color(0xFF30363D), height: 1),

          // Desglose Financiero (Cartas vs Envío)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Cartas', style: TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                      Text('\\$\${cardsTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'monospace')),
                      Text('Abonado: \\$\${paidCards.toStringAsFixed(2)}', style: const TextStyle(fontSize: 10, color: Color(0xFF34D399))),
                    ],
                  ),
                ),
                Container(width: 1, height: 36, color: const Color(0xFF30363D)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Cuota Envío (§5.6)', style: TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                      Text('\\$\${shippingShare.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontFamily: 'monospace')),
                      Text('Abonado: \\$\${paidShipping.toStringAsFixed(2)}', style: const TextStyle(fontSize: 10, color: Color(0xFF34D399))),
                    ],
                  ),
                ),
                Container(width: 1, height: 36, color: const Color(0xFF30363D)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Total Pendiente', style: TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                      Text(
                        '\\$\${pendingTotal.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: pendingTotal == 0 ? const Color(0xFF34D399) : const Color(0xFFF87171),
                          fontFamily: 'monospace',
                        ),
                      ),
                      if (onQuickPayment != null)
                        GestureDetector(
                          onTap: onQuickPayment,
                          child: const Text('Registrar Abono', style: TextStyle(fontSize: 10, color: Color(0xFFFBBF24), decoration: TextDecoration.underline)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Acordeón de Cartas
          Theme(
            data: ThemeData(dividerColor: Colors.transparent),
            child: ExpansionTile(
              title: Text('Ver \${items.length} cartas agregadas', style: const TextStyle(fontSize: 12, color: Color(0xFF58A6FF))),
              children: items.map((item) {
                return ListTile(
                  dense: true,
                  leading: Text('\${item.quantity}x', style: const TextStyle(color: Color(0xFFFBBF24), fontWeight: FontWeight.bold, fontSize: 12)),
                  title: Text(item.cardName, style: const TextStyle(color: Colors.white, fontSize: 12)),
                  subtitle: Text('\${item.edition} • \${item.condition} \${item.foil ? "• FOIL" : ""}', style: const TextStyle(color: Color(0xFF8B949E), fontSize: 10)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('\\$\${(item.price * item.quantity).toStringAsFixed(2)}', style: const TextStyle(fontFamily: 'monospace', color: Colors.white, fontSize: 11)),
                      if (canEdit && orderStatus != 'finalized')
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Color(0xFFF87171), size: 16),
                          onPressed: () => onDeleteItem?.call(item.id),
                        ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSolvencyChip(bool isFullyPaid, bool isOverpaid, double paid, double total) {
    String label = 'PENDIENTE';
    Color color = const Color(0xFFFBBF24);
    Color bg = const Color(0xFF78350F).withOpacity(0.5);

    if (isOverpaid) {
      label = 'SOBREPAGO';
      color = const Color(0xFF60A5FA);
      bg = const Color(0xFF1E3A8A).withOpacity(0.5);
    } else if (isFullyPaid) {
      label = 'PAGADO';
      color = const Color(0xFF34D399);
      bg = const Color(0xFF064E3B).withOpacity(0.5);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: color.withOpacity(0.4))),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }
}
`,
    },

    order_card: {
      title: 'Widget: Tarjeta de Orden (Historial §5.4)',
      filename: 'lib/widgets/order_card.dart',
      language: 'dart',
      category: 'widgets',
      desc: 'Componente visual para cada orden: ID formateado, chips de estado, cálculo de urgencia, fechas y resumen de cartas/USD.',
      code: `import 'dart:math';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/purchases_models.dart';

/// Tarjeta interactiva de orden de compra (§5.4 de la especificación)
class PurchaseOrderCard extends StatelessWidget {
  final PurchaseOrder order;
  final int totalCards;
  final double totalAmount;
  final VoidCallback onTap;

  const PurchaseOrderCard({
    super.key,
    required this.order,
    required this.totalCards,
    required this.totalAmount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final urgency = _calculateUrgency(order.estimatedPurchaseDate);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        hoverColor: const Color(0xFF21262D),
        splashColor: const Color(0xFF30363D),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFF161B22),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF30363D)),
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          'Orden \${_formatOrderId(order.id)}',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        _buildStatusChip(order.status),
                        if (urgency.isUpcoming &&
                            order.status != 'finalized' &&
                            order.status != 'purchased')
                          _buildUrgencyBadge(urgency),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          'Creada: \${_formatDate(order.createdAt)}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF8B949E),
                          ),
                        ),
                        if (order.estimatedPurchaseDate != null) ...[
                          const Text('·', style: TextStyle(fontSize: 12, color: Color(0xFF484F58))),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.calendar_today_rounded, size: 12, color: Color(0xFF8B949E)),
                              const SizedBox(width: 4),
                              Text(
                                'Compra estimada: \${_formatDate(order.estimatedPurchaseDate!)}',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF8B949E)),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '\$totalCards cartas',
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '\\$\${totalAmount.toStringAsFixed(2)} USD',
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF34D399),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded, color: Color(0xFF8B949E), size: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusChip(String status) {
    Color bg;
    Color border;
    Color text;
    String label;

    switch (status) {
      case 'active':
        bg = const Color(0xFF064E3B).withOpacity(0.7);
        border = const Color(0xFF10B981).withOpacity(0.4);
        text = const Color(0xFF34D399);
        label = 'Activa';
        break;
      case 'purchased':
        bg = const Color(0xFF1E3A8A).withOpacity(0.7);
        border = const Color(0xFF3B82F6).withOpacity(0.4);
        text = const Color(0xFF60A5FA);
        label = 'Comprada';
        break;
      case 'finalized':
        bg = const Color(0xFF1E293B);
        border = const Color(0xFF334155);
        text = const Color(0xFF94A3B8);
        label = 'Finalizada';
        break;
      case 'pending':
      default:
        bg = const Color(0xFF78350F).withOpacity(0.7);
        border = const Color(0xFFF59E0B).withOpacity(0.4);
        text = const Color(0xFFFBBF24);
        label = 'Pendiente';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: border)),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: text)),
    );
  }

  Widget _buildUrgencyBadge(_OrderUrgency urgency) {
    final color = urgency.isOverdue ? const Color(0xFFF87171) : const Color(0xFF34D399);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.access_time_rounded, size: 12, color: color),
        const SizedBox(width: 3),
        Text(urgency.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
      ],
    );
  }

  String _formatOrderId(String id) {
    if (id.length <= 10) return id.toUpperCase();
    return id.substring(0, 10).toUpperCase();
  }

  String _formatDate(DateTime date) {
    return DateFormat('dd/MM/yyyy').format(date);
  }

  _OrderUrgency _calculateUrgency(DateTime? date) {
    if (date == null) return _OrderUrgency(label: '', isUpcoming: false, isOverdue: false);

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(date.year, date.month, date.day);
    final diffDays = target.difference(today).inDays;

    if (diffDays < 0) {
      final days = diffDays.abs();
      return _OrderUrgency(
        label: 'Vencida hace \$days \${days == 1 ? "día" : "días"}',
        isUpcoming: true,
        isOverdue: true,
      );
    } else if (diffDays == 0) {
      return _OrderUrgency(label: 'Compra es hoy', isUpcoming: true, isOverdue: false);
    } else if (diffDays <= 7) {
      return _OrderUrgency(label: 'En \$diffDays días', isUpcoming: true, isOverdue: false);
    }

    return _OrderUrgency(label: '', isUpcoming: false, isOverdue: false);
  }
}

class _OrderUrgency {
  final String label;
  final bool isUpcoming;
  final bool isOverdue;

  _OrderUrgency({
    required this.label,
    required this.isUpcoming,
    required this.isOverdue,
  });
}
`,
    },

    payments_modal: {
      title: 'Widget: Modal de Gestión de Abonos (§5.5, §5.8)',
      filename: 'lib/widgets/order_payments_modal.dart',
      language: 'dart',
      category: 'widgets',
      desc: 'Hoja modal para registrar abonos con distinción estricta de tipo (Cartas vs Envío), notas, métodos de pago, historial con fechas y eliminación para administradores.',
      code: `import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';

/// Modal para registrar y gestionar abonos de una orden (§5.5, §5.8)
class OrderPaymentsModal extends StatefulWidget {
  final String orderId;
  final PurchaseOrder order;
  final List<OrderItem> items;
  final List<Payment> payments;

  const OrderPaymentsModal({
    super.key,
    required this.orderId,
    required this.order,
    required this.items,
    required this.payments,
  });

  @override
  State<OrderPaymentsModal> createState() => _OrderPaymentsModalState();
}

class _OrderPaymentsModalState extends State<OrderPaymentsModal> {
  final FirestoreService _firestore = FirestoreService();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();

  String? _selectedBuyerEmail;
  String _paymentType = 'cards'; // 'cards' | 'shipping'
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final buyers = widget.items.map((i) => i.buyerEmail).toSet().toList();
    if (buyers.isNotEmpty) {
      _selectedBuyerEmail = buyers.first;
    }
  }

  Future<void> _submitPayment() async {
    final amount = double.tryParse(_amountController.text.trim()) ?? 0.0;
    if (amount <= 0 || _selectedBuyerEmail == null) return;

    setState(() => _isSubmitting = true);
    try {
      await _firestore.addPayment(
        orderId: widget.orderId,
        buyerEmail: _selectedBuyerEmail!,
        amount: amount,
        type: _paymentType,
        note: _noteController.text.trim(),
        registeredBy: 'admin',
      );

      _amountController.clear();
      _noteController.clear();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(backgroundColor: Color(0xFF10B981), content: Text('Abono registrado con éxito.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final buyers = widget.items.map((i) => i.buyerEmail).toSet().toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Gestión de Abonos (§5.5, §5.8)', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              IconButton(icon: const Icon(Icons.close, color: Colors.white70), onPressed: () => Navigator.of(context).pop()),
            ],
          ),
          const SizedBox(height: 12),

          // Formulario para Registrar Abono
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Registrar Nuevo Abono', style: TextStyle(color: Color(0xFFFBBF24), fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: DropdownButtonFormField<String>(
                        value: _selectedBuyerEmail,
                        dropdownColor: const Color(0xFF161B22),
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                        decoration: InputDecoration(
                          labelText: 'Comprador',
                          labelStyle: const TextStyle(color: Color(0xFF8B949E), fontSize: 11),
                          filled: true,
                          fillColor: const Color(0xFF161B22),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        items: buyers.map((email) {
                          final item = widget.items.firstWhere((i) => i.buyerEmail == email);
                          return DropdownMenuItem(value: email, child: Text(item.buyerName));
                        }).toList(),
                        onChanged: (val) => setState(() => _selectedBuyerEmail = val),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 1,
                      child: TextField(
                        controller: _amountController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 12),
                        decoration: InputDecoration(
                          labelText: 'Monto USD',
                          labelStyle: const TextStyle(color: Color(0xFF8B949E), fontSize: 11),
                          prefixText: '\\$ ',
                          prefixStyle: const TextStyle(color: Color(0xFF34D399)),
                          filled: true,
                          fillColor: const Color(0xFF161B22),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('Cartas', style: TextStyle(fontSize: 11)),
                      selected: _paymentType == 'cards',
                      selectedColor: const Color(0xFFFBBF24),
                      onSelected: (val) => setState(() => _paymentType = 'cards'),
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('Envío', style: TextStyle(fontSize: 11)),
                      selected: _paymentType == 'shipping',
                      selectedColor: const Color(0xFFFBBF24),
                      onSelected: (val) => setState(() => _paymentType = 'shipping'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _noteController,
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                        decoration: InputDecoration(
                          hintText: 'Nota / Ref (ej: Zelle)',
                          hintStyle: const TextStyle(color: Colors.white24, fontSize: 11),
                          filled: true,
                          fillColor: const Color(0xFF161B22),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFBBF24), foregroundColor: const Color(0xFF0D1117)),
                    onPressed: _isSubmitting ? null : _submitPayment,
                    child: Text(_isSubmitting ? 'Registrando...' : 'Guardar Abono', style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Historial de Abonos Registrados
          const Text('Historial de Abonos', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Expanded(
            child: widget.payments.isEmpty
                ? const Center(child: Text('No hay abonos registrados para esta orden.', style: TextStyle(color: Color(0xFF8B949E))))
                : ListView.separated(
                    itemCount: widget.payments.length,
                    separatorBuilder: (_, __) => const Divider(color: Color(0xFF21262D), height: 1),
                    itemBuilder: (context, i) {
                      final p = widget.payments[i];
                      return ListTile(
                        dense: true,
                        leading: CircleAvatar(
                          backgroundColor: p.type == 'cards' ? const Color(0xFF064E3B) : const Color(0xFF1E3A8A),
                          radius: 14,
                          child: Icon(p.type == 'cards' ? Icons.style : Icons.local_shipping, size: 14, color: Colors.white),
                        ),
                        title: Text(p.buyerEmail, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                        subtitle: Text(
                          '\${DateFormat("dd/MM/yyyy").format(p.createdAt)} \${p.note.isNotEmpty ? "• \${p.note}" : ""}',
                          style: const TextStyle(color: Color(0xFF8B949E), fontSize: 10),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('\\$\${p.amount.toStringAsFixed(2)}', style: const TextStyle(fontFamily: 'monospace', color: Color(0xFF34D399), fontWeight: FontWeight.bold)),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 16, color: Color(0xFFF87171)),
                              onPressed: () => _firestore.deletePayment(widget.orderId, p.id),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
`,
    },


    register_payment_dialog: {
      title: "Widget: Registrar Abono de Cartas (§5.5, §5.6, §8)",
      filename: "lib/widgets/register_payment_dialog.dart",
      language: "dart",
      category: "widgets",
      desc: "Diálogo modal para registrar abono de cartas o envío: cálculo de saldo pendiente, botones de monto rápido, nota de comprobante y persistencia atómica en Firestore.",
      code: `import 'package:flutter/material.dart';
import '../services/firestore_service.dart';

/// =========================================================================
/// DIÁLOGO MODAL: REGISTRAR ABONO DE CARTAS Y ENVÍO (Flutter)
/// Especificación Técnica ManaBros: §5.5, §5.6, §8
///
/// Este componente permite a los administradores registrar abonos recibidos
/// para una orden activa, con distinción estricta de tipo:
/// - 'cards': Abono destinado al costo de las cartas MTG.
/// - 'shipping': Abono para la cuota proporcional de envío internacional.
///
/// Incluye:
/// - Visualización del comprador y monto pendiente de cartas/envío.
/// - Botones de monto rápido (ej. Monto pendiente total, $10, $20, $50).
/// - Campo de monto numérico en USD con validación de valores > 0.
/// - Campo opcional de comprobante / nota (referencia bancaria, Zelle, efectivo).
/// - Integración directa con FirestoreService.addPayment.
/// =========================================================================

class RegisterPaymentDialog extends StatefulWidget {
  final String orderId;
  final String buyerEmail;
  final String buyerName;
  final String initialType; // 'cards' | 'shipping'
  final double? suggestedAmount; // Monto pendiente sugerido
  final String currentUserEmail;

  const RegisterPaymentDialog({
    super.key,
    required this.orderId,
    required this.buyerEmail,
    required this.buyerName,
    this.initialType = 'cards',
    this.suggestedAmount,
    required this.currentUserEmail,
  });

  /// Método estático de conveniencia para mostrar el diálogo modal
  static Future<bool?> show(
    BuildContext context, {
    required String orderId,
    required String buyerEmail,
    required String buyerName,
    String initialType = 'cards',
    double? suggestedAmount,
    required String currentUserEmail,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (ctx) => RegisterPaymentDialog(
        orderId: orderId,
        buyerEmail: buyerEmail,
        buyerName: buyerName,
        initialType: initialType,
        suggestedAmount: suggestedAmount,
        currentUserEmail: currentUserEmail,
      ),
    );
  }

  @override
  State<RegisterPaymentDialog> createState() => _RegisterPaymentDialogState();
}

class _RegisterPaymentDialogState extends State<RegisterPaymentDialog> {
  final FirestoreService _firestore = FirestoreService();
  late TextEditingController _amountController;
  final TextEditingController _noteController = TextEditingController();

  late String _selectedType;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _selectedType = widget.initialType;

    // Si viene un monto sugerido mayor a 0, precargarlo en el campo
    final initialAmt = (widget.suggestedAmount != null && widget.suggestedAmount! > 0)
        ? widget.suggestedAmount!.toStringAsFixed(2)
        : '';
    _amountController = TextEditingController(text: initialAmt);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _handleSavePayment() async {
    final rawText = _amountController.text.trim().replaceAll(',', '.');
    final amount = double.tryParse(rawText);

    if (amount == null || amount <= 0) {
      setState(() => _errorMessage = 'Ingresa un monto válido mayor a 0');
      return;
    }

    setState(() {
      _errorMessage = null;
      _isSubmitting = true;
    });

    try {
      await _firestore.addPayment(
        orderId: widget.orderId,
        buyerEmail: widget.buyerEmail,
        amount: amount,
        type: _selectedType,
        note: _noteController.text.trim(),
        registeredBy: widget.currentUserEmail,
      );

      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            content: Text(
              'Abono \${_selectedType == "cards" ? "de cartas" : "de envío"} de \\$\${amount.toStringAsFixed(2)} USD registrado para \${widget.buyerName}',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Error al registrar el abono: $e';
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCards = _selectedType == 'cards';

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        width: 440,
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFF30363D)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.6),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ==========================================
              // HEADER
              // ==========================================
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFF0D1117),
                  border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: (isCards ? const Color(0xFF10B981) : const Color(0xFF3B82F6)).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            isCards ? Icons.attach_money : Icons.local_shipping,
                            color: isCards ? const Color(0xFF34D399) : const Color(0xFF60A5FA),
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          isCards ? 'Registrar Abono de Cartas' : 'Registrar Abono de Envío',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 18),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => Navigator.of(context).pop(false),
                    ),
                  ],
                ),
              ),

              // ==========================================
              // CUERPO DEL DIÁLOGO
              // ==========================================
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Tarjeta de información del comprador
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0D1117),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF30363D)),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: const Color(0xFF21262D),
                            child: Text(
                              widget.buyerName.isNotEmpty ? widget.buyerName[0].toUpperCase() : '?',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.buyerName,
                                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  widget.buyerEmail,
                                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          if (widget.suggestedAmount != null && widget.suggestedAmount! > 0)
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Text('Pendiente', style: TextStyle(color: Color(0xFF64748B), fontSize: 10)),
                                Text(
                                  '\\$\${widget.suggestedAmount!.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    color: Color(0xFFFBBF24),
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Selector de tipo de abono: Cartas vs Envío (§5.5)
                    const Text(
                      'Tipo de Abono',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _selectedType = 'cards'),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: isCards ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFF0D1117),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isCards ? const Color(0xFF10B981) : const Color(0xFF30363D),
                                  width: isCards ? 1.5 : 1,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.style, size: 14, color: isCards ? const Color(0xFF34D399) : const Color(0xFF64748B)),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Abono de Cartas',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: isCards ? FontWeight.bold : FontWeight.w500,
                                      color: isCards ? const Color(0xFF34D399) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _selectedType = 'shipping'),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: !isCards ? const Color(0xFF3B82F6).withOpacity(0.15) : const Color(0xFF0D1117),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: !isCards ? const Color(0xFF3B82F6) : const Color(0xFF30363D),
                                  width: !isCards ? 1.5 : 1,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.local_shipping, size: 14, color: !isCards ? const Color(0xFF60A5FA) : const Color(0xFF64748B)),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Abono de Envío',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: !isCards ? FontWeight.bold : FontWeight.w500,
                                      color: !isCards ? const Color(0xFF60A5FA) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Input Monto del Abono ($ USD)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Monto del Abono (\\$ USD)',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                        if (widget.suggestedAmount != null && widget.suggestedAmount! > 0)
                          GestureDetector(
                            onTap: () {
                              _amountController.text = widget.suggestedAmount!.toStringAsFixed(2);
                              setState(() => _errorMessage = null);
                            },
                            child: const Text(
                              'Usar monto pendiente total',
                              style: TextStyle(
                                color: Color(0xFFFBBF24),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _amountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      autofocus: true,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Ej. 25.00',
                        hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
                        prefixText: '\\$ ',
                        prefixStyle: TextStyle(
                          color: isCards ? const Color(0xFF34D399) : const Color(0xFF60A5FA),
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                        suffixText: 'USD',
                        suffixStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                        filled: true,
                        fillColor: const Color(0xFF0D1117),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFF30363D)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFF30363D)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(
                            color: isCards ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                            width: 1.5,
                          ),
                        ),
                      ),
                    ),

                    // Chips de montos rápidos
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [10.0, 20.0, 50.0, 100.0].map((quick) {
                        return InkWell(
                          onTap: () {
                            _amountController.text = quick.toStringAsFixed(2);
                            setState(() => _errorMessage = null);
                          },
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF21262D),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF30363D)),
                            ),
                            child: Text(
                              '+\\$\${quick.toStringAsFixed(0)}',
                              style: const TextStyle(
                                color: Color(0xFFCBD5E1),
                                fontSize: 11,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),

                    const SizedBox(height: 16),

                    // Input Nota o Comprobante
                    const Text(
                      'Nota o comprobante (opcional)',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _noteController,
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                      decoration: InputDecoration(
                        hintText: 'Ej. Transferencia bancaria #1098 / Zelle',
                        hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                        filled: true,
                        fillColor: const Color(0xFF0D1117),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFF30363D)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFF30363D)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                        ),
                      ),
                    ),

                    // Mensaje de error
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Color(0xFFF87171), size: 16),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(color: Color(0xFFF87171), fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              // ==========================================
              // FOOTER / ACCIONES
              // ==========================================
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                decoration: const BoxDecoration(
                  color: Color(0xFF0D1117),
                  border: Border(top: BorderSide(color: Color(0xFF30363D))),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF94A3B8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      child: const Text('Cancelar'),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton(
                      onPressed: _isSubmitting ? null : _handleSavePayment,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: const Color(0xFF0D1117),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(color: Color(0xFF0D1117), strokeWidth: 2),
                            )
                          : const Text('Guardar Abono'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`,
    },

    shipping_card: {
      title: 'Widget: Gestión de Flete / Encomienda (§5.7)',
      filename: 'lib/widgets/shipping_management_card.dart',
      language: 'dart',
      category: 'widgets',
      desc: 'Configuración global de costo de envío, selección de courier (MRW, Tealca, Zoom), número de tracking y preview del prorrateo automático entre compradores.',
      code: `import 'package:flutter/material.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';

/// Componente de Flete y Encomienda (§5.7)
class ShippingManagementCard extends StatefulWidget {
  final PurchaseOrder order;
  final bool isAdmin;
  final double totalCardsAmount;

  const ShippingManagementCard({
    super.key,
    required this.order,
    required this.isAdmin,
    required this.totalCardsAmount,
  });

  @override
  State<ShippingManagementCard> createState() => _ShippingManagementCardState();
}

class _ShippingManagementCardState extends State<ShippingManagementCard> {
  final FirestoreService _firestore = FirestoreService();
  final TextEditingController _costController = TextEditingController();
  final TextEditingController _trackingController = TextEditingController();
  String _selectedCourier = 'MRW';
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    _costController.text = (widget.order.shippingCost ?? 0.0).toStringAsFixed(2);
  }

  Future<void> _saveShipping() async {
    final cost = double.tryParse(_costController.text.trim()) ?? 0.0;
    await _firestore.updateShippingCost(widget.order.id, cost);
    setState(() => _isEditing = false);
  }

  @override
  Widget build(BuildContext context) {
    final shippingCost = widget.order.shippingCost ?? 0.0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF161B22),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.local_shipping_rounded, color: Color(0xFFFBBF24), size: 20),
                        SizedBox(width: 8),
                        Text('Flete Global de la Orden (§5.7)', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14)),
                      ],
                    ),
                    if (widget.isAdmin)
                      TextButton(
                        onPressed: () => setState(() => _isEditing = !_isEditing),
                        child: Text(_isEditing ? 'Cancelar' : 'Modificar', style: const TextStyle(color: Color(0xFF58A6FF), fontSize: 12)),
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                if (_isEditing && widget.isAdmin) ...[
                  TextField(
                    controller: _costController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                    decoration: InputDecoration(
                      labelText: 'Costo Total de Envío (USD)',
                      prefixText: '\\$ ',
                      filled: true,
                      fillColor: const Color(0xFF0D1117),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFBBF24), foregroundColor: const Color(0xFF0D1117)),
                      onPressed: _saveShipping,
                      child: const Text('Actualizar y Prorratear Flete', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ] else ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Costo de Envío:', style: TextStyle(color: Color(0xFF8B949E), fontSize: 13)),
                      Text(
                        '\\$\${shippingCost.toStringAsFixed(2)} USD',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF34D399), fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Este costo se divide automáticamente de forma proporcional según el subtotal de cartas de cada comprador.',
                    style: TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Encomienda Local y Courier
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF161B22),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Courier & Despacho', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 12),
                Row(
                  children: ['MRW', 'Tealca', 'Zoom'].map((courier) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(courier, style: const TextStyle(fontSize: 11)),
                        selected: _selectedCourier == courier,
                        selectedColor: const Color(0xFFFBBF24),
                        onSelected: (val) => setState(() => _selectedCourier = courier),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _trackingController,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: InputDecoration(
                    labelText: 'Número de Guía / Tracking',
                    hintText: 'Ej: 12893847291',
                    filled: true,
                    fillColor: const Color(0xFF0D1117),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
`,
    },

    settings_dialog: {
      title: 'Widget: Diálogo de Ajustes y Configuración (§5.9)',
      filename: 'lib/widgets/settings_dialog.dart',
      language: 'dart',
      category: 'widgets',
      desc: 'Modal de ajustes: perfil de usuario, tema (Oscuro, Claro, Sistema), permisos admin (historial de órdenes, ver solo tus items), proxy CORS, vaciado de caché de imágenes y cierre de sesión.',
      code: `import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/purchases_models.dart';

/// Modelo de Ajustes Globales de la Aplicación (§5.9)
class AppSettings {
  final String theme; // 'dark' | 'light' | 'system'
  final bool historyEnabled;
  final bool buyersViewHistory;
  final bool useProxy;

  AppSettings({
    this.theme = 'dark',
    this.historyEnabled = true,
    this.buyersViewHistory = true,
    this.useProxy = true,
  });

  factory AppSettings.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return AppSettings(
      theme: data['theme'] ?? 'dark',
      historyEnabled: data['historyEnabled'] ?? true,
      buyersViewHistory: data['buyersViewHistory'] ?? true,
      useProxy: data['useProxy'] ?? true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'theme': theme,
      'historyEnabled': historyEnabled,
      'buyersViewHistory': buyersViewHistory,
      'useProxy': useProxy,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  AppSettings copyWith({
    String? theme,
    bool? historyEnabled,
    bool? buyersViewHistory,
    bool? useProxy,
  }) {
    return AppSettings(
      theme: theme ?? this.theme,
      historyEnabled: historyEnabled ?? this.historyEnabled,
      buyersViewHistory: buyersViewHistory ?? this.buyersViewHistory,
      useProxy: useProxy ?? this.useProxy,
    );
  }
}

/// Diálogo Modal de Ajustes y Configuración (§5.9)
class SettingsDialog extends StatefulWidget {
  final UserProfile currentUser;
  final VoidCallback onLogout;
  final Function(AppSettings)? onSettingsChanged;

  const SettingsDialog({
    super.key,
    required this.currentUser,
    required this.onLogout,
    this.onSettingsChanged,
  });

  /// Método estático de conveniencia para invocar el modal
  static Future<void> show(
    BuildContext context, {
    required UserProfile currentUser,
    required VoidCallback onLogout,
    Function(AppSettings)? onSettingsChanged,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (ctx) => SettingsDialog(
        currentUser: currentUser,
        onLogout: onLogout,
        onSettingsChanged: onSettingsChanged,
      ),
    );
  }

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  AppSettings _settings = AppSettings();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final doc = await _firestore.collection('app_settings').doc('global').get();
      if (doc.exists && mounted) {
        setState(() {
          _settings = AppSettings.fromFirestore(doc);
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateSetting(AppSettings updated, String message) async {
    setState(() => _settings = updated);
    widget.onSettingsChanged?.call(updated);

    try {
      await _firestore
          .collection('app_settings')
          .doc('global')
          .set(updated.toMap(), SetOptions(merge: true));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 16),
                const SizedBox(width: 8),
                Text(message, style: const TextStyle(fontSize: 12)),
              ],
            ),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      // Manejar error de permisos si no es admin
    }
  }

  void _clearImageCache() {
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF10B981),
        content: Text('Caché de imágenes liberada correctamente.'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF30363D)),
        ),
        title: const Text('Cerrar sesión', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: const Text(
          '¿Estás seguro de que deseas cerrar sesión en este dispositivo?',
          style: TextStyle(color: Color(0xFF8B949E), fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.of(dialogCtx).pop();
              Navigator.of(context).pop();
              widget.onLogout();
            },
            child: const Text('Cerrar Sesión', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = widget.currentUser;
    final isAdmin = currentUser.role == 'admin';

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFF30363D)),
          boxShadow: const [
            BoxShadow(
              color: Colors.black87,
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ==========================================
              // 1. HEADER & PERFIL DE USUARIO
              // ==========================================
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Color(0xFF0D1117),
                  border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: const Color(0xFF21262D),
                      backgroundImage: currentUser.photoURL.isNotEmpty
                          ? NetworkImage(currentUser.photoURL)
                          : null,
                      child: currentUser.photoURL.isEmpty
                          ? Text(
                              currentUser.displayName.isNotEmpty
                                  ? currentUser.displayName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: Color(0xFFFBBF24),
                                fontWeight: FontWeight.bold,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  currentUser.displayName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              _buildRoleBadge(currentUser.role),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            currentUser.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white70),
                      onPressed: () => Navigator.of(context).pop(),
                      splashRadius: 18,
                    ),
                  ],
                ),
              ),

              // ==========================================
              // 2. CUERPO DE AJUSTES SCROLLABLE
              // ==========================================
              Flexible(
                child: _isLoading
                    ? const Padding(
                        padding: EdgeInsets.all(32),
                        child: Center(
                          child: CircularProgressIndicator(color: Color(0xFFFBBF24)),
                        ),
                      )
                    : SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // SECCIÓN APARIENCIA (§5.9)
                            _buildSectionHeader('APARIENCIA', Icons.palette_outlined),
                            const SizedBox(height: 10),
                            _buildThemeSelector(),

                            const SizedBox(height: 24),

                            // SECCIÓN AJUSTES DE ADMINISTRADOR (§5.9)
                            _buildSectionHeader('AJUSTES DE ADMINISTRADOR', Icons.admin_panel_settings_outlined),
                            const SizedBox(height: 10),
                            if (isAdmin) ...[
                              _buildSettingSwitchTile(
                                title: 'Historial de compra',
                                subtitle: 'Habilita o deshabilita la pestaña "Mis órdenes" para todos los compradores.',
                                value: _settings.historyEnabled,
                                icon: Icons.history_rounded,
                                onChanged: (val) {
                                  _updateSetting(
                                    _settings.copyWith(historyEnabled: val),
                                    'Historial \${val ? "habilitado" : "deshabilitado"}',
                                  );
                                },
                              ),
                              if (_settings.historyEnabled) ...[
                                const SizedBox(height: 10),
                                _buildSettingSwitchTile(
                                  title: 'Ver solo tus items',
                                  subtitle: _settings.buyersViewHistory
                                      ? 'Los compradores ven su historial con solo sus items.'
                                      : 'Los compradores ven el detalle completo de cada orden.',
                                  value: _settings.buyersViewHistory,
                                  icon: Icons.visibility_outlined,
                                  onChanged: (val) {
                                    _updateSetting(
                                      _settings.copyWith(buyersViewHistory: val),
                                      val
                                          ? 'Compradores verán solo sus items'
                                          : 'Compradores verán orden completa',
                                    );
                                  },
                                ),
                              ],
                            ] else
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0D1117),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF30363D)),
                                ),
                                child: const Text(
                                  'Próximamente podrás configurar ajustes de la aplicación.',
                                  style: TextStyle(fontSize: 12, color: Color(0xFF8B949E)),
                                ),
                              ),

                            const SizedBox(height: 24),

                            // SECCIÓN RED & RENDIMIENTO (§5.9)
                            _buildSectionHeader('RED & RENDIMIENTO', Icons.network_check_rounded),
                            const SizedBox(height: 10),
                            _buildSettingSwitchTile(
                              title: 'Proxy de descargas',
                              subtitle: 'Usa proxy para consultar el catálogo de Card Kingdom.',
                              value: _settings.useProxy,
                              icon: Icons.language_rounded,
                              activeColor: const Color(0xFF10B981),
                              onChanged: (val) {
                                _updateSetting(
                                  _settings.copyWith(useProxy: val),
                                  'Proxy \${val ? "activado" : "desactivado"}',
                                );
                              },
                            ),
                            const SizedBox(height: 10),
                            InkWell(
                              onTap: _clearImageCache,
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0D1117),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF30363D)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.image_outlined, size: 20, color: Color(0xFF8B949E)),
                                    const SizedBox(width: 12),
                                    const Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Limpiar caché de imágenes',
                                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                                          ),
                                          Text(
                                            'Libera espacio en memoria y disco',
                                            style: TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF21262D),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Text(
                                        'Limpiar',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFFBBF24)),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Saldo del usuario si existe
                            if (currentUser.balance > 0) ...[
                              const SizedBox(height: 24),
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF064E3B).withOpacity(0.4),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Row(
                                      children: [
                                        Icon(Icons.account_balance_wallet_rounded, size: 18, color: Color(0xFF34D399)),
                                        SizedBox(width: 8),
                                        Text('Saldo a Favor', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                                      ],
                                    ),
                                    Text(
                                      '\\$\${currentUser.balance.toStringAsFixed(2)} USD',
                                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Color(0xFF34D399), fontSize: 14),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            const SizedBox(height: 24),

                            // Botón de Cerrar Sesión
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.logout_rounded, size: 16),
                                label: const Text('Cerrar sesión', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFFF87171),
                                  side: const BorderSide(color: Color(0xFF7F1D1D)),
                                  backgroundColor: const Color(0xFF450A0A).withOpacity(0.3),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                onPressed: _confirmLogout,
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 14, color: const Color(0xFFFBBF24)),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
            color: Color(0xFF8B949E),
          ),
        ),
      ],
    );
  }

  Widget _buildThemeSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Row(
        children: [
          _buildThemeOption('dark', 'Oscuro', Icons.nightlight_round),
          _buildThemeOption('light', 'Claro', Icons.wb_sunny_rounded),
          _buildThemeOption('system', 'Sistema', Icons.brightness_auto_rounded),
        ],
      ),
    );
  }

  Widget _buildThemeOption(String key, String label, IconData icon) {
    final isSelected = _settings.theme == key;

    return Expanded(
      child: InkWell(
        onTap: () {
          _updateSetting(_settings.copyWith(theme: key), 'Tema \$label configurado');
        },
        borderRadius: BorderRadius.circular(8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF21262D) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: isSelected ? Border.all(color: const Color(0xFFFBBF24).withOpacity(0.4)) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: isSelected ? const Color(0xFFFBBF24) : const Color(0xFF8B949E)),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? const Color(0xFFFBBF24) : const Color(0xFF8B949E),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettingSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required IconData icon,
    required ValueChanged<bool> onChanged,
    Color activeColor = const Color(0xFFFBBF24),
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 20, color: activeColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch(
            value: value,
            activeColor: activeColor,
            activeTrackColor: activeColor.withOpacity(0.3),
            inactiveThumbColor: const Color(0xFF8B949E),
            inactiveTrackColor: const Color(0xFF21262D),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildRoleBadge(String role) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: const Color(0xFF78350F).withOpacity(0.6),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4)),
      ),
      child: Text(
        role.toUpperCase(),
        style: const TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.bold,
          color: Color(0xFFFBBF24),
        ),
      ),
    );
  }
}
`
    },


    users_manager_dialog: {
      title: "Widget: Gestión de Usuarios y Saldos (§5.7, §5.8)",
      filename: "lib/widgets/users_manager_dialog.dart",
      language: "dart",
      category: "widgets",
      desc: "Diálogo modal para administradores: listado con búsqueda, confirmación de cuentas unconfirmed, abonos y salidas de saldo con motivo, e historial de movimientos.",
      code: `import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';

/// =========================================================================
/// DIÁLOGO MODAL: GESTIÓN DE USUARIOS Y SALDO A FAVOR (Flutter)
/// Especificación Técnica ManaBros: §1.1, §3.2, §5.7, §5.8
///
/// Características principales:
/// 1. Admin Guard (§5.7): Solo accesible por usuarios con rol 'admin'.
/// 2. Búsqueda y listado en tiempo real de todos los usuarios registrados.
/// 3. Confirmación de cuenta (§3.2): Activa usuarios nuevos 'unconfirmed'.
/// 4. Gestión de Saldo a Favor (§5.8): Carga y salida de saldos con motivo.
/// 5. Historial auditado de movimientos de saldo en tiempo real.
/// =========================================================================

class UsersManagerDialog extends StatefulWidget {
  final UserProfile currentUser;

  const UsersManagerDialog({
    super.key,
    required this.currentUser,
  });

  /// Método estático de conveniencia para invocar el diálogo
  static Future<void> show(
    BuildContext context, {
    required UserProfile currentUser,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.85),
      builder: (ctx) => UsersManagerDialog(currentUser: currentUser),
    );
  }

  @override
  State<UsersManagerDialog> createState() => _UsersManagerDialogState();
}

class _UsersManagerDialogState extends State<UsersManagerDialog> {
  final FirestoreService _firestoreService = FirestoreService();

  // Estados locales
  String _searchQuery = '';
  UserProfile? _selectedUser;
  bool _isProcessing = false;

  // Estados para formulario de saldo (Abono / Salida)
  String? _balanceAction; // 'credit' | 'outflow' | null
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  String? _balanceError;

  @override
  void dispose() {
    _amountController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        backgroundColor: isError ? const Color(0xFFDC2626) : const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  // Confirmar cuenta de usuario (§3.2)
  Future<void> _handleConfirmUser(UserProfile user) async {
    setState(() => _isProcessing = true);
    try {
      await _firestoreService.confirmUser(user.uid);
      _showSnackBar('Usuario \${user.displayName} confirmado exitosamente');
    } catch (e) {
      _showSnackBar('Error al confirmar usuario: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  // Guardar abono o salida de saldo (§5.8)
  Future<void> _handleSaveBalanceMutation() async {
    if (_selectedUser == null || _balanceAction == null) return;

    final amountText = _amountController.text.trim().replaceAll(',', '.');
    final amount = double.tryParse(amountText);
    if (amount == null || amount <= 0) {
      setState(() => _balanceError = 'Ingresa un monto válido mayor a 0');
      return;
    }

    final desc = _descController.text.trim();
    if (desc.isEmpty) {
      setState(() => _balanceError = 'La descripción o motivo es obligatoria');
      return;
    }

    if (_balanceAction == 'outflow' && amount > _selectedUser!.balance) {
      setState(() => _balanceError = 'No puede superar el saldo actual (\\$\${_selectedUser!.balance.toStringAsFixed(2)})');
      return;
    }

    setState(() {
      _balanceError = null;
      _isProcessing = true;
    });

    try {
      await _firestoreService.addBalanceMovement(
        userUid: _selectedUser!.uid,
        userEmail: _selectedUser!.email,
        amount: amount,
        type: _balanceAction!,
        description: desc,
        registeredBy: widget.currentUser.email,
      );

      final isCredit = _balanceAction == 'credit';
      _showSnackBar(
        isCredit
            ? 'Se agregaron \\$\${amount.toStringAsFixed(2)} USD a \${_selectedUser!.displayName}'
            : 'Salida de \\$\${amount.toStringAsFixed(2)} USD registrada para \${_selectedUser!.displayName}',
      );

      // Limpiar formulario
      setState(() {
        _balanceAction = null;
        _amountController.clear();
        _descController.clear();
        _balanceError = null;
      });
    } catch (e) {
      setState(() => _balanceError = 'Error: $e');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  // Diálogo modal de historial de movimientos de saldo
  void _openMovementsHistoryModal(UserProfile user) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF161B22),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF30363D)),
          ),
          titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
          contentPadding: const EdgeInsets.symmetric(horizontal: 20),
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Historial de Movimientos',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.displayName,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
                onPressed: () => Navigator.of(ctx).pop(),
              ),
            ],
          ),
          content: SizedBox(
            width: 480,
            height: 380,
            child: StreamBuilder<List<BalanceMovement>>(
              stream: _firestoreService.getUserMovementsStream(user.email),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
                  );
                }

                final movements = snapshot.data ?? [];
                if (movements.isEmpty) {
                  return const Center(
                    child: Text(
                      'Sin movimientos registrados',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                    ),
                  );
                }

                return ListView.separated(
                  itemCount: movements.length,
                  separatorBuilder: (_, __) => const Divider(color: Color(0xFF30363D), height: 1),
                  itemBuilder: (context, index) {
                    final m = movements[index];
                    final isCredit = m.type == 'credit';
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: isCredit
                                  ? const Color(0xFF10B981).withOpacity(0.15)
                                  : const Color(0xFFEF4444).withOpacity(0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isCredit ? Icons.arrow_downward : Icons.arrow_upward,
                              size: 14,
                              color: isCredit ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  m.description.isNotEmpty ? m.description : 'Ajuste de saldo',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '\${m.createdAt.day.toString().padLeft(2, '0')}/\${m.createdAt.month.toString().padLeft(2, '0')}/\${m.createdAt.year} · \${m.registeredBy}',
                                  style: const TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '\${isCredit ? "+" : "-"}\\$\${m.amount.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: isCredit ? const Color(0xFF34D399) : const Color(0xFFF87171),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFF21262D),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Cerrar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // 1. Guard de Administrador (§5.7)
    if (!widget.currentUser.isAdmin) {
      return Dialog(
        backgroundColor: const Color(0xFF161B22),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF30363D)),
        ),
        child: Container(
          width: 380,
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 36),
              ),
              const SizedBox(height: 16),
              const Text(
                'Acceso Restringido',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'No tienes permisos de Administrador para gestionar usuarios y saldos (§5.7).',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF21262D),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Cerrar'),
              ),
            ],
          ),
        ),
      );
    }

    final isNarrow = MediaQuery.of(context).size.width < 768;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(16),
      child: Container(
        width: 900,
        height: 640,
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(18),
          border: Border.Border.all(color: const Color(0xFF30363D)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 25,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: StreamBuilder<List<UserProfile>>(
            stream: _firestoreService.getUsersStream(),
            builder: (context, snapshot) {
              final users = snapshot.data ?? [];
              final unconfirmedCount = users.where((u) => u.status == 'unconfirmed').length;

              // Filtrado por buscador
              final filteredUsers = users.where((u) {
                final q = _searchQuery.toLowerCase();
                return u.displayName.toLowerCase().contains(q) || u.email.toLowerCase().contains(q);
              }).toList();

              // Mantener referencia fresca al usuario seleccionado
              UserProfile? activeSelected = _selectedUser;
              if (activeSelected != null) {
                final found = users.where((u) => u.uid == activeSelected!.uid);
                if (found.isNotEmpty) {
                  activeSelected = found.first;
                }
              }

              return Column(
                children: [
                  // Header
                  _buildHeader(context, users.length, unconfirmedCount),

                  // Barra de progreso si está procesando
                  if (_isProcessing)
                    const LinearProgressIndicator(
                      backgroundColor: Color(0xFF21262D),
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFF59E0B)),
                      minHeight: 2,
                    ),

                  // Contenido principal
                  Expanded(
                    child: isNarrow
                        ? _buildNarrowLayout(filteredUsers, activeSelected)
                        : _buildWideSplitLayout(filteredUsers, activeSelected),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  // Header del modal
  Widget _buildHeader(BuildContext context, int totalUsers, int unconfirmedCount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: const BoxDecoration(
        color: Color(0xFF0D1117),
        border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.admin_panel_settings, color: Color(0xFFF59E0B), size: 20),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Gestión de Usuarios',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        '$totalUsers usuario\${totalUsers == 1 ? "" : "s"} registrados',
                        style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                      ),
                      if (unconfirmedCount > 0) ...[
                        const Text(' · ', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                        Text(
                          '$unconfirmedCount sin confirmar',
                          style: const TextStyle(
                            color: Color(0xFFF59E0B),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }

  // Vista Split (Desktop / Tablet)
  Widget _buildWideSplitLayout(List<UserProfile> users, UserProfile? selectedUser) {
    return Row(
      children: [
        // Columna Izquierda: Lista de Usuarios (60% ancho)
        Expanded(
          flex: 6,
          child: Container(
            decoration: const BoxDecoration(
              color: Color(0xFF0D1117),
              border: Border(right: BorderSide(color: Color(0xFF30363D))),
            ),
            child: Column(
              children: [
                // Input de búsqueda
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Buscar por nombre o email...',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 18),
                      filled: true,
                      fillColor: const Color(0xFF161B22),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                      ),
                    ),
                  ),
                ),

                // Lista scrolleable
                Expanded(
                  child: users.isEmpty
                      ? const Center(
                          child: Text(
                            'No se encontraron usuarios',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          itemCount: users.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 6),
                          itemBuilder: (context, idx) {
                            final u = users[idx];
                            final isSelected = selectedUser?.uid == u.uid;
                            return _buildUserListTile(u, isSelected);
                          },
                        ),
                ),
              ],
            ),
          ),
        ),

        // Columna Derecha: Detalle y Acciones del Usuario (40% ancho)
        Expanded(
          flex: 5,
          child: Container(
            color: const Color(0xFF161B22),
            child: selectedUser == null
                ? _buildEmptySelectionState()
                : _buildUserDetailPanel(selectedUser),
          ),
        ),
      ],
    );
  }

  // Vista Mobile / Estrecha
  Widget _buildNarrowLayout(List<UserProfile> users, UserProfile? selectedUser) {
    if (selectedUser != null) {
      return Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: const Color(0xFF21262D),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                  onPressed: () => setState(() => _selectedUser = null),
                ),
                const SizedBox(width: 8),
                const Text('Volver a la lista', style: TextStyle(color: Colors.white, fontSize: 13)),
              ],
            ),
          ),
          Expanded(child: _buildUserDetailPanel(selectedUser)),
        ],
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            onChanged: (val) => setState(() => _searchQuery = val),
            style: const TextStyle(color: Colors.white, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Buscar por nombre o email...',
              hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
              prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 18),
              filled: true,
              fillColor: const Color(0xFF0D1117),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFF30363D)),
              ),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(8),
            itemCount: users.length,
            separatorBuilder: (_, __) => const SizedBox(height: 6),
            itemBuilder: (context, idx) {
              final u = users[idx];
              return _buildUserListTile(u, false);
            },
          ),
        ),
      ],
    );
  }

  // Item de la lista de usuarios
  Widget _buildUserListTile(UserProfile user, bool isSelected) {
    final isConfirmed = user.status == 'confirmed';
    final hasBalance = user.balance > 0;

    return InkWell(
      onTap: () {
        setState(() {
          _selectedUser = user;
          _balanceAction = null;
          _balanceError = null;
        });
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF21262D) : const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF30363D),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFF30363D),
              backgroundImage: user.photoURL.isNotEmpty ? NetworkImage(user.photoURL) : null,
              child: user.photoURL.isEmpty
                  ? Text(
                      user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : '?',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    )
                  : null,
            ),
            const SizedBox(width: 12),

            // Info principal
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          user.displayName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (user.isAdmin) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withOpacity(0.2),
                            border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.5)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'ADMIN',
                            style: TextStyle(
                              color: Color(0xFFF59E0B),
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user.email,
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),

            const SizedBox(width: 8),

            // Saldo y Badge de Estado
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '\\$\${user.balance.toStringAsFixed(2)} USD',
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: hasBalance ? const Color(0xFF34D399) : const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 3),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isConfirmed
                        ? const Color(0xFF10B981).withOpacity(0.15)
                        : const Color(0xFFF59E0B).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isConfirmed
                          ? const Color(0xFF10B981).withOpacity(0.4)
                          : const Color(0xFFF59E0B).withOpacity(0.4),
                    ),
                  ),
                  child: Text(
                    isConfirmed ? 'Confirmado' : 'Sin confirmar',
                    style: TextStyle(
                      color: isConfirmed ? const Color(0xFF34D399) : const Color(0xFFF59E0B),
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // Panel derecho: Detalle del usuario seleccionado
  Widget _buildUserDetailPanel(UserProfile user) {
    final isConfirmed = user.status == 'confirmed';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Perfil Header
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: const Color(0xFF30363D),
                backgroundImage: user.photoURL.isNotEmpty ? NetworkImage(user.photoURL) : null,
                child: user.photoURL.isEmpty
                    ? Text(
                        user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : '?',
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                      )
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.displayName,
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.email,
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text(
                          user.role.toUpperCase(),
                          style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: isConfirmed
                                ? const Color(0xFF10B981).withOpacity(0.15)
                                : const Color(0xFFF59E0B).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isConfirmed
                                  ? const Color(0xFF10B981).withOpacity(0.4)
                                  : const Color(0xFFF59E0B).withOpacity(0.4),
                            ),
                          ),
                          child: Text(
                            isConfirmed ? 'Confirmado' : 'Sin confirmar',
                            style: TextStyle(
                              color: isConfirmed ? const Color(0xFF34D399) : const Color(0xFFF59E0B),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Banner de usuario sin confirmar (§3.2)
          if (!isConfirmed) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.1),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.35)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.info_outline, color: Color(0xFFF59E0B), size: 16),
                      SizedBox(width: 8),
                      Text(
                        'Usuario Pendiente de Aprobación',
                        style: TextStyle(color: Color(0xFFF59E0B), fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Este usuario requiere confirmación para poder participar en órdenes activas y agregar cartas.',
                    style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, height: 1.3),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.check_circle_outline, size: 16),
                      label: const Text('Confirmar cuenta'),
                      onPressed: () => _handleConfirmUser(user),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: const Color(0xFF0D1117),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Tarjeta de Saldo a Favor (§5.8)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Saldo a Favor en Perfil',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '\\$\${user.balance.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        color: Color(0xFF34D399),
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text('USD', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'El saldo se acumula automáticamente al liquidar órdenes con excedentes o mediante abonos manuales del admin.',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 11, height: 1.3),
                ),
                const SizedBox(height: 14),

                // Botones de acción de saldo
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.add, size: 15),
                        label: const Text('Agregar saldo'),
                        onPressed: () {
                          setState(() {
                            _balanceAction = 'credit';
                            _amountController.clear();
                            _descController.clear();
                            _balanceError = null;
                          });
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF21262D),
                          foregroundColor: const Color(0xFF34D399),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(color: const Color(0xFF10B981).withOpacity(0.3)),
                          ),
                          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.remove, size: 15),
                        label: const Text('Registrar salida'),
                        onPressed: user.balance <= 0
                            ? null
                            : () {
                                setState(() {
                                  _balanceAction = 'outflow';
                                  _amountController.clear();
                                  _descController.clear();
                                  _balanceError = null;
                                });
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF21262D),
                          foregroundColor: const Color(0xFFF87171),
                          disabledBackgroundColor: const Color(0xFF161B22),
                          disabledForegroundColor: const Color(0xFF475569),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(
                              color: user.balance > 0
                                  ? const Color(0xFFEF4444).withOpacity(0.3)
                                  : Colors.transparent,
                            ),
                          ),
                          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // Botón ver historial
                SizedBox(
                  width: double.infinity,
                  child: TextButton.icon(
                    icon: const Icon(Icons.history, size: 15, color: Color(0xFF94A3B8)),
                    label: const Text(
                      'Ver historial de movimientos',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    ),
                    onPressed: () => _openMovementsHistoryModal(user),
                  ),
                ),
              ],
            ),
          ),

          // Formulario Inline de Abono o Salida
          if (_balanceAction != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1117),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _balanceAction == 'credit' ? 'Agregar Saldo a Favor' : 'Registrar Salida de Saldo',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 16, color: Color(0xFF94A3B8)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => setState(() => _balanceAction = null),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Input Monto
                  const Text('Monto (\\$ USD)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Ej. 15.00',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF161B22),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Input Descripción
                  const Text('Motivo / Descripción (obligatoria)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _descController,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    decoration: InputDecoration(
                      hintText: 'Ej. Devolución de carta agotada',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF161B22),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                      ),
                    ),
                  ),

                  // Mensaje de error
                  if (_balanceError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _balanceError!,
                      style: const TextStyle(color: Color(0xFFF87171), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],

                  const SizedBox(height: 12),

                  // Botones cancelar y confirmar
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => setState(() => _balanceAction = null),
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFF94A3B8),
                          textStyle: const TextStyle(fontSize: 12),
                        ),
                        child: const Text('Cancelar'),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _isProcessing ? null : _handleSaveBalanceMutation,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF59E0B),
                          foregroundColor: const Color(0xFF0D1117),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        child: const Text('Guardar'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // Estado cuando no hay usuario seleccionado
  Widget _buildEmptySelectionState() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.person_search_outlined, size: 48, color: Color(0xFF475569)),
            SizedBox(height: 12),
            Text(
              'Selecciona un usuario',
              style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 6),
            Text(
              'Haz clic en cualquier usuario de la lista para revisar su estado, confirmar su cuenta o gestionar su saldo a favor.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B), fontSize: 12, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
`,
    },

    // ==========================================
    // SERVICIOS Y REGLAS
    // ==========================================
    firestore_service: {
      title: 'FirestoreService & Reglas de Negocio',
      filename: 'lib/services/firestore_service.dart',
      language: 'dart',
      category: 'services',
      desc: 'Servicio central con todas las operaciones: órdenes, items con regla de upsert, pagos, saldos a favor por finalización y confirmación de usuarios.',
      code: `import 'dart:math';
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
`,
    },

    rescraper: {
      title: 'Servicio de Refresco de Precios & Throttling (§7.1)',
      filename: 'lib/services/price_rescraper_service.dart',
      language: 'dart',
      category: 'services',
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
            headers: {'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36'},
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
`,
    },

    pusher: {
      title: 'Lanzador 1 a 1 al Carrito Online de CK (§5.10)',
      filename: 'lib/services/ck_cart_pusher.dart',
      language: 'dart',
      category: 'services',
      desc: 'Inyecta las cartas al carrito Laravel dentro del WebView de Card Kingdom con product_id, estilo y throttle de 5s.',
      code: `import 'dart:async';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/purchases_models.dart';

class CkCartPusher {
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

      await Future.delayed(const Duration(seconds: 5));
    }
  }
}
`,
    },

    rules: {
      title: 'Reglas de Seguridad Firestore',
      filename: 'firestore.rules',
      language: 'javascript',
      category: 'rules',
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

    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAdmin() || (isAuthenticated() && request.auth.uid == userId && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status', 'balance']));
      allow delete: if isAdmin();
    }

    match /purchase_orders/{orderId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
      
      match /items/{itemId} {
        allow read: if isAuthenticated();
        allow create, update: if isConfirmed() && resource.data.status != 'finalized';
        allow delete: if (isAdmin() || (isAuthenticated() && resource.data.buyerEmail == request.auth.token.email)) && resource.data.status != 'finalized';
      }

      match /payments/{paymentId} {
        allow read: if isAuthenticated();
        allow write: if isAdmin() && get(/databases/$(database)/documents/purchase_orders/$(orderId)).data.status != 'finalized';
      }
    }

    match /balance_movements/{movementId} {
      allow read: if isAuthenticated() && (isAdmin() || resource.data.email == request.auth.token.email);
      allow write: if isAdmin();
    }

    match /app_settings/{document} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
`,
    },
  };

  const filteredFiles = Object.entries(flutterFiles).filter(([key, f]) => {
    const matchesCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchesSearch = searchFilter === '' ||
      f.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.filename.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.desc.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const currentFile = flutterFiles[activeFile] || (filteredFiles.length > 0 ? filteredFiles[0][1] : flutterFiles['order_detail_screen']);

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
            <span className="uppercase tracking-wider">PurchasesManabros · Arquitectura Flutter & Dart Completa</span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Componentes y Pantallas en Flutter (Dart)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Todos los componentes y pantallas de la aplicación web implementados en código Flutter nativo: reglas de upsert, FirestoreService, tarjetas de comprador, modal de abonos, pantallas de detalle, historial de órdenes, carga masiva y navegador Card Kingdom.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href="/api/download-flutter-archive"
            download="manabros_flutter_app.tar.gz"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-sm"
            title="Descargar todos los archivos físicos de Flutter en un paquete comprimido"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Proyecto (.tar.gz)</span>
          </a>

          <button
            onClick={copyToClipboard}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '¡Copiado!' : 'Copiar Archivo Actual'}</span>
          </button>
        </div>
      </div>

      {/* Physical Repo Directory Info Banner */}
      <div className="bg-[#1C2128] border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <FolderArchive className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold text-emerald-400">Archivos Físicos Disponibles en el Repositorio:</span>{' '}
            <span className="text-slate-300">
              Todos los archivos ya están creados físicamente en la carpeta <code className="bg-[#0D1117] text-amber-300 px-1.5 py-0.5 rounded font-mono text-[11px]">/flutter_app/</code> del proyecto con <code className="bg-[#0D1117] text-amber-300 px-1.5 py-0.5 rounded font-mono text-[11px]">pubspec.yaml</code>, modelos, pantallas, widgets y reglas.
            </span>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-300 font-mono">
          <span>Ruta: ./flutter_app/lib/...</span>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#161B22] border border-[#30363D] p-3 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'Todos', icon: Layers },
            { id: 'screens', label: 'Pantallas (Screens)', icon: Monitor },
            { id: 'widgets', label: 'Widgets & Cards', icon: Box },
            { id: 'services', label: 'Servicios', icon: Code2 },
            { id: 'rules', label: 'Reglas Firestore', icon: ShieldCheck },
          ].map((cat) => {
            const IconComponent = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                    : 'bg-[#21262D] text-slate-300 hover:text-white border border-[#30363D]'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-56 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar componente..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Files List Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#30363D]">
        {filteredFiles.map(([key, f]) => (
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
