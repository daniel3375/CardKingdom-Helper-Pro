import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:html/parser.dart' as html_parser;

/// =========================================================================
/// SERVICIO UNIVERSAL DE SCRAPING DE CARD KINGDOM (Flutter Multiplataforma)
///
/// Resuelve el problema de CORS automáticamente según el entorno:
/// 1. En Flutter Web (kIsWeb == true):
///    - Evita el bloqueo Same-Origin Policy usando el endpoint proxy /api/scrape-card.
///    - Dispone de fallback dinámico con proxy CORS si se ejecuta en preview independiente.
/// 2. En Flutter Nativo (Android / iOS / Desktop, kIsWeb == false):
///    - Realiza la petición directa HTTP a nivel de socket de sistema operativo
///      con cabeceras de navegador de escritorio y parseo local con 'package:html'.
/// =========================================================================

class ScrapedVariation {
  final String condition;
  final double price;
  final int stock;
  final bool isFoil;

  const ScrapedVariation({
    required this.condition,
    required this.price,
    required this.stock,
    required this.isFoil,
  });

  factory ScrapedVariation.fromJson(Map<String, dynamic> json) {
    return ScrapedVariation(
      condition: json['condition']?.toString() ?? 'NM',
      price: (json['price'] is num) ? (json['price'] as num).toDouble() : 0.0,
      stock: (json['stock'] is num) ? (json['stock'] as num).toInt() : 0,
      isFoil: json['isFoil'] == true,
    );
  }
}

class ScrapedCardData {
  final String url;
  final String title;
  final String setName;
  final String cardType;
  final String imageUrl;
  final String productId;
  final List<ScrapedVariation> variations;

  const ScrapedCardData({
    required this.url,
    required this.title,
    required this.setName,
    this.cardType = 'Magic Single',
    required this.imageUrl,
    this.productId = '',
    required this.variations,
  });

  factory ScrapedCardData.fromJson(Map<String, dynamic> json) {
    final rawVariations = json['variations'] as List? ?? [];
    return ScrapedCardData(
      url: json['url']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Magic Card',
      setName: json['setName']?.toString() ?? 'Unknown Set',
      cardType: json['cardType']?.toString() ?? 'Magic Single',
      imageUrl: json['imageUrl']?.toString() ?? '',
      productId: json['productId']?.toString() ?? '',
      variations: rawVariations
          .map((v) => ScrapedVariation.fromJson(Map<String, dynamic>.from(v as Map)))
          .toList(),
    );
  }
}

class CkScraperService {
  /// URL base opcional para el backend proxy (si es diferente al host actual)
  static String? customBackendBaseUrl;

  /// Scraping universal de cualquier URL de producto de Card Kingdom
  static Future<ScrapedCardData?> scrapeCard(String cardKingdomUrl) async {
    final cleanUrl = cardKingdomUrl.trim();
    if (!cleanUrl.contains('cardkingdom.com')) {
      throw ArgumentError('La URL debe pertenecer a cardkingdom.com');
    }

    if (kIsWeb) {
      // ==============================================================
      // ESTRATEGIA 1: FLUTTER WEB (Resuelve CORS vía Backend Proxy / BFF)
      // ==============================================================
      return _scrapeFromWebProxy(cleanUrl);
    } else {
      // ==============================================================
      // ESTRATEGIA 2: FLUTTER NATIVO (Android / iOS sin restricciones CORS)
      // ==============================================================
      return _scrapeNativeDirect(cleanUrl);
    }
  }

  /// Petición desde Flutter Web contra el endpoint local Node.js /api/scrape-card
  static Future<ScrapedCardData?> _scrapeFromWebProxy(String targetUrl) async {
    final client = http.Client();
    try {
      // Resolver URI relativa respecto al origen del navegador actual (Same-Domain)
      final Uri proxyUri = customBackendBaseUrl != null && customBackendBaseUrl!.isNotEmpty
          ? Uri.parse('\${customBackendBaseUrl!}/api/scrape-card')
          : Uri.base.resolve('/api/scrape-card');

      final response = await client.post(
        proxyUri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'url': targetUrl}),
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        if (data['success'] == true) {
          return ScrapedCardData.fromJson(data);
        }
      }

      // Si el backend local no está disponible (ej. hosting estático puro en GitHub Pages),
      // se intenta un fallback mediante pasarela CORS pública
      return await _scrapeViaPublicCorsGateway(targetUrl);
    } catch (_) {
      // Fallback ante fallo de conexión local
      return await _scrapeViaPublicCorsGateway(targetUrl);
    } finally {
      client.close();
    }
  }

  /// Fallback para Flutter Web independiente usando pasarela CORS
  static Future<ScrapedCardData?> _scrapeViaPublicCorsGateway(String targetUrl) async {
    final client = http.Client();
    try {
      final corsGatewayUri = Uri.parse('https://corsproxy.io/?\${Uri.encodeComponent(targetUrl)}');
      final response = await client.get(
        corsGatewayUri,
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        return _parseHtml(targetUrl, response.body);
      }
    } catch (_) {
      // Silencioso
    } finally {
      client.close();
    }
    return null;
  }

  /// Petición directa a Card Kingdom desde Flutter Android / iOS (Sin restricciones CORS)
  static Future<ScrapedCardData?> _scrapeNativeDirect(String targetUrl) async {
    final client = http.Client();
    try {
      final response = await client.get(
        Uri.parse(targetUrl),
        headers: {
          'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        return _parseHtml(targetUrl, response.body);
      }
    } finally {
      client.close();
    }
    return null;
  }

  /// Parser común del árbol HTML de Card Kingdom (usado en nativo o fallback)
  static ScrapedCardData _parseHtml(String url, String html) {
    final document = html_parser.parse(html);

    // 1. Título de la carta
    final titleEl = document.querySelector('h1.productDetailTitle') ??
        document.querySelector('.itemInformation h1') ??
        document.querySelector('h1');
    final title = titleEl?.text.trim() ?? 'Magic Card';

    // 2. Edición / Set
    final setEl = document.querySelector('.productDetailSet a') ??
        document.querySelector('.productDetailSet') ??
        document.querySelector('.itemInformation .set');
    final setName = setEl?.text.trim() ?? 'Desconocida';

    // 3. Imagen
    final imgEl = document.querySelector('.productDetailImage img') ??
        document.querySelector('.mainCardImage') ??
        document.querySelector('meta[property="og:image"]');
    final imageUrl = imgEl?.attributes['src'] ?? imgEl?.attributes['content'] ?? '';

    // 4. Product ID
    final pidEl = document.querySelector('input[name="product_id"]');
    final productId = pidEl?.attributes['value'] ?? '';

    // 5. Variaciones, condiciones, stock y precios
    final variations = <ScrapedVariation>[];
    final rows = document.querySelectorAll('.itemQty, .styleList tr, .variation-row, .productDetailQtyWrap');

    for (final el in rows) {
      final text = el.text;
      final priceMatch = RegExp(r'\\$\\s*([0-9]+\\.[0-9]{2})').firstMatch(text);
      if (priceMatch == null) continue;

      final price = double.tryParse(priceMatch.group(1) ?? '') ?? 0.0;
      if (price <= 0) continue;

      String condition = 'NM';
      final upper = text.toUpperCase();
      if (upper.contains('EX') || upper.contains('EXCELLENT')) {
        condition = 'EX';
      } else if (upper.contains('VG') || upper.contains('VERY GOOD')) {
        condition = 'VG';
      } else if (upper.contains('G') || upper.contains('GOOD')) {
        condition = 'G';
      }

      final isFoil = upper.contains('FOIL');

      int stock = 1;
      final qtyMatch = RegExp(r'([0-9]+)\\s+available|Qty:\\s*([0-9]+)', caseSensitive: false).firstMatch(text);
      if (qtyMatch != null) {
        stock = int.tryParse(qtyMatch.group(1) ?? qtyMatch.group(2) ?? '1') ?? 1;
      } else if (upper.contains('OUT OF STOCK') || upper.contains('SOLD OUT')) {
        stock = 0;
      }

      variations.add(ScrapedVariation(
        condition: condition,
        price: price,
        stock: stock,
        isFoil: isFoil,
      ));
    }

    // Fallback si la plantilla de producto es atípica
    if (variations.isEmpty) {
      final anyPrice = RegExp(r'\\$\\s*([0-9]+\\.[0-9]{2})').firstMatch(html);
      if (anyPrice != null) {
        variations.add(ScrapedVariation(
          condition: 'NM',
          price: double.tryParse(anyPrice.group(1) ?? '') ?? 1.99,
          stock: 4,
          isFoil: false,
        ));
      }
    }

    return ScrapedCardData(
      url: url,
      title: title,
      setName: setName,
      imageUrl: imageUrl,
      productId: productId,
      variations: variations,
    );
  }
}
