import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, X, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { RescrapeResultItem, UserCart } from '../types/card';

interface PriceRescraperModalProps {
  userCarts: UserCart[];
  onClose: () => void;
  onApplyUpdatedPrices: (results: RescrapeResultItem[]) => void;
  onProceedToCartPusher: () => void;
}

export const PriceRescraperModal: React.FC<PriceRescraperModalProps> = ({
  userCarts,
  onClose,
  onApplyUpdatedPrices,
  onProceedToCartPusher,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanningCard, setCurrentScanningCard] = useState<string>('');
  const [results, setResults] = useState<RescrapeResultItem[] | null>(null);
  const [applied, setApplied] = useState(false);

  const allItems = React.useMemo(() => {
    const list: Array<{ id: string; name: string; setName: string; condition: string; isFoil: boolean; quantity: number; priceUsd: number }> = [];
    userCarts.forEach(u => {
      u.items.forEach(i => {
        list.push({
          id: i.id,
          name: i.name,
          setName: i.setName,
          condition: i.condition,
          isFoil: i.isFoil,
          quantity: i.quantity,
          priceUsd: i.priceUsd,
        });
      });
    });
    return list;
  }, [userCarts]);

  const runReScraper = async () => {
    if (allItems.length === 0) return;
    setIsScanning(true);
    setScanProgress(0);
    setResults(null);
    setApplied(false);

    try {
      for (let i = 0; i < allItems.length; i++) {
        setCurrentScanningCard(allItems[i].name);
        setScanProgress(Math.round(((i + 1) / allItems.length) * 100));
        await new Promise(r => setTimeout(r, 200));
      }

      const res = await fetch('/api/rescrape-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: allItems }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      }
    } catch (e) {
      console.error('Error re-scraping:', e);
    } finally {
      setIsScanning(false);
      setCurrentScanningCard('');
    }
  };

  const oldTotal = results
    ? results.reduce((sum, r) => sum + r.oldPrice * r.quantity, 0)
    : allItems.reduce((sum, i) => sum + i.priceUsd * i.quantity, 0);

  const newTotal = results
    ? results.reduce((sum, r) => sum + (r.inStock ? r.currentPrice * r.quantity : 0), 0)
    : oldTotal;

  const totalDelta = newTotal - oldTotal;
  const outOfStockCount = results ? results.filter(r => !r.inStock).length : 0;

  const handleApply = () => {
    if (!results) return;
    onApplyUpdatedPrices(results);
    setApplied(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1117]/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2.5 py-0.5 rounded-full mb-1">
              <span>Control Administrador Manabr✧s · Pre-Compra</span>
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-400" />
              <span>Actualizador de Precios & Stock en Card Kingdom</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Re-escanea cada carta en Card Kingdom para actualizar fluctuaciones de precio y disponibilidad antes del checkout final.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5">
          
          {!results && !isScanning && (
            <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-bold text-white mb-1">
                  Listo para escanear {allItems.length} cartas en la orden
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dado que los miembros agregaron cartas días atrás, verificaremos en vivo las variaciones de precio en Card Kingdom y si continúan en stock.
                </p>
              </div>
              <button
                type="button"
                onClick={runReScraper}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-[#0D1117] font-bold text-xs rounded-lg transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ejecutar Actualizador de Precios Ahora</span>
              </button>
            </div>
          )}

          {isScanning && (
            <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-8 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-white">
                  Re-escaneando precios en Card Kingdom...
                </h4>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Consultando: <span className="text-amber-300 font-bold">{currentScanningCard}</span>
                </p>
              </div>

              <div className="w-full bg-[#21262D] rounded-full h-2 overflow-hidden max-w-md mx-auto">
                <div
                  className="bg-amber-400 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${scanProgress}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono text-slate-400">{scanProgress}% completado</span>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Total Anterior</span>
                  <span className="text-base font-mono font-bold text-slate-300 tabular-nums">
                    ${oldTotal.toFixed(2)} USD
                  </span>
                </div>

                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Total Actualizado Hoy</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-mono font-bold text-emerald-400 tabular-nums">
                      ${newTotal.toFixed(2)} USD
                    </span>
                    {totalDelta !== 0 && (
                      <span className={`inline-flex items-center text-[11px] font-bold font-mono px-1.5 py-0.2 rounded ${
                        totalDelta > 0 ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'
                      }`}>
                        {totalDelta > 0 ? `+${totalDelta.toFixed(2)}` : `${totalDelta.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
                  <span className="text-slate-400 block mb-0.5">Alertas de Stock</span>
                  <span className={`text-base font-mono font-bold tabular-nums ${outOfStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {outOfStockCount > 0 ? `${outOfStockCount} Agotadas` : '100% En Stock'}
                  </span>
                </div>
              </div>

              <div className="border border-[#30363D] rounded-xl overflow-hidden bg-[#0D1117]">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#161B22] border-b border-[#30363D] text-slate-400 sticky top-0 font-medium">
                      <tr>
                        <th className="py-2 px-3">Carta</th>
                        <th className="py-2 px-3 text-center">Estado</th>
                        <th className="py-2 px-3 text-right">Precio Guardado</th>
                        <th className="py-2 px-3 text-right">Precio Hoy</th>
                        <th className="py-2 px-3 text-center">Variación</th>
                        <th className="py-2 px-3 text-center">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30363D]/60 font-mono">
                      {results.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#21262D]/50 transition-colors">
                          <td className="py-2 px-3 font-sans">
                            <span className="font-semibold text-slate-200">{item.name}</span>
                            <span className="text-[10px] text-slate-400 block">{item.setName}</span>
                          </td>
                          <td className="py-2 px-3 text-center text-amber-300 font-bold">
                            {item.condition} {item.isFoil && '(Foil)'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 tabular-nums">
                            ${item.oldPrice.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-white tabular-nums">
                            ${item.currentPrice.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.delta === 0 ? (
                              <span className="text-slate-600 font-sans text-[11px]">—</span>
                            ) : item.delta > 0 ? (
                              <span className="text-rose-400 font-bold flex items-center justify-center gap-0.5">
                                <TrendingUp className="w-3 h-3" />
                                <span>+${item.delta.toFixed(2)}</span>
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-bold flex items-center justify-center gap-0.5">
                                <TrendingDown className="w-3 h-3" />
                                <span>-${Math.abs(item.delta).toFixed(2)}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-sans">
                            {item.inStock ? (
                              <span className="text-emerald-400 text-[11px] font-medium flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{item.stockCount} disp.</span>
                              </span>
                            ) : (
                              <span className="text-rose-400 text-[11px] font-bold flex items-center justify-center gap-1 bg-rose-950/60 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Agotada</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#30363D] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {results && applied && (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Precios actualizados en todos los carritos de la orden activa</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cerrar
            </button>

            {results && (
              <>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applied}
                  className="px-4 py-2 bg-[#21262D] hover:bg-[#30363D] disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-[#30363D] transition-colors"
                >
                  {applied ? '✓ Precios Aplicados' : 'Aplicar Precios a la Orden'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleApply();
                    onProceedToCartPusher();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-[#0D1117] text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  <span>Lanzar al Carrito Online</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
