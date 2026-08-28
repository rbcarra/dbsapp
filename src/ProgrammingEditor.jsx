import React, { useState } from 'react';
import { getEletrodo, criarProgramaVazio } from './constants';

const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden';

// ─── CONTACT CELL ─────────────────────────────────────────────────────────────
const ContactCell = ({ label, contact, onChange, suggestedPerc, compacto }) => {
  const state = contact?.state ?? 'off';
  const perc  = contact?.perc  ?? 100;
  const cycle = () => {
    if (state === 'off') onChange({ state: '-', perc: suggestedPerc ?? 100 });
    else if (state === '-') onChange({ state: '+', perc: 100 });
    else onChange({ state: 'off', perc: 100 });
  };
  const bg = state === '-' ? 'bg-blue-500/40 border-blue-400 text-blue-200'
           : state === '+' ? 'bg-rose-500/40 border-rose-400 text-rose-200'
           :                 'bg-slate-700/50 border-slate-600 text-slate-400';
  const w = compacto ? 'w-6' : 'w-8';
  return (
    <div className="flex flex-col items-center gap-px">
      <button onClick={cycle} title={label}
        className={`${w} h-5 rounded border text-[10px] font-bold transition-all select-none ${bg}`}>
        {state === 'off' ? label : state === '-' ? '−' : '+'}
      </button>
      {state !== 'off' && (
        <input type="number" min={1} max={100} step={1} value={perc}
          onChange={e => onChange({ state, perc: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)) })}
          onFocus={e => e.target.select()}
          className={`${w} text-center text-[8px] font-mono bg-slate-800 border border-slate-600 rounded text-white ${noSpin}`}/>
      )}
    </div>
  );
};

// ─── SINGLE PROGRAM ROW (lead label + contacts + params + cycling) ─────────────
const ProgramRow = ({ label, prog, onChange, onRemove, tipoEletrodo, modoAmplitude, canRemove }) => {
  const el = getEletrodo(tipoEletrodo);
  const compacto = el.nContatos > 8;                     // Cartesia X / HX

  const totalCat = el.ordemBaixoCima.reduce((s, k) => {
    const c = prog.contatos?.[k];
    return c?.state === '-' ? s + (c.perc || 100) : s;
  }, 0);

  const setContact = (key, newC) => onChange({ ...prog, contatos: { ...prog.contatos, [key]: newC } });
  const paramCls = `w-10 text-center text-[10px] font-mono bg-slate-800 border border-slate-700 rounded px-0.5 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-600 ${noSpin}`;

  return (
    <div className="flex items-end gap-1 flex-wrap">
      <span className="text-[9px] font-bold text-slate-400 w-6 shrink-0 pb-1">{label}</span>

      {/* Contatos agrupados por nível, do distal (esq.) ao proximal (dir.) */}
      <div className="flex gap-1.5 flex-wrap items-end">
        {el.niveis.map(nivel => (
          <div key={nivel.idx} className="flex flex-col items-center gap-px">
            <div className="flex gap-px">
              {nivel.contatos.map(key => {
                const c = prog.contatos?.[key] || { state: 'off', perc: 100 };
                const remaining = totalCat < 100 && c.state === 'off' ? 100 - totalCat : undefined;
                // Direcional mostra a letra; anelar mostra o número do nível
                const cellLabel = nivel.tipo === 'dir' ? key.slice(String(nivel.idx).length) : String(nivel.idx);
                return (
                  <ContactCell key={key} label={cellLabel} contact={c} compacto={compacto}
                    onChange={nc => setContact(key, nc)} suggestedPerc={remaining}/>
                );
              })}
            </div>
            {el.temDirecional && (
              <span className="text-[6px] font-mono text-slate-600 leading-none">{nivel.idx}</span>
            )}
          </div>
        ))}
      </div>

      <span className="text-slate-700 pb-1 text-[10px] shrink-0">|</span>

      {/* Amp / PW / Freq */}
      <input type="number" value={prog.amp || ''} min={0} max={12} step={0.1}
        placeholder={modoAmplitude || 'mA'}
        onChange={e => onChange({ ...prog, amp: parseFloat(e.target.value) || 0 })}
        onFocus={e => e.target.select()} className={paramCls}/>
      <input type="number" value={prog.pw || ''} min={30} max={210} step={10}
        placeholder="µs"
        onChange={e => onChange({ ...prog, pw: parseInt(e.target.value) || 60 })}
        onFocus={e => e.target.select()} className={paramCls}/>
      <input type="number" value={prog.freq || ''} min={60} max={250} step={5}
        placeholder="Hz"
        onChange={e => onChange({ ...prog, freq: parseInt(e.target.value) || 130 })}
        onFocus={e => e.target.select()} className={paramCls}/>

      {/* Cycling per program */}
      <label className="flex items-center gap-0.5 cursor-pointer select-none pb-1" title="Cycling ativo neste programa">
        <input type="checkbox" checked={!!prog.cycling}
          onChange={e => onChange({ ...prog, cycling: e.target.checked })}
          className="accent-indigo-400 w-3 h-3 cursor-pointer"/>
        <span className="text-[7px] text-slate-500">cyc</span>
      </label>

      {/* Remove interleaving program */}
      {canRemove && (
        <button onClick={onRemove} className="text-[8px] text-slate-600 hover:text-rose-400 pb-1">✕</button>
      )}
    </div>
  );
};

// ─── ONE LEAD SECTION (E or D, with interleaving support) ────────────────────
const LeadSection = ({ sideLabel, progs, onChangeProgs, tipoEletrodo, modoAmplitude }) => {
  const makeEmpty = () => criarProgramaVazio(tipoEletrodo);

  const setProgAt = (idx, newProg) => {
    const next = [...progs];
    next[idx] = newProg;
    onChangeProgs(next);
  };
  const addInterleave = () => onChangeProgs([...progs, makeEmpty()]);
  const removeAt = (idx) => onChangeProgs(progs.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Lead {sideLabel}</span>
        {progs.length < 2 && (
          <button onClick={addInterleave}
            className="text-[7px] font-bold text-violet-400 hover:text-violet-300 border border-violet-700 hover:border-violet-500 rounded px-1.5 py-0.5 transition-all">
            +↔ interleav.
          </button>
        )}
      </div>
      {progs.map((prog, idx) => (
        <ProgramRow key={idx}
          label={progs.length > 1 ? `${sideLabel}${idx + 1}` : sideLabel}
          prog={prog}
          onChange={newP => setProgAt(idx, newP)}
          onRemove={() => removeAt(idx)}
          canRemove={progs.length > 1}
          tipoEletrodo={tipoEletrodo}
          modoAmplitude={modoAmplitude}/>
      ))}
    </div>
  );
};

// ─── GROUP CARD ───────────────────────────────────────────────────────────────
const GroupCard = ({ groupLabel, grupo, onChange, tipoEletrodo, modoAmplitude }) => {
  const makeEmpty = () => criarProgramaVazio(tipoEletrodo);
  const hasData = (grupo?.L || []).some(p => p.amp > 0) || (grupo?.R || []).some(p => p.amp > 0);
  const setProgs = (side, newProgs) => {
    const g = { L: grupo?.L || [makeEmpty()], R: grupo?.R || [makeEmpty()] };
    onChange({ ...g, [side]: newProgs });
  };

  return (
    <div className={`rounded-lg border flex flex-col ${hasData ? 'border-indigo-500/40 bg-indigo-950/30' : 'border-slate-700 bg-slate-900'}`}>
      <div className="px-2 py-1 border-b border-slate-700/60">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Grupo {groupLabel}</span>
        {hasData && <span className="text-indigo-400 text-[7px] ml-1">●</span>}
      </div>
      <div className="px-2 py-1.5 flex flex-col gap-2">
        {[['L', 'E'], ['R', 'D']].map(([side, lbl]) => (
          <LeadSection key={side}
            sideLabel={lbl}
            progs={grupo?.[side]?.length ? grupo[side] : [makeEmpty()]}
            onChangeProgs={newProgs => setProgs(side, newProgs)}
            tipoEletrodo={tipoEletrodo}
            modoAmplitude={modoAmplitude}/>
        ))}
      </div>
    </div>
  );
};

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export const ProgrammingEditor = ({
  dadosGrupos, setDadosGrupos,
  tipoEletrodo = '4-ring', modoAmplitude = 'mA',
  sessaoAnteriorGrupos = null,
}) => {
  const [swapFrom, setSwapFrom] = useState('A');
  const [swapTo,   setSwapTo]   = useState('D');
  const grupos = ['A', 'B', 'C', 'D'];
  const el = getEletrodo(tipoEletrodo);
  const makeEmpty = () => criarProgramaVazio(tipoEletrodo);

  const setGrupo = (g, newGrupo) => setDadosGrupos(prev => ({ ...(prev || {}), [g]: newGrupo }));

  const swapGroups = () => {
    if (swapFrom === swapTo) return;
    setDadosGrupos(prev => {
      const next = { ...(prev || {}) };
      [next[swapFrom], next[swapTo]] = [
        JSON.parse(JSON.stringify(next[swapTo]   || { L: [makeEmpty()], R: [makeEmpty()] })),
        JSON.parse(JSON.stringify(next[swapFrom] || { L: [makeEmpty()], R: [makeEmpty()] })),
      ];
      return next;
    });
  };

  const copyFromPrevious = () => {
    if (!sessaoAnteriorGrupos) return;
    setDadosGrupos(prev => {
      const next = { ...(prev || {}) };
      grupos.forEach(g => { if (sessaoAnteriorGrupos[g]) next[g] = JSON.parse(JSON.stringify(sessaoAnteriorGrupos[g])); });
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap text-[7px] text-slate-500">
        <span>Clique: <span className="bg-blue-500/30 text-blue-300 px-1 rounded">−</span> cátodo → <span className="bg-rose-500/30 text-rose-300 px-1 rounded">+</span> ânodo → ∅ off</span>
        <span className="text-slate-600">|</span>
        <span>% abaixo para MICC · mA · µs · Hz · cyc = cycling</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">{el.label} · {el.nContatos} contatos · {el.nNiveis} níveis</span>
      </div>

      {/* Groups — coluna única (serve para todos os eletrodos do registro) */}
      <div className="flex flex-col gap-2">
        {grupos.map(g => (
          <GroupCard key={g} groupLabel={g}
            grupo={dadosGrupos?.[g]}
            onChange={newG => setGrupo(g, newG)}
            tipoEletrodo={tipoEletrodo}
            modoAmplitude={modoAmplitude}/>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-700/40">
        <span className="text-[8px] text-slate-500">Permutar</span>
        <select value={swapFrom} onChange={e => setSwapFrom(e.target.value)}
          className="text-[9px] bg-slate-800 border border-slate-600 text-slate-300 rounded px-1 py-0.5 focus:outline-none">
          {grupos.map(g => <option key={g}>{g}</option>)}
        </select>
        <select value={swapTo} onChange={e => setSwapTo(e.target.value)}
          className="text-[9px] bg-slate-800 border border-slate-600 text-slate-300 rounded px-1 py-0.5 focus:outline-none">
          {grupos.map(g => <option key={g}>{g}</option>)}
        </select>
        <button onClick={swapGroups}
          className="text-[9px] font-bold bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-600/40 rounded px-2 py-0.5">⇄</button>
        {sessaoAnteriorGrupos && (
          <button onClick={copyFromPrevious}
            className="ml-auto text-[9px] font-bold text-indigo-400 hover:text-indigo-300 border border-indigo-700 hover:border-indigo-500 rounded px-2 py-0.5">
            ⬇ Copiar sessão anterior
          </button>
        )}
      </div>
    </div>
  );
};
