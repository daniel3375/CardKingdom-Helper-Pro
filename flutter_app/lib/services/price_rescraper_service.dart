import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:html/parser.dart' as html_parser;
import '../models/purchases_models.dart';

class RescrapeResult {
  final OrderItem item;
  final double currentPrice;
  final double delta;
  final bool inStock;
  final int stockCount;

  RescrapeResult({
    required this.item,
    required this.currentPrice,
    required this.delta,
    required this.inStock,
    required this.stockCount,
  });
}

class PriceRescraperService {
  static Stream<RescrapeResult> rescrapeEligibleItems(
    List<OrderItem> items, {
    Duration delay = const Duration(seconds: 5),
  }) async* {
    final client = http.Client();

    try {
      for (final item in items) {
        if (!item.needsPriceRefresh) continue;

        try {
          final response = await client.get(
            Uri.parse(item.pageUrl),
            headers: {'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36'},
          );

          if (response.statusCode == 200) {
            final document = html_parser.parse(response.body);
            double foundPrice = item.price;
            bool inStock = true;
            int stockCount = 1;

            final rows = document.querySelectorAll('.itemQty, .styleList tr, .variation-row');
            for (final row in rows) {
              final text = row.text;
              if (text.toUpperCase().contains(item.condition.toUpperCase())) {
                final match = RegExp(r'\\$\\s*([0-9]+\\.[0-9]{2})').firstMatch(text);
                if (match != null) {
                  foundPrice = double.tryParse(match.group(1) ?? '') ?? item.price;
                }
                if (text.toLowerCase().contains('out of stock') || text.toLowerCase().contains('sold out')) {
                  inStock = false;
                  stockCount = 0;
                }
                break;
              }
            }

            final delta = double.parse((foundPrice - item.price).toStringAsFixed(2));

            yield RescrapeResult(
              item: item,
              currentPrice: foundPrice,
              delta: delta,
              inStock: inStock,
              stockCount: stockCount,
            );
          }
        } catch (_) {
          yield RescrapeResult(
            item: item,
            currentPrice: item.price,
            delta: 0.0,
            inStock: true,
            stockCount: 1,
          );
        }

        await Future.delayed(delay);
      }
    } finally {
      client.close();
    }
  }
}
