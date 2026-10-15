import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { ParsedCardItem } from '../types/card';
import { getCardKingdomSearchUrl } from '../services/cardKingdom';

interface CardModalProps {
  card: ParsedCardItem | null;
  onClose: () => void;
}

export const CardModal: React.FC<CardModalProps> = ({ card, onClose }) => {
  if (!card) return null;

  const unitPrice = card.isFoil
    ? (card.estimatedPriceFoil || card.estimatedPriceUsd || 0)
    : (card.estimatedPriceUsd || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1117]/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative">
        <div className="p-4 border-b border-[#30363D] flex items-center justify-between">
          <div className="min-w-0 pr-4">
            <h3 className="text-base font-bold text-white truncate">{card.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {card.setDisplayName || (card.setCode ? `Edición: ${card.setCode}` : 'Cualquier edición')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          {card.imageUrl ? (
            <div className="w-48 shrink-0 rounded-xl overflow-hidden border border-[#30363D] shadow-xl bg-[#0D1117]">
              <img
                src={card.imageUrl}
                alt={card.name}
                referrerPolicy="no-referrer"
                className="w-full h-auto block"
              />
            </div>
          ) : (
            <div className="w-48 h-64 shrink-0 rounded-xl bg-[#0D1117] border border-[#30363D] flex items-center justify-center text-slate-500 text-xs">
              Sin imagen
            </div>
          )}

          <div className="flex-1 w-full space-y-4 text-xs">
            {card.typeLine && (
              <div>
                <span className="text-slate-400 block mb-1 font-medium">Tipo:</span>
                <span className="text-slate-200 font-semibold">{card.typeLine}</span>
              </div>
            )}

            {card.manaCost && (
              <div>
                <span className="text-slate-400 block mb-1 font-medium">Coste de Maná:</span>
                <span className="font-mono text-amber-300 font-bold">{card.manaCost}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#30363D]">
              <div className="bg-[#0D1117] rounded-lg p-2.5 border border-[#30363D]">
                <span className="text-slate-400 block mb-0.5 font-medium">Estado deseado:</span>
                <span className="font-mono font-bold text-amber-400">{card.preferredCondition}</span>
              </div>
              <div className="bg-[#0D1117] rounded-lg p-2.5 border border-[#30363D]">
                <span className="text-slate-400 block mb-0.5 font-medium">Tratamiento:</span>
                <span className="font-semibold text-slate-200">{card.isFoil ? 'Foil' : 'Regular'}</span>
              </div>
            </div>

            <div className="bg-[#0D1117] rounded-lg p-3 border border-[#30363D] flex items-center justify-between">
              <span className="text-slate-400 font-medium">Precio Ref. Scryfall:</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">
                {unitPrice > 0 ? `$${unitPrice.toFixed(2)} USD` : 'No disponible'}
              </span>
            </div>

            <div className="pt-2">
              <a
                href={getCardKingdomSearchUrl(card.name, card.setCode)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-[#0D1117] font-bold text-xs rounded-lg transition-colors shadow-sm"
              >
                <span>Buscar stock en Card Kingdom</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
