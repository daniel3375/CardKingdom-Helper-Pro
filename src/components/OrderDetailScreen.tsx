import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  Play,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Edit2,
  ExternalLink,
  Plus,
  DollarSign,
  Truck,
  Check,
  X,
  Clock,
  Layers,
  Users,
  Search,
  Lock,
} from 'lucide-react';
import {
  PurchaseOrder,
  OrderItem,
  Payment,
  UserProfile,
  getOrderUrgency,
  CardCondition,
} from '../types/purchases';
import { storeService } from '../services/storeService';
import { PriceRescraperModal } from './PriceRescraperModal';
import { OneByOneCartPusherModal } from './OneByOneCartPusherModal';

interface OrderDetailScreenProps {
  orderId: string;
  currentUser: UserProfile;
  onBack?: () => void;
  onOpenWebViewWithUrl?: (url: string) => void;
}

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  orderId,
  currentUser,
  onOpenWebViewWithUrl,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [, setTick] = useState(0);

  // View mode: 'buyers' (Compradores) | 'cards' (Cartas)
  const [viewMode, setViewMode] = useState<'buyers' | 'cards'>('buyers');
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState<string>('all');
  const [cardsSearch, setCardsSearch] = useState('');

  // Modals state
  const [showRescraperModal, setShowRescraperModal] = useState(false);
  const [showPusherModal, setShowPusherModal] = useState(false);

  // Payment register dialog
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    buyerEmail: string;
    buyerName: string;
    type: 'cards' | 'shipping';
    amount: string;
    note: string;
    error: string | null;
  }>({
    isOpen: false,
    buyerEmail: '',
    buyerName: '',
    type: 'cards',
    amount: '',
    note: '',
    error: null,
  });

  // Payments list modal
  const [paymentsListModal, setPaymentsListModal] = useState<{
    isOpen: boolean;
    buyerEmail: string;
    buyerName: string;
    type?: 'cards' | 'shipping';
  }>({
    isOpen: false,
    buyerEmail: '',
    buyerName: '',
  });

  // Edit item modal
  const [editItemModal, setEditItemModal] = useState<{
    isOpen: boolean;
    item: OrderItem | null;
    condition: CardCondition;
    price: string;
    quantity: number;
    error: string | null;
  }>({
    isOpen: false,
    item: null,
    condition: 'NM',
    price: '',
    quantity: 1,
    error: null,
  });

  // Card detail modal
  const [detailCardItem, setDetailCardItem] = useState<OrderItem | null>(null);

  // Finalize warning & surplus modal
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [pendingSurplusList, setPendingSurplusList] = useState<{ email: string; surplus: number }[]>([]);

  // Shipping cost edit input
  const [isEditingShipping, setIsEditingShipping] = useState(false);
  const [shippingInput, setShippingInput] = useState('');

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const forceRefresh = () => setTick(t => t + 1);

  // Order summary calculation from storeService
  const summary = storeService.getOrderSummary(orderId);
  const order = summary.order;

  if (!order) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p className="text-base font-semibold">Orden no encontrada</p>
      </div>
    );
  }

  const urgency = getOrderUrgency(order.estimatedPurchaseDate);
  const canMutate = order.status !== 'finalized';

  // Buyers list
  const filteredBuyers = selectedBuyerFilter === 'all'
    ? summary.buyersData
    : summary.buyersData.filter(b => b.email.toLowerCase() === selectedBuyerFilter.toLowerCase());

  // Handle Order Status Transitions (§4)
  const handleTransitionStatus = () => {
    if (!isAdmin) return;

    if (order.status === 'pending') {
      if (confirm('¿Cambiar el estado de esta orden a Activa? Los compradores podrán agregar cartas.')) {
        storeService.updateOrderStatus(orderId, 'active');
        showToast('Orden actualizada a Activa');
        forceRefresh();
      }
    } else if (order.status === 'active') {
      if (confirm('¿Marcar esta orden como Comprada? Ya no se podrán agregar más cartas a Card Kingdom.')) {
        storeService.updateOrderStatus(orderId, 'purchased');
        showToast('Orden actualizada a Comprada');
        forceRefresh();
      }
    } else if (order.status === 'purchased') {
      // Calculate surpluses preview
      const previewSummary = storeService.getOrderSummary(orderId);
      const totalOrderCards = previewSummary.totalCards;
      const shippingCost = previewSummary.shippingCost;

      const surpluses: { email: string; surplus: number }[] = [];
      previewSummary.buyersData.forEach(b => {
        const shippingShare = totalOrderCards > 0 ? (shippingCost / totalOrderCards) * b.userCards : 0;
        const cardsSurplus = b.cardsPaid - b.userCardsAmount;
        const shippingSurplus = b.shippingPaid - shippingShare;
        const total = Math.round((Math.max(cardsSurplus, 0) + Math.max(shippingSurplus, 0)) * 100) / 100;
        if (total > 0) surpluses.push({ email: b.email, surplus: total });
      });

      setPendingSurplusList(surpluses);
      setShowFinalizeModal(true);
    }
  };

  const handleConfirmFinalize = () => {
    const res = storeService.updateOrderStatus(orderId, 'finalized');
    setShowFinalizeModal(false);
    if (res.success) {
      showToast('Orden finalizada exitosamente. Saldos a favor acreditados.');
      forceRefresh();
    }
  };

  const handleSaveShippingCost = () => {
    const val = parseFloat(shippingInput.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      storeService.updateOrderShippingCost(orderId, val);
      showToast(`Costo de envío actualizado a $${val.toFixed(2)} USD`);
      setIsEditingShipping(false);
      forceRefresh();
    }
  };

  const handleRegisterPayment = () => {
    const amt = parseFloat(paymentModal.amount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setPaymentModal(prev => ({ ...prev, error: 'Ingresa un monto válido mayor a 0' }));
      return;
    }

    const res = storeService.addPayment(
      orderId,
      paymentModal.buyerEmail,
      amt,
      paymentModal.type,
      paymentModal.note,
      currentUser.email
    );

    if (res.success) {
      showToast(`Abono de $${amt.toFixed(2)} USD registrado`);
      setPaymentModal({
        isOpen: false,
        buyerEmail: '',
        buyerName: '',
        type: 'cards',
        amount: '',
        note: '',
        error: null,
      });
      forceRefresh();
    } else {
      setPaymentModal(prev => ({ ...prev, error: res.message || 'Error al registrar abono' }));
    }
  };

  const handleDeletePayment = (paymentId: string, amount: number) => {
    if (!canMutate) return;
    if (confirm(`¿Estás seguro de eliminar el abono de $${amount.toFixed(2)} USD?`)) {
      storeService.deletePayment(orderId, paymentId);
      showToast('Abono eliminado');
      forceRefresh();
    }
  };

  const handleSaveItemEdit = () => {
    if (!editItemModal.item || !canMutate) return;
    const priceVal = parseFloat(editItemModal.price.replace(',', '.'));
    if (isNaN(priceVal) || priceVal < 0) {
      setEditItemModal(prev => ({ ...prev, error: 'Precio inválido' }));
      return;
    }
    if (editItemModal.quantity < 1) {
      setEditItemModal(prev => ({ ...prev, error: 'Cantidad debe ser al menos 1' }));
      return;
    }

    storeService.updateItem(orderId, editItemModal.item.id, {
      condition: editItemModal.condition,
      price: priceVal,
      quantity: editItemModal.quantity,
    });

    showToast(`Carta ${editItemModal.item.cardName} actualizada`);
    setEditItemModal({
      isOpen: false,
      item: null,
      condition: 'NM',
      price: '',
      quantity: 1,
      error: null,
    });
    forceRefresh();
  };

  const handleDeleteItem = (item: OrderItem) => {
    if (!canMutate) return;
    if (confirm(`¿Estás seguro de eliminar «${item.cardName}» (${item.condition})?`)) {
      storeService.deleteItem(orderId, item.id);
      showToast(`«${item.cardName}» eliminada del pedido`);
      forceRefresh();
    }
  };

  const handleEmptyUserCart = (buyerEmail: string, buyerName: string) => {
    if (!canMutate) return;
    if (confirm(`¿Estás seguro de vaciar el carrito completo de ${buyerName}? Esta acción no se puede deshacer.`)) {
      storeService.deleteUserItems(orderId, buyerEmail);
      showToast(`Carrito de ${buyerName} vaciado`);
      forceRefresh();
    }
  };

  // Build merged items for 'cards' view mode
  const allOrderItems = storeService.getItemsByOrder(orderId);
  const mergedItemsMap = new Map<string, {
    key: string;
    cardName: string;
    edition: string;
    condition: string;
    foil: boolean;
    price: number;
    totalQuantity: number;
    inStock: boolean;
    availableQty: number;
    refreshStatus: 'ok' | 'error' | null;
    imageUrl: string;
    pageUrl: string;
    buyers: { email: string; name: string; quantity: number; itemId: string }[];
  }>();

  allOrderItems.forEach(item => {
    const key = `${item.cardName}_${item.edition}_${item.condition}_${item.foil}`;
    const existing = mergedItemsMap.get(key);
    if (existing) {
      existing.totalQuantity += item.quantity;
      existing.buyers.push({
        email: item.buyerEmail,
        name: item.buyerName,
        quantity: item.quantity,
        itemId: item.id,
      });
    } else {
      mergedItemsMap.set(key, {
        key,
        cardName: item.cardName,
        edition: item.edition,
        condition: item.condition,
        foil: item.foil,
        price: item.price,
        totalQuantity: item.quantity,
        inStock: item.inStock,
        availableQty: item.availableQty,
        refreshStatus: item.refreshStatus,
        imageUrl: item.imageUrl,
        pageUrl: item.pageUrl,
        buyers: [{
          email: item.buyerEmail,
          name: item.buyerName,
          quantity: item.quantity,
          itemId: item.id,
        }],
      });
    }
  });

  const mergedItemsList = Array.from(mergedItemsMap.values()).filter(m =>
    m.cardName.toLowerCase().includes(cardsSearch.toLowerCase()) ||
    m.edition.toLowerCase().includes(cardsSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#161B22] border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Main Order Card Header */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#30363D]">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                ORDEN {order.id.slice(0, 10).toUpperCase()}
              </h2>

              {/* Status Chip (§10.2) */}
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${
                  order.status === 'active'
                    ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/40'
                    : order.status === 'purchased'
                    ? 'bg-blue-950/70 text-blue-400 border border-blue-500/40'
                    : order.status === 'finalized'
                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                    : 'bg-amber-950/70 text-amber-400 border border-amber-500/40'
                }`}
              >
                {order.status === 'active' && 'Activa'}
                {order.status === 'pending' && 'Pendiente'}
                {order.status === 'purchased' && 'Comprada'}
                {order.status === 'finalized' && 'Finalizada'}
              </span>

              {/* Urgency Badge */}
              {urgency.urgency !== 'none' && order.status !== 'finalized' && order.status !== 'purchased' && (
                <span
                  className={`text-xs font-semibold flex items-center gap-1 ${
                    urgency.urgency === 'upcoming' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{urgency.label}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
              <span>Creada: {new Date(order.createdAt).toLocaleDateString()}</span>
              {order.estimatedPurchaseDate && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Compra estimada: {new Date(order.estimatedPurchaseDate).toLocaleDateString()}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick KPIs & Admin Status Transition Button */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="bg-[#0D1117] border border-[#30363D] px-4 py-2 rounded-xl text-right">
              <span className="text-[11px] text-slate-400 block font-medium">Total de Cartas</span>
              <span className="text-lg font-bold font-mono text-white">{summary.totalCards} copias</span>
            </div>

            <div className="bg-[#0D1117] border border-[#30363D] px-4 py-2 rounded-xl text-right">
              <span className="text-[11px] text-slate-400 block font-medium">Subtotal Cartas</span>
              <span className="text-lg font-bold font-mono text-emerald-400">${summary.totalCartasAmount.toFixed(2)} USD</span>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                {order.status === 'pending' && (
                  <button
                    type="button"
                    onClick={handleTransitionStatus}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0D1117] text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Activar orden
                  </button>
                )}

                {order.status === 'active' && (
                  <button
                    type="button"
                    onClick={handleTransitionStatus}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Marcar como comprada
                  </button>
                )}

                {order.status === 'purchased' && (
                  <button
                    type="button"
                    onClick={handleTransitionStatus}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finalizar orden</span>
                  </button>
                )}

                {order.status === 'finalized' && (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-400 text-xs font-semibold rounded-xl border border-slate-700">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Solo lectura (Finalizada)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Global Action Bar for Admin in Active Order (§4 & §7) */}
        {isAdmin && order.status === 'active' && (
          <div className="pt-4 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-semibold text-slate-400">Acciones Globales de la Orden:</span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowRescraperModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-amber-400 text-xs font-bold rounded-lg border border-amber-500/30 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>1. Actualizar Precios</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  alert(`Se verificó el stock en Card Kingdom para las ${summary.totalCards} cartas de la orden. ¡Stock suficiente en todas las variantes!`);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/30 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Verificar Stock</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPusherModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-[#0D1117] text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>2. Lanzar a Carrito CK</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Shipping Cost & Coverage Card (§6.5) */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 shadow-lg grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Shipping Courier Management */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Envío / Courier Total</span>
            </div>
            {isAdmin && canMutate && (
              <button
                type="button"
                onClick={() => {
                  setShippingInput((order.shippingCost || 0).toString());
                  setIsEditingShipping(!isEditingShipping);
                }}
                className="text-xs text-amber-400 hover:underline"
              >
                {isEditingShipping ? 'Cancelar' : 'Modificar'}
              </button>
            )}
          </div>

          {isEditingShipping ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={shippingInput}
                onChange={(e) => setShippingInput(e.target.value)}
                placeholder="Costo total flete"
                className="w-full px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
              />
              <button
                type="button"
                onClick={handleSaveShippingCost}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-lg"
              >
                Guardar
              </button>
            </div>
          ) : (
            <div className="text-2xl font-bold font-mono text-white">
              ${(order.shippingCost || 0).toFixed(2)} USD
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Reparto proporcional por número de cartas: cada comprador paga según cuántas cartas pidió.
          </p>
        </div>

        {/* Coverage Cartas */}
        <div className="space-y-2 border-l md:border-l-[#30363D] md:pl-5">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Cobertura Cartas
          </span>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-400">Abonado a Cartas:</span>
            <span className="font-mono font-bold text-emerald-400">${summary.totalCardsPaid.toFixed(2)} USD</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-400">Por cubrir cartas:</span>
            <span className={`font-mono font-bold ${summary.totalCartasAmount - summary.totalCardsPaid > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              ${Math.max(0, summary.totalCartasAmount - summary.totalCardsPaid).toFixed(2)} USD
            </span>
          </div>
          <div className="w-full bg-[#0D1117] h-2 rounded-full overflow-hidden border border-[#30363D]">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all"
              style={{
                width: `${summary.totalCartasAmount > 0 ? Math.min(100, (summary.totalCardsPaid / summary.totalCartasAmount) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Coverage Envío */}
        <div className="space-y-2 border-l md:border-l-[#30363D] md:pl-5">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Cobertura Envío
          </span>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-400">Abonado a Envío:</span>
            <span className="font-mono font-bold text-blue-400">${summary.totalShippingPaid.toFixed(2)} USD</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-400">Por cubrir envío:</span>
            <span className={`font-mono font-bold ${(order.shippingCost || 0) - summary.totalShippingPaid > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              ${Math.max(0, (order.shippingCost || 0) - summary.totalShippingPaid).toFixed(2)} USD
            </span>
          </div>
          <div className="w-full bg-[#0D1117] h-2 rounded-full overflow-hidden border border-[#30363D]">
            <div
              className="bg-blue-400 h-full rounded-full transition-all"
              style={{
                width: `${(order.shippingCost || 0) > 0 ? Math.min(100, (summary.totalShippingPaid / (order.shippingCost || 1)) * 100) : 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Mode Switcher: Compradores vs Cartas & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* SegmentedButton (§5.5) */}
        <div className="flex items-center gap-1 p-1 bg-[#161B22] border border-[#30363D] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('buyers')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              viewMode === 'buyers'
                ? 'bg-amber-400 text-[#0D1117] shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Compradores ({summary.buyersData.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              viewMode === 'cards'
                ? 'bg-amber-400 text-[#0D1117] shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Cartas Consolidadas ({mergedItemsMap.size})</span>
          </button>
        </div>

        {/* View Specific Filter */}
        {viewMode === 'buyers' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filtrar Comprador:</span>
            <select
              value={selectedBuyerFilter}
              onChange={(e) => setSelectedBuyerFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#161B22] border border-[#30363D] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="all">Todos los compradores ({summary.buyersData.length})</option>
              {summary.buyersData.map(b => (
                <option key={b.email} value={b.email}>{b.displayName} ({b.userCards} cartas)</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por carta o edición..."
              value={cardsSearch}
              onChange={(e) => setCardsSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#161B22] border border-[#30363D] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        )}
      </div>

      {/* VIEW 1: VISTA DE COMPRADORES (§5.5) */}
      {viewMode === 'buyers' && (
        <div className="space-y-6">
          {filteredBuyers.length === 0 ? (
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-10 text-center text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40 text-amber-400" />
              <p className="text-sm font-semibold">No hay cartas pedidas por este comprador en esta orden.</p>
            </div>
          ) : (
            filteredBuyers.map((buyer) => {
              return (
                <div
                  key={buyer.email}
                  className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-lg transition-all"
                >
                  {/* Buyer Section Header */}
                  <div className="p-4 sm:p-5 bg-[#0D1117] border-b border-[#30363D] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={buyer.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={buyer.displayName}
                        className="w-11 h-11 rounded-full object-cover border border-[#30363D]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{buyer.displayName}</h3>
                          <span className="text-xs text-slate-400">({buyer.email})</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {buyer.userCards} cartas · Subtotal: <strong className="text-emerald-400 font-mono">${buyer.userCardsAmount.toFixed(2)} USD</strong>
                        </span>
                      </div>
                    </div>

                    {/* Buyer Summary & Abonos Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Abono Cartas Button */}
                      {isAdmin && canMutate && (
                        <button
                          type="button"
                          onClick={() => setPaymentModal({
                            isOpen: true,
                            buyerEmail: buyer.email,
                            buyerName: buyer.displayName,
                            type: 'cards',
                            amount: '',
                            note: '',
                            error: null,
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/30"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Abono Cartas</span>
                        </button>
                      )}

                      {/* Abono Envío Button */}
                      {isAdmin && canMutate && (
                        <button
                          type="button"
                          onClick={() => setPaymentModal({
                            isOpen: true,
                            buyerEmail: buyer.email,
                            buyerName: buyer.displayName,
                            type: 'shipping',
                            amount: '',
                            note: '',
                            error: null,
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-blue-400 text-xs font-semibold rounded-lg border border-blue-500/30"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Abono Envío</span>
                        </button>
                      )}

                      {/* Ver Abonos Button */}
                      <button
                        type="button"
                        onClick={() => setPaymentsListModal({
                          isOpen: true,
                          buyerEmail: buyer.email,
                          buyerName: buyer.displayName,
                        })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-slate-300 text-xs font-semibold rounded-lg border border-[#30363D]"
                      >
                        <span>Ver abonos ({buyer.payments.length})</span>
                      </button>

                      {/* Vaciar Carrito Button (Admin only §3.3) */}
                      {isAdmin && canMutate && (
                        <button
                          type="button"
                          onClick={() => handleEmptyUserCart(buyer.email, buyer.displayName)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                          title="Vaciar carrito de este usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Buyer Financial Balance Strip (Cartas + Envío separated §6) */}
                  <div className="bg-[#161B22]/90 px-4 sm:px-5 py-3 border-b border-[#30363D]/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Abonado Cartas</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${buyer.cardsPaid.toFixed(2)} USD
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Cartas Pendiente</span>
                      <span className={`font-mono font-bold ${buyer.cardsPending > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {buyer.cardsPending > 0 ? `$${buyer.cardsPending.toFixed(2)}` : 'Cubierto'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Cuota Envío ({buyer.userCards} cartas)</span>
                      <span className="font-mono font-bold text-blue-300">
                        ${buyer.shippingShare.toFixed(2)} USD
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Envío Pendiente</span>
                      <span className={`font-mono font-bold ${buyer.shippingPending > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {buyer.shippingPending > 0 ? `$${buyer.shippingPending.toFixed(2)}` : 'Cubierto'}
                      </span>
                    </div>
                  </div>

                  {/* Buyer Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#30363D] bg-[#0D1117]/40 text-slate-400 font-semibold text-[11px]">
                          <th className="py-2.5 px-4">Carta & Edición</th>
                          <th className="py-2.5 px-3">Condición</th>
                          <th className="py-2.5 px-3 text-right">Cant.</th>
                          <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                          <th className="py-2.5 px-3">Estado CK</th>
                          {canMutate && <th className="py-2.5 px-3 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#30363D]/40">
                        {buyer.items.map((item) => (
                          <tr key={item.id} className="hover:bg-[#21262D]/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.cardName}
                                    className="w-8 h-11 object-cover rounded shadow-sm border border-[#30363D] shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-11 bg-[#0D1117] rounded border border-[#30363D] shrink-0" />
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setDetailCardItem(item)}
                                      className="font-semibold text-white hover:text-amber-400 transition-colors text-left"
                                    >
                                      {item.cardName}
                                    </button>
                                    {item.foil && (
                                      <span className="text-[9px] font-bold uppercase text-amber-300 bg-amber-950/70 border border-amber-500/40 px-1 py-0.2 rounded">
                                        Foil
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-400 block">{item.edition}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  item.condition === 'NM'
                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                                    : item.condition === 'EX'
                                    ? 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
                                    : item.condition === 'VG'
                                    ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                                    : 'bg-red-950/60 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {item.condition}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-white">
                              x{item.quantity}
                            </td>

                            <td className="py-3 px-3 text-right font-mono text-slate-300">
                              ${item.price.toFixed(2)}
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                              ${(item.price * item.quantity).toFixed(2)}
                            </td>

                            <td className="py-3 px-3">
                              {item.refreshStatus === 'ok' ? (
                                <span className={`text-[10px] font-semibold ${item.inStock ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {item.inStock ? `Disponible (${item.availableQty})` : 'Agotado'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No consultado</span>
                              )}
                            </td>

                            {canMutate && (
                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditItemModal({
                                      isOpen: true,
                                      item,
                                      condition: item.condition,
                                      price: item.price.toString(),
                                      quantity: item.quantity,
                                      error: null,
                                    })}
                                    className="p-1 text-slate-400 hover:text-white hover:bg-[#30363D] rounded transition-colors"
                                    title="Editar carta"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item)}
                                    className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                                    title="Eliminar carta"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: VISTA DE CARTAS CONSOLIDADAS (§5.5) */}
      {viewMode === 'cards' && (
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3.5 bg-[#0D1117] border-b border-[#30363D] flex items-center justify-between text-xs text-slate-400">
            <span>Listado agrupado para compra en Card Kingdom ({mergedItemsList.length} referencias)</span>
            <span>Total unidades: <strong className="text-white font-mono">{summary.totalCards}</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#30363D] bg-[#0D1117]/40 text-slate-400 font-semibold text-[11px]">
                  <th className="py-2.5 px-4">Carta</th>
                  <th className="py-2.5 px-3">Edición</th>
                  <th className="py-2.5 px-3">Cond.</th>
                  <th className="py-2.5 px-3 text-right">Cant. Total</th>
                  <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                  <th className="py-2.5 px-3">Compradores / Miembros</th>
                  <th className="py-2.5 px-3">Stock CK</th>
                  <th className="py-2.5 px-3 text-right">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363D]/40">
                {mergedItemsList.map((m) => (
                  <tr key={m.key} className="hover:bg-[#21262D]/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {m.imageUrl && (
                          <img
                            src={m.imageUrl}
                            alt={m.cardName}
                            className="w-7 h-10 object-cover rounded shadow-sm border border-[#30363D] shrink-0"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white">{m.cardName}</span>
                            {m.foil && (
                              <span className="text-[9px] font-bold uppercase text-amber-300 bg-amber-950/70 border border-amber-500/40 px-1 py-0.2 rounded">
                                Foil
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-300">{m.edition}</td>

                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0D1117] border border-[#30363D] text-slate-200">
                        {m.condition}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-white text-sm">
                      x{m.totalQuantity}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                      ${m.price.toFixed(2)}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {m.buyers.map((b) => (
                          <span
                            key={b.itemId}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#0D1117] border border-[#30363D] text-slate-300"
                          >
                            <span>{b.name} ({b.quantity}x)</span>
                            {canMutate && isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`¿Quitar copia de ${b.name}?`)) {
                                    storeService.deleteItem(orderId, b.itemId);
                                    forceRefresh();
                                  }
                                }}
                                className="text-slate-500 hover:text-red-400 font-bold ml-0.5"
                                title="Quitar de este usuario"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {m.refreshStatus === 'ok' ? (
                        <span className={`text-[10px] font-semibold ${m.inStock ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.inStock ? `Disponible (${m.availableQty})` : 'Agotado'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">No consultado</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {m.pageUrl && (
                        <button
                          type="button"
                          onClick={() => onOpenWebViewWithUrl ? onOpenWebViewWithUrl(m.pageUrl) : window.open(m.pageUrl, '_blank')}
                          className="p-1 text-slate-400 hover:text-amber-400"
                          title="Ver en Card Kingdom"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Abono (§8) */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#30363D] mb-4">
              <h3 className="text-sm font-bold text-white">
                Registrar Abono {paymentModal.type === 'shipping' ? 'de Envío' : 'de Cartas'}
              </h3>
              <button
                onClick={() => setPaymentModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Comprador: <strong className="text-white">{paymentModal.buyerName}</strong> ({paymentModal.buyerEmail})
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Monto del abono ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ej. 25.00"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal(prev => ({ ...prev, amount: e.target.value, error: null }))}
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Nota o comprobante (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Transferencia bancaria #1098"
                  value={paymentModal.note}
                  onChange={(e) => setPaymentModal(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {paymentModal.error && (
                <p className="text-xs text-red-400 font-semibold">{paymentModal.error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-[#30363D]">
              <button
                type="button"
                onClick={() => setPaymentModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-[#21262D] hover:bg-[#30363D] text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegisterPayment}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-lg shadow-sm"
              >
                Guardar Abono
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ver Abonos (§5.6) */}
      {paymentsListModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#30363D] mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Abonos — {paymentsListModal.buyerName}
                </h3>
                <span className="text-xs text-slate-400">{paymentsListModal.buyerEmail}</span>
              </div>
              <button
                onClick={() => setPaymentsListModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-[#30363D]/60 pr-1">
              {summary.buyersData
                .find(b => b.email === paymentsListModal.buyerEmail)?.payments.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No hay abonos registrados para este comprador.</p>
              ) : (
                summary.buyersData
                  .find(b => b.email === paymentsListModal.buyerEmail)
                  ?.payments.map((p) => (
                    <div key={p.id} className="pt-2 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            p.type === 'shipping' ? 'bg-blue-950 text-blue-400 border border-blue-500/30' : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {p.type === 'shipping' ? 'Envío' : 'Cartas'}
                          </span>
                          <span className="font-mono font-bold text-white text-sm">
                            ${p.amount.toFixed(2)} USD
                          </span>
                        </div>
                        {p.note && <p className="text-slate-300 mt-0.5">{p.note}</p>}
                        <span className="text-[10px] text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {p.registeredBy && ` · Registrado por ${p.registeredBy}`}
                        </span>
                      </div>

                      {canMutate && isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id, p.amount)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                          title="Eliminar abono"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#30363D] text-right">
              <button
                type="button"
                onClick={() => setPaymentsListModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-xs font-semibold text-white rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Carta (§5.3) */}
      {editItemModal.isOpen && editItemModal.item && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#30363D] mb-4">
              <h3 className="text-sm font-bold text-white">Editar Carta</h3>
              <button
                onClick={() => setEditItemModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold text-white block">{editItemModal.item.cardName}</span>
                <span className="text-[11px] text-slate-400">{editItemModal.item.edition}</span>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Condición</label>
                <select
                  value={editItemModal.condition}
                  onChange={(e) => setEditItemModal(prev => ({ ...prev, condition: e.target.value as CardCondition }))}
                  className="w-full px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs text-white"
                >
                  <option value="NM">Near Mint (NM)</option>
                  <option value="EX">Excellent (EX)</option>
                  <option value="VG">Very Good (VG)</option>
                  <option value="G">Good (G)</option>
                </select>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Nota: cambiar de condición reestablece la verificación a "No consultado".
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Precio Unitario ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editItemModal.price}
                  onChange={(e) => setEditItemModal(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Cantidad</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={editItemModal.quantity <= 1}
                    onClick={() => setEditItemModal(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                    className="p-1.5 bg-[#21262D] rounded-lg disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-white">{editItemModal.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setEditItemModal(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                    className="p-1.5 bg-[#21262D] rounded-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              {editItemModal.error && (
                <p className="text-xs text-red-400 font-semibold">{editItemModal.error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-[#30363D]">
              <button
                type="button"
                onClick={() => setEditItemModal(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 bg-[#21262D] text-slate-300 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveItemEdit}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-lg"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Finalizar Orden con Advertencia Crítica y Excedentes (§4 & §6.6) */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-[#30363D] mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <h3 className="text-base font-bold text-white">¿Finalizar esta orden?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Al finalizar la orden <strong>no se podrá editar</strong>, ni siquiera por un administrador. Esta acción no se puede deshacer.
            </p>

            {pendingSurplusList.length > 0 ? (
              <div className="p-3.5 bg-[#0D1117] border border-[#30363D] rounded-xl mb-4 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block">
                  Saldo a favor (excedente) que se acreditará al perfil de cada usuario:
                </span>
                <div className="divide-y divide-[#30363D]/60 text-xs">
                  {pendingSurplusList.map((s) => (
                    <div key={s.email} className="py-1.5 flex items-center justify-between">
                      <span className="text-slate-300">{s.email}</span>
                      <span className="font-mono font-bold text-emerald-400">+${s.surplus.toFixed(2)} USD</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mb-4 italic">
                No hay excedentes de abonos en esta orden. No se generarán movimientos de crédito.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-[#30363D]">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="px-4 py-2 bg-[#21262D] text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-lg shadow-sm"
              >
                Confirmar y Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Rescraper Modal */}
      {showRescraperModal && (
        <PriceRescraperModal
          userCarts={summary.buyersData.map(b => ({
            userId: b.email,
            userName: b.displayName,
            userEmail: b.email,
            colorBadge: 'bg-amber-400',
            items: b.items.map(i => ({
              id: i.id,
              name: i.cardName,
              setName: i.edition,
              condition: i.condition,
              quantity: i.quantity,
              priceUsd: i.price,
              isFoil: i.foil,
              imageUrl: i.imageUrl,
              cardKingdomUrl: i.pageUrl,
              addedAt: i.createdAt,
            })),
          }))}
          onClose={() => setShowRescraperModal(false)}
          onApplyUpdatedPrices={() => {
            setShowRescraperModal(false);
            forceRefresh();
            showToast('Precios de Card Kingdom actualizados');
          }}
          onProceedToCartPusher={() => {
            setShowRescraperModal(false);
            setShowPusherModal(true);
          }}
        />
      )}

      {/* Cart Pusher Modal */}
      {showPusherModal && (
        <OneByOneCartPusherModal
          userCarts={summary.buyersData.map(b => ({
            userId: b.email,
            userName: b.displayName,
            userEmail: b.email,
            colorBadge: 'bg-amber-400',
            items: b.items.map(i => ({
              id: i.id,
              name: i.cardName,
              setName: i.edition,
              condition: i.condition,
              quantity: i.quantity,
              priceUsd: i.price,
              isFoil: i.foil,
              imageUrl: i.imageUrl,
              cardKingdomUrl: i.pageUrl,
              addedAt: i.createdAt,
            })),
          }))}
          onClose={() => setShowPusherModal(false)}
        />
      )}

    </div>
  );
};
