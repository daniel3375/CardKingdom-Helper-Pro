import React, { useState } from 'react';
import { Sparkles, Trash2, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { SAMPLE_DECKLISTS } from '../utils/parser';

interface DeckInputProps {
  rawText: string;
  setRawText: (text: string) => void;
  onParseAndResolve: () => void;
  isLoading: boolean;
  totalCardsParsed: number;
  uniqueCardsParsed: number;
}

export const DeckInput: React.FC<DeckInputProps> = ({
  rawText,
  setRawText,
  onParseAndResolve,
  isLoading,
  totalCardsParsed,
  uniqueCardsParsed
}) => {
  const [, setActiveSample] = useState<string | null>(null);

  const loadSample = (key: keyof typeof SAMPLE_DECKLISTS, label: string) => {
    setRawText(SAMPLE_DECKLISTS[key]);
    setActiveSample(label);
  };

  const handleClear = () => {
    setRawText('');
    setActiveSample(null);
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 mb-6 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Lista de Cartas para Cotizar y Comprar</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pega tu mazo en formato estándar (ej: <code className="text-amber-300">4 Lightning Bolt</code> o <code className="text-amber-300">1 Sol Ring (C21)</code>)
          </p>
        </div>

        {/* Quick sample chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 mr-1 font-medium">Ejemplos:</span>
          <button
            type="button"
            onClick={() => loadSample('commanderStaples', 'Commander')}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-[#21262D] hover:bg-[#30363D] text-slate-300 border border-[#30363D] transition-colors"
          >
            Commander Staples
          </button>
          <button
            type="button"
            onClick={() => loadSample('burnModern', 'Modern Burn')}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-[#21262D] hover:bg-[#30363D] text-slate-300 border border-[#30363D] transition-colors"
          >
            Modern Burn
          </button>
          <button
            type="button"
            onClick={() => loadSample('budgetUpgrades', 'Budget')}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-[#21262D] hover:bg-[#30363D] text-slate-300 border border-[#30363D] transition-colors"
          >
            Budget Upgrades
          </button>
          {rawText && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-400 transition-colors ml-1"
              title="Borrar texto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <textarea
          rows={6}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setActiveSample(null);
          }}
          placeholder="Pega aquí la lista de cartas...&#10;Ejemplo:&#10;4 Lightning Bolt&#10;1 Sol Ring (C21)&#10;2 Birds of Paradise *F*"
          className="w-full bg-[#0D1117] border border-[#30363D] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg p-3 text-xs sm:text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none resize-y transition-all"
        />
      </div>

      {/* Footer controls & counters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-[#30363D]">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div>
            <span>Detectadas: </span>
            <span className="font-mono font-bold text-white tabular-nums">{uniqueCardsParsed}</span>
            <span className="text-slate-500"> distintas</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span>Copias totales: </span>
            <span className="font-mono font-bold text-amber-400 tabular-nums">{totalCardsParsed}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onParseAndResolve}
          disabled={isLoading || !rawText.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 disabled:opacity-50 text-[#0D1117] font-bold text-xs rounded-lg transition-all shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#0D1117]" />
              <span>Consultando Scryfall & Precios...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cotizar Lista con Scryfall</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
