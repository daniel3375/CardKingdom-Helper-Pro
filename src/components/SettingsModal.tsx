import React, { useState } from 'react';
import { X, Moon, Sun, Monitor, ShieldCheck, History, Eye, Globe, Image, LogOut, Check } from 'lucide-react';
import { UserProfile, AppSettings } from '../types/purchases';
import { storeService } from '../services/storeService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSwitchSession: (uid: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSwitchSession,
}) => {
  const [settings, setSettings] = useState<AppSettings>(() => storeService.getSettings());
  const [toast, setToast] = useState<string | null>(null);
  const [showSwitchUser, setShowSwitchUser] = useState(false);
  const allUsers = storeService.getAllUsers();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  if (!isOpen) return null;

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K], label: string) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    storeService.updateSettings({ [key]: value });
    showToast(label);
  };

  const handleClearImageCache = () => {
    if (confirm('¿Se eliminarán las imágenes de cartas descargadas para liberar espacio? En la web las imágenes usan la caché del navegador.')) {
      showToast('En la web las imágenes usan la caché del navegador');
    }
  };

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      // Pick first non-admin user or show login
      const nextUser = allUsers.find(u => u.uid !== currentUser.uid) || allUsers[0];
      onSwitchSession(nextUser.uid);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#30363D] flex items-center justify-between bg-[#0D1117]">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName}
              className="w-10 h-10 rounded-full object-cover border border-[#30363D]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{currentUser.displayName}</h3>
                <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.2 rounded capitalize">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-400">{currentUser.email}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#21262D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 px-4 py-2 text-xs font-semibold flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            <span>{toast}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Apariencia -> Tema (§5.9) */}
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
              Apariencia
            </span>
            <div className="grid grid-cols-3 gap-2 bg-[#0D1117] p-1.5 rounded-xl border border-[#30363D]">
              <button
                type="button"
                onClick={() => updateSetting('theme', 'dark', 'Tema oscuro activado')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-colors ${
                  settings.theme === 'dark' ? 'bg-[#21262D] text-amber-400 border border-amber-500/30 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Oscuro</span>
              </button>
              <button
                type="button"
                onClick={() => updateSetting('theme', 'light', 'Tema claro configurado')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-colors ${
                  settings.theme === 'light' ? 'bg-[#21262D] text-amber-400 border border-amber-500/30 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => updateSetting('theme', 'system', 'Tema sistema configurado')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-colors ${
                  settings.theme === 'system' ? 'bg-[#21262D] text-amber-400 border border-amber-500/30 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Sistema</span>
              </button>
            </div>
          </div>

          {/* Ajustes Globales de Negocio (Solo Admin §5.9) */}
          {currentUser.role === 'admin' ? (
            <div className="space-y-4 pt-2 border-t border-[#30363D]/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ajustes de Administrador
                </span>
              </div>

              {/* historyEnabled */}
              <div className="p-3.5 bg-[#0D1117] border border-[#30363D] rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-white">Historial de compra</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Habilita o deshabilita la pestaña "Mis órdenes" para todos los compradores.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting(
                    'historyEnabled',
                    !settings.historyEnabled,
                    `Historial de compra ${!settings.historyEnabled ? 'habilitado' : 'deshabilitado'}`
                  )}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                    settings.historyEnabled ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-[#0D1117] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.historyEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* buyersViewHistory (Solo visible si historyEnabled) */}
              {settings.historyEnabled && (
                <div className="p-3.5 bg-[#0D1117] border border-[#30363D] rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-white">Ver solo tus items</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {settings.buyersViewHistory
                        ? 'Los compradores ven su historial con solo sus items.'
                        : 'Los compradores ven el detalle completo de cada orden, incluyendo lo de otros.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting(
                      'buyersViewHistory',
                      !settings.buyersViewHistory,
                      settings.buyersViewHistory
                        ? 'Compradores verán el detalle completo'
                        : 'Compradores verán solo sus items'
                    )}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      settings.buyersViewHistory ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-[#0D1117] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        settings.buyersViewHistory ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-[#0D1117] border border-[#30363D] rounded-xl text-xs text-slate-500">
              Próximamente podrás configurar ajustes de la aplicación.
            </div>
          )}

          {/* Proxy y Herramientas (§5.9) */}
          <div className="space-y-3 pt-2 border-t border-[#30363D]/60">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Red & Rendimiento
            </span>

            {/* Proxy toggle */}
            <div className="p-3.5 bg-[#0D1117] border border-[#30363D] rounded-xl flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Proxy de descargas</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Usa proxy CORS para consultar el catálogo de Card Kingdom (recomendado en web).
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateSetting('useProxy', !settings.useProxy, `Proxy ${!settings.useProxy ? 'activado' : 'desactivado'}`)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                  settings.useProxy ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`bg-[#0D1117] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.useProxy ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Clear Image Cache */}
            <button
              type="button"
              onClick={handleClearImageCache}
              className="w-full p-3 bg-[#0D1117] hover:bg-[#21262D] border border-[#30363D] rounded-xl flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Image className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Limpiar caché de imágenes</span>
                  <span className="text-[11px] text-slate-500">Libera espacio en memoria y disco</span>
                </div>
              </div>
              <span className="text-xs text-amber-400 font-medium">Limpiar</span>
            </button>
          </div>

          {/* Conmutador de Sesión de Prueba & Logout */}
          <div className="pt-2 border-t border-[#30363D]/60 space-y-2">
            <button
              type="button"
              onClick={() => setShowSwitchUser(!showSwitchUser)}
              className="w-full py-2 px-3 bg-[#21262D] hover:bg-[#30363D] text-xs font-semibold text-slate-300 rounded-xl border border-[#30363D] transition-colors flex items-center justify-between"
            >
              <span>Cambiar cuenta activa (Simulador Google Auth)</span>
              <span className="text-amber-400 font-bold">{showSwitchUser ? '▲' : '▼'}</span>
            </button>

            {showSwitchUser && (
              <div className="p-2 bg-[#0D1117] border border-[#30363D] rounded-xl space-y-1">
                {allUsers.map((u) => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => {
                      onSwitchSession(u.uid);
                      onClose();
                    }}
                    className={`w-full p-2 rounded-lg flex items-center justify-between text-left text-xs transition-colors ${
                      u.uid === currentUser.uid ? 'bg-amber-400 text-[#0D1117] font-bold' : 'hover:bg-[#161B22] text-slate-300'
                    }`}
                  >
                    <span>{u.displayName} ({u.role})</span>
                    <span className="text-[10px] font-mono">${u.balance.toFixed(2)} USD</span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 px-3 bg-red-950/30 hover:bg-red-900/40 text-red-300 text-xs font-bold rounded-xl border border-red-500/30 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
