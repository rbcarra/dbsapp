import React from 'react';
import { MDS_PART_META } from './mdsUpdrsData';

// ─── MDS-UPDRS Parte I / II / IV — modal genérico ─────────────────────────────
// Estado é EXTERNO (vem do App) para persistir em memória entre aberturas.
// scores: { [itemId]: 0-4 }  |  onScoresChange(newScores)  |  onInserir(text)
export const MdsUpdrsModal = ({ parte, scores, onScoresChange, onInserir, onClose }) => {
  const meta = MDS_PART_META[parte];
  if (!meta) return null;
  const { titulo, subtitulo, items, max, prefix } = meta;

  const total = items.reduce((sum, it) => sum + (scores[it.id] ?? 0), 0);
  const preenchidos = items.filter(it => scores[it.id] !== undefined && scores[it.id] !== null).length;
  const details = items.map(it => `${it.id}:${scores[it.id] ?? '-'}`).join(' ');
  const resultText = `${prefix} total: ${total}/${max} | ${details}`;

  const setScore = (id, val) => onScoresChange({ ...scores, [id]: val });
  const limpar = () => onScoresChange({});

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-teal-700 text-white rounded-t-2xl shrink-0">
          <div>
            <h2 className="font-bold text-sm">{titulo}</h2>
            <p className="text-[10px] text-teal-200">{subtitulo} · passe o mouse para ver os critérios</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-black bg-teal-600 px-3 py-1 rounded-lg">{total}<span className="text-xs text-teal-200">/{max}</span></span>
            <button onClick={onClose} className="text-white hover:text-teal-200 text-xl font-bold leading-none">×</button>
          </div>
        </div>

        {/* Scrollable items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-2 mb-1">
              <div className="text-xs font-bold text-slate-700 mb-1.5">{item.id}. {item.name}</div>
              <div className="flex flex-wrap gap-1">
                {item.opts.map((label, idx) => (
                  <button key={idx}
                    onClick={() => setScore(item.id, idx)}
                    title={item.desc?.[idx] || ''}
                    className={`flex-1 min-w-[70px] px-2 py-1.5 rounded text-[10px] border transition-all ${
                      scores[item.id] === idx
                        ? 'bg-teal-500 text-white border-teal-500 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400'
                    }`}>
                    <span className="block font-bold text-[11px]">{idx}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t bg-white px-4 py-3 flex items-center gap-2">
          <span className="text-[10px] text-slate-400 shrink-0">{preenchidos}/{items.length}</span>
          <div className="flex-1 font-mono text-[10px] text-slate-600 bg-slate-100 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
            {resultText}
          </div>
          <button onClick={limpar}
            className="text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-2 rounded-lg shrink-0">
            🗑 Limpar
          </button>
          <button onClick={() => { navigator.clipboard.writeText(resultText); }}
            className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg shrink-0">
            📋 Copiar
          </button>
          <button onClick={() => { onInserir(resultText); onClose(); }}
            className="text-[10px] font-bold bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg shrink-0">
            ✓ Inserir
          </button>
        </div>
      </div>
    </div>
  );
};
