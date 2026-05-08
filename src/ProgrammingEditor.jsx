import React, { useState } from 'react';
import { ORDEM_TEXTO_BAIXO_CIMA, getContatosIniciais } from './constants';

const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden';

const ContactCell = ({ label, contact, onChange, suggestedPerc }) => {
  const state = contact?.state ?? 'off';
  const perc  = contact?.perc  ?? 100;
  const cycle = () => {
    if (state === 'off') onChange({ state: '-', perc: suggestedPerc ?? 100 });
    else if (state === '-') onChange({ state: '+', perc: 100 });
    else onChange({ state: 'off', perc: 100 });
  };
  const bg = state === '-' ? 'bg-blue-500/40 border-blue-400 text-blue-200'
           : state === '+' ? 'bg-rose-500/40 border-rose-400 text-rose-200'
           : 'bg-slate-700/50 border-slate-600 text-slate-400';
  return (
    <div className="flex flex-col items-center gap-px">
      <button onClick={cycle}
        className={`w-8 h-5 rounded border text-[10px] font-bold transition-all select-none ${bg}`}>
        {state === 'off' ? label : state === '-' ? '−' : '+'}
      </button>
      {state !== 'off' && (
        <input type="number" min={1} max={100} step={1} value={perc}
          onChange={e => onChange({ state, perc: Math.min(100, Math.max(1, parseInt(e.target.value)||1)) })}
          onFocus={e => e.target.select()}
          className={`w-8 text-center text-[8px] font-mono bg-slate-800 border border-slate-600 rounded text-white ${noSpin}`}/>
      )}
    </div>
  );
};

const LeadRow = ({ label, prog, onChange, tipoEletrodo, modoAmplitude }) => {
  const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEletrodo] || ['0','1','2','3'];
  const totalCat = ordem.reduce((s, k) => {
    const c = prog.contatos?.[k];
    return c?.state === '-' ? s + (c.perc || 100) : s;
  }, 0);
  const setContact = (key, newC) => onChange({ ...prog, contatos: { ...prog.contatos, [key]: newC } });
  const paramCls = `w-11 text-center text-[10px] font-mono bg-slate-800 border border-slate-700 rounded px-0.5 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-600 ${noSpin}`;
  return (
    <div className="flex items-end gap-1">
      <span className="text-[9px] font-bold text-slate-400 w-5 shrink-0 pb-1">{label}</span>
      <div className="flex gap-0.5">
        {ordem.map(key => {
          const c = prog.contatos?.[key] || { state: 'off', perc: 100 };
          const remaining = totalCat < 100 && c.state === 'off' ? 100 - totalCat : undefined;
          return <ContactCell key={key} label={`R${key}`} contact={c}
            onChange={nc => setContact(key, nc)} suggestedPerc={remaining}/>;
        })}
      </div>
      <span className="text-slate-700 pb-1 text-[10px] shrink-0">|</span>
      <input type="number" value={prog.amp||''} min={0} max={12} step={0.1} placeholder={modoAmplitude||'mA'}
        onChange={e => onChange({ ...prog, amp: parseFloat(e.target.value)||0 })}
        onFocus={e => e.target.select()} className={paramCls}/>
      <input type="number" value={prog.pw||''} min={30} max={210} step={10} placeholder="µs"
        onChange={e => onChange({ ...prog, pw: parseInt(e.target.value)||60 })}
        onFocus={e => e.target.select()} className={paramCls}/>
      <input type="number" value={prog.freq||''} min={60} max={250} step={5} placeholder="Hz"
        onChange={e => onChange({ ...prog, freq: parseInt(e.target.value)||130 })}
        onFocus={e => e.target.select()} className={paramCls}/>
    </div>
  );
};

const GroupCard = ({ groupLabel, grupo, onChange, tipoEletrodo, modoAmplitude, cyclingL, cyclingR, onCyclingChange }) => {
  const makeEmpty = () => ({ contatos: getContatosIniciais(tipoEletrodo), amp:0, pw:60, freq:130, efeito:'neutro' });
  const hasData = (grupo?.L||[]).some(p=>p.amp>0)||(grupo?.R||[]).some(p=>p.amp>0);
  const setPrograma = (side, idx, newProg) => {
    const g = JSON.parse(JSON.stringify(grupo || { L:[makeEmpty()], R:[makeEmpty()] }));
    if (!Array.isArray(g[side])) g[side] = [makeEmpty()];
    while (g[side].length <= idx) g[side].push(makeEmpty());
    g[side][idx] = newProg;
    onChange(g);
  };
  return (
    <div className={`rounded-lg border flex flex-col ${hasData?'border-indigo-500/40 bg-indigo-950/30':'border-slate-700 bg-slate-900'}`}>
      <div className="px-2 py-1 flex items-center justify-between border-b border-slate-700/60">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Grupo {groupLabel}</span>
        <div className="flex gap-2">
          {[['L','E',cyclingL],['R','D',cyclingR]].map(([side,lbl,cyc]) => (
            <label key={side} className="flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" checked={!!cyc}
                onChange={e => { e.stopPropagation(); onCyclingChange?.(side, e.target.checked); }}
                className="accent-indigo-400 w-3 h-3 cursor-pointer"/>
              <span className="text-[8px] text-slate-400">cyc{lbl}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="px-2 py-1.5 flex flex-col gap-1.5">
        {[['L','E'],['R','D']].map(([side,lbl]) => {
          const progs = grupo?.[side]?.length ? grupo[side] : [makeEmpty()];
          return progs.map((prog,idx) => (
            <LeadRow key={`${side}${idx}`}
              label={progs.length>1?`${lbl}${idx+1}`:lbl}
              prog={prog}
              onChange={newP => setPrograma(side, idx, newP)}
              tipoEletrodo={tipoEletrodo} modoAmplitude={modoAmplitude}/>
          ));
        })}
      </div>
    </div>
  );
};

export const ProgrammingEditor = ({
  dadosGrupos, setDadosGrupos,
  tipoEletrodo='4-ring', modoAmplitude='mA',
  sessaoAnteriorGrupos=null,
  cyclingL=false, cyclingR=false,
  onCyclingChange,
}) => {
  const [swapFrom, setSwapFrom] = useState('A');
  const [swapTo,   setSwapTo]   = useState('D');
  const grupos = ['A','B','C','D'];
  const makeEmpty = () => ({ contatos:getContatosIniciais(tipoEletrodo), amp:0, pw:60, freq:130, efeito:'neutro' });

  const setGrupo = (g, newGrupo) => setDadosGrupos(prev => ({ ...(prev||{}), [g]: newGrupo }));

  const swapGroups = () => {
    if (swapFrom===swapTo) return;
    setDadosGrupos(prev => {
      const next = {...(prev||{})};
      [next[swapFrom],next[swapTo]] = [
        JSON.parse(JSON.stringify(next[swapTo]  ||{L:[makeEmpty()],R:[makeEmpty()]})),
        JSON.parse(JSON.stringify(next[swapFrom]||{L:[makeEmpty()],R:[makeEmpty()]})),
      ];
      return next;
    });
  };

  const copyFromPrevious = () => {
    if (!sessaoAnteriorGrupos) return;
    setDadosGrupos(prev => {
      const next = {...(prev||{})};
      grupos.forEach(g => { if (sessaoAnteriorGrupos[g]) next[g]=JSON.parse(JSON.stringify(sessaoAnteriorGrupos[g])); });
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap text-[7px] text-slate-500">
        <span>Clique no contato: <span className="bg-blue-500/30 text-blue-300 px-1 rounded">−</span> cátodo → <span className="bg-rose-500/30 text-rose-300 px-1 rounded">+</span> ânodo → ∅ off</span>
        <span className="text-slate-600">|</span>
        <span>% abaixo para MICC · mA · µs · Hz</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {grupos.map(g => (
          <GroupCard key={g} groupLabel={g}
            grupo={dadosGrupos?.[g]}
            onChange={newG => setGrupo(g, newG)}
            tipoEletrodo={tipoEletrodo} modoAmplitude={modoAmplitude}
            cyclingL={cyclingL} cyclingR={cyclingR}
            onCyclingChange={onCyclingChange}/>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-700/40">
        <span className="text-[8px] text-slate-500">Permutar</span>
        <select value={swapFrom} onChange={e=>setSwapFrom(e.target.value)}
          className="text-[9px] bg-slate-800 border border-slate-600 text-slate-300 rounded px-1 py-0.5 focus:outline-none">
          {grupos.map(g=><option key={g}>{g}</option>)}
        </select>
        <select value={swapTo} onChange={e=>setSwapTo(e.target.value)}
          className="text-[9px] bg-slate-800 border border-slate-600 text-slate-300 rounded px-1 py-0.5 focus:outline-none">
          {grupos.map(g=><option key={g}>{g}</option>)}
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
