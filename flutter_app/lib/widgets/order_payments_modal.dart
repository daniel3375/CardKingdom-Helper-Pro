import 'package:flutter/material.dart';
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
