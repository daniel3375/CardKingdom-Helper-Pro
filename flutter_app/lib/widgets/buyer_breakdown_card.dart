import 'package:flutter/material.dart';
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
