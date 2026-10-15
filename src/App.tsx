import React, { useState, useEffect, useMemo } from 'react';
import { Header, TabType } from './components/Header';
import { ManabrosHero } from './components/ManabrosHero';
import { WebViewSimulator } from './components/WebViewSimulator';
import { OrderDetailScreen } from './components/OrderDetailScreen';
import { OrdersHistoryView } from './components/OrdersHistoryView';
import { UsersManagerModal } from './components/UsersManagerModal';
import { SettingsModal } from './components/SettingsModal';
import { FlutterCodeHub } from './components/FlutterCodeHub';
import { DeckInput } from './components/DeckInput';
import { CardListTable } from './components/CardListTable';
import { ExportPanel } from './components/ExportPanel';
import { CardModal } from './components/CardModal';
import { PriceRescraperModal } from './components/PriceRescraperModal';
import { OneByOneCartPusherModal } from './components/OneByOneCartPusherModal';
import { CardCondition, ParsedCardItem } from './types/card';
import { UserProfile, PurchaseOrder } from './types/purchases';
import { parseDecklist, SAMPLE_DECKLISTS } from './utils/parser';
import { resolveCardsWithScryfall } from './services/scryfall';
import { storeService } from './services/storeService';
import { AlertCircle, Plus, Check } from 'lucide-react';

export default function App() {
  const [, setTick] = useState(0);

  // Subscribe to storeService updates
  useEffect(() => {
    return storeService.subscribe(() => {
      setTick(t => t + 1);
    });
  }, []);

  const currentUser: UserProfile = storeService.getCurrentUser();
  const allUsers: UserProfile[] = storeService.getAllUsers();
  const appSettings = storeService.getSettings();
  const activeOrders = storeService.getActiveOrders();
  const orders = storeService.getAllOrders();

  // Active Tab state
  const [activeTab, setActiveTab] = useState<TabType>('active_order');

  // Selected active order (in case of multiple active orders §4)
  const [selectedActiveOrderId, setSelectedActiveOrderId] = useState<string>(() => {
    return activeOrders[0]?.id || orders[0]?.id || '';
  });

  const activeOrder = orders.find(o => o.id === selectedActiveOrderId) || activeOrders[0] || orders[0];

  // Modals state
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRescraperModal, setShowRescraperModal] = useState(false);
  const [showPusherModal, setShowPusherModal] = useState(false);
  const [previewCard, setPreviewCard] = useState<ParsedCardItem | null>(null);

  // WebView initial URL
  const [webViewUrl, setWebViewUrl] = useState<string | undefined>(undefined);

  // Mass Decklist Input state
  const [rawText, setRawText] = useState<string>(SAMPLE_DECKLISTS.commanderStaples);
  const [cards, setCards] = useState<ParsedCardItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [massAddFeedback, setMassAddFeedback] = useState<string | null>(null);

  // Summary for Hero banner
  const activeOrderSummary = activeOrder ? storeService.getOrderSummary(activeOrder.id) : null;
  const totalCardsInOrder = activeOrderSummary?.totalCards || 0;
  const totalOrderUsd = activeOrderSummary?.totalCartasAmount || 0;

  const unconfirmedUsersCount = allUsers.filter(u => u.status === 'unconfirmed').length;

  const handleOpenWebViewWithUrl = (url: string) => {
    setWebViewUrl(url);
    setActiveTab('webview');
  };

  const handleAddToCartFromWebView = (itemData: any) => {
    if (!activeOrder) return;
    storeService.upsertItem(activeOrder.id, itemData);
  };

  const handleParseAndResolve = async () => {
    const parsed = parseDecklist(rawText);
    if (parsed.length === 0) return;

    setIsLoading(true);
    setCards(parsed);

    try {
      const resolved = await resolveCardsWithScryfall(parsed);
      setCards(resolved);
    } catch (err) {
      console.error('Error resolving cards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAllResolvedToActiveOrder = () => {
    if (!activeOrder) {
      alert('No hay una orden activa seleccionada para agregar cartas');
      return;
    }
    if (cards.length === 0) return;

    let count = 0;
    cards.forEach(card => {
      storeService.upsertItem(activeOrder.id, {
        buyerEmail: currentUser.email,
        buyerName: currentUser.displayName,
        cardName: card.name,
        edition: card.setDisplayName || card.setCode || 'Standard Edition',
        cardType: card.typeLine || 'Magic Card',
        imageUrl: card.imageUrl || '',
        pageUrl: `https://www.cardkingdom.com/catalog/search?filter%5Bname%5D=${encodeURIComponent(card.name)}`,
        productId: '999123',
        foil: card.isFoil,
        condition: card.preferredCondition || 'NM',
        price: card.estimatedPriceUsd || 1.99,
        quantity: card.quantity,
        inStock: true,
        availableQty: 10,
      });
      count += card.quantity;
    });

    setMassAddFeedback(`¡${count} copias agregadas a la orden activa!`);
    setTimeout(() => setMassAddFeedback(null), 3000);
  };

  const handleUpdateCard = (id: string, updates: Partial<ParsedCardItem>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleRemoveCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const handleSetAllConditions = (cond: CardCondition) => {
    setCards(prev => prev.map(c => ({ ...c, preferredCondition: cond })));
  };

  const handleToggleAllFoils = () => {
    setCards(prev => {
      const allFoil = prev.every(c => c.isFoil);
      return prev.map(c => ({ ...c, isFoil: !allFoil }));
    });
  };

  const liveStats = useMemo(() => {
    const parsed = parseDecklist(rawText);
    return {
      unique: parsed.length,
      total: parsed.reduce((acc, c) => acc + c.quantity, 0),
    };
  }, [rawText]);

  return (
    <div className="min-h-full flex flex-col bg-[#0D1117] text-[#F0F6FC] font-sans">
      
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalCardsInOrder={totalCardsInOrder}
        currentUser={currentUser}
        appSettings={appSettings}
        unconfirmedUsersCount={unconfirmedUsersCount}
        onOpenUsersManager={() => setShowUsersModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Unconfirmed user gate banner (§3.2) */}
        {currentUser.status === 'unconfirmed' && (
          <div className="mb-6 p-4 bg-amber-950/40 border border-amber-500/50 rounded-2xl flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <strong className="text-amber-300 block font-bold">Cuenta en espera de confirmación</strong>
                <span className="text-slate-300">
                  Debe esperar confirmación de un admin para comprar o agregar cartas a pedidos grupales.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-amber-300 font-semibold rounded-lg shrink-0 border border-amber-500/30"
            >
              Cambiar cuenta
            </button>
          </div>
        )}

        {/* Manabr✧s Fantasy Hero Banner matching manabros-store.web.app */}
        <ManabrosHero
          currentUser={currentUser}
          totalCardsInOrder={totalCardsInOrder}
          totalOrderUsd={totalOrderUsd}
          onOpenRescraper={() => setShowRescraperModal(true)}
          onOpenPusher={() => setShowPusherModal(true)}
        />

        {/* Order Selector (if multiple active orders §4) */}
        {activeOrders.length > 1 && (
          <div className="mb-6 p-3.5 bg-[#161B22] border border-[#30363D] rounded-xl flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium">Hay {activeOrders.length} órdenes activas disponibles:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Orden activa seleccionada:</span>
              <select
                value={selectedActiveOrderId}
                onChange={(e) => setSelectedActiveOrderId(e.target.value)}
                className="px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg text-xs text-white font-mono"
              >
                {activeOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    Orden {o.id.slice(0, 10).toUpperCase()} ({storeService.getItemsByOrder(o.id).length} cartas)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* TAB 1: Orden Activa / Detalle de Orden */}
        {activeTab === 'active_order' && (
          <div>
            {activeOrder ? (
              <OrderDetailScreen
                orderId={activeOrder.id}
                currentUser={currentUser}
                onOpenWebViewWithUrl={handleOpenWebViewWithUrl}
              />
            ) : (
              <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-12 text-center text-slate-400 space-y-4">
                <AlertCircle className="w-12 h-12 text-amber-400 mx-auto opacity-70" />
                <h3 className="text-lg font-bold text-white">No hay una orden activa</h3>
                <p className="text-xs max-w-md mx-auto leading-relaxed">
                  Espera a que un administrador active una orden desde el historial para poder agregar cartas al pedido grupal.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders_history')}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-xl transition-colors"
                >
                  Ver Historial de Órdenes
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WebView & Card Kingdom Scraper */}
        {activeTab === 'webview' && (
          <WebViewSimulator
            currentUser={currentUser}
            activeOrder={activeOrder}
            allUsers={allUsers}
            initialUrl={webViewUrl}
            onAddToCart={handleAddToCartFromWebView}
          />
        )}

        {/* TAB 3: Mass Decklist Input & Reference Pricing */}
        {activeTab === 'mass_entry' && (
          <div className="space-y-6">
            <DeckInput
              rawText={rawText}
              setRawText={setRawText}
              onParseAndResolve={handleParseAndResolve}
              isLoading={isLoading}
              totalCardsParsed={liveStats.total}
              uniqueCardsParsed={liveStats.unique}
            />

            {cards.length > 0 && (
              <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-bold text-white block">
                    {cards.length} cartas resueltas listas para ordenar
                  </span>
                  <span className="text-xs text-slate-400">
                    Se agregarán a la orden activa con tu usuario ({currentUser.displayName}).
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {massAddFeedback && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-4 h-4" />
                      <span>{massAddFeedback}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!activeOrder || currentUser.status === 'unconfirmed'}
                    onClick={handleAddAllResolvedToActiveOrder}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Todas a la Orden Activa</span>
                  </button>
                </div>
              </div>
            )}

            <CardListTable
              cards={cards}
              onUpdateCard={handleUpdateCard}
              onRemoveCard={handleRemoveCard}
              onSetAllConditions={handleSetAllConditions}
              onToggleAllFoils={handleToggleAllFoils}
              onClearAll={() => { setCards([]); setRawText(''); }}
              onSelectCardForPreview={(card) => setPreviewCard(card)}
            />

            {cards.length > 0 && <ExportPanel cards={cards} />}
          </div>
        )}

        {/* TAB 4: Mis Órdenes / Historial (§5.4) */}
        {activeTab === 'orders_history' && (
          <OrdersHistoryView
            currentUser={currentUser}
            onOpenWebViewWithUrl={handleOpenWebViewWithUrl}
          />
        )}

        {/* TAB 5: Flutter (Dart) Architecture & Code Hub */}
        {activeTab === 'flutter_code' && (
          <FlutterCodeHub />
        )}

      </main>

      {/* Card detail modal preview */}
      <CardModal
        card={previewCard}
        onClose={() => setPreviewCard(null)}
      />

      {/* Admin Users Manager Modal (§5.7) */}
      <UsersManagerModal
        isOpen={showUsersModal}
        onClose={() => setShowUsersModal(false)}
        currentUser={currentUser}
      />

      {/* Settings Modal (§5.9) */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentUser={currentUser}
        onSwitchSession={(uid) => {
          storeService.setCurrentUser(uid);
          setTick(t => t + 1);
        }}
      />

      {/* Price Rescraper Modal */}
      {showRescraperModal && activeOrder && (
        <PriceRescraperModal
          userCarts={activeOrderSummary?.buyersData.map(b => ({
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
          })) || []}
          onClose={() => setShowRescraperModal(false)}
          onApplyUpdatedPrices={() => {
            setShowRescraperModal(false);
            setTick(t => t + 1);
          }}
          onProceedToCartPusher={() => {
            setShowRescraperModal(false);
            setShowPusherModal(true);
          }}
        />
      )}

      {/* Cart Pusher Modal */}
      {showPusherModal && activeOrder && (
        <OneByOneCartPusherModal
          userCarts={activeOrderSummary?.buyersData.map(b => ({
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
          })) || []}
          onClose={() => setShowPusherModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-[#30363D] bg-[#0D1117] py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/src/assets/favicon.png" alt="Manabros" className="w-4 h-4 object-contain" />
            <p>Manabr✧s Store · PurchasesManabros Engine (Card Kingdom)</p>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="https://manabros-store.web.app" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">
              manabros-store.web.app
            </a>
            <span aria-hidden="true">·</span>
            <span>Despierta tu chispa</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
