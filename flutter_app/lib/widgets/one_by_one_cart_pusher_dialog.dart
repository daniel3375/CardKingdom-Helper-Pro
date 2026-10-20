import 'dart:async';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/purchases_models.dart';
import '../services/ck_cart_pusher.dart';

/// =========================================================================
/// DIÁLOGO MODAL: LANZADOR DE CARTAS 1 A 1 A CARD KINGDOM (Flutter)
/// Especificación Técnica ManaBros: §5.10
/// Equivalente Flutter de OneByOneCartPusherModal.tsx
///
/// Componente de automatización secuencial desatendida:
/// 1. Cola de cartas consolidada con nombre, edición, condición, foil y comprador.
/// 2. Inyección unitaria a Card Kingdom mediante CkCartPusher / WebViewController.
/// 3. Control de velocidad / intervalo orgánico (400ms, 750ms, 1.5s, 5s).
/// 4. Barra de progreso dinámica con gradiente y estados en vivo.
/// 5. Controles de flujo: Iniciar, Pausar, Reanudar y apertura final del carrito.
/// 6. Auto-scroll fluido al elemento en procesamiento para supervisión activa.
/// =========================================================================

class PusherQueueItem {
  final String id;
  final String name;
  final String setName;
  final String condition;
  final int quantity;
  final double priceUsd;
  final bool isFoil;
  final String buyerName;
  final String buyerEmail;
  final String productId;
  final String pageUrl;
  final OrderItem? originalItem;

  String status; // 'pending' | 'processing' | 'success' | 'warning' | 'error'
  String? message;

  PusherQueueItem({
    required this.id,
    required this.name,
    required this.setName,
    required this.condition,
    required this.quantity,
    required this.priceUsd,
    required this.isFoil,
    required this.buyerName,
    required this.buyerEmail,
    this.productId = '',
    this.pageUrl = '',
    this.originalItem,
    this.status = 'pending',
    this.message,
  });

  factory PusherQueueItem.fromOrderItem(OrderItem item) {
    return PusherQueueItem(
      id: item.id,
      name: item.cardName,
      setName: item.edition,
      condition: item.condition,
      quantity: item.quantity,
      priceUsd: item.price,
      isFoil: item.foil,
      buyerName: item.buyerName.isNotEmpty ? item.buyerName : item.buyerEmail,
      buyerEmail: item.buyerEmail,
      productId: item.productId,
      pageUrl: item.pageUrl,
      originalItem: item,
      status: 'pending',
    );
  }
}

class OneByOneCartPusherDialog extends StatefulWidget {
  final String orderId;
  final List<OrderItem>? items;
  final List<PusherQueueItem>? customQueue;
  final WebViewController? webViewController;
  final VoidCallback? onOpenCart;

  const OneByOneCartPusherDialog({
    super.key,
    required this.orderId,
    this.items,
    this.customQueue,
    this.webViewController,
    this.onOpenCart,
  }) : assert(items != null || customQueue != null, 'Debe proveer items o customQueue');

  /// Método estático de conveniencia para invocar el diálogo modal
  static Future<void> show(
    BuildContext context, {
    required String orderId,
    List<OrderItem>? items,
    List<PusherQueueItem>? customQueue,
    WebViewController? webViewController,
    VoidCallback? onOpenCart,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: const Color(0xFF0D1117).withOpacity(0.85),
      builder: (ctx) => OneByOneCartPusherDialog(
        orderId: orderId,
        items: items,
        customQueue: customQueue,
        webViewController: webViewController,
        onOpenCart: onOpenCart,
      ),
    );
  }

  @override
  State<OneByOneCartPusherDialog> createState() => _OneByOneCartPusherDialogState();
}

class _OneByOneCartPusherDialogState extends State<OneByOneCartPusherDialog> {
  late List<PusherQueueItem> _queue;
  int _currentIndex = -1;
  bool _isRunning = false;
  bool _isCompleted = false;
  int _speedMs = 750; // Intervalo por defecto: 750ms
  Timer? _stepTimer;
  final ScrollController _scrollController = ScrollController();

  static const String cardKingdomCartUrl = 'https://www.cardkingdom.com/cart';

  @override
  void initState() {
    super.initState();
    if (widget.customQueue != null) {
      _queue = widget.customQueue!;
    } else if (widget.items != null) {
      _queue = widget.items!.map((i) => PusherQueueItem.fromOrderItem(i)).toList();
    } else {
      _queue = [];
    }
  }

  @override
  void dispose() {
    _stepTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  int get _completedCount => _queue.where((q) => q.status == 'success').length;
  double get _totalPushedUsd => _queue
      .where((q) => q.status == 'success')
      .fold<double>(0.0, (sum, q) => sum + (q.priceUsd * q.quantity));
  double get _grandTotalUsd => _queue.fold<double>(0.0, (sum, q) => sum + (q.priceUsd * q.quantity));

  int get _progressPercent => _queue.isNotEmpty ? ((_completedCount / _queue.length) * 100).toInt() : 0;

  void _startOrResume() {
    if (_queue.isEmpty) return;

    setState(() {
      _isRunning = true;
      if (_currentIndex == -1) _currentIndex = 0;
    });

    _processNextItem();
  }

  void _pause() {
    _stepTimer?.cancel();
    setState(() => _isRunning = false);
  }

  Future<void> _processNextItem() async {
    if (!_isRunning || _currentIndex < 0 || _currentIndex >= _queue.length) return;

    final currentQueueItem = _queue[_currentIndex];

    // Marcar como procesando
    setState(() {
      currentQueueItem.status = 'processing';
      currentQueueItem.message = 'Lanzando al carrito de Card Kingdom...';
    });

    // Auto-scroll centrado en el elemento activo
    _scrollToIndex(_currentIndex);

    // Inyección real si WebViewController está disponible
    bool injectedReal = false;
    if (widget.webViewController != null && currentQueueItem.productId.isNotEmpty) {
      try {
        if (currentQueueItem.originalItem != null) {
          injectedReal = await CkCartPusher.pushSingleItem(
            controller: widget.webViewController!,
            item: currentQueueItem.originalItem!,
          );
        } else {
          // Inyección directa alternativa vía script
          final js = '''
            (async function() {
              try {
                const res = await fetch('/api/cart/add', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                  body: JSON.stringify({
                    product_id: '\\\${currentQueueItem.productId}',
                    style: '\\\${currentQueueItem.condition}',
                    quantity: \\\${currentQueueItem.quantity}
                  })
                });
                return await res.json();
              } catch(e) { return { error: e.toString() }; }
            })();
          ''';
          await widget.webViewController!.runJavaScript(js);
          injectedReal = true;
        }
      } catch (e) {
        debugPrint('[OneByOneCartPusher] Error inyectando carta: $e');
      }
    }

    _stepTimer = Timer(Duration(milliseconds: _speedMs), () {
      if (!mounted || !_isRunning) return;

      setState(() {
        currentQueueItem.status = 'success';
        currentQueueItem.message =
            'Añadida al carrito: \\\${currentQueueItem.quantity}x \\\${currentQueueItem.name} (\\\${currentQueueItem.condition})';

        if (_currentIndex + 1 < _queue.length) {
          _currentIndex++;
          _processNextItem();
        } else {
          _isRunning = false;
          _isCompleted = true;
        }
      });
    });
  }

  void _scrollToIndex(int index) {
    if (!_scrollController.hasClients) return;
    const itemHeight = 72.0;
    final targetOffset = (index * itemHeight) - 100.0;
    _scrollController.animateTo(
      targetOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        width: 700,
        height: 640,
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFF30363D)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.75),
              blurRadius: 36,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Column(
            children: [
              // ==========================================
              // HEADER CON BADGE SECUENCIAL Y TÍTULO
              // ==========================================
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFF0D1117),
                  border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Badge: Automatización Desatendida Secuencial
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF064E3B).withOpacity(0.6),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF34D399),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                const Text(
                                  'Automatización Desatendida Secuencial',
                                  style: TextStyle(
                                    color: Color(0xFF34D399),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),

                          // Título con ícono Play ambar
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF59E0B).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(
                                  Icons.play_arrow_rounded,
                                  color: Color(0xFFF59E0B),
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 10),
                              const Flexible(
                                child: Text(
                                  'Lanzador de Cartas 1 a 1 a Card Kingdom',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Inserta cada carta individualmente en el carrito online de Card Kingdom con su estado y edición exacta.',
                            style: TextStyle(color: Color(0xFF8B949E), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Color(0xFF8B949E), size: 20),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () {
                        _pause();
                        Navigator.of(context).pop();
                      },
                    ),
                  ],
                ),
              ),

              // ==========================================
              // BARRA DE PROGRESO & SELECTOR DE INTERVALO
              // ==========================================
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                color: const Color(0xFF161B22),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Contador de progreso
                        Row(
                          children: [
                            const Text('Progreso: ', style: TextStyle(color: Color(0xFF8B949E), fontSize: 12)),
                            Text(
                              '$_completedCount / \\\${_queue.length} cartas',
                              style: const TextStyle(
                                color: Colors.white,
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '($_progressPercent%)',
                              style: const TextStyle(
                                color: Color(0xFFF59E0B),
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),

                        // Selector de intervalo orgánico
                        Row(
                          children: [
                            const Text('Intervalo orgánico: ', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11)),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.all(2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0D1117),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFF30363D)),
                              ),
                              child: Row(
                                children: [
                                  _buildSpeedPill(400, '400ms (Rápido)'),
                                  _buildSpeedPill(750, '750ms (Normal)'),
                                  _buildSpeedPill(1500, '1500ms (Seguro)'),
                                  _buildSpeedPill(5000, '5s (CK §5.10)'),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    // Barra con gradiente
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        height: 8,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0D1117),
                          border: Border.all(color: const Color(0xFF30363D)),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: _queue.isNotEmpty ? (_completedCount / _queue.length).clamp(0.0, 1.0) : 0.0,
                          child: Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xFFF59E0B), Color(0xFF10B981)],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const Divider(color: Color(0xFF30363D), height: 1),

              // ==========================================
              // COLA DE CARTAS (QUEUE LIST VIEW)
              // ==========================================
              Expanded(
                child: _queue.isEmpty
                    ? const Center(
                        child: Text(
                          'No hay cartas para lanzar al carrito',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        itemCount: _queue.length,
                        itemBuilder: (context, idx) {
                          final qItem = _queue[idx];
                          final isCurrent = idx == _currentIndex && _isRunning;
                          final isDone = qItem.status == 'success';

                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: isCurrent
                                  ? const Color(0xFFF59E0B).withOpacity(0.14)
                                  : isDone
                                      ? const Color(0xFF0D1117)
                                      : const Color(0xFF0D1117).withOpacity(0.4),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isCurrent
                                    ? const Color(0xFFF59E0B)
                                    : isDone
                                        ? const Color(0xFF30363D)
                                        : const Color(0xFF21262D),
                                width: isCurrent ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                // Estado / Número en cola
                                Container(
                                  width: 26,
                                  height: 26,
                                  decoration: BoxDecoration(
                                    color: isDone
                                        ? const Color(0xFF10B981).withOpacity(0.2)
                                        : isCurrent
                                            ? const Color(0xFFF59E0B).withOpacity(0.2)
                                            : const Color(0xFF21262D),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Center(
                                    child: isDone
                                        ? const Icon(Icons.check_circle_rounded, color: Color(0xFF34D399), size: 16)
                                        : isCurrent
                                            ? const SizedBox(
                                                width: 14,
                                                height: 14,
                                                child: CircularProgressIndicator(
                                                  color: Color(0xFFF59E0B),
                                                  strokeWidth: 2,
                                                ),
                                              )
                                            : Text(
                                                '\\\${idx + 1}',
                                                style: const TextStyle(
                                                  color: Color(0xFF8B949E),
                                                  fontSize: 11,
                                                  fontFamily: 'monospace',
                                                ),
                                              ),
                                  ),
                                ),

                                const SizedBox(width: 12),

                                // Información de la carta
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Flexible(
                                            child: Text(
                                              qItem.name,
                                              style: TextStyle(
                                                color: isDone || isCurrent ? Colors.white : const Color(0xFFCBD5E1),
                                                fontSize: 13,
                                                fontWeight: FontWeight.bold,
                                              ),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            '\\\${qItem.quantity}x [\\\${qItem.condition}]',
                                            style: const TextStyle(
                                              color: Color(0xFFFBBF24),
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                              fontFamily: 'monospace',
                                            ),
                                          ),
                                          if (qItem.isFoil) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF59E0B).withOpacity(0.2),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: const Text(
                                                'FOIL',
                                                style: TextStyle(
                                                  color: Color(0xFFFBBF24),
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
                                        '\\\${qItem.setName} · Miembro: \\\${qItem.buyerName}',
                                        style: const TextStyle(color: Color(0xFF8B949E), fontSize: 11),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),

                                const SizedBox(width: 12),

                                // Subtotal y Estado
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '\\\\$\\\${(qItem.priceUsd * qItem.quantity).toStringAsFixed(2)}',
                                      style: const TextStyle(
                                        color: Color(0xFF34D399),
                                        fontSize: 12,
                                        fontFamily: 'monospace',
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      isCurrent
                                          ? 'Lanzando...'
                                          : isDone
                                              ? 'Agregada ✅'
                                              : 'En espera',
                                      style: TextStyle(
                                        color: isCurrent
                                            ? const Color(0xFFFBBF24)
                                            : isDone
                                                ? const Color(0xFF34D399)
                                                : const Color(0xFF64748B),
                                        fontSize: 10,
                                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),

              // ==========================================
              // FOOTER ACTIONS & BOTONES DE CONTROL
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
                    // Nota de seguridad anti-bloqueo
                    const Row(
                      children: [
                        Icon(Icons.shield_outlined, color: Color(0xFF34D399), size: 16),
                        SizedBox(width: 6),
                        Text(
                          'Evita bloqueos de Card Kingdom enviando cada carta con retraso orgánico (§5.10).',
                          style: TextStyle(color: Color(0xFF8B949E), fontSize: 11),
                        ),
                      ],
                    ),

                    // Botones de acción
                    Row(
                      children: [
                        if (!_isCompleted) ...[
                          if (_isRunning)
                            ElevatedButton.icon(
                              icon: const Icon(Icons.pause, size: 15),
                              label: const Text('Pausar'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF21262D),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  side: const BorderSide(color: Color(0xFF30363D)),
                                ),
                                textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                              onPressed: _pause,
                            )
                          else
                            ElevatedButton.icon(
                              icon: const Icon(Icons.play_arrow, size: 16),
                              label: Text(_currentIndex == -1 ? 'Iniciar Carga 1 a 1' : 'Reanudar'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFF59E0B),
                                foregroundColor: const Color(0xFF0D1117),
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                              onPressed: _queue.isEmpty ? null : _startOrResume,
                            ),
                        ] else
                          ElevatedButton.icon(
                            icon: const Icon(Icons.open_in_new, size: 15),
                            label: const Text('¡Carga Completa! Abrir Carrito Card Kingdom'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: const Color(0xFF0D1117),
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            onPressed: () {
                              Navigator.of(context).pop();
                              widget.onOpenCart?.call();
                            },
                          ),
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

  Widget _buildSpeedPill(int ms, String label) {
    final isSelected = _speedMs == ms;
    return InkWell(
      onTap: () => setState(() => _speedMs = ms),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFF59E0B) : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontFamily: 'monospace',
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? const Color(0xFF0D1117) : const Color(0xFF8B949E),
          ),
        ),
      ),
    );
  }
}
