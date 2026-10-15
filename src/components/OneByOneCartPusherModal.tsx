import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { UserCart } from '../types/card';
import { CARD_KINGDOM_DECKBUILDER_URL } from '../services/cardKingdom';

interface OneByOneCartPusherModalProps {
  userCarts: UserCart[];
  onClose: () => void;
}

interface QueueItem {
  id: string;
  name: string;
  setName: string;
  condition: string;
  quantity: number;
  priceUsd: number;
  isFoil: boolean;
  user: string;
  status: 'pending' | 'processing' | 'success' | 'warning';
  message?: string;
}

export const OneByOneCartPusherModal: React.FC<OneByOneCartPusherModalProps> = ({
  userCarts,
  onClose,
}) => {
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    const list: QueueItem[] = [];
    userCarts.forEach(u => {
      u.items.forEach(i => {
        list.push({
          id: `${u.userId}-${i.id}`,
          name: i.name,
          setName: i.setName,
          condition: i.condition,
          quantity: i.quantity,
          priceUsd: i.priceUsd,
          isFoil: i.isFoil,
          user: u.userName,
          status: 'pending'
        });
      });
    });
    return list;
  });

  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(750);

  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  useEffect(() => {
    let timeoutId: any;

    if (isRunning && currentIndex < queue.length) {
      if (currentIndex === -1) {
        setCurrentIndex(0);
        return;
      }

      setQueue(prev =>
        prev.map((item, idx) => (idx === currentIndex ? { ...item, status: 'processing' } : item))
      );

      timeoutId = setTimeout(() => {
        if (!isRunningRef.current) return;

        setQueue(prev =>
          prev.map((item, idx) =>
            idx === currentIndex
              ? {
                  ...item,
                  status: 'success',
                  message: `Añadida al carrito: ${item.quantity}x ${item.name} (${item.condition})`
                }
              : item
          )
        );

        if (currentIndex + 1 < queue.length) {
          setCurrentIndex(currentIndex + 1);
        } else {
          setIsRunning(false);
          setIsCompleted(true);
        }
      }, speedMs);
    }

    return () => clearTimeout(timeoutId);
  }, [isRunning, currentIndex, queue.length, speedMs]);

  const handleStart = () => {
    if (currentIndex === -1) setCurrentIndex(0);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const completedCount = queue.filter(q => q.status === 'success').length;
  const progressPercent = queue.length > 0 ? Math.round((completedCount / queue.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1117]/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full mb-1">
              <span>Automatización Desatendida Secuencial</span>
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-amber-400 fill-current" />
              <span>Lanzador de Cartas 1 a 1 a Card Kingdom</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Inserta cada carta individualmente en el carrito online de Card Kingdom con su estado y edición exacta.
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

        {/* Progress & Speed Toolbar */}
        <div className="py-4 border-b border-[#30363D] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-400">Progreso: </span>
            <span className="font-mono font-bold text-white tabular-nums">
              {completedCount} / {queue.length} cartas
            </span>
            <span className="text-amber-400 font-mono font-semibold ml-2">
              ({progressPercent}%)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-[11px] font-medium">Intervalo orgánico:</span>
            <div className="flex items-center gap-1 bg-[#0D1117] p-1 rounded-lg border border-[#30363D] font-mono text-[11px]">
              {[
                { label: '400ms (Rápido)', ms: 400 },
                { label: '750ms (Normal)', ms: 750 },
                { label: '1500ms (Seguro)', ms: 1500 },
              ].map(opt => (
                <button
                  key={opt.ms}
                  type="button"
                  onClick={() => setSpeedMs(opt.ms)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    speedMs === opt.ms ? 'bg-amber-400 text-[#0D1117] font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#0D1117] h-2.5 rounded-full overflow-hidden my-3 border border-[#30363D]">
          <div
            className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        {/* Queue List View */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
          {queue.map((item, idx) => {
            const isCurrent = idx === currentIndex && isRunning;
            const isDone = item.status === 'success';

            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                  isCurrent
                    ? 'bg-amber-500/15 border-amber-400 text-white'
                    : isDone
                    ? 'bg-[#0D1117] border-[#30363D] text-slate-300'
                    : 'bg-[#0D1117]/40 border-[#30363D]/40 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-mono text-[11px] bg-[#21262D]">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isCurrent ? (
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : (
                      <span className="text-slate-500">{idx + 1}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">{item.name}</span>
                      <span className="font-mono text-amber-300 font-bold">
                        {item.quantity}x [{item.condition}]
                      </span>
                      {item.isFoil && (
                        <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1 rounded font-bold">
                          Foil
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {item.setName} · Miembro: <span className="text-slate-300 font-medium">{item.user}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono ml-4">
                  <span className="font-semibold text-emerald-400 tabular-nums">
                    ${(item.priceUsd * item.quantity).toFixed(2)}
                  </span>
                  <div className="text-[10px] text-slate-400">
                    {item.status === 'processing'
                      ? 'Lanzando...'
                      : item.status === 'success'
                      ? 'Agregada ✅'
                      : 'En espera'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#30363D] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Evita bloqueos de Card Kingdom enviando cada carta con retraso orgánico.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isCompleted ? (
              isRunning ? (
                <button
                  type="button"
                  onClick={handlePause}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#21262D] hover:bg-[#30363D] text-slate-200 text-xs font-semibold rounded-lg border border-[#30363D] transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStart}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-[#0D1117] text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{currentIndex === -1 ? 'Iniciar Carga 1 a 1' : 'Reanudar'}</span>
                </button>
              )
            ) : (
              <a
                href={CARD_KINGDOM_DECKBUILDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-[#0D1117] text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                <span>¡Carga Completa! Abrir Carrito Card Kingdom</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
