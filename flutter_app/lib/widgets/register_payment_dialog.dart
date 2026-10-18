import 'package:flutter/material.dart';
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
