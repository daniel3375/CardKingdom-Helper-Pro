import 'dart:async';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/purchases_models.dart';

class CkCartPusher {
  static Future<void> pushItemsToCardKingdom({
    required WebViewController controller,
    required List<OrderItem> items,
    required Function(int current, int total, OrderItem item) onProgress,
    required Function(String error, OrderItem item) onError,
  }) async {
    final validItems = items.where((i) => i.productId.isNotEmpty).toList();

    for (int i = 0; i < validItems.length; i++) {
      final item = validItems[i];
      onProgress(i + 1, validItems.length, item);

      final jsCall = '''
        (async function() {
          try {
            const res = await fetch('/api/cart/add', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({
                product_id: '\${item.productId}',
                style: '\${item.condition}',
                quantity: \${item.quantity}
              })
            });
            return await res.json();
          } catch(e) {
            return { error: e.toString() };
          }
        })();
      ''';

      try {
        await controller.runJavaScript(jsCall);
      } catch (e) {
        onError(e.toString(), item);
      }

      await Future.delayed(const Duration(seconds: 5));
    }
  }
}
