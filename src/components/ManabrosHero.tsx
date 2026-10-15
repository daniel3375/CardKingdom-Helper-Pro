import React from 'react';
import { Sparkles, ShieldCheck, RefreshCw, Play, ShoppingCart } from 'lucide-react';
import { UserProfile } from '../types/purchases';

interface ManabrosHeroProps {
  currentUser: UserProfile;
  totalCardsInOrder: number;
  totalOrderUsd: number;
  onOpenRescraper: () => void;
  onOpenPusher: () => void;
}

export const ManabrosHero: React.FC<ManabrosHeroProps> = ({
  currentUser,
  totalCardsInOrder,
  totalOrderUsd,
  onOpenRescraper,
  onOpenPusher,
}) => {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#30363D] mb-8 shadow-2xl bg-[#161B22]">
      {/* Background Tavern Image with measured dark scrim matching manabros-store.web.app */}
      <div className="absolute inset-0 z-0">
        <img
          src="/src/assets/tavern_bg.jpg"
          alt="Manabr✧s Tavern"
          className="w-full h-full object-cover object-center filter brightness-[0.38] contrast-[1.1]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/70 to-[#0D1117]/40" />
      </div>

      {/* Content Canvas */}
      <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-3 py-1 rounded-full mb-3 shadow-sm backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">Manabr✧s Store · Card Kingdom Hub</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-3">
            Despierta tu chispa
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
            Herramienta oficial de importación colectiva para <strong>Manabr✧s</strong>. 
            Permite que cada cliente arme su carrito local en Card Kingdom, 
            actualiza precios antes de la compra y automatiza el pedido final.
          </p>
        </div>

        {/* Hero Quick KPI & Action Card */}
        <div className="w-full md:w-auto shrink-0 bg-[#0D1117]/90 border border-[#30363D] backdrop-blur-md rounded-xl p-5 shadow-xl flex flex-col gap-4 min-w-[260px]">
          <div>
            <span className="text-xs text-slate-400 font-medium block">
              {currentUser.role === 'admin' ? 'Total Orden Activa (Consolidada)' : 'Tu Subtotal Personal'}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 tabular-nums mt-0.5">
              ${totalOrderUsd.toFixed(2)} USD
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {totalCardsInOrder} copias en la orden grupal
            </span>
          </div>

          {currentUser.role === 'admin' && (
            <div className="flex flex-col gap-2 pt-2 border-t border-[#30363D]">
              <button
                type="button"
                onClick={onOpenRescraper}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-[#21262D] hover:bg-[#30363D] text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/30 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Re-escanear Precios</span>
              </button>

              <button
                type="button"
                onClick={onOpenPusher}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-[#0D1117] text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>2. Lanzar Cartas a CK</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
