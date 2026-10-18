import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';
import '../services/ck_cart_pusher.dart';

/// Pantalla del Navegador In-App para Card Kingdom (§5.9, §5.10)
class CkWebViewScreen extends StatefulWidget {
  final String activeOrderId;
  final String currentUserEmail;
  final String currentUserName;
  final bool isAdmin;

  const CkWebViewScreen({
    super.key,
    required this.activeOrderId,
    required this.currentUserEmail,
    required this.currentUserName,
    required this.isAdmin,
  });

  @override
  State<CkWebViewScreen> createState() => _CkWebViewScreenState();
}

class _CkWebViewScreenState extends State<CkWebViewScreen> {
  late final WebViewController _controller;
  final FirestoreService _firestore = FirestoreService();
  Map<String, dynamic>? _detectedCard;
  bool _isLoading = true;
  String _selectedCondition = 'NM';
  int _selectedQty = 1;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0D1117))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) => setState(() => _isLoading = true),
          onPageFinished: (url) {
            setState(() => _isLoading = false);
            _injectCardExtractor();
          },
        ),
      )
      ..addJavaScriptChannel(
        'CardDetectorChannel',
        onMessageReceived: (message) {
          try {
            final data = jsonDecode(message.message) as Map<String, dynamic>;
            setState(() {
              _detectedCard = data;
              _selectedCondition = data['style'] ?? 'NM';
            });
          } catch (_) {}
        },
      )
      ..loadRequest(Uri.parse('https://www.cardkingdom.com'));
  }

  /// Script JS inyectado en Card Kingdom para detectar carta actual en pantalla
  void _injectCardExtractor() {
    const js = '''
      (function() {
        function scanCard() {
          const titleEl = document.querySelector('h1.product-title, .product-name');
          if (!titleEl) return;

          const title = titleEl.innerText.trim();
          const imgEl = document.querySelector('.product-image img, .main-image img');
          const imageUrl = imgEl ? imgEl.src : '';
          const pidInput = document.querySelector('input[name="product_id"]');
          const productId = pidInput ? pidInput.value : '';

          CardDetectorChannel.postMessage(JSON.stringify({
            cardName: title,
            imageUrl: imageUrl,
            productId: productId,
            url: window.location.href,
            style: 'NM',
            price: 1.0
          }));
        }

        scanCard();
      })();
    ''';
    _controller.runJavaScript(js);
  }

  Future<void> _addDetectedCardToOrder() async {
    if (_detectedCard == null) return;

    await _firestore.addOrUpsertOrderItem(
      orderId: widget.activeOrderId,
      buyerEmail: widget.currentUserEmail,
      buyerName: widget.currentUserName,
      cardName: _detectedCard!['cardName'] ?? 'Carta CK',
      edition: 'Card Kingdom',
      condition: _selectedCondition,
      foil: false,
      price: (_detectedCard!['price'] as num?)?.toDouble() ?? 1.0,
      quantityToAdd: _selectedQty,
      imageUrl: _detectedCard!['imageUrl'] ?? '',
      pageUrl: _detectedCard!['url'] ?? '',
      productId: _detectedCard!['productId'] ?? '',
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF10B981),
          content: Text('Carta agregada a la orden activa con éxito.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        elevation: 0,
        title: const Text('Navegador Card Kingdom', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        actions: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => _controller.goBack(),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _controller.reload(),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const LinearProgressIndicator(color: Color(0xFFFBBF24), backgroundColor: Colors.transparent),

          // Floating Action Bar de Detección de Carta (§5.9)
          if (_detectedCard != null)
            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF161B22).withOpacity(0.96),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFBBF24)),
                  boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 12, offset: Offset(0, 4))],
                ),
                child: Row(
                  children: [
                    if (_detectedCard!['imageUrl'] != null && _detectedCard!['imageUrl'].isNotEmpty)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.network(_detectedCard!['imageUrl'], width: 36, height: 50, fit: BoxFit.cover),
                      ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _detectedCard!['cardName'] ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              DropdownButton<String>(
                                value: _selectedCondition,
                                dropdownColor: const Color(0xFF161B22),
                                underline: const SizedBox(),
                                style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 11, fontWeight: FontWeight.bold),
                                items: const ['NM', 'EX', 'VG', 'G'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                                onChanged: (v) {
                                  if (v != null) setState(() => _selectedCondition = v);
                                },
                              ),
                              const SizedBox(width: 8),
                              Text('Cant: \$_selectedQty', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      icon: const Icon(Icons.add_shopping_cart, size: 14),
                      label: const Text('Añadir a Orden', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFBBF24),
                        foregroundColor: const Color(0xFF0D1117),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      onPressed: _addDetectedCardToOrder,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
