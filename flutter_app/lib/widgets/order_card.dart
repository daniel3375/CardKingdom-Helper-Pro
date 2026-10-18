import 'dart:math';
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
