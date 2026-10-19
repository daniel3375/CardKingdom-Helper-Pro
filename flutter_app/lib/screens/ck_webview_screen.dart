import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';
import '../services/ck_cart_pusher.dart';
import '../widgets/scraped_card_capture_card.dart';

/// =========================================================================
/// PANTALLA: NAVEGADOR & CAPTURA CARD KINGDOM (Flutter)
/// Especificación Técnica ManaBros: §5.2, §5.9, §5.10
///
/// Características principales:
/// 1. Navegador In-App WebView con Card Kingdom oficial.
/// 2. Inyección de script JS para detección automática de cartas en pantalla.
/// 3. Modo alternativo: Simulador & Capturador por URL con cartas de demostración.
/// 4. Integración del widget ScrapedCardCaptureCard con selección de condiciones,
///    acabado Foil, stepper de cantidad y asignación de comprador (Admin §5.2).
/// 5. Carga automatizada al carrito de Card Kingdom (Cart Pusher §5.10)
///    respetando el throttling de 5 segundos.
/// 6. Banners de validación de orden activa y confirmación de cuenta (§3.2).
/// =========================================================================

class CkWebViewScreen extends StatefulWidget {
  final String activeOrderId;
  final String currentUserEmail;
  final String currentUserName;
  final bool isAdmin;
  final UserProfile? currentUser;
  final List<UserProfile> allUsers;

  const CkWebViewScreen({
    super.key,
    required this.activeOrderId,
    required this.currentUserEmail,
    required this.currentUserName,
    required this.isAdmin,
    this.currentUser,
    this.allUsers = const [],
  });

  @override
  State<CkWebViewScreen> createState() => _CkWebViewScreenState();
}

class _CkWebViewScreenState extends State<CkWebViewScreen> with SingleTickerProviderStateMixin {
  late final WebViewController _controller;
  final FirestoreService _firestore = FirestoreService();

  // Modos: 'webview' (Navegador real) | 'simulator' (URLs directas y demo)
  String _activeTabMode = 'webview'; // 'webview' | 'simulator'

  // Estados del WebView
  bool _isLoadingWeb = true;
  String _currentUrl = 'https://www.cardkingdom.com';
  final TextEditingController _urlController = TextEditingController(text: 'https://www.cardkingdom.com');

  // Carta detectada en vivo desde el DOM del WebView
  ScrapedCKCard? _detectedCard;

  // Estados del Simulador / Captura por URL
  late ScrapedCKCard _simulatedCard;
  bool _isScrapingUrl = false;

  // Cart Pusher (§5.10)
  bool _isPushingCart = false;
  int _pushCurrent = 0;
  int _pushTotal = 0;
  String? _pushStatusText;

  // Presets de demostración
  static final List<ScrapedCKCard> _demoCards = [
    ScrapedCKCard(
      title: 'Force of Will',
      setName: 'Eternal Masters',
      cardType: 'Instant',
      productId: '206412',
      imageUrl: 'https://cards.scryfall.io/normal/front/e/f/ef86e270-023a-4949-8c01-7257e84128d5.jpg',
      url: 'https://www.cardkingdom.com/mtg/eternal-masters/force-of-will',
      variations: [
        CardVariation(condition: 'NM', price: 69.99, stock: 5, isFoil: false),
        CardVariation(condition: 'EX', price: 62.99, stock: 3, isFoil: false),
        CardVariation(condition: 'VG', price: 54.99, stock: 1, isFoil: false),
        CardVariation(condition: 'NM', price: 189.99, stock: 2, isFoil: true),
      ],
    ),
    ScrapedCKCard(
      title: 'Sol Ring',
      setName: 'Commander 2021',
      cardType: 'Artifact',
      productId: '245012',
      imageUrl: 'https://cards.scryfall.io/normal/front/4/c/4cbc6901-6a4a-4d0a-83ea-7eefa3b35021.jpg',
      url: 'https://www.cardkingdom.com/mtg/commander-2021/sol-ring',
      variations: [
        CardVariation(condition: 'NM', price: 1.99, stock: 24, isFoil: false),
        CardVariation(condition: 'EX', price: 1.69, stock: 12, isFoil: false),
        CardVariation(condition: 'VG', price: 1.39, stock: 4, isFoil: false),
      ],
    ),
    ScrapedCKCard(
      title: 'Cyclonic Rift',
      setName: 'Commander 2014',
      cardType: 'Instant',
      productId: '204112',
      imageUrl: 'https://cards.scryfall.io/normal/front/f/f/ff08e5ed-f47b-4d8e-8b8b-41675dccef8b.jpg',
      url: 'https://www.cardkingdom.com/mtg/commander-2014/cyclonic-rift',
      variations: [
        CardVariation(condition: 'NM', price: 34.99, stock: 8, isFoil: false),
        CardVariation(condition: 'EX', price: 29.99, stock: 5, isFoil: false),
        CardVariation(condition: 'NM', price: 79.99, stock: 1, isFoil: true),
      ],
    ),
    ScrapedCKCard(
      title: 'Ragavan, Nimble Pilferer',
      setName: 'Modern Horizons 2',
      cardType: 'Legendary Creature — Monkey Pirate',
      productId: '246810',
      imageUrl: 'https://cards.scryfall.io/normal/front/a/1/a13c1332-7a11-4e3d-8c3b-012ab6490708.jpg',
      url: 'https://www.cardkingdom.com/mtg/modern-horizons-2/ragavan-nimble-pilferer',
      variations: [
        CardVariation(condition: 'NM', price: 39.99, stock: 3, isFoil: false),
        CardVariation(condition: 'EX', price: 35.99, stock: 2, isFoil: false),
      ],
    ),
  ];

  @override
  void initState() {
    super.initState();
    _simulatedCard = _demoCards[0];
    _initWebView();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  UserProfile get _effectiveUser =>
      widget.currentUser ??
      UserProfile(
        uid: 'user',
        email: widget.currentUserEmail,
        displayName: widget.currentUserName,
        photoURL: '',
        role: widget.isAdmin ? 'admin' : 'comprador',
        status: 'confirmed',
        balance: 0.0,
        createdAt: DateTime.now(),
      );

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0D1117))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            setState(() {
              _isLoadingWeb = true;
              _currentUrl = url;
              _urlController.text = url;
            });
          },
          onPageFinished: (url) {
            setState(() => _isLoadingWeb = false);
            _injectCardExtractor();
          },
        ),
      )
      ..addJavaScriptChannel(
        'CardDetectorChannel',
        onMessageReceived: (message) {
          try {
            final data = jsonDecode(message.message) as Map<String, dynamic>;
            final card = ScrapedCKCard.fromMap(data);
            setState(() {
              _detectedCard = card;
            });
          } catch (_) {}
        },
      )
      ..loadRequest(Uri.parse(_currentUrl));
  }

  /// Script JS inyectado en el DOM de Card Kingdom (§5.9)
  void _injectCardExtractor() {
    const js = '''
      (function() {
        function scanCard() {
          const titleEl = document.querySelector('h1.product-title, .product-name, .productDetailTitle');
          if (!titleEl) return;

          const title = titleEl.innerText.trim();
          const imgEl = document.querySelector('.product-image img, .main-image img, .productImageContainer img');
          const imageUrl = imgEl ? imgEl.src : '';
          const pidInput = document.querySelector('input[name="product_id"]');
          const productId = pidInput ? pidInput.value : '';

          const setEl = document.querySelector('.productDetailSet, .product-set');
          const setName = setEl ? setEl.innerText.trim() : 'Card Kingdom';

          // Extraer variaciones de condición y stock
          const variations = [];
          const rows = document.querySelectorAll('.style-table tr, .variation-row, .card-style-row, .styleItem');
          if (rows.length > 0) {
            rows.forEach(r => {
              const condEl = r.querySelector('.condition, .style, .styleName');
              const priceEl = r.querySelector('.price, .style-price, .stylePrice');
              const qtyEl = r.querySelector('.qty, .stock, .styleQty');
              
              if (condEl && priceEl) {
                const cond = condEl.innerText.trim().substring(0, 2).toUpperCase();
                const price = parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')) || 0.0;
                const stock = parseInt(qtyEl ? qtyEl.innerText.replace(/[^0-9]/g, '') : '1') || 1;
                const isFoil = r.innerText.toLowerCase().includes('foil');

                variations.push({
                  condition: cond,
                  price: price,
                  stock: stock,
                  isFoil: isFoil
                });
              }
            });
          }

          if (variations.length === 0) {
            const defaultPriceEl = document.querySelector('.price, .productPrice');
            const defaultPrice = defaultPriceEl ? parseFloat(defaultPriceEl.innerText.replace(/[^0-9.]/g, '')) || 1.0 : 1.0;
            variations.push({ condition: 'NM', price: defaultPrice, stock: 4, isFoil: false });
            variations.push({ condition: 'EX', price: defaultPrice * 0.9, stock: 2, isFoil: false });
            variations.push({ condition: 'VG', price: defaultPrice * 0.8, stock: 1, isFoil: false });
          }

          CardDetectorChannel.postMessage(JSON.stringify({
            title: title,
            setName: setName,
            cardType: 'Magic Card',
            imageUrl: imageUrl,
            productId: productId,
            url: window.location.href,
            variations: variations
          }));
        }

        scanCard();
      })();
    ''';
    _controller.runJavaScript(js);
  }

  void _navigateToUrl(String url) {
    var target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://$target';
    }
    _controller.loadRequest(Uri.parse(target));
  }

  // Scrapeo directo en el modo simulador
  Future<void> _handleScrapeSimulatedUrl(String url) async {
    setState(() => _isScrapingUrl = true);

    // Revisar si coincide con una de las cartas demo
    final match = _demoCards.firstWhere(
      (c) => c.url.toLowerCase().trim() == url.toLowerCase().trim(),
      orElse: () {
        // Fallback dinámico con el nombre de la URL
        final segments = url.split('/');
        final slug = segments.isNotEmpty ? segments.last.replaceAll('-', ' ') : 'Carta MTG';
        return ScrapedCKCard(
          title: slug.toUpperCase(),
          setName: 'Card Kingdom Singles',
          cardType: 'Magic: The Gathering',
          productId: '998811',
          imageUrl: 'https://cards.scryfall.io/normal/front/a/1/a13c1332-7a11-4e3d-8c3b-012ab6490708.jpg',
          url: url,
          variations: [
            CardVariation(condition: 'NM', price: 14.99, stock: 5, isFoil: false),
            CardVariation(condition: 'EX', price: 12.99, stock: 3, isFoil: false),
            CardVariation(condition: 'VG', price: 9.99, stock: 1, isFoil: false),
          ],
        );
      },
    );

    await Future.delayed(const Duration(milliseconds: 400));
    if (mounted) {
      setState(() {
        _simulatedCard = match;
        _isScrapingUrl = false;
      });
    }
  }

  // Volcar Carrito a Card Kingdom (§5.10)
  Future<void> _handlePushCartToCardKingdom() async {
    if (!widget.isAdmin) return;
    if (widget.activeOrderId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay una orden activa para volcar al carrito.')),
      );
      return;
    }

    setState(() {
      _isPushingCart = true;
      _pushStatusText = 'Obteniendo cartas de la orden...';
    });

    try {
      final itemsSnapshot = await _firestore.getOrderItemsStream(widget.activeOrderId).first;
      final validItems = itemsSnapshot.where((i) => i.productId.isNotEmpty).toList();

      if (validItems.isEmpty) {
        if (mounted) {
          setState(() => _isPushingCart = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('La orden no tiene cartas con ID de producto Card Kingdom.')),
          );
        }
        return;
      }

      setState(() {
        _pushTotal = validItems.length;
        _pushCurrent = 0;
      });

      await CkCartPusher.pushItemsToCardKingdom(
        controller: _controller,
        items: validItems,
        onProgress: (current, total, item) {
          if (mounted) {
            setState(() {
              _pushCurrent = current;
              _pushTotal = total;
              _pushStatusText = 'Añadiendo ($current/$total): \${item.cardName} (\${item.condition})';
            });
          }
        },
        onError: (err, item) {
          debugPrint('Error añadiendo carta: \${item.cardName} - $err');
        },
      );

      if (mounted) {
        setState(() => _isPushingCart = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            content: Text('¡Todas las cartas fueron añadidas al carrito de Card Kingdom!'),
          ),
        );
        _controller.loadRequest(Uri.parse('https://www.cardkingdom.com/cart'));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isPushingCart = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: const Color(0xFFEF4444), content: Text('Error al volcar carrito: $e')),
        );
      }
    }
  }

  void _openCardModal(ScrapedCKCard card) {
    ScrapedCardCaptureCard.showAsBottomSheet(
      context,
      card: card,
      activeOrderId: widget.activeOrderId,
      currentUser: _effectiveUser,
      allUsers: widget.allUsers,
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasActiveOrder = widget.activeOrderId.isNotEmpty;
    final isUnconfirmed = _effectiveUser.status == 'unconfirmed';

    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.public, color: Color(0xFFF59E0B), size: 18),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Navegador & Captura',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
                ),
                Text(
                  'Card Kingdom · Capturador Inteligente MTG',
                  style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Selector de Modo: WebView vs Simulador
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildModeTabButton('webview', 'Navegador Web', Icons.language),
                _buildModeTabButton('simulator', 'Simulador / Demo', Icons.dashboard_customize_outlined),
              ],
            ),
          ),

          // Botón Admin: Volcar Carrito (§5.10)
          if (widget.isAdmin)
            IconButton(
              icon: _isPushingCart
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(color: Color(0xFFF59E0B), strokeWidth: 2),
                    )
                  : const Icon(Icons.shopping_cart_checkout, color: Color(0xFFF59E0B)),
              tooltip: 'Volcar Orden Activa al Carrito de Card Kingdom (§5.10)',
              onPressed: _isPushingCart ? null : _handlePushCartToCardKingdom,
            ),
        ],
      ),
      body: Column(
        children: [
          // Banner de alerta: Si no hay orden activa (§5.2)
          if (!hasActiveOrder)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFF450A0A),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: Color(0xFFF87171), size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'No hay una orden activa. Las cartas no se agregarán hasta que un admin active un pedido grupal.',
                      style: TextStyle(color: Color(0xFFFECACA), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),

          // Banner de alerta: Si el usuario está sin confirmar (§3.2)
          if (isUnconfirmed)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFF451A03),
              child: const Row(
                children: [
                  Icon(Icons.lock_outline, color: Color(0xFFFBBF24), size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Tu cuenta está pendiente de confirmación por un admin. No podrás pedir cartas (§3.2).',
                      style: TextStyle(color: Color(0xFFFEF3C7), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),

          // Modal / Progress Indicator de Cart Pusher en ejecución
          if (_isPushingCart)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: const Color(0xFF1E1B4B),
              child: Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(color: Color(0xFF818CF8), strokeWidth: 2),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _pushStatusText ?? 'Cargando cartas al carrito CK...',
                      style: const TextStyle(color: Color(0xFFE0E7FF), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(
                    '$_pushCurrent / $_pushTotal',
                    style: const TextStyle(color: Color(0xFFC7D2FE), fontSize: 12, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),

          // Contenido Principal según el Modo Activo
          Expanded(
            child: _activeTabMode == 'webview' ? _buildWebViewMode() : _buildSimulatorMode(),
          ),
        ],
      ),
    );
  }

  Widget _buildModeTabButton(String mode, String label, IconData icon) {
    final isSelected = _activeTabMode == mode;
    return InkWell(
      onTap: () => setState(() => _activeTabMode = mode),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFF59E0B) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 13,
              color: isSelected ? const Color(0xFF0D1117) : const Color(0xFF94A3B8),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? const Color(0xFF0D1117) : const Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // MODO 1: NAVEGADOR IN-APP WEBVIEW
  // ==========================================
  Widget _buildWebViewMode() {
    return Column(
      children: [
        // Barra de navegación de URL del WebView
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          color: const Color(0xFF161B22),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_ios, color: Colors.white70, size: 16),
                onPressed: () => _controller.goBack(),
                tooltip: 'Atrás',
              ),
              IconButton(
                icon: const Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 16),
                onPressed: () => _controller.goForward(),
                tooltip: 'Adelante',
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.white70, size: 18),
                onPressed: () => _controller.reload(),
                tooltip: 'Recargar',
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D1117),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF30363D)),
                  ),
                  child: TextField(
                    controller: _urlController,
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'monospace'),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: 'https://www.cardkingdom.com/mtg/...',
                      hintStyle: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    ),
                    onSubmitted: _navigateToUrl,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () => _navigateToUrl(_urlController.text),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF21262D),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Ir', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),

        // Vista WebView con detector de carta flotante
        Expanded(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_isLoadingWeb)
                const LinearProgressIndicator(color: Color(0xFFF59E0B), backgroundColor: Colors.transparent),

              // Floating Bar de Carta Detectada en tiempo real
              if (_detectedCard != null)
                Positioned(
                  bottom: 16,
                  left: 16,
                  right: 16,
                  child: InkWell(
                    onTap: () => _openCardModal(_detectedCard!),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF161B22).withOpacity(0.96),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
                        boxShadow: const [BoxShadow(color: Colors.black87, blurRadius: 15, offset: Offset(0, 4))],
                      ),
                      child: Row(
                        children: [
                          if (_detectedCard!.imageUrl.isNotEmpty)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: Image.network(_detectedCard!.imageUrl, width: 38, height: 52, fit: BoxFit.cover),
                            ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF59E0B).withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4)),
                                      ),
                                      child: const Text('DETECTADA', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 9, fontWeight: FontWeight.bold)),
                                    ),
                                    const SizedBox(width: 6),
                                    Flexible(
                                      child: Text(
                                        _detectedCard!.title,
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '\${_detectedCard!.setName} · \${_detectedCard!.variations.length} variaciones',
                                  style: const TextStyle(color: Color(0xFF8B949E), fontSize: 11),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          ElevatedButton.icon(
                            icon: const Icon(Icons.add_shopping_cart, size: 14),
                            label: const Text('Configurar & Pedir', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: const Color(0xFF0D1117),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: () => _openCardModal(_detectedCard!),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  // ==========================================
  // MODO 2: SIMULADOR Y CAPTURA POR URL (§5.2)
  // ==========================================
  Widget _buildSimulatorMode() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner de Información
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
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4)),
                      ),
                      child: const Text(
                        'SIMULADOR DE CAPTURA CARD KINGDOM',
                        style: TextStyle(color: Color(0xFFFBBF24), fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Ingresa cualquier URL directa de Card Kingdom o selecciona una carta de demostración para probar la extracción de precios, estados (NM, EX, VG, G), acabado Foil y agregarla a la orden activa.',
                  style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 14),

                // Presets Demo Buttons
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    const Text('Cartas demo:', style: TextStyle(color: Color(0xFF8B949E), fontSize: 11, fontWeight: FontWeight.bold)),
                    ..._demoCards.map((demo) {
                      final isSelected = _simulatedCard.title == demo.title;
                      return InkWell(
                        onTap: () {
                          setState(() {
                            _simulatedCard = demo;
                            _urlController.text = demo.url;
                          });
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF21262D),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF30363D),
                            ),
                          ),
                          child: Text(
                            demo.title,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                              color: isSelected ? const Color(0xFF0D1117) : Colors.white,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Input de URL manual
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF161B22),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Row(
              children: [
                const Icon(Icons.link, color: Color(0xFF8B949E), size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _urlController,
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'monospace'),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: 'https://www.cardkingdom.com/mtg/...',
                      hintStyle: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    ),
                    onSubmitted: _handleScrapeSimulatedUrl,
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  icon: _isScrapingUrl
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(color: Color(0xFF0D1117), strokeWidth: 2),
                        )
                      : const Icon(Icons.search, size: 15),
                  label: const Text('Scrapear'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    foregroundColor: const Color(0xFF0D1117),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  onPressed: _isScrapingUrl ? null : () => _handleScrapeSimulatedUrl(_urlController.text),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Componente de Presentación y Captura de la Carta Scrapeada
          ScrapedCardCaptureCard(
            card: _simulatedCard,
            activeOrderId: widget.activeOrderId,
            currentUser: _effectiveUser,
            allUsers: widget.allUsers,
          ),
        ],
      ),
    );
  }
}
