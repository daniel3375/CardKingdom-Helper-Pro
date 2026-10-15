# Plan de Implementación: Alineación 100% con Especificación PurchasesManabros

Plan integral para sincronizar la aplicación con todas las reglas de negocio, ciclo de vida de órdenes, modelos de datos, gestión de abonos y saldos, y permisos de rol definidos en el documento de especificación funcional oficial.

---

## 1. Decisiones Clave y Respuestas del Usuario

- **Rol Colaborador:** Se mantiene idéntico al rol de Comprador (sin privilegios administrativos adicionales), tal como opera la app Flutter actual.
- **Entrada de Cartas:** Se mantendrán activas las tres modalidades para máxima conveniencia en web: Pegar URL directa de CK, Navegador embebido (WebView) y Carga masiva de listas (Decklist).
- **Cobertura de Abonos:** Se implementará el desglose limpio y transparente que separa el balance de **Cartas** (`cardsPaid` vs `userAmount`) y el balance de **Envío** (`shippingPaid` vs `shippingShare`).
- **Look & Feel:** Se preserva el diseño oscuro y elegante de **ManaBros Store** (`#0D1117`, acentos ámbar/dorado `manabr✧s`), aplicando la disciplina anti-slop (sin píldoras estáticas excesivas, tipografía editorial y números tabulares claros).

---

## 2. Cambios Propuestos por Módulo

### 2.1 Modelo de Datos y Tipos (`src/types/card.ts` & `src/types/purchases.ts`)
- **`UserProfile`:** `uid`, `email`, `displayName`, `photoURL`, `role` (`'admin'` | `'colaborador'` | `'comprador'`), `status` (`'unconfirmed'` | `'confirmed'`), `balance` (double), `createdAt`.
- **`PurchaseOrder`:** `id`, `status` (`'pending'` | `'active'` | `'purchased'` | `'finalized'`), `estimatedPurchaseDate?`, `shippingCost?`, `createdAt`.
- **`OrderItem`:** `id`, `buyerEmail`, `buyerName`, `cardName`, `edition`, `cardType`, `imageUrl`, `pageUrl`, `productId`, `foil` (bool), `condition` (`'NM'` | `'EX'` | `'VG'` | `'G'`), `price`, `quantity`, `inStock`, `availableQty`, `refreshStatus` (`null` | `'ok'` | `'error'`), `createdAt`, `lastCheckedAt`.
  - Regla `needsPriceRefresh`: `pageUrl != ''` && (`refreshStatus != 'ok'` || `now - lastCheckedAt >= 1 hora`).
- **`Payment`:** `id`, `orderId`, `buyerEmail`, `amount`, `note`, `registeredBy`, `type` (`'cards'` | `'shipping'`), `createdAt`.
- **`BalanceMovement`:** `id`, `email`, `type` (`'credit'` | `'outflow'`), `amount`, `description`, `orderId?`, `registeredBy`, `createdAt`.
- **`AppSettings`:** `historyEnabled` (bool, default `false`), `buyersViewHistory` (bool, default `true`).

### 2.2 Gestión de Estado y Servicios Centrales (`src/services/storeService.ts`)
- Implementar el store en memoria / local con persistencia simulada de Firestore que soporte:
  - Órdenes: `getActiveOrderId`, `getAllOrders`, `createOrder` (siempre nace en `pending`, picker de fecha estimada entre hoy y hoy+365 días), transiciones de estado (`pending` → `active` → `purchased` → `finalized`).
  - Finalización de orden con cálculo de excedentes (`cardsSurplus = cardsPaid - userAmount`, `shippingSurplus = shippingPaid - shippingShare`, `total = max(cardsSurplus, 0) + max(shippingSurplus, 0)`), acreditación a `balance` y registro de `BalanceMovement`.
  - Items: `upsertItem` (agrupa por `buyerEmail + cardName + condition + foil`), `updateItemFields`, `deleteItem`, `deleteUserItems`.
  - Usuarios: lista de usuarios, confirmación (`unconfirmed` → `confirmed`), ajuste de saldo (`credit` y `outflow` con descripciones obligatorias y validación de tope de saldo).
  - Pagos: registro y eliminación de abonos tipados (`cards` y `shipping`).
  - Ajustes globales de la app (`historyEnabled`, `buyersViewHistory`).

### 2.3 Pantalla Home y Navegación Principal (`src/components/Header.tsx`, `src/App.tsx`)
- Incorporar control de usuario no confirmado: banner de espera "Debe esperar confirmación de un admin para comprar" si el usuario activo tiene `status == 'unconfirmed'`.
- Menú unificado con accesos según rol y configuración:
  1. **Comprar / Orden Activa** (gated si no está confirmado).
  2. **Mis Órdenes / Historial** (visible siempre para admin; para compradores solo si `historyEnabled` está activo).
  3. **Usuarios** (visible solo para admin; con badge de conteo de usuarios sin confirmar).
  4. **Ajustes** (tema, configuración global de historial, proxy, caché y cierre de sesión).
- Selector de Orden Activa: manejar casos de 0 órdenes activas (aviso claro), 1 orden activa (indicador), o múltiples órdenes activas (dropdown de selección).

### 2.4 Pantalla de Detalle de Orden (`src/components/OrderDetailScreen.tsx` & `ActiveOrderManager.tsx`)
- Adaptar o integrar el `OrderDetailScreen` completo:
  - **Cabecera:** Chip de estado (`Pendiente`, `Activa`, `Comprada`, `Finalizada`), urgencia de compra (`En N días`, `Compra es hoy`, `Vencida hace N días`).
  - **Transición de estados (Admin):** Botones contextuales ("Activar orden", "Marcar como comprada", "Finalizar orden" con modal de advertencia y previsualización de saldos a favor).
  - **Modos de vista:** "Compradores" (default) y "Cartas" (consolidado merged por `cardName + condition + foil`).
  - **Desglose de Cobertura:**
    - Cartas: Subtotal pedido vs Total abonado a cartas.
    - Envío: Reparto proporcional `share = (shippingCost / totalCartas) * cartasComprador`, abonado a envío, y pendiente.
  - **Gestión de Abonos:**
    - Botones para "Registrar abono" (cartas) y "Registrar abono de envío".
    - Modal de lista de abonos (`PaymentsScreen`) con opción de eliminar abonos (solo en órdenes no finalizadas).
  - **Inmutabilidad:** Si la orden está en estado `finalized`, todo queda en solo lectura permanente.

### 2.5 Pantalla de Gestión de Usuarios y Saldo (`src/components/UsersManagerModal.tsx` o vista de Usuarios)
- Lista de usuarios con estado ("Confirmado" / "Sin confirmar") y saldo actual.
- Detalle de usuario:
  - Botón "Confirmar usuario" para usuarios nuevos.
  - "Agregar saldo" (diálogo con Monto > 0 y Descripción obligatoria).
  - "Registrar salida de saldo" (validación: no puede superar el saldo actual, descripción obligatoria).
  - "Ver movimientos" (historial con descripción, fecha, `+$X` verde y `-$X` rojo).

### 2.6 Pantalla de Ajustes (`src/components/SettingsModal.tsx`)
- Selector de Tema: Claro / Oscuro / Sistema.
- Ajustes de Admin:
  - Toggle "Historial de compra" (`historyEnabled`).
  - Toggle "Ver solo tus items" (`buyersViewHistory`).
- Proxy de descargas y limpieza de caché.
- Conmutador de sesión / Cierre de sesión.

### 2.7 Código Flutter / Dart de Referencia (`src/components/FlutterCodeHub.tsx`)
- Actualizar el repositorio de código Dart para incluir:
  - `FirestoreService` completo con las operaciones exactas del documento.
  - Modelos `UserProfile`, `PurchaseOrder`, `OrderItem`, `Payment`, `BalanceMovement`, `AppSettings`.
  - Lógica de liquidación de excedentes al finalizar orden (`surplus`).
  - Reglas de seguridad `firestore.rules` adaptadas a la estructura `purchase_orders/{orderId}/items` y `/payments`.

---

## 3. Plan de Verificación

1. **Pruebas de Ciclo de Vida de Órdenes:**
   - Crear orden con fecha estimada (nace en `pending`).
   - Pasar a `active` -> verificar que se pueden agregar cartas.
   - Pasar a `purchased` -> verificar que se bloquea la adición de cartas.
   - Finalizar orden -> verificar cálculo y acreditación de excedentes al saldo del comprador.
2. **Pruebas de Reparto de Envío y Abonos:**
   - Asignar costo de envío (ej. $15.00) en una orden con varios compradores y verificar el split proporcional por cantidad de cartas.
   - Registrar abonos de tipo `cards` y `shipping` y verificar la actualización en tiempo real de los porcentajes de cobertura.
3. **Pruebas de Permisos y Roles:**
   - Probar vista como `admin` vs `comprador` confirmado vs `comprador` sin confirmar.
   - Probar el toggle `historyEnabled` y `buyersViewHistory` desde Ajustes.
4. **Compilación y Linters:**
   - Ejecutar `compile_applet` y `lint_applet` tras completar las modificaciones.
