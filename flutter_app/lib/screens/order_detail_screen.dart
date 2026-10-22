import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import 'mass_entry_screen.dart';

/// =========================================================================
/// PANTALLA: DETALLE DE ORDEN ACTIVA (§5.1, §5.2, §5.3, §8.3)
///
/// Pantalla central de gestión de la orden activa:
/// 1. Contexto y rol: Admin (control total) vs. Comprador (mi carrito).
/// 2. Métricas financieras en vivo: Total consolidado, abonado, restante y cobertura.
/// 3. Búsqueda y filtrado en tiempo real por comprador, nombre de carta o condición.
/// 4. Vistas por pestaña:
///    - Compradores: Desglose por miembro con prorrateo de flete (§5.6) y abonos rápidos.
///    - Cartas: Vista consolidada con imágenes, stocks, deltas de precio y edición de items.
///    - Flete / Envío: Courier nacional (MRW, Tealca, Zoom), tracking y costo global.
///    - Resumen: Métricas consolidadas, auditoría y ciclo de vida de la orden.
/// 5. Automatización: Re-escaneo de precios (§5.9) y Lanzador 1 a 1 al Carrito (§5.10).
/// =========================================================================

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  final bool isAdmin;
  final String currentUserEmail;
  final String currentUserName;

  const OrderDetailScreen({
    super.key,
    required this.orderId,
    required this.isAdmin,
    required this.currentUserEmail,
    this.currentUserName = '',
  });

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen>
    with SingleTickerProviderStateMixin {
  final FirestoreService _firestore = FirestoreService();
  late TabController _tabController;

  String _searchQuery = '';
  String _selectedBuyerFilter = 'all';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
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
            body: Center(
              child: CircularProgressIndicator(color: Color(0xFFFBBF24)),
            ),
          );
        }

        final order = orderSnapshot.data;
        if (order == null) {
          return Scaffold(
            backgroundColor: const Color(0xFF0D1117),
            appBar: AppBar(
              backgroundColor: const Color(0xFF161B22),
              title: const Text('Orden no encontrada'),
            ),
            body: const Center(
              child: Text(
                'No existe la orden solicitada o ha sido archivada.',
                style: TextStyle(color: Colors.white70),
              ),
            ),
          );
        }

        return StreamBuilder<List<OrderItem>>(
          stream: _firestore.getOrderItemsStream(widget.orderId),
          builder: (context, itemsSnapshot) {
            final allItems = itemsSnapshot.data ?? [];

            return StreamBuilder<List<Payment>>(
              stream: _firestore.getOrderPaymentsStream(widget.orderId),
              builder: (context, paymentsSnapshot) {
                final payments = paymentsSnapshot.data ?? [];

                // Cálculos financieros globales
                final totalCards = allItems.fold<int>(0, (sum, i) => sum + i.quantity);
                final totalCardsAmount = allItems.fold<double>(0.0, (sum, i) => sum + (i.price * i.quantity));
                final shippingCost = order.shippingCost ?? 0.0;
                final grandTotal = totalCardsAmount + shippingCost;
                final totalPaid = payments.fold<double>(0.0, (sum, p) => sum + p.amount);
                final paymentProgress = grandTotal > 0 ? (totalPaid / grandTotal).clamp(0.0, 1.0) : 0.0;
                final remainingBalance = (grandTotal - totalPaid > 0) ? grandTotal - totalPaid : 0.0;

                // Agrupación de compradores
                final Map<String, List<OrderItem>> buyerItemsMap = {};
                for (final item in allItems) {
                  buyerItemsMap.putIfAbsent(item.buyerEmail, () => []).add(item);
                }

                // Filtrar cartas según búsqueda y comprador seleccionado
                final filteredItems = allItems.where((item) {
                  final matchesBuyer = _selectedBuyerFilter == 'all' || item.buyerEmail == _selectedBuyerFilter;
                  final q = _searchQuery.toLowerCase().trim();
                  if (q.isEmpty) return matchesBuyer;

                  final matchesSearch = item.cardName.toLowerCase().contains(q) ||
                      item.edition.toLowerCase().contains(q) ||
                      item.condition.toLowerCase().contains(q) ||
                      item.buyerName.toLowerCase().contains(q) ||
                      item.buyerEmail.toLowerCase().contains(q);

                  return matchesBuyer && matchesSearch;
                }).toList();

                return Scaffold(
                  backgroundColor: const Color(0xFF0D1117),
                  appBar: AppBar(
                    backgroundColor: const Color(0xFF161B22),
                    elevation: 0,
                    titleSpacing: 16,
                    title: Row(
                      children: [
                        InkWell(
                          onTap: () {
                            Clipboard.setData(ClipboardData(text: order.id));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('ID de Orden copiado al portapapeles'),
                                duration: Duration(seconds: 2),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(6),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                            child: Row(
                              children: [
                                Text(
                                  'ORDEN #\${order.id.length > 8 ? order.id.substring(0, 8).toUpperCase() : order.id.toUpperCase()}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.copy_rounded, size: 13, color: Color(0xFF8B949E)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _buildStatusBadge(order.status),
                      ],
                    ),
                    actions: [
                      // Re-escaneo de Precios (Admin)
                      if (widget.isAdmin)
                        IconButton(
                          icon: const Icon(Icons.price_change_outlined, color: Color(0xFFFBBF24)),
                          tooltip: 'Actualizar Precios CK (§5.9)',
                          onPressed: () => _triggerPriceRescrape(allItems),
                        ),

                      // Lanzador 1 a 1 a Card Kingdom (Admin)
                      if (widget.isAdmin)
                        IconButton(
                          icon: const Icon(Icons.play_circle_fill_rounded, color: Color(0xFF38BDF8)),
                          tooltip: 'Lanzador 1 a 1 a Card Kingdom (§5.10)',
                          onPressed: () => _triggerCartPusher(allItems),
                        ),

                      // Gestión de Abonos
                      if (widget.isAdmin)
                        IconButton(
                          icon: const Icon(Icons.payments_rounded, color: Color(0xFF34D399)),
                          tooltip: 'Gestión de Abonos',
                          onPressed: () => _openPaymentsModal(context, order, allItems, payments),
                        ),

                      // Menú de opciones adicionales
                      PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert, color: Color(0xFF8B949E)),
                        color: const Color(0xFF161B22),
                        onSelected: (val) {
                          if (val == 'browser') {
                            _openBrowser();
                          } else if (val == 'mass_entry') {
                            _openMassEntry();
                          } else if (val == 'copy_id') {
                            Clipboard.setData(ClipboardData(text: order.id));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('ID de Orden copiado')),
                            );
                          }
                        },
                        itemBuilder: (ctx) => [
                          const PopupMenuItem(
                            value: 'browser',
                            child: Row(
                              children: [
                                Icon(Icons.travel_explore_rounded, size: 16, color: Color(0xFFFBBF24)),
                                SizedBox(width: 8),
                                Text('Navegador & Captura', style: TextStyle(color: Colors.white, fontSize: 13)),
                              ],
                            ),
                          ),
                          const PopupMenuItem(
                            value: 'mass_entry',
                            child: Row(
                              children: [
                                Icon(Icons.playlist_add_rounded, size: 16, color: Color(0xFF38BDF8)),
                                SizedBox(width: 8),
                                Text('Carga Masiva de Cartas', style: TextStyle(color: Colors.white, fontSize: 13)),
                              ],
                            ),
                          ),
                          const PopupMenuDivider(height: 1),
                          const PopupMenuItem(
                            value: 'copy_id',
                            child: Row(
                              children: [
                                Icon(Icons.copy_rounded, size: 16, color: Color(0xFF8B949E)),
                                SizedBox(width: 8),
                                Text('Copiar ID de Orden', style: TextStyle(color: Colors.white70, fontSize: 13)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                    bottom: TabBar(
                      controller: _tabController,
                      indicatorColor: const Color(0xFFFBBF24),
                      indicatorWeight: 3,
                      labelColor: const Color(0xFFFBBF24),
                      unselectedLabelColor: const Color(0xFF8B949E),
                      tabs: [
                        Tab(text: 'Compradores (\${buyerItemsMap.length})'),
                        Tab(text: 'Cartas (\${allItems.length})'),
                        const Tab(text: 'Flete / Envío'),
                        const Tab(text: 'Resumen'),
                      ],
                    ),
                  ),
                  body: Column(
                    children: [
                      // Context Banner de Rol
                      _buildRoleContextBanner(order),

                      // Barra de Progreso Financiero
                      _buildFinancialSummaryBar(
                        totalCards: totalCards,
                        totalAmount: grandTotal,
                        totalPaid: totalPaid,
                        remaining: remainingBalance,
                        progress: paymentProgress,
                        status: order.status,
                      ),

                      // Barra de Búsqueda y Chips de Filtro (Visible en pestañas 1 y 2)
                      _buildSearchAndFilterBar(buyerItemsMap),

                      // Contenido de Tabs
                      Expanded(
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            // Tab 1: Compradores
                            _buildBuyersTab(
                              buyerItemsMap: buyerItemsMap,
                              payments: payments,
                              shippingCost: shippingCost,
                              totalCardsAmount: totalCardsAmount,
                              orderStatus: order.status,
                            ),

                            // Tab 2: Cartas Consolidadas
                            _buildConsolidatedCardsTab(
                              items: filteredItems,
                              allItemsCount: allItems.length,
                              orderStatus: order.status,
                            ),

                            // Tab 3: Envíos y Tracking
                            ShippingManagementCard(
                              order: order,
                              isAdmin: widget.isAdmin,
                              totalCardsAmount: totalCardsAmount,
                            ),

                            // Tab 4: Resumen Global y Métricas
                            _buildGlobalSummaryTab(
                              order: order,
                              items: allItems,
                              payments: payments,
                              totalCards: totalCards,
                              totalCardsAmount: totalCardsAmount,
                              shippingCost: shippingCost,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  bottomNavigationBar: widget.isAdmin ? _buildAdminActionBar(order, allItems) : null,
                  floatingActionButton: _buildFloatingActionButton(),
                );
              },
            );
          },
        );
      },
    );
  }

  /// Banner contextual de rol y fecha límite
  Widget _buildRoleContextBanner(PurchaseOrder order) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(
                widget.isAdmin ? Icons.shield_rounded : Icons.person_rounded,
                size: 14,
                color: widget.isAdmin ? const Color(0xFFFBBF24) : const Color(0xFF38BDF8),
              ),
              const SizedBox(width: 6),
              Text(
                widget.isAdmin
                    ? 'ADMINISTRADOR MANABROS · CONTROL TOTAL'
                    : 'COMPRADOR · MI CARRITO EN LA ORDEN',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.3,
                  color: widget.isAdmin ? const Color(0xFFFBBF24) : const Color(0xFF38BDF8),
                ),
              ),
            ],
          ),
          if (order.deadline != null)
            Row(
              children: [
                const Icon(Icons.alarm, size: 12, color: Color(0xFF94A3B8)),
                const SizedBox(width: 4),
                Text(
                  'Cierre: \${DateFormat('dd/MM/yyyy').format(order.deadline!)}',
                  style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontFamily: 'monospace'),
                ),
              ],
            ),
        ],
      ),
    );
  }

  /// Barra de resumen financiero con progreso
  Widget _buildFinancialSummaryBar({
    required int totalCards,
    required double totalAmount,
    required double totalPaid,
    required double remaining,
    required double progress,
    required String status,
  }) {
    final bool isCovered = totalPaid >= totalAmount && totalAmount > 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                    '\\$\${totalAmount.toStringAsFixed(2)} USD',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'Abonado: \\$\${totalPaid.toStringAsFixed(2)} USD (\${(progress * 100).toInt()}%)',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isCovered ? const Color(0xFF34D399) : const Color(0xFFFBBF24),
                    ),
                  ),
                  Text(
                    'Faltante: \\$\${remaining.toStringAsFixed(2)} USD',
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

  /// Barra de búsqueda y selector de comprador
  Widget _buildSearchAndFilterBar(Map<String, List<OrderItem>> buyerItemsMap) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFF0D1117),
        border: Border(bottom: BorderSide(color: Color(0xFF21262D))),
      ),
      child: Column(
        children: [
          // Input de búsqueda
          SizedBox(
            height: 36,
            child: TextField(
              controller: _searchController,
              onChanged: (val) => setState(() => _searchQuery = val),
              style: const TextStyle(fontSize: 12, color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Buscar carta por nombre, edición o comprador...',
                hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                prefixIcon: const Icon(Icons.search, size: 16, color: Color(0xFF64748B)),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 14, color: Color(0xFF64748B)),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: const Color(0xFF161B22),
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF30363D)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFFBBF24)),
                ),
              ),
            ),
          ),

          // Chips horizontales de filtro por Comprador
          if (buyerItemsMap.length > 1) ...[
            const SizedBox(height: 6),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildBuyerFilterChip('all', 'Todos'),
                  ...buyerItemsMap.entries.map((entry) {
                    final buyerName = entry.value.isNotEmpty ? entry.value.first.buyerName : entry.key;
                    return _buildBuyerFilterChip(entry.key, buyerName);
                  }),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBuyerFilterChip(String key, String label) {
    final isSelected = _selectedBuyerFilter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => setState(() => _selectedBuyerFilter = key),
        labelStyle: TextStyle(
          fontSize: 11,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          color: isSelected ? const Color(0xFF0D1117) : const Color(0xFF8B949E),
        ),
        selectedColor: const Color(0xFFFBBF24),
        backgroundColor: const Color(0xFF161B22),
        side: BorderSide(color: isSelected ? const Color(0xFFFBBF24) : const Color(0xFF30363D)),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }

  /// Pestaña 1: Compradores
  Widget _buildBuyersTab({
    required Map<String, List<OrderItem>> buyerItemsMap,
    required List<Payment> payments,
    required double shippingCost,
    required double totalCardsAmount,
    required String orderStatus,
  }) {
    if (buyerItemsMap.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.shopping_bag_outlined, size: 48, color: Color(0xFF30363D)),
            const SizedBox(height: 12),
            const Text('No hay cartas añadidas a esta orden aún.', style: TextStyle(color: Color(0xFF8B949E))),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Agregar Cartas'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFBBF24),
                foregroundColor: const Color(0xFF0D1117),
              ),
              onPressed: _openBrowser,
            ),
          ],
        ),
      );
    }

    final filteredEntries = buyerItemsMap.entries.where((e) {
      if (_selectedBuyerFilter != 'all') {
        return e.key == _selectedBuyerFilter;
      }
      return true;
    }).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: filteredEntries.map((entry) {
        final buyerEmail = entry.key;
        final items = entry.value;
        final buyerName = items.isNotEmpty ? items.first.buyerName : buyerEmail;

        // Subtotal de cartas del comprador
        final buyerCardsTotal = items.fold<double>(0.0, (sum, i) => sum + (i.price * i.quantity));

        // Cuota proporcional de envío (§5.6)
        final shippingShare = totalCardsAmount > 0
            ? (buyerCardsTotal / totalCardsAmount) * shippingCost
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

  /// Pestaña 2: Cartas Consolidadas
  Widget _buildConsolidatedCardsTab({
    required List<OrderItem> items,
    required int allItemsCount,
    required String orderStatus,
  }) {
    if (items.isEmpty) {
      return Center(
        child: Text(
          allItemsCount == 0
              ? 'No hay cartas registradas en la orden.'
              : 'Ninguna carta coincide con la búsqueda o filtro.',
          style: const TextStyle(color: Color(0xFF8B949E)),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = items[index];
        final bool canEditThis = widget.isAdmin || widget.currentUserEmail == item.buyerEmail;

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF161B22),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Imagen miniatura
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: item.imageUrl.isNotEmpty
                    ? Image.network(
                        item.imageUrl,
                        width: 46,
                        height: 64,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _buildCardFallbackImage(),
                      )
                    : _buildCardFallbackImage(),
              ),
              const SizedBox(width: 12),

              // Información central
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            item.cardName,
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (item.foil) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('FOIL', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 9, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '\${item.edition} · [\${item.condition}]',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFF21262D),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            item.buyerName.isNotEmpty ? item.buyerName : item.buyerEmail,
                            style: const TextStyle(fontSize: 10, color: Color(0xFF58A6FF)),
                          ),
                        ),
                        if (!item.inStock) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('AGOTADO', style: TextStyle(color: Color(0xFFEF4444), fontSize: 9, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Subtotal y menú contextual
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '\${item.quantity}x \\$\${item.price.toStringAsFixed(2)}',
                    style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Colors.white, fontSize: 12),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '\\$\${(item.price * item.quantity).toStringAsFixed(2)} USD',
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Color(0xFF34D399), fontWeight: FontWeight.bold),
                  ),
                  if (canEditThis) ...[
                    const SizedBox(height: 4),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        InkWell(
                          onTap: () => _openEditItemDialog(item),
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(Icons.edit_outlined, size: 14, color: Color(0xFF8B949E)),
                          ),
                        ),
                        InkWell(
                          onTap: () => _confirmDeleteItem(item),
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(Icons.delete_outline, size: 14, color: Color(0xFFEF4444)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCardFallbackImage() {
    return Container(
      width: 46,
      height: 64,
      color: const Color(0xFF21262D),
      child: const Icon(Icons.style, color: Colors.white24, size: 20),
    );
  }

  /// Pestaña 4: Resumen Global
  Widget _buildGlobalSummaryTab({
    required PurchaseOrder order,
    required List<OrderItem> items,
    required List<Payment> payments,
    required int totalCards,
    required double totalCardsAmount,
    required double shippingCost,
  }) {
    final grandTotal = totalCardsAmount + shippingCost;
    final totalPaid = payments.fold<double>(0.0, (sum, p) => sum + p.amount);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Tarjeta Principal
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
                const Text(
                  'Métricas Consolidadas de la Orden',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 12),
                _buildSummaryRow('Estado Actual', order.status.toUpperCase()),
                _buildSummaryRow('Fecha de Apertura', DateFormat('dd/MM/yyyy HH:mm').format(order.createdAt)),
                if (order.deadline != null)
                  _buildSummaryRow('Fecha Límite Cierre', DateFormat('dd/MM/yyyy HH:mm').format(order.deadline!)),
                _buildSummaryRow('Total Cartas en Orden', '$totalCards unidades'),
                _buildSummaryRow('Subtotal Cartas (USD)', '\\$\${totalCardsAmount.toStringAsFixed(2)}'),
                _buildSummaryRow('Costo de Flete / Envío', '\\$\${shippingCost.toStringAsFixed(2)}'),
                const Divider(color: Color(0xFF30363D), height: 24),
                _buildSummaryRow(
                  'TOTAL GLOBAL A PAGAR',
                  '\\$\${grandTotal.toStringAsFixed(2)} USD',
                  isBold: true,
                ),
                _buildSummaryRow(
                  'TOTAL ABONADO',
                  '\\$\${totalPaid.toStringAsFixed(2)} USD',
                  valueColor: totalPaid >= grandTotal && grandTotal > 0 ? const Color(0xFF34D399) : const Color(0xFFFBBF24),
                ),
                _buildSummaryRow(
                  'SALDO PENDIENTE',
                  '\\$\${(grandTotal - totalPaid > 0 ? grandTotal - totalPaid : 0.0).toStringAsFixed(2)} USD',
                  valueColor: const Color(0xFFEF4444),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Acciones Rápidas
          if (widget.isAdmin)
            ElevatedButton.icon(
              icon: const Icon(Icons.playlist_add_check_rounded, size: 16),
              label: const Text('Re-escanear Precios de Todas las Cartas (§5.9)'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF21262D),
                foregroundColor: const Color(0xFF58A6FF),
                side: const BorderSide(color: Color(0xFF30363D)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: () => _triggerPriceRescrape(items),
            ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: const Color(0xFF8B949E),
              fontSize: 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? Colors.white,
              fontSize: 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }

  /// Barra flotante inferior de administración
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
              label: const Text('Precios CK', style: TextStyle(fontSize: 12)),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF58A6FF),
                side: const BorderSide(color: Color(0xFF30363D)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: () => _triggerPriceRescrape(items),
            ),
          ),
          const SizedBox(width: 8),

          // Botón Avanzar Estado de la Orden
          Expanded(
            child: ElevatedButton.icon(
              icon: const Icon(Icons.swap_horiz_rounded, size: 16),
              label: Text(
                _getNextStatusLabel(order.status),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
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

  Widget? _buildFloatingActionButton() {
    return FloatingActionButton.extended(
      backgroundColor: const Color(0xFFFBBF24),
      foregroundColor: const Color(0xFF0D1117),
      icon: const Icon(Icons.add_shopping_cart, size: 18),
      label: const Text('Agregar Cartas', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      onPressed: () {
        showModalBottomSheet(
          context: context,
          backgroundColor: const Color(0xFF161B22),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          builder: (ctx) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFBBF24).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.travel_explore_rounded, color: Color(0xFFFBBF24)),
                    ),
                    title: const Text('Navegador & Captura Card Kingdom', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Navega o pega URL para scrapear stock y condiciones en vivo', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                    onTap: () {
                      Navigator.pop(ctx);
                      _openBrowser();
                    },
                  ),
                  const Divider(color: Color(0xFF30363D)),
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF38BDF8).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.playlist_add_rounded, color: Color(0xFF38BDF8)),
                    ),
                    title: const Text('Carga Masiva de Cartas', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    subtitle: const Text('Pega listas de texto completas en formato estándar', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                    onTap: () {
                      Navigator.pop(ctx);
                      _openMassEntry();
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _openBrowser() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CkWebViewScreen(
          activeOrderId: widget.orderId,
          currentUserEmail: widget.currentUserEmail,
          currentUserName: widget.currentUserName,
          isAdmin: widget.isAdmin,
        ),
      ),
    );
  }

  void _openMassEntry() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MassEntryScreen(
          orderId: widget.orderId,
          currentUserEmail: widget.currentUserEmail,
          currentUserName: widget.currentUserName,
        ),
      ),
    );
  }

  String _getNextStatusLabel(String current) {
    switch (current) {
      case 'pending':
        return 'Activar Orden';
      case 'active':
        return 'Marcar Comprada';
      case 'purchased':
        return 'Finalizar Orden';
      default:
        return 'Finalizada';
    }
  }

  Future<void> _advanceOrderStatus(PurchaseOrder order) async {
    String nextStatus;
    if (order.status == 'pending') {
      nextStatus = 'active';
    } else if (order.status == 'active') {
      nextStatus = 'purchased';
    } else if (order.status == 'purchased') {
      nextStatus = 'finalized';
    } else {
      return;
    }

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
              currentUserName: widget.currentUserName,
              isAdmin: widget.isAdmin,
              initialUrl: 'https://www.cardkingdom.com/cart',
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color border;
    Color text;

    switch (status) {
      case 'active':
        bg = const Color(0xFF064E3B);
        border = const Color(0xFF10B981);
        text = const Color(0xFF34D399);
        break;
      case 'purchased':
        bg = const Color(0xFF1E3A8A);
        border = const Color(0xFF3B82F6);
        text = const Color(0xFF60A5FA);
        break;
      case 'finalized':
        bg = const Color(0xFF21262D);
        border = const Color(0xFF484F58);
        text = const Color(0xFF8B949E);
        break;
      default:
        bg = const Color(0xFF451A03);
        border = const Color(0xFFF59E0B);
        text = const Color(0xFFFBBF24);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: text),
      ),
    );
  }

  void _openPaymentsModal(BuildContext context, PurchaseOrder order, List<OrderItem> items, List<Payment> payments) {
    showModalBottomSheet(
      context: context,
      isScrollController: true,
      backgroundColor: Colors.transparent,
      builder: (_) => OrderPaymentsModal(
        orderId: widget.orderId,
        order: order,
        items: items,
        payments: payments,
      ),
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

  void _openEditItemDialog(OrderItem item) {
    final qtyController = TextEditingController(text: item.quantity.toString());
    final priceController = TextEditingController(text: item.price.toStringAsFixed(2));
    String selectedCondition = item.condition;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF161B22),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF30363D)),
          ),
          title: Text(
            'Editar Carta: \${item.cardName}',
            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '\${item.edition} · Comprador: \${item.buyerName}',
                style: const TextStyle(color: Color(0xFF8B949E), fontSize: 11),
              ),
              const SizedBox(height: 16),

              // Cantidad
              const Text('Cantidad', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
              const SizedBox(height: 4),
              TextField(
                controller: qtyController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFF0D1117),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 12),

              // Condición
              const Text('Condición', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
              const SizedBox(height: 4),
              DropdownButtonFormField<String>(
                value: ['NM', 'EX', 'VG', 'G'].contains(selectedCondition) ? selectedCondition : 'NM',
                dropdownColor: const Color(0xFF161B22),
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFF0D1117),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                items: ['NM', 'EX', 'VG', 'G'].map((c) {
                  return DropdownMenuItem(value: c, child: Text(c));
                }).toList(),
                onChanged: (val) {
                  if (val != null) setDialogState(() => selectedCondition = val);
                },
              ),
              const SizedBox(height: 12),

              // Precio unitario
              const Text('Precio Unitario (\\$ USD)', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
              const SizedBox(height: 4),
              TextField(
                controller: priceController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFF0D1117),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar', style: TextStyle(color: Color(0xFF8B949E))),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFBBF24),
                foregroundColor: const Color(0xFF0D1117),
              ),
              onPressed: () async {
                final newQty = int.tryParse(qtyController.text) ?? item.quantity;
                final newPrice = double.tryParse(priceController.text) ?? item.price;

                if (newQty <= 0) {
                  await _firestore.deleteOrderItem(widget.orderId, item.id);
                } else {
                  await _firestore.updateOrderItemDetails(
                    orderId: widget.orderId,
                    itemId: item.id,
                    quantity: newQty,
                    condition: selectedCondition,
                    price: newPrice,
                  );
                }
                if (mounted) Navigator.pop(ctx);
              },
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDeleteItem(OrderItem item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF30363D)),
        ),
        title: const Text('Eliminar Carta', style: TextStyle(color: Colors.white, fontSize: 15)),
        content: Text(
          '¿Deseas eliminar "\${item.cardName}" (\${item.quantity}x) de la orden?',
          style: const TextStyle(color: Color(0xFF8B949E), fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF8B949E))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              await _firestore.deleteOrderItem(widget.orderId, item.id);
              if (mounted) Navigator.pop(ctx);
            },
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
  }
}
