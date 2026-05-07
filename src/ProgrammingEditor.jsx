import React, { useState, useMemo, useEffect } from 'react';
import { ORDEM_TEXTO_BAIXO_CIMA, getContatosIniciais } from './constants';

// ─── CONTACT ROW ─────────────────────────────────────────────────────────────
// Displays one contact with a polarity cycle button and optional % input.
// Convention: positive % = cathode (−), negative % = anode (+), blank = off.
const ContactRow = ({ label, contact, onChange, suggestedPerc }) => {
  const { state, perc } = contact;

  const cycle = () => {
    if (state === 'off') onChange({ state: '-', perc: suggestedPerc ?? 100 });
    else if (state === '-') onChange({ state: '+', perc: 100 });
    else onChange({ state: 'off', perc: 100 });
  };

  const colorMap = {
    off: 'bg-slate-100 text-slate-400 border-slate-200',
    '-':  'bg-blue-100 text-blue-700 border-blue-300',
    '+':  'bg-rose-100 text-rose-600 border-rose-300',
  };
  const symbolMap = { off: '∅', '-': '−', '+': '+' };

  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-mono text-slate-400 w-8 text-right shrink-0">{label}</span>
      <button onClick={cycle}
        className={`w-7 h-6 rounded border text-[11px] font-bold transition-all ${colorMap[state]}`}>
        {symbolMap[state]}
      </button>
      {state !== 'off' ? (
        <div className="flex items-center gap-0.5">
          <input
            type="number" min={1} max={100} step={1}
            value={perc}
            onChange={e => {
              const v = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
              onChange({ state, perc: v });
            }}
            onFocus={e => e.target.select()}
            className="w-12 text-right text-[10px] font-mono bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
          <span className="text-[8px] text-slate-400">%</span>
        </div>
      ) : (
        <span className="w-14 text-[9px] text-slate-300 ml-0.5 select-none">—</span>
      )}
    </div>
  );
};

// ─── PROGRAM EDITOR (one E or D within a group) ──────────────────────────────
const ProgramEditor = ({ label, prog, onChange, tipoEletrodo, modoAmplitude }) => {
  const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEletrodo] || ['0','1','2','3'];

  // Compute how much cathode % is already allocated
  const allocatedCathodePerc = useMemo(() => {
    return ordem.reduce((sum, key) => {
      const c = prog.contatos?.[key];
      return c?.state === '-' ? sum + (c.perc || 100) : sum;
    }, 0);
  }, [prog.contatos, ordem]);

  const setContact = (key, newContact) => {
    onChange({ ...prog, contatos: { ...prog.contatos, [key]: newContact } });
  };

  const totalCathode = allocatedCathodePerc;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>

      {/* Contacts */}
      <div className="flex flex-col gap-0.5 bg-slate-50 rounded-lg p-2 border border-slate-100">
        {ordem.map((key, i) => {
          const contact = prog.contatos?.[key] || { state: 'off', perc: 100 };
          // Suggest remaining cathode % for next unfilled cathode contact
          const remainingForSuggestion = contact.state === 'off' && totalCathode < 100
            ? 100 - totalCathode : undefined;
          return (
            <ContactRow key={key}
              label={`R${key}`}
              contact={contact}
              onChange={newC => setContact(key, newC)}
              suggestedPerc={remainingForSuggestion}
            />
          );
        })}
        {/* % balance indicator */}
        {totalCathode > 0 && (
          <div className={`text-[8px] font-mono mt-0.5 pl-9 ${totalCathode === 100 ? 'text-emerald-500' : totalCathode > 100 ? 'text-rose-500' : 'text-amber-500'}`}>
            Σ cátodo: {totalCathode}% {totalCathode === 100 ? '✓' : totalCathode > 100 ? '⚠ >100%' : `(faltam ${100-totalCathode}%)`}
          </div>
        )}
      </div>

      {/* Amp / PW / Freq */}
      <div className="grid grid-cols-3 gap-1">
        {[
          { key:'amp',  label: modoAmplitude||'mA', step:0.1, min:0, max:12  },
          { key:'pw',   label:'µs',                 step:10,  min:30, max:210 },
          { key:'freq', label:'Hz',                 step:5,   min:60, max:250 },
        ].map(({ key, label, step, min, max }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-400 text-center">{label}</span>
            <input type="number" min={min} max={max} step={step}
              value={prog[key] || ''}
              onChange={e => onChange({ ...prog, [key]: parseFloat(e.target.value) || 0 })}
              onFocus={e => e.target.select()}
              className="w-full text-center text-[10px] font-mono bg-white border border-slate-200 rounded py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Fix the render bug above (removed the broken useMemo arrow)
// ContactRow already handles the logic correctly.

// ─── PROGRAMMING EDITOR ──────────────────────────────────────────────────────
export const ProgrammingEditor = ({
  dadosGrupos,
  setDadosGrupos,
  tipoEletrodo = '4-ring',
  modoAmplitude = 'mA',
  sessaoAnteriorGrupos = null,  // for "copy previous" button
}) => {
  const [activeGroup, setActiveGroup] = useState('A');
  const [swapFrom, setSwapFrom] = useState('A');
  const [swapTo, setSwapTo] = useState('D');

  const grupo = dadosGrupos?.[activeGroup] || { L: [], R: [] };
  const grupos = ['A','B','C','D'];

  const makeEmptyProg = () => ({
    contatos: getContatosIniciais(tipoEletrodo),
    amp: 0, pw: 60, freq: 130, efeito: 'neutro',
  });

  const setPrograma = (side, idx, newProg) => {
    setDadosGrupos(prev => {
      const g = JSON.parse(JSON.stringify(prev[activeGroup] || { L:[makeEmptyProg()], R:[makeEmptyProg()] }));
      if (!Array.isArray(g[side])) g[side] = [makeEmptyProg()];
      while (g[side].length <= idx) g[side].push(makeEmptyProg());
      g[side][idx] = newProg;
      return { ...prev, [activeGroup]: g };
    });
  };

  const toggleInterleaving = (side) => {
    setDadosGrupos(prev => {
      const g = JSON.parse(JSON.stringify(prev[activeGroup] || { L:[makeEmptyProg()], R:[makeEmptyProg()] }));
      if (!Array.isArray(g[side])) g[side] = [makeEmptyProg()];
      if (g[side].length >= 2) g[side] = [g[side][0]];
      else g[side].push(makeEmptyProg());
      return { ...prev, [activeGroup]: g };
    });
  };

  const swapGroups = () => {
    if (swapFrom === swapTo) return;
    setDadosGrupos(prev => {
      const next = { ...prev };
      [next[swapFrom], next[swapTo]] = [
        JSON.parse(JSON.stringify(next[swapTo] || { L:[makeEmptyProg()], R:[makeEmptyProg()] })),
        JSON.parse(JSON.stringify(next[swapFrom] || { L:[makeEmptyProg()], R:[makeEmptyProg()] })),
      ];
      return next;
    });
  };

  const copyFromPrevious = () => {
    if (!sessaoAnteriorGrupos) return;
    setDadosGrupos(prev => {
      const next = { ...prev };
      grupos.forEach(g => {
        if (sessaoAnteriorGrupos[g]) {
          next[g] = JSON.parse(JSON.stringify(sessaoAnteriorGrupos[g]));
        }
      });
      return next;
    });
  };

  const groupHasData = (g) => {
    const gd = dadosGrupos?.[g];
    if (!gd) return false;
    return (gd.L||[]).some(p => p.amp > 0) || (gd.R||[]).some(p => p.amp > 0);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Group tab bar */}
      <div className="flex items-center gap-1 flex-wrap">
        {grupos.map(g => (
          <button key={g} onClick={() => setActiveGroup(g)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${activeGroup === g
              ? 'bg-indigo-600 text-white border-indigo-400'
              : groupHasData(g)
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:border-indigo-400'
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400'
            }`}>
            Grupo {g}
            {groupHasData(g) && <span className="ml-1 text-[7px]">●</span>}
          </button>
        ))}

        {/* Swap groups */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[8px] text-slate-400">Permutar</span>
          {['from','to'].map((which) => (
            <select key={which}
              value={which === 'from' ? swapFrom : swapTo}
              onChange={e => which === 'from' ? setSwapFrom(e.target.value) : setSwapTo(e.target.value)}
              className="text-[9px] bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none">
              {grupos.map(g => <option key={g}>{g}</option>)}
            </select>
          ))}
          <button onClick={swapGroups}
            title="Trocar os dois grupos entre si"
            className="text-[9px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 rounded px-2 py-0.5 transition-all">
            ⇄
          </button>
        </div>
      </div>

      {/* E / D columns */}
      <div className="grid grid-cols-2 gap-3">
        {[['L','E'], ['R','D']].map(([side, label]) => {
          const progs = grupo[side] || [makeEmptyProg()];
          return (
            <div key={side} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Lead {label}</span>
                <button onClick={() => toggleInterleaving(side)}
                  className={`text-[8px] font-bold px-1.5 py-0.5 rounded border transition-all ${progs.length >= 2
                    ? 'bg-violet-100 text-violet-600 border-violet-300'
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-400'}`}>
                  {progs.length >= 2 ? '↔ 2 progs' : '+ Interleav.'}
                </button>
              </div>
              {progs.map((prog, idx) => (
                <ProgramEditor
                  key={idx}
                  label={progs.length > 1 ? `Programa ${idx + 1}` : undefined}
                  prog={prog}
                  onChange={newProg => setPrograma(side, idx, newProg)}
                  tipoEletrodo={tipoEletrodo}
                  modoAmplitude={modoAmplitude}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Copy from previous session */}
      {sessaoAnteriorGrupos && (
        <button onClick={copyFromPrevious}
          className="w-full py-1.5 rounded-lg text-[10px] font-bold border border-dashed border-indigo-200 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
          ⬇ Copiar programação da sessão anterior
        </button>
      )}
    </div>
  );
};
