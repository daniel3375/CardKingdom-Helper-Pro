import React from 'react';
import {
  ExternalLink,
  ShieldCheck,
  User,
  ShoppingBag,
  Users,
  Globe,
  Smartphone,
  History,
  Settings,
  UserCheck,
} from 'lucide-react';
import { UserProfile, AppSettings } from '../types/purchases';
import { CARD_KINGDOM_DECKBUILDER_URL } from '../services/cardKingdom';

export type TabType = 'active_order' | 'webview' | 'mass_entry' | 'orders_history' | 'flutter_code';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  totalCardsInOrder: number;
  currentUser: UserProfile;
  appSettings: AppSettings;
  unconfirmedUsersCount: number;
  onOpenUsersManager: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalCardsInOrder,
  currentUser,
  appSettings,
  unconfirmedUsersCount,
  onOpenUsersManager,
  onOpenSettings,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const showHistoryTab = isAdmin || appSettings.historyEnabled;

  return (
    <header className="border-b border-[#30363D] bg-[#0D1117]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          
          {/* Zone 1: Manabr✧s Brand Lockup with Favicon Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('active_order')}
              className="flex items-center gap-2.5 group text-left"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#161B22] border border-[#30363D] p-1 flex items-center justify-center shadow-sm group-hover:border-amber-400 transition-colors">
                <img
                  src="/src/assets/favicon.png"
                  alt="Manabr✧s"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight text-white group-hover:text-amber-400 transition-colors flex items-center gap-1">
                  <span>MANABR</span>
                  <span className="text-amber-400">✧</span>
                  <span>S</span>
                  <span className="text-xs font-normal text-slate-400 ml-1">BUYER</span>
                </span>
                <span className="text-[10px] text-slate-400 block -mt-1 font-medium tracking-wide">
                  Card Kingdom Assistant
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 text-xs font-semibold tracking-wider text-slate-300">
            {/* Tab 1: Orden Activa / Mi Carrito */}
            <button
              onClick={() => setActiveTab('active_order')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'active_order'
                  ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#161B22]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isAdmin ? 'Orden Activa' : 'Mi Carrito'}</span>
              {totalCardsInOrder > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'active_order' ? 'bg-[#0D1117] text-amber-400' : 'bg-amber-400 text-[#0D1117]'
                }`}>
                  {totalCardsInOrder}
                </span>
              )}
            </button>

            {/* Tab 2: Navegador & Captura WebView */}
            <button
              onClick={() => setActiveTab('webview')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'webview'
                  ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#161B22]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Navegador & Captura</span>
            </button>

            {/* Tab 3: Listas Masivas */}
            <button
              onClick={() => setActiveTab('mass_entry')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'mass_entry'
                  ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#161B22]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Listas Masivas</span>
            </button>

            {/* Tab 4: Mis Órdenes / Historial (§5.4) */}
            {showHistoryTab && (
              <button
                onClick={() => setActiveTab('orders_history')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'orders_history'
                    ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#161B22]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Mis Órdenes</span>
              </button>
            )}

            {/* Tab 5: Flutter / Dart Code Reference */}
            <button
              onClick={() => setActiveTab('flutter_code')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'flutter_code'
                  ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#161B22]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Código Flutter</span>
            </button>

            {/* Admin Users Tool (§5.7) */}
            {isAdmin && (
              <button
                onClick={onOpenUsersManager}
                className="px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-amber-300 hover:text-amber-200 hover:bg-[#161B22] border border-amber-500/30"
                title="Gestión de usuarios y confirmación"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Usuarios</span>
                {unconfirmedUsersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-[#0D1117]">
                    {unconfirmedUsersCount}
                  </span>
                )}
              </button>
            )}
          </nav>

          {/* Zone 3: User Profile, Balance & Settings Gear */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* User Profile Pill with Saldo a Favor (§2.2) */}
            <div className="flex items-center gap-2 bg-[#161B22] border border-[#30363D] rounded-xl p-1.5">
              <img
                src={currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser.displayName}
                className="w-7 h-7 rounded-lg object-cover border border-[#30363D]"
              />
              <div className="hidden sm:block text-left pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate max-w-[110px]">
                    {currentUser.displayName}
                  </span>
                  <span className={`text-[9px] font-bold uppercase px-1 rounded ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                      : 'bg-blue-950/60 text-blue-400 border border-blue-500/40'
                  }`}>
                    {currentUser.role === 'admin' ? 'Admin' : currentUser.role}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 block font-semibold leading-tight">
                  Saldo: ${currentUser.balance.toFixed(2)} USD
                </span>
              </div>
            </div>

            {/* Settings Gear Button (§5.9) */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white bg-[#161B22] hover:bg-[#21262D] border border-[#30363D] rounded-xl transition-colors"
              title="Ajustes de la aplicación"
            >
              <Settings className="w-4 h-4" />
            </button>

            <a
              href={CARD_KINGDOM_DECKBUILDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#0D1117] bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-lg transition-colors whitespace-nowrap shadow-sm"
            >
              <span>Card Kingdom</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>

        {/* Mobile Navigation Strip (Visible on small screens) */}
        <div className="md:hidden flex items-center gap-1.5 overflow-x-auto py-2 border-t border-[#30363D]/60 text-xs pb-2.5">
          <button
            onClick={() => setActiveTab('active_order')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'active_order'
                ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                : 'text-slate-400 hover:text-white bg-[#161B22]'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>{isAdmin ? 'Orden' : 'Carrito'}</span>
          </button>

          <button
            onClick={() => setActiveTab('webview')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'webview'
                ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                : 'text-slate-400 hover:text-white bg-[#161B22]'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Navegador</span>
          </button>

          <button
            onClick={() => setActiveTab('mass_entry')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'mass_entry'
                ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                : 'text-slate-400 hover:text-white bg-[#161B22]'
            }`}
          >
            <ShoppingBag className="w-3 h-3" />
            <span>Masivo</span>
          </button>

          {showHistoryTab && (
            <button
              onClick={() => setActiveTab('orders_history')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-xs ${
                activeTab === 'orders_history'
                  ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-[#161B22]'
              }`}
            >
              <History className="w-3 h-3" />
              <span>Órdenes</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={onOpenUsersManager}
              className="px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap text-xs bg-amber-950/60 text-amber-300 border border-amber-500/40"
            >
              <UserCheck className="w-3 h-3" />
              <span>Usuarios</span>
              {unconfirmedUsersCount > 0 && (
                <span className="font-bold">({unconfirmedUsersCount})</span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('flutter_code')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'flutter_code'
                ? 'bg-amber-400 text-[#0D1117] font-bold shadow-sm'
                : 'text-slate-400 hover:text-white bg-[#161B22]'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            <span>Flutter</span>
          </button>
        </div>

      </div>
    </header>
  );
};
