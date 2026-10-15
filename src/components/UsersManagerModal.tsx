import React, { useState } from 'react';
import { X, ShieldCheck, UserCheck, AlertTriangle, Plus, Minus, History, Check, DollarSign, Search } from 'lucide-react';
import { UserProfile, BalanceMovement } from '../types/purchases';
import { storeService } from '../services/storeService';

interface UsersManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

export const UsersManagerModal: React.FC<UsersManagerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<UserProfile[]>(() => storeService.getAllUsers());
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState('');

  // Balance dialog states
  const [balanceAction, setBalanceAction] = useState<'add' | 'outflow' | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDescription, setBalanceDescription] = useState('');
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Movements dialog state
  const [showMovements, setShowMovements] = useState(false);
  const [movements, setMovements] = useState<BalanceMovement[]>([]);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const reloadUsers = () => {
    const list = storeService.getAllUsers();
    setUsers(list);
    if (selectedUser) {
      const refreshed = list.find(u => u.uid === selectedUser.uid);
      setSelectedUser(refreshed || null);
    }
  };

  if (!isOpen) return null;

  // Check admin guard (§5.7)
  if (currentUser.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Acceso Restringido</h3>
          <p className="text-sm text-slate-400 mb-6">No tienes permisos de Administrador para gestionar usuarios.</p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#21262D] hover:bg-[#30363D] text-white text-sm font-semibold rounded-lg border border-[#30363D]"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const unconfirmedCount = users.filter(u => u.status === 'unconfirmed').length;
  const filteredUsers = users.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirmUser = (uid: string, name: string) => {
    storeService.confirmUser(uid);
    reloadUsers();
    showToast(`Usuario ${name} confirmado exitosamente`);
  };

  const handleSaveBalanceMutation = () => {
    if (!selectedUser) return;
    const amount = parseFloat(balanceAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setBalanceError('Ingresa un monto válido mayor a 0');
      return;
    }
    if (!balanceDescription.trim()) {
      setBalanceError('La descripción es obligatoria');
      return;
    }

    if (balanceAction === 'add') {
      const res = storeService.addBalance(selectedUser.email, amount, balanceDescription, currentUser.email);
      if (res.success) {
        showToast(`Se agregaron $${amount.toFixed(2)} USD a ${selectedUser.displayName}`);
        setBalanceAction(null);
        setBalanceAmount('');
        setBalanceDescription('');
        setBalanceError(null);
        reloadUsers();
      } else {
        setBalanceError(res.message || 'Error al agregar saldo');
      }
    } else if (balanceAction === 'outflow') {
      if (amount > selectedUser.balance) {
        setBalanceError('No puede superar el saldo actual');
        return;
      }
      const res = storeService.outflowBalance(selectedUser.email, amount, balanceDescription, currentUser.email);
      if (res.success) {
        showToast(`Salida de $${amount.toFixed(2)} USD registrada para ${selectedUser.displayName}`);
        setBalanceAction(null);
        setBalanceAmount('');
        setBalanceDescription('');
        setBalanceError(null);
        reloadUsers();
      } else {
        setBalanceError(res.message || 'Error al registrar salida');
      }
    }
  };

  const handleOpenMovements = (user: UserProfile) => {
    const list = storeService.getBalanceMovements(user.email);
    setMovements(list);
    setShowMovements(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-4xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#30363D] flex items-center justify-between bg-[#0D1117]">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">Gestión de Usuarios</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {users.length} usuario{users.length === 1 ? '' : 's'} registrados
              {unconfirmedCount > 0 && (
                <span className="text-amber-400 font-semibold ml-1.5">
                  · {unconfirmedCount} sin confirmar
                </span>
              )}
            </p>
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

        {/* Content split */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5">
          
          {/* Left Column: User List (3 cols) */}
          <div className="md:col-span-3 border-r border-[#30363D] flex flex-col overflow-hidden bg-[#0D1117]/50">
            {/* Search */}
            <div className="p-3 border-b border-[#30363D]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#161B22] border border-[#30363D] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#30363D]/60 p-2 space-y-1">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No se encontraron usuarios
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedUser?.uid === u.uid;
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => setSelectedUser(u)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#21262D] border border-amber-400/50 shadow-sm'
                          : 'hover:bg-[#161B22]/80 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={u.photoURL}
                          alt={u.displayName}
                          className="w-10 h-10 rounded-full object-cover border border-[#30363D] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white truncate">{u.displayName}</span>
                            {u.role === 'admin' && (
                              <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.2 rounded">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 truncate block">{u.email}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-xs font-mono font-bold ${u.balance > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          ${u.balance.toFixed(2)} USD
                        </div>
                        <span
                          className={`inline-block text-[10px] font-semibold mt-0.5 px-2 py-0.5 rounded-full ${
                            u.status === 'confirmed'
                              ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-950/50 text-amber-400 border border-amber-500/40'
                          }`}
                        >
                          {u.status === 'confirmed' ? 'Confirmado' : 'Sin confirmar'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: User Detail & Actions (2 cols) */}
          <div className="md:col-span-2 p-4 sm:p-5 overflow-y-auto bg-[#161B22]">
            {selectedUser ? (
              <div className="space-y-5">
                {/* User Profile Header */}
                <div className="flex items-center gap-3">
                  <img
                    src={selectedUser.photoURL}
                    alt={selectedUser.displayName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-400/40"
                  />
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedUser.displayName}</h3>
                    <p className="text-xs text-slate-400">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-semibold text-slate-300 capitalize">
                        {selectedUser.role}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedUser.status === 'confirmed'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {selectedUser.status === 'confirmed' ? 'Confirmado' : 'Sin confirmar'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* If unconfirmed, show confirm button (§3.2 & §5.8) */}
                {selectedUser.status === 'unconfirmed' && (
                  <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl">
                    <p className="text-xs text-amber-300 mb-2.5">
                      Este usuario está esperando confirmación para poder agregar cartas a órdenes activas.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleConfirmUser(selectedUser.uid, selectedUser.displayName)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-lg transition-colors shadow-sm"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Confirmar usuario</span>
                    </button>
                  </div>
                )}

                {/* Balance Card */}
                <div className="p-4 bg-[#0D1117] border border-[#30363D] rounded-xl space-y-3">
                  <span className="text-xs text-slate-400 font-medium block">Saldo a Favor en Perfil</span>
                  <div className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
                    ${selectedUser.balance.toFixed(2)} <span className="text-sm font-sans font-medium text-slate-400">USD</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    El saldo a favor se acumula automáticamente al finalizar órdenes con excedentes, o mediante abonos directos.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#30363D]">
                    <button
                      type="button"
                      onClick={() => {
                        setBalanceAction('add');
                        setBalanceAmount('');
                        setBalanceDescription('');
                        setBalanceError(null);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#21262D] hover:bg-[#30363D] text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar saldo</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedUser.balance <= 0}
                      onClick={() => {
                        setBalanceAction('outflow');
                        setBalanceAmount('');
                        setBalanceDescription('');
                        setBalanceError(null);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#21262D] hover:bg-[#30363D] disabled:opacity-40 disabled:pointer-events-none text-red-300 text-xs font-semibold rounded-lg border border-red-500/30"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>Registrar salida</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenMovements(selectedUser)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Ver historial de movimientos</span>
                  </button>
                </div>

                {/* Balance Action Dialog inline */}
                {balanceAction && (
                  <div className="p-3.5 bg-[#0D1117] border border-amber-500/40 rounded-xl space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {balanceAction === 'add' ? 'Agregar Saldo a Favor' : 'Registrar Salida de Saldo'}
                      </span>
                      <button
                        onClick={() => setBalanceAction(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Monto ($ USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={balanceAction === 'outflow' ? selectedUser.balance : undefined}
                        placeholder="Ej. 10.50"
                        value={balanceAmount}
                        onChange={(e) => setBalanceAmount(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#161B22] border border-[#30363D] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Descripción (obligatoria)</label>
                      <input
                        type="text"
                        placeholder="Ej. Devolución de carta agotada"
                        value={balanceDescription}
                        onChange={(e) => setBalanceDescription(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#161B22] border border-[#30363D] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {balanceError && (
                      <p className="text-[11px] text-red-400 font-medium">{balanceError}</p>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setBalanceAction(null)}
                        className="px-3 py-1.5 bg-[#21262D] text-slate-300 text-xs rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBalanceMutation}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#0D1117] text-xs font-bold rounded-lg"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <DollarSign className="w-10 h-10 mb-2 opacity-40 text-amber-400" />
                <p className="text-xs">Selecciona un usuario para ver su detalle, confirmar cuenta o gestionar saldo.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Movements History Modal */}
      {showMovements && selectedUser && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#30363D] mb-4">
              <h4 className="text-sm font-bold text-white">
                Movimientos de {selectedUser.displayName}
              </h4>
              <button
                onClick={() => setShowMovements(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-[#30363D]/60 pr-1">
              {movements.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Sin movimientos registrados</p>
              ) : (
                movements.map((m) => (
                  <div key={m.id} className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-slate-200 font-medium">{m.description}</p>
                      <span className="text-[10px] text-slate-500">
                        {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {m.registeredBy && ` · ${m.registeredBy}`}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        m.type === 'credit' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {m.type === 'credit' ? `+$${m.amount.toFixed(2)}` : `-$${m.amount.toFixed(2)}`}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#30363D] text-right">
              <button
                type="button"
                onClick={() => setShowMovements(false)}
                className="px-4 py-1.5 bg-[#21262D] hover:bg-[#30363D] text-xs font-semibold text-white rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
