import React, { useState } from 'react';
import { Globe, Search, Plus, ShoppingCart, Loader2, Check, ExternalLink, AlertCircle, User, ShieldCheck } from 'lucide-react';
import { ScrapedCKCard, CardCondition } from '../types/card';
import { UserProfile, PurchaseOrder, OrderItem } from '../types/purchases';

interface WebViewSimulatorProps {
  currentUser: UserProfile;
  activeOrder?: PurchaseOrder;
  allUsers: UserProfile[];
  initialUrl?: string;
  onAddToCart: (itemData: Omit<OrderItem, 'id' | 'orderId' | 'createdAt' | 'lastCheckedAt' | 'refreshStatus'>) => void;
}

const PRESET_URLS = [
  {
    name: 'Force of Will (Eternal Masters)',
    url: 'https://www.cardkingdom.com/mtg/eternal-masters/force-of-will',
    title: 'Force of Will',
    setName: 'Eternal Masters',
    cardType: 'Instant',
    productId: '206412',
    imageUrl: 'https://cards.scryfall.io/normal/front/e/f/ef86e270-023a-4949-8c01-7257e84128d5.jpg',
    variations: [
      { condition: 'NM' as CardCondition, price: 69.99, stock: 5, isFoil: false },
      { condition: 'EX' as CardCondition, price: 62.99, stock: 3, isFoil: false },
      { condition: 'VG' as CardCondition, price: 54.99, stock: 1, isFoil: false },
      { condition: 'NM' as CardCondition, price: 189.99, stock: 2, isFoil: true },
    ]
  },
  {
    name: 'Sol Ring (Commander 2021)',
    url: 'https://www.cardkingdom.com/mtg/commander-2021/sol-ring',
    title: 'Sol Ring',
    setName: 'Commander 2021',
    cardType: 'Artifact',
    productId: '245012',
    imageUrl: 'https://cards.scryfall.io/normal/front/4/c/4cbc6901-6a4a-4d0a-83ea-7eefa3b35021.jpg',
    variations: [
      { condition: 'NM' as CardCondition, price: 1.99, stock: 24, isFoil: false },
      { condition: 'EX' as CardCondition, price: 1.69, stock: 12, isFoil: false },
      { condition: 'VG' as CardCondition, price: 1.39, stock: 4, isFoil: false },
    ]
  },
  {
    name: 'Cyclonic Rift (Commander 2014)',
    url: 'https://www.cardkingdom.com/mtg/commander-2014/cyclonic-rift',
    title: 'Cyclonic Rift',
    setName: 'Commander 2014',
    cardType: 'Instant',
    productId: '204112',
    imageUrl: 'https://cards.scryfall.io/normal/front/f/f/ff08e5ed-f47b-4d8e-8b8b-41675dccef8b.jpg',
    variations: [
      { condition: 'NM' as CardCondition, price: 34.99, stock: 8, isFoil: false },
      { condition: 'EX' as CardCondition, price: 29.99, stock: 5, isFoil: false },
      { condition: 'NM' as CardCondition, price: 79.99, stock: 1, isFoil: true },
    ]
  },
  {
    name: 'Ragavan, Nimble Pilferer (MH2)',
    url: 'https://www.cardkingdom.com/mtg/modern-horizons-2/ragavan-nimble-pilferer',
    title: 'Ragavan, Nimble Pilferer',
    setName: 'Modern Horizons 2',
    cardType: 'Legendary Creature — Monkey Pirate',
    productId: '246810',
    imageUrl: 'https://cards.scryfall.io/normal/front/a/1/a13c1332-7a11-4e3d-8c3b-012ab6490708.jpg',
    variations: [
      { condition: 'NM' as CardCondition, price: 39.99, stock: 3, isFoil: false },
      { condition: 'EX' as CardCondition, price: 35.99, stock: 2, isFoil: false },
    ]
  }
];

export const WebViewSimulator: React.FC<WebViewSimulatorProps> = ({
  currentUser,
  activeOrder,
  allUsers,
  initialUrl,
  onAddToCart,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isUnconfirmed = currentUser.status === 'unconfirmed';

  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl || PRESET_URLS[0].url);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [scrapedCard, setScrapedCard] = useState<typeof PRESET_URLS[0]>(PRESET_URLS[0]);

  // Destination user (admin only §5.2)
  const [targetEmail, setTargetEmail] = useState<string>(currentUser.email);
  const [selectedCondition, setSelectedCondition] = useState<CardCondition>('NM');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [isFoil, setIsFoil] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  const handleScrape = async () => {
    if (!currentUrl.trim()) return;

    const matchedPreset = PRESET_URLS.find(p => p.url.toLowerCase() === currentUrl.toLowerCase().trim());
    if (matchedPreset) {
      setScrapedCard(matchedPreset);
      setSelectedCondition(matchedPreset.variations[0].condition);
      setIsFoil(matchedPreset.variations[0].isFoil);
      setSelectedQuantity(1);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/scrape-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        setScrapedCard({
          name: data.title,
          url: currentUrl,
          title: data.title,
          setName: data.setName || 'Edición Card Kingdom',
          cardType: data.cardType || 'Magic Card',
          productId: data.productId || '999999',
          imageUrl: data.imageUrl || 'https://cards.scryfall.io/normal/front/e/f/ef86e270-023a-4949-8c01-7257e84128d5.jpg',
          variations: data.variations?.length > 0 ? data.variations : [
            { condition: 'NM', price: 9.99, stock: 4, isFoil: false }
          ]
        });
      } else {
        const simulatedName = currentUrl.split('/').pop()?.replace(/-/g, ' ') || 'Magic Card';
        setScrapedCard({
          name: simulatedName,
          url: currentUrl,
          title: simulatedName.toUpperCase(),
          setName: 'Edición Estándar CK',
          cardType: 'Carta Scrapeada',
          productId: '888123',
          imageUrl: 'https://cards.scryfall.io/normal/front/a/1/a13c1332-7a11-4e3d-8c3b-012ab6490708.jpg',
          variations: [
            { condition: 'NM', price: 12.99, stock: 4, isFoil: false },
            { condition: 'EX', price: 11.49, stock: 2, isFoil: false },
            { condition: 'VG', price: 9.99, stock: 1, isFoil: false },
          ]
        });
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCurrentCard = () => {
    if (!scrapedCard || !activeOrder) return;
    if (isUnconfirmed) return;

    const matchedVariation = scrapedCard.variations.find(
      v => v.condition === selectedCondition && v.isFoil === isFoil
    ) || scrapedCard.variations[0];

    const price = matchedVariation ? matchedVariation.price : 0;
    const destUser = allUsers.find(u => u.email.toLowerCase() === targetEmail.toLowerCase()) || currentUser;

    onAddToCart({
      buyerEmail: destUser.email,
      buyerName: destUser.displayName,
      cardName: scrapedCard.title,
      edition: scrapedCard.setName,
      cardType: scrapedCard.cardType,
      imageUrl: scrapedCard.imageUrl,
      pageUrl: scrapedCard.url,
      productId: scrapedCard.productId,
      foil: isFoil,
      condition: selectedCondition,
      price,
      quantity: selectedQuantity,
      inStock: (matchedVariation?.stock || 0) > 0,
      availableQty: matchedVariation?.stock || 0,
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2500);
  };

  const activeVariation = scrapedCard.variations.find(
    v => v.condition === selectedCondition && v.isFoil === isFoil
  ) || scrapedCard.variations[0];

  const maxStock = activeVariation?.stock || 1;

  return (
    <div className="space-y-6">
      
      {/* Banner if no active order (§5.2) */}
      {!activeOrder && (
        <div className="bg-red-950/40 border border-red-500/40 text-red-300 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>
            No hay una orden activa. Espera a que un administrador active una orden para agregar cartas al pedido grupal.
          </span>
        </div>
      )}

      {/* Banner if user is unconfirmed (§3.2) */}
      {isUnconfirmed && (
        <div className="bg-amber-950/40 border border-amber-500/40 text-amber-300 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            Debe esperar confirmación de un admin para comprar cartas. Tu cuenta se encuentra en estado "Sin confirmar".
          </span>
        </div>
      )}

      {/* Intro info */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2.5 py-0.5 rounded-full mb-2">
            <span>Simulador WebView Card Kingdom · PurchasesManabros</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Navegador y Capturador de Cartas
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Pega una URL directa de Card Kingdom o selecciona una carta demo para scrapear en tiempo real: nombre, edición, estados (**NM, EX, VG, G**), stock y precios en USD.
          </p>
        </div>

        {/* Quick URL presets */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-slate-400 self-center text-[11px] font-medium">Cartas demo:</span>
          {PRESET_URLS.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setCurrentUrl(preset.url);
                setScrapedCard(preset);
                setSelectedCondition(preset.variations[0].condition);
                setIsFoil(preset.variations[0].isFoil);
                setSelectedQuantity(1);
              }}
              className="px-2.5 py-1 rounded-md bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-slate-300 text-xs transition-colors"
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* URL Browser Bar */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3 flex items-center gap-2 shadow-inner">
        <Globe className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={currentUrl}
          onChange={(e) => setCurrentUrl(e.target.value)}
          placeholder="https://www.cardkingdom.com/mtg/..."
          className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
        />
        <button
          onClick={handleScrape}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-[#0D1117] rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>Scrapear</span>
        </button>
      </div>

      {/* Card Presentation & Add Dialog (§5.2) */}
      {scrapedCard && (
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card Image */}
          <div className="flex flex-col items-center justify-center">
            {scrapedCard.imageUrl ? (
              <img
                src={scrapedCard.imageUrl}
                alt={scrapedCard.title}
                className="w-48 rounded-xl shadow-2xl border border-[#30363D] object-cover hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-48 h-64 bg-[#0D1117] rounded-xl border border-[#30363D] flex items-center justify-center text-slate-600 text-xs">
                Sin vista previa
              </div>
            )}
          </div>

          {/* Card Info & Variations */}
          <div className="md:col-span-2 space-y-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-white tracking-tight">{scrapedCard.title}</h3>
                {isFoil && (
                  <span className="text-[10px] font-bold uppercase text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded">
                    Foil
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{scrapedCard.setName} · {scrapedCard.cardType}</p>
            </div>

            {/* Condition Selection Chips */}
            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-2">
                Selecciona Condición y Acabado:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {scrapedCard.variations.map((v, idx) => {
                  const isSelected = selectedCondition === v.condition && isFoil === v.isFoil;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedCondition(v.condition);
                        setIsFoil(v.isFoil);
                        setSelectedQuantity(1);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-amber-400 text-[#0D1117] border-amber-400 font-bold shadow-md'
                          : 'bg-[#0D1117] border-[#30363D] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span>{v.condition} {v.isFoil ? '(Foil)' : ''}</span>
                        <span className="font-mono">${v.price.toFixed(2)}</span>
                      </div>
                      <span className={`text-[10px] block mt-1 ${isSelected ? 'text-black/80' : 'text-slate-400'}`}>
                        {v.stock > 0 ? `${v.stock} disponibles` : 'Agotado'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity Stepper & Target User (§5.2) */}
            <div className="p-4 bg-[#0D1117] border border-[#30363D] rounded-xl space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Stepper */}
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Cantidad a pedir</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedQuantity <= 1}
                      onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                      className="w-8 h-8 flex items-center justify-center bg-[#21262D] text-white rounded-lg disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-white text-base px-2">
                      {selectedQuantity}
                    </span>
                    <button
                      type="button"
                      disabled={selectedQuantity >= maxStock}
                      onClick={() => setSelectedQuantity(Math.min(maxStock, selectedQuantity + 1))}
                      className="w-8 h-8 flex items-center justify-center bg-[#21262D] text-white rounded-lg disabled:opacity-40"
                    >
                      +
                    </button>
                    <span className="text-[11px] text-slate-400 ml-2">
                      (Máx: {maxStock})
                    </span>
                  </div>
                </div>

                {/* Destination user (Admin only §5.2) */}
                {isAdmin ? (
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">
                      Comprador destino (Admin):
                    </span>
                    <select
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      className="px-3 py-1.5 bg-[#161B22] border border-[#30363D] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      {allUsers.map(u => (
                        <option key={u.uid} value={u.email}>
                          {u.displayName} ({u.email}) {u.status === 'unconfirmed' ? '⚠️' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs text-slate-400 block">Comprador</span>
                    <span className="text-xs font-semibold text-white">{currentUser.displayName}</span>
                  </div>
                )}
              </div>

              {/* Price Calculation & Add Button */}
              <div className="flex items-center justify-between pt-3 border-t border-[#30363D] gap-4">
                <div>
                  <span className="text-xs text-slate-400 block">Total a Agregar</span>
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    ${((activeVariation?.price || 0) * selectedQuantity).toFixed(2)} USD
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!activeOrder || isUnconfirmed || maxStock <= 0}
                  onClick={handleAddCurrentCard}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                    justAdded
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-[#0D1117] disabled:opacity-40 disabled:pointer-events-none'
                  }`}
                >
                  {justAdded ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>¡Agregado a la Orden!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Pedir Carta</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
