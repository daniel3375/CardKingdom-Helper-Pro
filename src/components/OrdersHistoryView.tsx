import React, { useState } from 'react';
import { Plus, Calendar, Clock, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { PurchaseOrder, UserProfile, getOrderUrgency } from '../types/purchases';
import { storeService } from '../services/storeService';
import { OrderDetailScreen } from './OrderDetailScreen';

interface OrdersHistoryViewProps {
  currentUser: UserProfile;
  onOpenWebViewWithUrl?: (url: string) => void;
}

export const OrdersHistoryView: React.FC<OrdersHistoryViewProps> = ({
  currentUser,
  onOpenWebViewWithUrl,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [estimatedDate, setEstimatedDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [, setTick] = useState(0);

  const forceRefresh = () => setTick(t => t + 1);

  const orders = storeService.getAllOrders();

  // Grouped sections in FIXED order (§5.4): Activas / Pendientes / Compradas / Finalizadas
  const activeOrders = orders.filter(o => o.status === 'active');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const purchasedOrders = orders.filter(o => o.status === 'purchased');
  const finalizedOrders = orders.filter(o => o.status === 'finalized');

  const handleCreateOrder = () => {
    storeService.createOrder(estimatedDate ? new Date(estimatedDate).toISOString() : undefined);
    setShowCreateModal(false);
    forceRefresh();
  };

  // If viewing a specific order detail
  if (selectedOrderId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedOrderId(null)}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
        >
          <span>← Volver al Historial de Órdenes</span>
        </button>

        <OrderDetailScreen
          orderId={selectedOrderId}
          currentUser={currentUser}
          onBack={() => setSelectedOrderId(null)}
          onOpenWebViewWithUrl={onOpenWebViewWithUrl}
        />
      </div>
    );
  }

  const renderOrderCard = (order: PurchaseOrder) => {
    const summary = storeService.getOrderSummary(order.id);
    const urgency = getOrderUrgency(order.estimatedPurchaseDate);

    return (
      <button
        key={order.id}
        type="button"
        onClick={() => setSelectedOrderId(order.id)}
        className="w-full text-left p-4 sm:p-5 bg-[#161B22] hover:bg-[#21262D] border border-[#30363D] hover:border-amber-400/40 rounded-2xl transition-all shadow-md flex items-center justify-between gap-4 group"
      >
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm sm:text-base font-bold text-white font-mono">
              Orden {order.id.slice(0, 10).toUpperCase()}
            </span>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
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

            {urgency.urgency !== 'none' && order.status !== 'finalized' && order.status !== 'purchased' && (
              <span
                className={`text-xs font-semibold flex items-center gap-1 ${
                  urgency.urgency === 'upcoming' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{urgency.label}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span>Creada: {new Date(order.createdAt).toLocaleDateString()}</span>
            {order.estimatedPurchaseDate && (
              <>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Compra estimada: {new Date(order.estimatedPurchaseDate).toLocaleDateString()}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <span className="text-sm font-bold font-mono text-white block">
              {summary.totalCards} cartas
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-400">
              ${summary.totalCartasAmount.toFixed(2)} USD
            </span>
          </div>

          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </div>
      </button>
    );
  };

  const renderSection = (title: string, list: PurchaseOrder[], countColor: string) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {title}
          </h3>
          <span className={`text-xs font-bold px-2 py-0.2 rounded-full ${countColor}`}>
            {list.length}
          </span>
        </div>
        <div className="space-y-2.5">
          {list.map(renderOrderCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">Mis Órdenes</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Historial y seguimiento de compras grupales en Card Kingdom
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Crear nueva orden</span>
          </button>
        )}
      </div>

      {/* Sections in fixed order */}
      {orders.length === 0 ? (
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-10 text-center text-slate-500">
          <p className="text-sm font-semibold mb-3">No hay órdenes registradas</p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-xl"
            >
              Crear primera orden
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {renderSection('Activas', activeOrders, 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30')}
          {renderSection('Pendientes', pendingOrders, 'bg-amber-950/60 text-amber-400 border border-amber-500/30')}
          {renderSection('Compradas', purchasedOrders, 'bg-blue-950/60 text-blue-400 border border-blue-500/30')}
          {renderSection('Finalizadas', finalizedOrders, 'bg-slate-800 text-slate-400 border border-slate-700')}
        </div>
      )}

      {/* Admin Order Creation Modal (§4) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-2">Crear Nueva Orden</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              La orden se creará con estado <strong className="text-amber-400">"pendiente"</strong>. Podrás activarla cuando esté lista para recibir cartas.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Fecha estimada de compra
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                  value={estimatedDate}
                  onChange={(e) => setEstimatedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-[#30363D]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-1.5 bg-[#21262D] text-slate-300 text-xs rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateOrder}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-lg shadow-sm"
              >
                Crear Orden
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
