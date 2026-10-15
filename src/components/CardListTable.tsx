import React, { useState } from 'react';
import { ExternalLink, Trash2, Plus, Minus, Image as ImageIcon, Sparkles } from 'lucide-react';
import { CardCondition, ParsedCardItem } from '../types/card';
import { getCardKingdomSearchUrl } from '../services/cardKingdom';

interface CardListTableProps {
  cards: ParsedCardItem[];
  onUpdateCard: (id: string, updates: Partial<ParsedCardItem>) => void;
  onRemoveCard: (id: string) => void;
  onSetAllConditions: (condition: CardCondition) => void;
  onToggleAllFoils: () => void;
  onClearAll: () => void;
  onSelectCardForPreview: (card: ParsedCardItem) => void;
}

export const CardListTable: React.FC<CardListTableProps> = ({
  cards,
  onUpdateCard,
  onRemoveCard,
  onSetAllConditions,
  onToggleAllFoils,
  onClearAll,
  onSelectCardForPreview
}) => {
  const [hoveredCardImg, setHoveredCardImg] = useState<{ url: string; x: number; y: number } | null>(null);

  if (cards.length === 0) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-12 text-center shadow-lg">
        <div className="w-12 h-12 rounded-full bg-[#21262D] text-amber-400 mx-auto flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-white mb-1">Sin cartas en la lista</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
          Pega una lista de cartas arriba o selecciona uno de los ejemplos para comenzar a cotizar y armar tu carrito.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden mb-6 relative shadow-lg">
      {/* Table toolbar / Bulk operations */}
      <div className="p-3.5 border-b border-[#30363D] bg-[#0D1117] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Condición masiva:</span>
          {(['NM', 'EX', 'VG', 'G'] as CardCondition[]).map(cond => (
            <button
              key={cond}
              type="button"
              onClick={() => onSetAllConditions(cond)}
              className="px-2 py-0.5 rounded bg-[#21262D] hover:bg-[#30363D] text-slate-200 border border-[#30363D] font-mono font-semibold transition-colors"
            >
              {cond}
            </button>
          ))}
          <button
            type="button"
            onClick={onToggleAllFoils}
            className="px-2.5 py-0.5 rounded bg-[#21262D] hover:bg-[#30363D] text-amber-300 border border-[#30363D] font-semibold transition-colors ml-1"
          >
            Invertir Foils
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            Total: <span className="text-white font-bold font-mono">{cards.length}</span> ítems
          </span>
          <button
            type="button"
            onClick={onClearAll}
            className="text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vaciar</span>
          </button>
        </div>
      </div>

      {/* High-density grid table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#30363D] bg-[#0D1117] text-slate-400 font-semibold select-none">
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-3 min-w-[220px]">Carta / Edición</th>
              <th className="py-2.5 px-3 w-28 text-center">Cantidad</th>
              <th className="py-2.5 px-3 w-28 text-center">Condición</th>
              <th className="py-2.5 px-3 w-20 text-center">Foil</th>
              <th className="py-2.5 px-3 w-28 text-right">Precio Ref.</th>
              <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
              <th className="py-2.5 px-3 w-32 text-center">Card Kingdom</th>
              <th className="py-2.5 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363D]/60 font-mono">
            {cards.map((card, idx) => {
              const unitPrice = card.isFoil
                ? (card.estimatedPriceFoil || card.estimatedPriceUsd || 0)
                : (card.estimatedPriceUsd || 0);
              const subtotal = unitPrice * card.quantity;

              return (
                <tr
                  key={card.id}
                  className="hover:bg-[#21262D]/50 transition-colors group"
                >
                  <td className="py-2 px-3 text-center text-slate-500">
                    {idx + 1}
                  </td>

                  <td className="py-2 px-3 font-sans">
                    <div className="flex items-center gap-2.5">
                      {card.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => onSelectCardForPreview(card)}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCardImg({
                              url: card.imageUrl!,
                              x: rect.right + 12,
                              y: Math.max(10, rect.top - 60)
                            });
                          }}
                          onMouseLeave={() => setHoveredCardImg(null)}
                          className="w-7 h-9 rounded bg-[#0D1117] overflow-hidden shrink-0 border border-[#30363D] hover:border-amber-400 transition-all cursor-zoom-in"
                        >
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-7 h-9 rounded bg-[#0D1117] border border-[#30363D] flex items-center justify-center text-slate-600 shrink-0">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 truncate hover:text-amber-300 transition-colors">
                            {card.name}
                          </span>
                          {card.manaCost && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {card.manaCost}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          {card.setCode ? (
                            <span className="font-mono text-amber-400 font-bold uppercase">
                              [{card.setCode}]
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Cualquier edición</span>
                          )}
                          {card.typeLine && (
                            <span className="truncate max-w-[160px] text-slate-500 hidden sm:inline">
                              · {card.typeLine}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-2 px-3 text-center">
                    <div className="inline-flex items-center border border-[#30363D] rounded bg-[#0D1117]">
                      <button
                        type="button"
                        onClick={() => onUpdateCard(card.id, { quantity: Math.max(1, card.quantity - 1) })}
                        className="p-1 hover:text-white text-slate-400 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={card.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) {
                            onUpdateCard(card.id, { quantity: val });
                          }
                        }}
                        className="w-10 text-center bg-transparent font-mono font-bold text-white text-xs outline-none tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateCard(card.id, { quantity: card.quantity + 1 })}
                        className="p-1 hover:text-white text-slate-400 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>

                  <td className="py-2 px-3 text-center">
                    <select
                      value={card.preferredCondition}
                      onChange={(e) => onUpdateCard(card.id, { preferredCondition: e.target.value as CardCondition })}
                      className="bg-[#0D1117] border border-[#30363D] rounded px-2 py-1 text-xs font-mono font-bold text-amber-300 outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="NM">NM (Near Mint)</option>
                      <option value="EX">EX (Excellent)</option>
                      <option value="VG">VG (Very Good)</option>
                      <option value="G">G (Good)</option>
                    </select>
                  </td>

                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onUpdateCard(card.id, { isFoil: !card.isFoil })}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        card.isFoil
                          ? 'bg-amber-400 text-[#0D1117] shadow-sm'
                          : 'bg-[#21262D] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {card.isFoil ? 'FOIL' : 'Reg'}
                    </button>
                  </td>

                  <td className="py-2 px-3 text-right tabular-nums text-slate-300">
                    {unitPrice > 0 ? (
                      `$${unitPrice.toFixed(2)}`
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-400">
                    {subtotal > 0 ? (
                      `$${subtotal.toFixed(2)}`
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  <td className="py-2 px-3 text-center font-sans">
                    <a
                      href={getCardKingdomSearchUrl(card.name, card.setCode)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#21262D] hover:bg-[#30363D] text-slate-300 hover:text-amber-300 rounded border border-[#30363D] text-[11px] font-semibold transition-colors whitespace-nowrap"
                    >
                      <span>Ver en CK</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>

                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveCard(card.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Eliminar de la lista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hoveredCardImg && (
        <div
          className="fixed z-50 pointer-events-none rounded-xl overflow-hidden shadow-2xl border-2 border-amber-400 bg-[#0D1117] w-56 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${hoveredCardImg.x}px`,
            top: `${hoveredCardImg.y}px`
          }}
        >
          <img
            src={hoveredCardImg.url}
            alt="Card preview"
            referrerPolicy="no-referrer"
            className="w-full h-auto block"
          />
        </div>
      )}
    </div>
  );
};
