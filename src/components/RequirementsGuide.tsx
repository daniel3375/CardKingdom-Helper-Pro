import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, ArrowRight, Code, ShoppingCart, Layers, ShieldCheck, Cpu } from 'lucide-react';

interface Props {
  onGoToApp: () => void;
}

export const RequirementsGuide: React.FC<Props> = ({ onGoToApp }) => {
  const [copied, setCopied] = useState(false);

  // Questionnaire state to help user specify their project
  const [appType, setAppType] = useState<string>('webapp');
  const [currentMethod, setCurrentMethod] = useState<string>('deckbuilder_export');
  const [inputFormats, setInputFormats] = useState<string[]>(['moxfield', 'plaintext']);
  const [conditionStrategy, setConditionStrategy] = useState<string>('nm_with_fallback');

  const toggleInputFormat = (fmt: string) => {
    setInputFormats(prev => 
      prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
    );
  };

  const generateProjectBrief = () => {
    return `=== BRIEF DE REQUERIMIENTOS: RENOVACIÓN APP CARD KINGDOM ===
1. Tipo de aplicación deseada: ${appType}
2. Cómo opera o interactúa con Card Kingdom actualmente: ${currentMethod}
3. Formatos de listas de cartas a soportar: ${inputFormats.join(', ')}
4. Estrategia de estados (Condiciones NM, EX, VG, G): ${conditionStrategy}
=============================================================`;
  };

  const handleCopyBrief = () => {
    navigator.clipboard.writeText(generateProjectBrief());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Intro hero banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-3 py-1 rounded-full mb-4">
            <span>Guía de Planificación y Especificación Técnica</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 text-balance">
            Requerimientos para Renovar tu App de Compras en Card Kingdom
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl">
            Para diseñar y construir la versión perfecta, moderna, rápida y amigable de tu herramienta, 
            hemos desglosado los aspectos clave necesarios. Responde a estas preguntas o selecciona tus preferencias a continuación:
          </p>
        </div>
      </div>

      {/* 4 Essential Requirements Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        
        {/* Pilar 1 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
              <Code className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              1. Arquitectura de tu app actual
            </h2>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              ¿Cómo funciona técnicamente tu versión actual para comunicarse con Card Kingdom?
            </p>
            <ul className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Script local / Web scraper</strong> (Python, Node.js, Puppeteer, Selenium).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Extensión de navegador</strong> (Chrome / Tampermonkey) que interactúa con el carrito en la web de Card Kingdom.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Generador de importación masiva</strong> para el Deck Builder oficial de Card Kingdom.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Pilar 2 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              2. Formato de entrada de tus cartas
            </h2>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              ¿De dónde provienen tus listas o mazos habitualmente?
            </p>
            <ul className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Listas exportadas</strong> de Moxfield, Archidekt, ManaBox, Deckbox o MTGArena.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Archivos CSV / Excel</strong> con columnas de cantidad, nombre, edición y estado.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Texto plano rápido</strong> ("4 Lightning Bolt", "1 Sol Ring").</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Pilar 3 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              3. Reglas de compra y condiciones
            </h2>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              ¿Qué prioridades de optimización necesitas al comprar?
            </p>
            <ul className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span><strong>Condición preferida:</strong> Near Mint (NM), Excellent (EX), Very Good (VG), Good (G).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span><strong>Estrategia de Stock:</strong> Si NM está agotado, ¿aceptar automáticamente EX o alertar?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span><strong>Tratamientos:</strong> Foil, No-Foil, o la versión más económica disponible.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Pilar 4 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              4. Flujo de Carrito y Checkout
            </h2>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              ¿Hasta qué punto deseas automatizar el pedido?
            </p>
            <ul className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Modo Deck Builder (Recomendado):</strong> Copia con 1-click el formato optimizado y abre el importador de Card Kingdom.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Inyección directa al carrito:</strong> Requiere sesión iniciada en Card Kingdom o extensión de navegador.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Historial y Presupuesto:</strong> Guardar listas de compras recurrentes y comparar gastos.</span>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* Interactive Configurator / Brief Generator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Cpu className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">
            Configurador Rápido de tu Proyecto
          </h2>
        </div>

        <div className="space-y-6">
          {/* Question 1 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              1. ¿Qué tipo de interfaz prefieres para la nueva versión?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'webapp', title: 'Web App Moderna', desc: 'Accesible desde PC y móvil, sin instalación' },
                { id: 'extension', title: 'Extensión de Chrome', desc: 'Inyectada en la web de Card Kingdom' },
                { id: 'hybrid', title: 'Híbrida (Web + Tool)', desc: 'Web app con botones y exportador directo' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setAppType(opt.id)}
                  className={`p-3 text-left rounded-lg border transition-all ${
                    appType === opt.id
                      ? 'border-amber-400 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-semibold">{opt.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Question 2 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              2. ¿Cómo funciona o interactúa tu app actual con Card Kingdom?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'deckbuilder_export', title: 'Importador Deck Builder', desc: 'Usa https://cardkingdom.com/builder' },
                { id: 'scraper_bot', title: 'Bot / Web Scraping', desc: 'Consulta inventario y precios directamente' },
                { id: 'tampermonkey', title: 'Script de Usuario / Extensión', desc: 'Agrega al carrito con botones en el DOM' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setCurrentMethod(opt.id)}
                  className={`p-3 text-left rounded-lg border transition-all ${
                    currentMethod === opt.id
                      ? 'border-amber-400 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-semibold">{opt.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Question 3 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              3. Formatos de entrada que necesitas soportar (marca los que uses):
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'moxfield', label: 'Moxfield / Archidekt' },
                { id: 'plaintext', label: 'Texto plano (4 Lightning Bolt)' },
                { id: 'mtga', label: 'MTG Arena Export' },
                { id: 'csv', label: 'Excel / CSV' },
                { id: 'manabox', label: 'ManaBox App' }
              ].map(fmt => {
                const isSelected = inputFormats.includes(fmt.id);
                return (
                  <button
                    key={fmt.id}
                    onClick={() => toggleInputFormat(fmt.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 4 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              4. ¿Qué estrategia de condición de cartas prefieres?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'nm_only', title: 'Solo Near Mint (NM)', desc: 'No aceptar cartas en menor estado' },
                { id: 'nm_with_fallback', title: 'NM con fallback a EX', desc: 'Si NM no tiene stock, bajar a Excellent' },
                { id: 'cheapest', title: 'Cualquier estado (Más barata)', desc: 'Ahorrar al máximo sin importar desgaste' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setConditionStrategy(opt.id)}
                  className={`p-3 text-left rounded-lg border transition-all ${
                    conditionStrategy === opt.id
                      ? 'border-amber-400 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-semibold">{opt.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={handleCopyBrief}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors border border-slate-700"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">¡Copiado al portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Resumen para el Chat</span>
                </>
              )}
            </button>

            <button
              onClick={onGoToApp}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              <span>Probar Prototipo Actual del Asistente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
