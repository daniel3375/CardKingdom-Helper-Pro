import React, { useState } from 'react';
import { Users, UserPlus, Trash2, Play, RefreshCw, ShieldCheck, User, Plus, Minus, AlertCircle, Check, MoreVertical, Search, X } from 'lucide-react';
import { UserCart, CurrentUserSession, RescrapeResultItem, CartItem } from '../types/card';
import { PriceRescraperModal } from './PriceRescraperModal';
import { OneByOneCartPusherModal } from './OneByOneCartPusherModal';

interface ConsolidatedItem {
  key: string;
  name: string;
  setName: string;
  condition: string;
  quantity: number;
  priceUsd: number;
  isFoil: boolean;
  userEntries: Array<{ userId: string; userName: string; itemId: string; quantity: number }>;
}

interface ActiveOrderManagerProps {
  userCarts: UserCart[];
  currentSession: CurrentUserSession;
  onRemoveItem: (userId: string, itemId: string) => void;
  onUpdateItemQuantity: (userId: string, itemId: string, newQty: number) => void;
  onRemoveConsolidatedCard: (name: string, condition: string, isFoil: boolean, targetUserId?: string) => void;
  onRemoveUser: (userId: string) => void;
  onAddUser: (userName: string) => void;
  onClearOrder: () => void;
  onApplyUpdatedPrices: (results: RescrapeResultItem[]) => void;
}

export const ActiveOrderManager: React.FC<ActiveOrderManagerProps> = ({
  userCarts,
  currentSession,
  onRemoveItem,
  onUpdateItemQuantity,
  onRemoveConsolidatedCard,
  onRemoveUser,
  onAddUser,
  onApplyUpdatedPrices,
}) => {
  const [selectedUserTab, setSelectedUserTab] = useState<string>('all');
  const [newUserName, setNewUserName] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRescraperModal, setShowRescraperModal] = useState(false);
  const [showPusherModal, setShowPusherModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active dropdown state for consolidated card deletion menu
  const [activeDeleteMenuKey, setActiveDeleteMenuKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Build structured consolidated items with exact user links
  const consolidatedItems = React.useMemo<ConsolidatedItem[]>(() => {
    const map = new Map<string, ConsolidatedItem>();

    userCarts.forEach(user => {
      user.items.forEach(item => {
        const key = `${item.name.toLowerCase()}_${item.setName.toLowerCase()}_${item.condition}_${item.isFoil ? 'foil' : 'reg'}`;
        if (map.has(key)) {
          const existing = map.get(key)!;
          existing.quantity += item.quantity;
          existing.userEntries.push({
            userId: user.userId,
            userName: user.userName,
            itemId: item.id,
            quantity: item.quantity,
          });
        } else {
          map.set(key, {
            key,
            name: item.name,
            setName: item.setName,
            condition: item.condition,
            quantity: item.quantity,
            priceUsd: item.priceUsd,
            isFoil: item.isFoil,
            userEntries: [{
              userId: user.userId,
              userName: user.userName,
              itemId: item.id,
              quantity: item.quantity,
            }]
          });
        }
      });
    });

    return Array.from(map.values());
  }, [userCarts]);

  // Filter consolidated items by search query (card name, set name, user name)
  const filteredConsolidatedItems = React.useMemo(() => {
    if (!searchQuery.trim()) return consolidatedItems;
    const q = searchQuery.toLowerCase().trim();
    return consolidatedItems.filter(item => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchSet = item.setName.toLowerCase().includes(q);
      const matchCondition = item.condition.toLowerCase().includes(q);
      const matchUsers = item.userEntries.some(ue => ue.userName.toLowerCase().includes(q));
      return matchName || matchSet || matchCondition || matchUsers;
    });
  }, [consolidatedItems, searchQuery]);

  // Grand total
  const grandTotalUsd = userCarts.reduce((acc, u) => {
    return acc + u.items.reduce((sum, item) => sum + (item.priceUsd * item.quantity), 0);
  }, 0);

  const totalCardsCount = userCarts.reduce((acc, u) => {
    return acc + u.items.reduce((sum, item) => sum + item.quantity, 0);
  }, 0);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    onAddUser(newUserName.trim());
    setNewUserName('');
    setShowAddUserModal(false);
    showFeedback(`Miembro "${newUserName.trim()}" agregado.`);
  };

  const handleAdminDeleteFromSingleUser = (userId: string, itemId: string, cardName: string, userName: string) => {
    onRemoveItem(userId, itemId);
    setActiveDeleteMenuKey(null);
    showFeedback(`Carta "${cardName}" eliminada del carrito de ${userName}.`);
  };

  const handleAdminDeleteFromAll = (item: ConsolidatedItem) => {
    onRemoveConsolidatedCard(item.name, item.condition, item.isFoil);
    setActiveDeleteMenuKey(null);
    showFeedback(`"${item.name}" eliminada de TODOS los carritos de la orden.`);
  };

  const myCart = userCarts.find(u => u.userId === currentSession.uid) || userCarts[1] || userCarts[0];
  const mySubtotal = myCart ? myCart.items.reduce((sum, i) => sum + (i.priceUsd * i.quantity), 0) : 0;

  return (
    <div className="space-y-6">
      
      {/* Toast Notification for Admin Actions */}
      {actionNotice && (
        <div className="fixed top-20 right-6 z-50 bg-[#161B22] border border-emerald-500/60 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Role Banner / Context */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full mb-2 border bg-amber-950/60 border-amber-500/40 text-amber-300">
            {currentSession.role === 'admin' ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="tracking-wide">ADMINISTRADOR MANABROS · CONTROL TOTAL</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="tracking-wide">MIEMBRO MANABROS: {currentSession.name}</span>
              </>
            )}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {currentSession.role === 'admin'
              ? 'Gestión de Orden Grupal Activa'
              : 'Mi Carrito en la Orden Activa'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            {currentSession.role === 'admin'
              ? 'Como administrador tienes control para eliminar o ajustar cualquier carta de cualquier carrito (individual o consolidado), re-escanear precios y lanzar el pedido a Card Kingdom.'
              : 'Revisa tus cartas seleccionadas. Al momento del cierre, el administrador verificará precios y lanzará el pedido en Card Kingdom.'}
          </p>
        </div>

        {/* Admin Pre-purchase Actions */}
        {currentSession.role === 'admin' ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowRescraperModal(true)}
              disabled={totalCardsCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#21262D] hover:bg-[#30363D] disabled:opacity-50 text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/30 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Actualizar Precios & Stock</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPusherModal(true)}
              disabled={totalCardsCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 disabled:opacity-50 text-[#0D1117] text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>2. Lanzar Cartas 1 a 1</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 text-right">
            <span className="text-[11px] text-slate-400 block">Tu total a abonar</span>
            <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
              ${mySubtotal.toFixed(2)} USD
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards Strip */}
      {currentSession.role === 'admin' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 shadow-sm">
            <span className="text-xs text-slate-400 block mb-1">Total Consolidado de la Orden</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              ${grandTotalUsd.toFixed(2)} USD
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Suma de {userCarts.length} miembros participando
            </span>
          </div>

          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 shadow-sm">
            <span className="text-xs text-slate-400 block mb-1">Volumen de Cartas</span>
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {totalCardsCount} <span className="text-xs text-slate-400 font-normal">copias</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {consolidatedItems.length} líneas de cartas únicas
            </span>
          </div>

          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 shadow-sm">
            <span className="text-xs text-slate-400 block mb-1">Miembros en la Orden</span>
            <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {userCarts.length}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Carritos independientes listos para consolidar
            </span>
          </div>
        </div>
      ) : null}

      {/* Admin Tab Navigator between All vs Specific Users */}
      {currentSession.role === 'admin' && (
        <div className="flex items-center justify-between gap-3 border-b border-[#30363D] pb-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedUserTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedUserTab === 'all'
                  ? 'bg-amber-400 text-[#0D1117] shadow-sm'
                  : 'bg-[#161B22] text-slate-400 hover:text-white border border-[#30363D]'
              }`}
            >
              Vista Consolidada (Master)
            </button>

            {userCarts.map(user => {
              const userSubtotal = user.items.reduce((sum, i) => sum + (i.priceUsd * i.quantity), 0);
              return (
                <button
                  key={user.userId}
                  type="button"
                  onClick={() => setSelectedUserTab(user.userId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                    selectedUserTab === user.userId
                      ? 'bg-[#21262D] text-white border border-amber-400/60 font-semibold'
                      : 'bg-[#161B22] text-slate-400 hover:text-white border border-[#30363D]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${user.colorBadge}`}></span>
                  <span>{user.userName}</span>
                  <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
                    (${userSubtotal.toFixed(2)})
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowAddUserModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-slate-200 text-xs font-semibold rounded-lg border border-[#30363D] shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Miembro</span>
          </button>
        </div>
      )}

      {/* View 1: Customer Mode (Own cart only) */}
      {currentSession.role === 'customer' ? (
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-[#30363D] bg-[#0D1117]/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${myCart.colorBadge}`}></span>
                <span>Tus cartas agregadas ({myCart.items.length} ítems)</span>
              </h3>
              <span className="text-xs text-slate-400">
                Sesión de Google: <strong className="text-slate-300">{myCart.userEmail || currentSession.email}</strong>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Subtotal estimado:</span>
              <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                ${mySubtotal.toFixed(2)} USD
              </span>
            </div>
          </div>

          {myCart.items.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              Aún no has agregado cartas a tu carrito. Ve a la pestaña <strong>Navegador & Captura</strong> para explorar Card Kingdom y agregarlas en un clic.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#30363D] bg-[#0D1117] text-slate-400 font-medium">
                    <th className="py-2.5 px-3 min-w-[200px]">Carta</th>
                    <th className="py-2.5 px-3 w-16 text-center">Cant.</th>
                    <th className="py-2.5 px-3 w-20 text-center">Estado</th>
                    <th className="py-2.5 px-3 w-16 text-center">Foil</th>
                    <th className="py-2.5 px-3 w-24 text-right">Precio</th>
                    <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D]/60 font-mono">
                  {myCart.items.map(item => (
                    <tr key={item.id} className="hover:bg-[#21262D]/50 transition-colors">
                      <td className="py-2 px-3 font-sans">
                        <span className="font-semibold text-slate-200">{item.name}</span>
                        <span className="text-[11px] text-slate-400 block">{item.setName}</span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-amber-400 tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-300">
                        {item.condition}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">
                        {item.isFoil ? 'Foil' : 'Reg'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                        ${item.priceUsd.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-400 tabular-nums">
                        ${(item.priceUsd * item.quantity).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveItem(myCart.userId, item.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Remover de mi carrito"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* View 2: Admin View - Master Consolidated Table */
        selectedUserTab === 'all' ? (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-lg">
            <div className="p-3.5 border-b border-[#30363D] bg-[#0D1117] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-300">
                  Listado Consolidado para Enviar a Card Kingdom
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
                  {filteredConsolidatedItems.length} líneas ({filteredConsolidatedItems.reduce((acc, i) => acc + i.quantity, 0)} copias)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar carta, set o miembro..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#161B22] border border-[#30363D] rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-56 sm:w-64"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredConsolidatedItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                {searchQuery
                  ? `No se encontraron cartas que coincidan con "${searchQuery}".`
                  : 'No hay cartas en los carritos de la orden activa.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#30363D] bg-[#0D1117] text-slate-400 font-medium">
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Carta / Edición</th>
                      <th className="py-2.5 px-3 w-20 text-center">Cant.</th>
                      <th className="py-2.5 px-3 w-24 text-center">Estado</th>
                      <th className="py-2.5 px-3 w-20 text-center">Foil</th>
                      <th className="py-2.5 px-3 w-24 text-right">Precio Guardado</th>
                      <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Miembros (Clic ✕ para quitar)</th>
                      <th className="py-2.5 px-3 w-36 text-center text-amber-300 font-semibold">Acciones Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363D]/60 font-mono">
                    {filteredConsolidatedItems.map((item, idx) => {
                      const hasMultipleUsers = item.userEntries.length > 1;
                      const isMenuOpen = activeDeleteMenuKey === item.key;

                      return (
                        <tr key={idx} className="hover:bg-[#21262D]/50 transition-colors relative">
                          <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-sans">
                            <div className="font-semibold text-slate-200">{item.name}</div>
                            <div className="text-[11px] text-slate-400">{item.setName}</div>
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-amber-400 tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-xs font-bold text-slate-300">
                              {item.condition}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.isFoil ? 'bg-amber-400 text-[#0D1117]' : 'text-slate-500'}`}>
                              {item.isFoil ? 'FOIL' : 'REG'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                            ${item.priceUsd.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-400 tabular-nums">
                            ${(item.priceUsd * item.quantity).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <div className="flex flex-wrap gap-1.5">
                              {item.userEntries.map(ue => (
                                <span
                                  key={ue.userId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#21262D] hover:bg-[#2d333b] text-slate-300 text-[11px] border border-[#30363D] transition-colors"
                                >
                                  <span>{ue.userName}</span>
                                  <span className="font-mono text-amber-400 font-bold">({ue.quantity})</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAdminDeleteFromSingleUser(ue.userId, ue.itemId, item.name, ue.userName)}
                                    className="text-slate-400 hover:text-rose-400 p-0.5 rounded hover:bg-rose-950/60 transition-colors ml-0.5"
                                    title={`Eliminar del carrito de ${ue.userName}`}
                                  >
                                    <X className="w-3 h-3 text-rose-400" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Admin Direct Delete Action Column */}
                          <td className="py-2 px-3 text-center font-sans relative">
                            <div className="flex items-center justify-center gap-1.5">
                              {hasMultipleUsers ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAdminDeleteFromAll(item)}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded border border-rose-800/60 text-xs font-semibold transition-all"
                                    title="Eliminar de TODOS los miembros"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-400" />
                                    <span>Todos</span>
                                  </button>

                                  <div className="relative inline-block text-left">
                                    <button
                                      type="button"
                                      onClick={() => setActiveDeleteMenuKey(isMenuOpen ? null : item.key)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#21262D] hover:bg-[#30363D] text-slate-300 rounded border border-[#30363D] text-xs font-semibold transition-all"
                                      title="Opciones individuales por miembro"
                                    >
                                      <span>Por Miembro...</span>
                                    </button>

                                    {/* Popover Menu for Multi-user Card Removal */}
                                    {isMenuOpen && (
                                      <div className="absolute right-0 mt-1 w-64 rounded-xl bg-[#161B22] border border-[#30363D] shadow-2xl z-50 p-2 space-y-1 text-left animate-in fade-in zoom-in-95 duration-100">
                                        <div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1 border-b border-[#30363D]">
                                          Eliminar del carrito de:
                                        </div>
                                        {item.userEntries.map(ue => (
                                          <button
                                            key={ue.userId}
                                            type="button"
                                            onClick={() => handleAdminDeleteFromSingleUser(ue.userId, ue.itemId, item.name, ue.userName)}
                                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-rose-950/40 hover:border-rose-800 border border-transparent transition-all flex items-center justify-between"
                                          >
                                            <span>Carrito de <strong>{ue.userName}</strong> ({ue.quantity}x)</span>
                                            <Trash2 className="w-3 h-3 text-rose-400" />
                                          </button>
                                        ))}
                                        <div className="border-t border-[#30363D] pt-1">
                                          <button
                                            type="button"
                                            onClick={() => handleAdminDeleteFromAll(item)}
                                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-900/40 transition-colors flex items-center justify-between"
                                          >
                                            <span>Eliminar de TODOS ({item.quantity} copias)</span>
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                /* Only 1 user owns this card -> single-click trash */
                                <button
                                  type="button"
                                  onClick={() => {
                                    const entry = item.userEntries[0];
                                    handleAdminDeleteFromSingleUser(entry.userId, entry.itemId, item.name, entry.userName);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 rounded border border-rose-800/50 text-xs font-semibold transition-all"
                                  title={`Eliminar del carrito de ${item.userEntries[0]?.userName}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Quitar ({item.userEntries[0]?.userName})</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* View 3: Admin View - Specific User Tab with Full Admin Editing */
          (() => {
            const activeUser = userCarts.find(u => u.userId === selectedUserTab);
            if (!activeUser) return null;
            const userSubtotal = activeUser.items.reduce((sum, i) => sum + (i.priceUsd * i.quantity), 0);

            return (
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 border-b border-[#30363D] bg-[#0D1117] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${activeUser.colorBadge}`}></span>
                      <span>Carrito de: {activeUser.userName}</span>
                      <span className="text-[11px] font-normal text-slate-400">({activeUser.userEmail})</span>
                    </h3>
                    <span className="text-xs text-slate-400">
                      {activeUser.items.length} cartas distintas agregadas en este carrito
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Subtotal:</span>
                      <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                        ${userSubtotal.toFixed(2)} USD
                      </span>
                    </div>

                    {activeUser.items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Vaciar todas las cartas del carrito de ${activeUser.userName}?`)) {
                            activeUser.items.forEach(i => onRemoveItem(activeUser.userId, i.id));
                            showFeedback(`Carrito de ${activeUser.userName} vaciado.`);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-[#21262D] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-[#30363D] hover:border-rose-500/40 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                        title="Eliminar todas las cartas de este carrito"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Vaciar Carrito</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Seguro que deseas eliminar a ${activeUser.userName} y su carrito de la orden activa?`)) {
                          onRemoveUser(activeUser.userId);
                          setSelectedUserTab('all');
                          showFeedback(`Miembro "${activeUser.userName}" eliminado de la orden.`);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-[#21262D] hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-[#30363D] hover:border-rose-500/50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      title="Eliminar usuario de la orden"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Quitar Miembro</span>
                    </button>
                  </div>
                </div>

                {activeUser.items.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    Este miembro aún no tiene cartas en su carrito local.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#30363D] bg-[#0D1117] text-slate-400 font-medium">
                          <th className="py-2.5 px-3 min-w-[200px]">Carta</th>
                          <th className="py-2.5 px-3 w-28 text-center text-amber-300">Cantidad (Admin)</th>
                          <th className="py-2.5 px-3 w-20 text-center">Estado</th>
                          <th className="py-2.5 px-3 w-16 text-center">Foil</th>
                          <th className="py-2.5 px-3 w-24 text-right">Precio</th>
                          <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                          <th className="py-2.5 px-3 w-24 text-center text-amber-300">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#30363D]/60 font-mono">
                        {activeUser.items.map(item => (
                          <tr key={item.id} className="hover:bg-[#21262D]/50 transition-colors">
                            <td className="py-2 px-3 font-sans">
                              <span className="font-semibold text-slate-200">{item.name}</span>
                              <span className="text-[11px] text-slate-400 block">{item.setName}</span>
                            </td>

                            {/* Quantity Stepper so Admin can modify quantity directly */}
                            <td className="py-2 px-3 text-center">
                              <div className="inline-flex items-center border border-[#30363D] rounded bg-[#0D1117]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.quantity > 1) {
                                      onUpdateItemQuantity(activeUser.userId, item.id, item.quantity - 1);
                                      showFeedback(`Cantidad reducida a ${item.quantity - 1}x`);
                                    } else {
                                      onRemoveItem(activeUser.userId, item.id);
                                      showFeedback(`"${item.name}" eliminada.`);
                                    }
                                  }}
                                  className="p-1 hover:text-white text-slate-400 transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center font-mono font-bold text-amber-400 text-xs tabular-nums">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateItemQuantity(activeUser.userId, item.id, item.quantity + 1);
                                    showFeedback(`Cantidad aumentada a ${item.quantity + 1}x`);
                                  }}
                                  className="p-1 hover:text-white text-slate-400 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            <td className="py-2 px-3 text-center font-bold text-slate-300">
                              {item.condition}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-400">
                              {item.isFoil ? 'Foil' : 'Reg'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                              ${item.priceUsd.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-400 tabular-nums">
                              ${(item.priceUsd * item.quantity).toFixed(2)}
                            </td>

                            {/* Delete single card from this user */}
                            <td className="py-2 px-3 text-center font-sans">
                              <button
                                type="button"
                                onClick={() => {
                                  onRemoveItem(activeUser.userId, item.id);
                                  showFeedback(`"${item.name}" eliminada del carrito de ${activeUser.userName}.`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-[#21262D] hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 rounded border border-[#30363D] hover:border-rose-500/50 text-xs font-semibold transition-all"
                                title="Eliminar esta carta"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                <span>Eliminar</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()
        )
      )}

      {/* Modal: Add User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1117]/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Agregar Miembro a la Orden</h3>
            <p className="text-xs text-slate-400 mb-4">
              Cada usuario maneja su propio carrito y cuenta de Google en la app.
            </p>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre del Miembro / Comprador:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: David R."
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-[#0D1117] font-bold text-xs rounded-lg transition-colors"
                >
                  Crear Miembro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Price Rescraper */}
      {showRescraperModal && (
        <PriceRescraperModal
          userCarts={userCarts}
          onClose={() => setShowRescraperModal(false)}
          onApplyUpdatedPrices={(results) => {
            onApplyUpdatedPrices(results);
          }}
          onProceedToCartPusher={() => {
            setShowRescraperModal(false);
            setShowPusherModal(true);
          }}
        />
      )}

      {/* Modal: One-by-One Cart Pusher */}
      {showPusherModal && (
        <OneByOneCartPusherModal
          userCarts={userCarts}
          onClose={() => setShowPusherModal(false)}
        />
      )}

    </div>
  );
};
