import 'package:flutter/material.dart';
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
