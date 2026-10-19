import 'package:flutter/material.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';

/// =========================================================================
/// WIDGET FLUTTER: ITEM DE CARTA SCRAPEADA EN "NAVEGADOR & CAPTURA"
/// Especificación Técnica ManaBros: §5.2, §5.9, §5.10
///
/// Componente interactivo que presenta los datos extraídos de Card Kingdom:
/// 1. Arte e información de la carta (Nombre, Edición, Tipo, ID de producto).
/// 2. Selector visual de condiciones (NM, EX, VG, G) y acabado (Regular vs Foil).
/// 3. Indicador de stock en tiempo real y precio unitario en USD.
/// 4. Selector de cantidad con stepper (+ / -) acotado al stock disponible.
/// 5. Asignación de Comprador Destino:
///    - Admin (§5.2): puede asignar la carta a cualquier comprador registrado.
///    - Comprador regular: asignado automáticamente a su propio perfil.
/// 6. Guards de seguridad: validación de orden activa y cuenta confirmada (§3.2).
/// 7. Acción de captura con regla de Upsert (§5.10) hacia Firestore.
/// =========================================================================

class ScrapedCardCaptureCard extends StatefulWidget {
  final ScrapedCKCard card;
  final String activeOrderId;
  final UserProfile currentUser;
  final List<UserProfile> allUsers;
  final Function(Map<String, dynamic>)? onCardAdded;
  final VoidCallback? onClose;
  final bool isCompact;

  const ScrapedCardCaptureCard({
    super.key,
    required this.card,
    required this.activeOrderId,
    required this.currentUser,
    this.allUsers = const [],
    this.onCardAdded,
    this.onClose,
    this.isCompact = false,
  });

  /// Método estático de conveniencia para mostrarlo como BottomSheet modal
  static Future<bool?> showAsBottomSheet(
    BuildContext context, {
    required ScrapedCKCard card,
    required String activeOrderId,
    required UserProfile currentUser,
    List<UserProfile> allUsers = const [],
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollController: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Color(0xFF161B22),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(color: Colors.black87, blurRadius: 25, offset: Offset(0, -5)),
            ],
          ),
          child: ScrapedCardCaptureCard(
            card: card,
            activeOrderId: activeOrderId,
            currentUser: currentUser,
            allUsers: allUsers,
            onClose: () => Navigator.of(ctx).pop(false),
          ),
        ),
      ),
    );
  }

  @override
  State<ScrapedCardCaptureCard> createState() => _ScrapedCardCaptureCardState();
}

class _ScrapedCardCaptureCardState extends State<ScrapedCardCaptureCard> {
  final FirestoreService _firestoreService = FirestoreService();

  late String _selectedCondition;
  late bool _isFoil;
  int _selectedQuantity = 1;
  late String _targetBuyerEmail;
  bool _isSubmitting = false;
  bool _justAdded = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initDefaultVariation();
    _targetBuyerEmail = widget.currentUser.email;
  }

  @override
  void didUpdateWidget(covariant ScrapedCardCaptureCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.card.url != widget.card.url || oldWidget.card.title != widget.card.title) {
      _initDefaultVariation();
      _selectedQuantity = 1;
      _justAdded = false;
      _errorMessage = null;
    }
  }

  void _initDefaultVariation() {
    if (widget.card.variations.isNotEmpty) {
      // Buscar primera variación con stock disponible si existe
      final inStockVar = widget.card.variations.where((v) => v.inStock);
      final initial = inStockVar.isNotEmpty ? inStockVar.first : widget.card.variations.first;
      _selectedCondition = initial.condition;
      _isFoil = initial.isFoil;
    } else {
      _selectedCondition = 'NM';
      _isFoil = false;
    }
  }

  CardVariation get _activeVariation {
    if (widget.card.variations.isEmpty) {
      return CardVariation(condition: _selectedCondition, price: 0.0, stock: 0, isFoil: _isFoil);
    }
    return widget.card.variations.firstWhere(
      (v) => v.condition == _selectedCondition && v.isFoil == _isFoil,
      orElse: () => widget.card.variations.first,
    );
  }

  int get _maxStock => _activeVariation.stock > 0 ? _activeVariation.stock : 1;

  UserProfile get _selectedUser {
    if (widget.currentUser.isAdmin && widget.allUsers.isNotEmpty) {
      return widget.allUsers.firstWhere(
        (u) => u.email.toLowerCase() == _targetBuyerEmail.toLowerCase(),
        orElse: () => widget.currentUser,
      );
    }
    return widget.currentUser;
  }

  Future<void> _handleAddToCart() async {
    // Guards
    if (widget.activeOrderId.isEmpty) {
      setState(() => _errorMessage = 'No hay una orden activa actualmente.');
      return;
    }
    if (widget.currentUser.status == 'unconfirmed') {
      setState(() => _errorMessage = 'Tu cuenta aún está pendiente de confirmación por un administrador.');
      return;
    }
    if (!_activeVariation.inStock) {
      setState(() => _errorMessage = 'Esta condición no tiene stock disponible.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final buyer = _selectedUser;
      final price = _activeVariation.price;

      await _firestoreService.addOrUpsertOrderItem(
        orderId: widget.activeOrderId,
        buyerEmail: buyer.email,
        buyerName: buyer.displayName,
        cardName: widget.card.title,
        edition: widget.card.setName,
        condition: _selectedCondition,
        foil: _isFoil,
        price: price,
        quantityToAdd: _selectedQuantity,
        imageUrl: widget.card.imageUrl,
        pageUrl: widget.card.url,
        productId: widget.card.productId,
      );

      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _justAdded = true;
        });

        widget.onCardAdded?.call({
          'cardName': widget.card.title,
          'edition': widget.card.setName,
          'price': price,
          'quantity': _selectedQuantity,
          'condition': _selectedCondition,
          'foil': _isFoil,
          'buyerEmail': buyer.email,
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            content: Text(
              '\${widget.card.title} ($_selectedCondition\${_isFoil ? " Foil" : ""}) agregada a la orden',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
        );

        Future.delayed(const Duration(milliseconds: 2200), () {
          if (mounted) setState(() => _justAdded = false);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'Error al agregar carta: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasActiveOrder = widget.activeOrderId.isNotEmpty;
    final isUnconfirmed = widget.currentUser.status == 'unconfirmed';
    final activeVar = _activeVariation;
    final inStock = activeVar.inStock;
    final subtotal = activeVar.price * _selectedQuantity;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner de Alerta: Cuenta no confirmada (§3.2)
          if (isUnconfirmed) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFF59E0B)),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Debes esperar confirmación de un admin para comprar cartas (§3.2).',
                      style: TextStyle(color: Color(0xFFFBBF24), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Banner de Alerta: Sin orden activa (§5.2)
          if (!hasActiveOrder) ...[
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.4)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.error_outline, size: 16, color: Color(0xFFF87171)),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'No hay una orden activa. Espera a que un admin active un pedido grupal.',
                      style: TextStyle(color: Color(0xFFF87171), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Cabecera: Imagen + Título + Edición + Foil Badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Preview de Imagen de la Carta
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 72,
                  height: 100,
                  color: const Color(0xFF0D1117),
                  child: widget.card.imageUrl.isNotEmpty
                      ? Image.network(
                          widget.card.imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(Icons.style, color: Color(0xFF475569), size: 30),
                        )
                      : const Icon(Icons.style, color: Color(0xFF475569), size: 30),
                ),
              ),

              const SizedBox(width: 14),

              // Información de la Carta
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Título y Badge Foil
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            widget.card.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.2,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (widget.onClose != null)
                          IconButton(
                            icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 18),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            onPressed: widget.onClose,
                          ),
                      ],
                    ),

                    const SizedBox(height: 4),

                    // Edición y Tipo
                    Text(
                      '\${widget.card.setName} · \${widget.card.cardType}',
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),

                    const SizedBox(height: 8),

                    // Badges de Metadatos
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        if (_isFoil)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.5)),
                            ),
                            child: const Text(
                              'FOIL',
                              style: TextStyle(
                                color: Color(0xFFFBBF24),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        if (widget.card.productId.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF21262D),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF30363D)),
                            ),
                            child: Text(
                              'PID: \${widget.card.productId}',
                              style: const TextStyle(
                                color: Color(0xFF8B949E),
                                fontSize: 10,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: inStock ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFFEF4444).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: inStock ? const Color(0xFF10B981).withOpacity(0.4) : const Color(0xFFEF4444).withOpacity(0.4),
                            ),
                          ),
                          child: Text(
                            inStock ? '\${activeVar.stock} en stock' : 'Agotado',
                            style: TextStyle(
                              color: inStock ? const Color(0xFF34D399) : const Color(0xFFF87171),
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

          const SizedBox(height: 16),

          // Selector de Variaciones / Condiciones (§5.2)
          const Text(
            'Selecciona Condición y Acabado:',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),

          // Grid de variaciones
          if (widget.card.variations.isEmpty)
            const Text('Sin variaciones scrapeadas', style: TextStyle(color: Color(0xFF64748B), fontSize: 12))
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: widget.card.variations.map((v) {
                final isSelected = _selectedCondition == v.condition && _isFoil == v.isFoil;
                return InkWell(
                  onTap: () {
                    setState(() {
                      _selectedCondition = v.condition;
                      _isFoil = v.isFoil;
                      _selectedQuantity = 1;
                      _errorMessage = null;
                    });
                  },
                  borderRadius: BorderRadius.circular(10),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF0D1117),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF30363D),
                        width: isSelected ? 1.5 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              v.condition,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isSelected ? const Color(0xFF0D1117) : Colors.white,
                              ),
                            ),
                            if (v.isFoil) ...[
                              const SizedBox(width: 4),
                              Text(
                                '(Foil)',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected ? const Color(0xFF0D1117).withOpacity(0.8) : const Color(0xFFFBBF24),
                                ),
                              ),
                            ],
                            const SizedBox(width: 8),
                            Text(
                              '\\$\${v.price.toStringAsFixed(2)}',
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isSelected ? const Color(0xFF0D1117) : const Color(0xFF34D399),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          v.inStock ? '\${v.stock} disp.' : 'Agotado',
                          style: TextStyle(
                            fontSize: 10,
                            color: isSelected
                                ? const Color(0xFF0D1117).withOpacity(0.8)
                                : (v.inStock ? const Color(0xFF8B949E) : const Color(0xFFEF4444)),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),

          const SizedBox(height: 16),

          // Controles de Cantidad y Comprador Destino (§5.2)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Stepper de Cantidad
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Cantidad a pedir', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove, size: 16),
                              color: Colors.white,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              style: IconButton.styleFrom(
                                backgroundColor: const Color(0xFF21262D),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                              ),
                              onPressed: _selectedQuantity > 1
                                  ? () => setState(() => _selectedQuantity--)
                                  : null,
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              child: Text(
                                '$_selectedQuantity',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontFamily: 'monospace',
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.add, size: 16),
                              color: Colors.white,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              style: IconButton.styleFrom(
                                backgroundColor: const Color(0xFF21262D),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                              ),
                              onPressed: _selectedQuantity < _maxStock
                                  ? () => setState(() => _selectedQuantity++)
                                  : null,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '(Máx: $_maxStock)',
                              style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // Selector de Comprador Destino (Admin §5.2)
                    if (widget.currentUser.isAdmin && widget.allUsers.isNotEmpty)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('Comprador destino (Admin)', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF161B22),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFF30363D)),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _targetBuyerEmail,
                                dropdownColor: const Color(0xFF161B22),
                                style: const TextStyle(color: Colors.white, fontSize: 11),
                                items: widget.allUsers.map((u) {
                                  return DropdownMenuItem<String>(
                                    value: u.email,
                                    child: Text(
                                      '\${u.displayName} \${u.status == "unconfirmed" ? "⚠️" : ""}',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) setState(() => _targetBuyerEmail = val);
                                },
                              ),
                            ),
                          ),
                        ],
                      )
                    else
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('Comprador', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                          const SizedBox(height: 4),
                          Text(
                            widget.currentUser.displayName,
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                  ],
                ),

                const SizedBox(height: 12),
                const Divider(color: Color(0xFF30363D), height: 1),
                const SizedBox(height: 12),

                // Subtotal y Botón de Captura / Pedir Carta
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total a Agregar', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                        const SizedBox(height: 2),
                        Text(
                          '\\$\${subtotal.toStringAsFixed(2)} USD',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            color: Color(0xFF34D399),
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),

                    ElevatedButton.icon(
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(color: Color(0xFF0D1117), strokeWidth: 2),
                            )
                          : Icon(_justAdded ? Icons.check : Icons.add_shopping_cart, size: 16),
                      label: Text(
                        _justAdded ? '¡Agregado a la Orden!' : 'Pedir Carta',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _justAdded ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                        foregroundColor: const Color(0xFF0D1117),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        disabledBackgroundColor: const Color(0xFF21262D),
                        disabledForegroundColor: const Color(0xFF64748B),
                      ),
                      onPressed: (!hasActiveOrder || isUnconfirmed || !inStock || _isSubmitting)
                          ? null
                          : _handleAddToCart,
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Error Inline
          if (_errorMessage != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 14, color: Color(0xFFF87171)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: Color(0xFFF87171), fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
