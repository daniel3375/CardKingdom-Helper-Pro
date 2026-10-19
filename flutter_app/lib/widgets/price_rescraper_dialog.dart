import 'package:flutter/material.dart';
import '../models/purchases_models.dart';
import '../services/price_rescraper_service.dart';
import '../services/firestore_service.dart';

/// =========================================================================
/// DIÁLOGO MODAL: ACTUALIZADOR DE PRECIOS & STOCK CARD KINGDOM (Flutter)
/// Especificación Técnica ManaBros: §2.4, §7.1, §8.3
///
/// Componente de control administrativo previo a la compra consolidada:
/// 1. Escaneo en vivo de cada carta contra la tienda Card Kingdom.
/// 2. Detección de deltas de precio (+ / -) y cartas agotadas (out of stock).
/// 3. Resumen financiero comparativo: Total anterior vs Total actualizado hoy.
/// 4. Desglose detallado por ítem con variaciones e indicador de disponibilidad.
/// 5. Aplicación atómica de nuevos precios a la orden en Firestore.
/// 6. Acceso directo al Cart Pusher para checkout online.
/// =========================================================================

class PriceRescraperDialog extends StatefulWidget {
  final String orderId;
  final List<OrderItem> items;
  final VoidCallback? onProceedToCartPusher;
  final Function(List<RescrapeResult>)? onPricesApplied;

  const PriceRescraperDialog({
    super.key,
    required this.orderId,
    required this.items,
    this.onProceedToCartPusher,
    this.onPricesApplied,
  });

  /// Método estático de conveniencia para invocar el diálogo modal
  static Future<void> show(
    BuildContext context, {
    required String orderId,
    required List<OrderItem> items,
    VoidCallback? onProceedToCartPusher,
    Function(List<RescrapeResult>)? onPricesApplied,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.85),
      builder: (ctx) => PriceRescraperDialog(
        orderId: orderId,
        items: items,
        onProceedToCartPusher: onProceedToCartPusher,
        onPricesApplied: onPricesApplied,
      ),
    );
  }

  @override
  State<PriceRescraperDialog> createState() => _PriceRescraperDialogState();
}

class _PriceRescraperDialogState extends State<PriceRescraperDialog> {
  final PriceRescraperService _rescraperService = PriceRescraperService();
  final FirestoreService _firestore = FirestoreService();

  bool _isScanning = false;
  int _scannedCount = 0;
  String _currentScanningCard = '';
  List<RescrapeResult>? _results;
  bool _applied = false;
  bool _isApplying = false;

  Future<void> _runReScraper() async {
    if (widget.items.isEmpty) return;

    setState(() {
      _isScanning = true;
      _scannedCount = 0;
      _currentScanningCard = '';
      _results = null;
      _applied = false;
    });

    final tempResults = <RescrapeResult>[];

    try {
      await for (final res in PriceRescraperService.rescrapeEligibleItems(widget.items, onlyEligible: false)) {
        tempResults.add(res);
        if (mounted) {
          setState(() {
            _scannedCount = tempResults.length;
            _currentScanningCard = res.item.cardName;
          });
        }
      }

      if (mounted) {
        setState(() {
          _results = tempResults;
          _isScanning = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isScanning = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: const Color(0xFFEF4444), content: Text('Error al escanear precios: $e')),
        );
      }
    }
  }

  double get _oldTotal {
    if (_results != null) {
      return _results!.fold(0.0, (sum, r) => sum + (r.oldPrice * r.item.quantity));
    }
    return widget.items.fold(0.0, (sum, i) => sum + (i.price * i.quantity));
  }

  double get _newTotal {
    if (_results != null) {
      return _results!.fold(0.0, (sum, r) => sum + (r.inStock ? r.currentPrice * r.item.quantity : 0.0));
    }
    return _oldTotal;
  }

  double get _totalDelta => _newTotal - _oldTotal;

  int get _outOfStockCount => _results != null ? _results!.where((r) => !r.inStock).length : 0;

  Future<void> _handleApplyPrices() async {
    if (_results == null || _results!.isEmpty) return;

    setState(() => _isApplying = true);

    try {
      await _rescraperService.applyUpdatedPrices(widget.orderId, _results!);

      if (mounted) {
        setState(() {
          _isApplying = false;
          _applied = true;
        });

        widget.onPricesApplied?.call(_results!);

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            content: Text('✓ Precios y stock actualizados en la orden activa con éxito.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isApplying = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: const Color(0xFFEF4444), content: Text('Error al guardar precios: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scanPercent = widget.items.isNotEmpty
        ? ((_scannedCount / widget.items.length) * 100).clamp(0, 100).toInt()
        : 0;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        width: 780,
        height: 600,
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFF30363D)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.65),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Column(
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
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.sync_rounded, color: Color(0xFFF59E0B), size: 20),
                        ),
                        const SizedBox(width: 12),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Actualizador de Precios & Stock Card Kingdom',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Re-escaneo en vivo de fluctuaciones de precio y disponibilidad antes del checkout final.',
                              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                            ),
                          ],
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),

              // ==========================================
              // CUERPO PRINCIPAL
              // ==========================================
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: _results == null
                      ? (_isScanning ? _buildScanningView(scanPercent) : _buildPreScanView())
                      : _buildResultsView(),
                ),
              ),

              // ==========================================
              // FOOTER ACTIONS
              // ==========================================
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                decoration: const BoxDecoration(
                  color: Color(0xFF0D1117),
                  border: Border(top: BorderSide(color: Color(0xFF30363D))),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Estado de aplicación
                    if (_applied)
                      const Row(
                        children: [
                          Icon(Icons.check_circle, color: Color(0xFF34D399), size: 16),
                          SizedBox(width: 6),
                          Text(
                            'Precios actualizados en la orden activa',
                            style: TextStyle(color: Color(0xFF34D399), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ],
                      )
                    else
                      const SizedBox.shrink(),

                    // Botones de acción
                    Row(
                      children: [
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF94A3B8),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                            textStyle: const TextStyle(fontSize: 12),
                          ),
                          child: const Text('Cerrar'),
                        ),

                        if (_results != null) ...[
                          const SizedBox(width: 10),
                          ElevatedButton.icon(
                            icon: _isApplying
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : Icon(_applied ? Icons.done_all : Icons.save_outlined, size: 15),
                            label: Text(_applied ? 'Precios Aplicados' : 'Aplicar Precios a la Orden'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _applied ? const Color(0xFF064E3B) : const Color(0xFF21262D),
                              foregroundColor: _applied ? const Color(0xFF34D399) : Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                                side: BorderSide(color: _applied ? const Color(0xFF10B981) : const Color(0xFF30363D)),
                              ),
                              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            onPressed: (_isApplying || _applied) ? null : _handleApplyPrices,
                          ),

                          const SizedBox(width: 10),
                          ElevatedButton.icon(
                            icon: const Icon(Icons.arrow_forward, size: 15),
                            label: const Text('Lanzar al Carrito Online'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: const Color(0xFF0D1117),
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            onPressed: () async {
                              if (!_applied) await _handleApplyPrices();
                              if (mounted) {
                                Navigator.of(context).pop();
                                widget.onProceedToCartPusher?.call();
                              }
                            },
                          ),
                        ],
                      ],
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

  // Vista 1: Pre-escaneo
  Widget _buildPreScanView() {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.sync_rounded, color: Color(0xFFF59E0B), size: 36),
            ),
            const SizedBox(height: 16),
            Text(
              'Listo para escanear \${widget.items.length} cartas en la orden',
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const SizedBox(
              width: 440,
              child: Text(
                'Dado que los miembros agregaron cartas en diferentes momentos, verificaremos en vivo las fluctuaciones de precio en Card Kingdom y si continúan en stock.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, height: 1.4),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Ejecutar Actualizador de Precios Ahora'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: const Color(0xFF0D1117),
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              onPressed: widget.items.isEmpty ? null : _runReScraper,
            ),
          ],
        ),
      ),
    );
  }

  // Vista 2: En progreso de escaneo
  Widget _buildScanningView(int percent) {
    return Center(
      child: Container(
        width: 480,
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 38,
              height: 38,
              child: CircularProgressIndicator(
                color: Color(0xFFF59E0B),
                strokeWidth: 3,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Re-escaneando precios en Card Kingdom...',
              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text(
              _currentScanningCard.isNotEmpty ? 'Consultando: $_currentScanningCard' : 'Iniciando escaneo...',
              style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 12, fontFamily: 'monospace'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: widget.items.isNotEmpty ? (_scannedCount / widget.items.length) : 0,
                backgroundColor: const Color(0xFF21262D),
                valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFF59E0B)),
                minHeight: 8,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '$percent% completado ($_scannedCount / \${widget.items.length})',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontFamily: 'monospace'),
            ),
          ],
        ),
      ),
    );
  }

  // Vista 3: Resultados detallados
  Widget _buildResultsView() {
    final results = _results ?? [];

    return Column(
      children: [
        // Métricas resumen
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D1117),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF30363D)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total Anterior', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                    const SizedBox(height: 4),
                    Text(
                      '\\$\${_oldTotal.toStringAsFixed(2)} USD',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        color: Color(0xFFCBD5E1),
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D1117),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF30363D)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total Actualizado Hoy', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          '\\$\${_newTotal.toStringAsFixed(2)} USD',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            color: Color(0xFF34D399),
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (_totalDelta != 0) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: _totalDelta > 0
                                  ? const Color(0xFFEF4444).withOpacity(0.2)
                                  : const Color(0xFF10B981).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '\${_totalDelta > 0 ? "+" : ""}\\$\${_totalDelta.toStringAsFixed(2)}',
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: _totalDelta > 0 ? const Color(0xFFF87171) : const Color(0xFF34D399),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D1117),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF30363D)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Alertas de Stock', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                    const SizedBox(height: 4),
                    Text(
                      _outOfStockCount > 0 ? '$_outOfStockCount Agotadas' : '100% En Stock',
                      style: TextStyle(
                        fontFamily: 'monospace',
                        color: _outOfStockCount > 0 ? const Color(0xFFF87171) : const Color(0xFF34D399),
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 14),

        // Tabla de ítems escaneados
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: ListView.separated(
                itemCount: results.length,
                separatorBuilder: (_, __) => const Divider(color: Color(0xFF21262D), height: 1),
                itemBuilder: (context, idx) {
                  final r = results[idx];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Row(
                      children: [
                        // Foto miniatura
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: r.item.imageUrl.isNotEmpty
                              ? Image.network(r.item.imageUrl, width: 32, height: 44, fit: BoxFit.cover)
                              : Container(width: 32, height: 44, color: const Color(0xFF21262D), child: const Icon(Icons.style, size: 16, color: Colors.white24)),
                        ),
                        const SizedBox(width: 12),

                        // Info carta
                        Expanded(
                          flex: 5,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                r.item.cardName,
                                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '\${r.item.edition} · \${r.item.quantity}x',
                                style: const TextStyle(color: Color(0xFF8B949E), fontSize: 11),
                              ),
                            ],
                          ),
                        ),

                        // Condición & Foil
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF21262D),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFF30363D)),
                          ),
                          child: Text(
                            '\${r.item.condition}\${r.item.foil ? " (Foil)" : ""}',
                            style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),

                        const SizedBox(width: 16),

                        // Precio Guardado vs Precio Hoy
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '\\$\${r.oldPrice.toStringAsFixed(2)}',
                              style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontFamily: 'monospace', decoration: TextDecoration.lineThrough),
                            ),
                            Text(
                              '\\$\${r.currentPrice.toStringAsFixed(2)}',
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                            ),
                          ],
                        ),

                        const SizedBox(width: 16),

                        // Variación (Delta)
                        SizedBox(
                          width: 75,
                          child: r.delta == 0
                              ? const Center(child: Text('—', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)))
                              : Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      r.delta > 0 ? Icons.trending_up : Icons.trending_down,
                                      size: 14,
                                      color: r.delta > 0 ? const Color(0xFFF87171) : const Color(0xFF34D399),
                                    ),
                                    const SizedBox(width: 2),
                                    Text(
                                      '\${r.delta > 0 ? "+" : ""}\\$\${r.delta.toStringAsFixed(2)}',
                                      style: TextStyle(
                                        fontFamily: 'monospace',
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: r.delta > 0 ? const Color(0xFFF87171) : const Color(0xFF34D399),
                                      ),
                                    ),
                                  ],
                                ),
                        ),

                        const SizedBox(width: 12),

                        // Stock
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                          decoration: BoxDecoration(
                            color: r.inStock ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFFEF4444).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: r.inStock ? const Color(0xFF10B981).withOpacity(0.4) : const Color(0xFFEF4444).withOpacity(0.4),
                            ),
                          ),
                          child: Text(
                            r.inStock ? '\${r.stockCount} disp.' : 'Agotada',
                            style: TextStyle(
                              color: r.inStock ? const Color(0xFF34D399) : const Color(0xFFF87171),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}
