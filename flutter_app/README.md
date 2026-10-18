# ManaBros - Aplicación Flutter (Dart)

Proyecto móvil nativo de ManaBros para consolidación de pedidos de Magic: The Gathering en Card Kingdom, basado en la especificación técnica §5.

## Estructura del Proyecto

```
flutter_app/
├── pubspec.yaml                 # Dependencias (Firebase, Webview, HTTP, Intl)
├── analysis_options.yaml        # Reglas de linter Flutter
├── firestore.rules              # Reglas de seguridad Firestore de la app
└── lib/
    ├── main.dart                # Punto de entrada y autenticación
    ├── models/
    │   └── purchases_models.dart # Modelos fuertemente tipados con fromMap/toMap
    ├── screens/
    │   ├── order_detail_screen.dart   # Pantalla principal de orden activa (§5.1, §5.2)
    │   ├── orders_history_screen.dart # Historial de órdenes finalizadas (§5.7)
    │   ├── mass_entry_screen.dart     # Entrada masiva de listas de cartas (§5.5)
    │   └── ck_webview_screen.dart     # Navegador Card Kingdom con inyección JS (§5.6)
    ├── widgets/
    │   ├── order_card.dart              # Tarjeta de orden con indicador de urgencia (§5.4)
    │   ├── buyer_breakdown_card.dart    # Desglose individual por comprador
    │   ├── shipping_management_card.dart# Asignación de flete y tracking (§5.3)
    │   ├── order_payments_modal.dart    # Modal de registro y liquidación de abonos (§5.2)
    │   └── settings_dialog.dart         # Diálogo de ajustes de usuario y admin (§5.9)
    └── services/
        ├── firestore_service.dart       # CRUD Firestore con regla de upsert (§1.2)
        ├── price_rescraper_service.dart # Re-escaneo de precios elegibles (§2.4)
        └── ck_cart_pusher.dart          # Automatización de carrito en Card Kingdom
```

## Ejecución

```bash
flutter pub get
flutter run
```
