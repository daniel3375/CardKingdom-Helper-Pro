import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Download, ShoppingBag, DollarSign } from 'lucide-react';
import { ParsedCardItem } from '../types/card';
import {
  formatForCardKingdomDeckBuilder,
  CARD_KINGDOM_DECKBUILDER_URL,
  generateCardListCsv,
  downloadFile
} from '../services/cardKingdom';

interface ExportPanelProps {
  cards: ParsedCardItem[];
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ cards }) => {
  const [includeSets, setIncludeSets] = useState(false);
  const [copied, setCopied] = useState(false);

  const totalCards = cards.reduce((acc, c) => acc + c.quantity, 0);
  const totalEstimatedUsd = cards.reduce((acc, c) => {
    const price = c.isFoil
      ? (c.estimatedPriceFoil || c.estimatedPriceUsd || 0)
      : (c.estimatedPriceUsd || 0);
    return acc + (price * c.quantity);
  }, 0);

  const conditionCounts = cards.reduce((acc, c) => {
    acc[c.preferredCondition] = (acc[c.preferredCondition] || 0) + c.quantity;
    return acc;
  }, {} as Record<string, number>);

  const deckBuilderString = formatForCardKingdomDeckBuilder(cards, includeSets);

  const handleCopy = () => {
    navigator.clipboard.writeText(deckBuilderString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    const csv = generateCardListCsv(cards);
    downloadFile(csv, `manabros_order_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
      {/* Financial & Volume Summary Card */}
      <div className="lg:col-span-1 bg-[#161B22] border border-[#30363D] rounded-xl p-5 flex flex-col justify-between shadow-lg">
        <div>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Presupuesto Estimado</span>
          </h3>

          <div className="space-y-4">
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
              <span className="text-xs text-slate-400 block mb-1">Total Estimado Scryfall (USD)</span>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 tabular-nums">
                ${totalEstimatedUsd.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                *Precios de referencia de mercado en vivo.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5">
                <span className="text-slate-400 block">Total Cartas</span>
                <span className="text-base font-bold font-mono text-white tabular-nums">
                  {totalCards}
                </span>
              </div>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5">
                <span className="text-slate-400 block">Líneas Únicas</span>
                <span className="text-base font-bold font-mono text-white tabular-nums">
                  {cards.length}
                </span>
              </div>
            </div>

            {/* Condition Breakdown */}
            <div className="border-t border-[#30363D] pt-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Desglose por Estado
              </span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {['NM', 'EX', 'VG', 'G'].map((cond) => (
                  <div key={cond} className="bg-[#0D1117] rounded p-1.5 border border-[#30363D]">
                    <span className="font-mono text-amber-400 font-bold block">{cond}</span>
                    <span className="text-slate-300 font-mono tabular-nums">
                      {conditionCounts[cond] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#30363D]">
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={cards.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#21262D] hover:bg-[#30363D] disabled:opacity-50 text-slate-300 rounded-lg text-xs font-semibold transition-colors border border-[#30363D]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar CSV para Inventario</span>
          </button>
        </div>
      </div>

      {/* Export to Card Kingdom Deck Builder */}
      <div className="lg:col-span-2 bg-[#161B22] border border-[#30363D] rounded-xl p-5 flex flex-col justify-between shadow-lg">
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>Exportar Formato Deck Builder</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Copia este texto y pégalo directamente en la herramienta oficial de Card Kingdom para armar el pedido en segundos.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSets}
                onChange={(e) => setIncludeSets(e.target.checked)}
                className="rounded border-[#30363D] bg-[#0D1117] text-amber-400 focus:ring-amber-400"
              />
              <span>Incluir códigos de edición [SET]</span>
            </label>
          </div>

          <div className="relative">
            <textarea
              readOnly
              rows={7}
              value={deckBuilderString || '// Tu lista de cartas optimizada aparecerá aquí'}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-3 text-xs font-mono text-slate-300 outline-none select-all"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-[#30363D]">
          <button
            type="button"
            onClick={handleCopy}
            disabled={cards.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#21262D] hover:bg-[#30363D] disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors border border-[#30363D]"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">¡Texto copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar Formato Deck Builder</span>
              </>
            )}
          </button>

          <a
            href={CARD_KINGDOM_DECKBUILDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-[#0D1117] font-bold text-xs rounded-lg transition-colors shadow-sm"
          >
            <span>Ir a Card Kingdom Deck Builder</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
