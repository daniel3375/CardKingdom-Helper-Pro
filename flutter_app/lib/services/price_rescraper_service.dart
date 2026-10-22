import 'dart:async';
import '../models/purchases_models.dart';
import 'firestore_service.dart';
import 'ck_scraper_service.dart';

/// =========================================================================
/// SERVICIO: RE-SCANEO Y ACTUALIZADOR DE PRECIOS CARD KINGDOM (§7.1, §8.3)
///
/// Características:
/// - Filtro opcional por regla de elegibilidad (§2.4).
/// - Resuelve CORS automáticamente en Web mediante CkScraperService.
/// - Consulta nativa directa sin restricciones CORS en Android / iOS.
/// - Detección de agotado / sold out y cálculo preciso de delta ($ USD).
/// - Actualización por lotes en Firestore.
/// =========================================================================

class RescrapeResult {
  final OrderItem item;
  final double oldPrice;
  final double currentPrice;
  final double delta;
  final bool inStock;
  final int stockCount;

  RescrapeResult({
    required this.item,
    double? oldPrice,
    required this.currentPrice,
    required this.delta,
    required this.inStock,
    required this.stockCount,
  }) : oldPrice = oldPrice ?? item.price;

  bool get priceChanged => delta != 0;
  bool get hasIncreased => delta > 0;
  bool get hasDecreased => delta < 0;
}

class PriceRescraperService {
  final FirestoreService _firestore = FirestoreService();

  /// Re-escaneo reactivo de lista de ítems mediante Stream (compatible con Web y Móvil)
  static Stream<RescrapeResult> rescrapeEligibleItems(
    List<OrderItem> items, {
    bool onlyEligible = false,
    Duration delay = const Duration(milliseconds: 350),
  }) async* {
    final targetList = onlyEligible
        ? items.where((i) => i.needsPriceRefresh).toList()
        : items.where((i) => i.pageUrl.trim().isNotEmpty).toList();

    for (final item in targetList) {
      double foundPrice = item.price;
      bool inStock = true;
      int stockCount = 1;

      try {
        final scraped = await CkScraperService.scrapeCard(item.pageUrl);
        if (scraped != null && scraped.variations.isNotEmpty) {
          // Buscar variación que coincida con la condición de la carta (NM, EX, VG, G)
          final variation = scraped.variations.firstWhere(
            (v) => v.condition.toUpperCase() == item.condition.toUpperCase(),
            orElse: () => scraped.variations.first,
          );

          foundPrice = variation.price > 0 ? variation.price : item.price;
          inStock = variation.stock > 0;
          stockCount = variation.stock;
        }
      } catch (_) {
        // Fallback seguro: mantener precio existente si la red falla
        foundPrice = item.price;
        inStock = item.inStock;
        stockCount = item.availableQty;
      }

      final delta = double.parse((foundPrice - item.price).toStringAsFixed(2));

      yield RescrapeResult(
        item: item,
        oldPrice: item.price,
        currentPrice: foundPrice,
        delta: delta,
        inStock: inStock,
        stockCount: stockCount,
      );

      await Future.delayed(delay);
    }
  }

  /// Aplica los resultados actualizados de precio y stock a la base de datos Firestore
  Future<void> applyUpdatedPrices(String orderId, List<RescrapeResult> results) async {
    for (final res in results) {
      await _firestore.updateItemPriceAndStock(
        orderId: orderId,
        itemId: res.item.id,
        newPrice: res.currentPrice,
        inStock: res.inStock,
        availableQty: res.stockCount,
      );
    }
  }
}
