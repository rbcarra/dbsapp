import React, { useState, useMemo } from 'react';
import { ORDEM_TEXTO_BAIXO_CIMA, getContatosIniciais } from './constants';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const parseContactInput = (raw) => {
  const s = (raw || '').trim();
  if (!s || s === '0') return { state: 'off', perc: 100 };
  if (s === '-') return { state: '-', perc: 100 };
  if (s === '+') return { state: '+', perc: 100 };
  const n = parseFloat(s);
  if (!isNaN(n) && n > 0) return { state: '-', perc: Math.min(100, n) };
  if (!isNaN(n) && n < 0) return { state: '+', perc: Math.min(100, -n) };
  return { state: 'off', perc: 100 };
};

const fmtContact = (c) => {
  if (!c || c.state === 'off') return '';
  if (c.state === '-') return c.perc === 100 ? '-' : String(c.perc);
  return c.perc === 100 ? '+' : String(-c.perc);
};

const noSpinner = '[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden';

// ─── COMPACT ONE-LEAD ROW ─────────────────────────────────────────────────────
// Shows contacts + params on a single dense row
const LeadRow = ({ label, prog, onChange, tipoEletrodo, modoAmplitude, cycling, onCyclingChange }) => {
  const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEletrodo] || ['0','1','2','3'];

  const allocatedCathode = useMemo(() =>
    ordre.reduce ? ordre : ordem.reduce((s, k) => {
      const c = prog.contatos?.[k];
      return c?.state === '-' ? s + (c.perc || 100) : s;
    }, 0),
  [prog.contatos, ordem]);
  // Fix: compute correctly
  const totalCat = ordem.reduce((s, k) => {
    const c = prog.contatos?.[k];
    return c?.state === '-' ? s + (c.perc || 100) : s;
  }, 0);

  const setContact = (key, raw) => {
    const remaining = 100 - (totalCat - ((prog.contatos?.[key]?.state==='-') ? (prog.contatos[key].perc||100) : 0));
    let parsed = parseContactInput(raw);
    // Auto-suggest remaining cathode if no value given and key was focused
    if (!raw && totalCat < 100 && totalCat > 0) parsed = { state: '-', perc: remaining };
    onChange({ ...prog, contatos: { ...prog.contatos, [key]: parsed } });
  };

  const bgContact = (c) => {
    if (!c || c.state === 'off') return 'bg-white text-black';
    if (c.state === '-') return 'bg-blue-100 text-black';
    return 'bg-rose-100 text-black';
  };

  return (
    <div className="flex items-center gap-0.5 py-0.5">
      {/* Lead label */}
      <span className="text-[8px] font-bold text-slate-400 w-8 shrink-0 text-right pr-1">{label}</span>

      {/* Contacts */}
      {ordem.map((key, i) => {
        const c = prog.contatos?.[key] || { state: 'off', perc: 100 };
        return (
          <input key={key}
            type="text"
            value={fmtContact(c)}
            placeholder={`R${key}`}
            onChange={e => setContact(key, e.target.value)}
            className={`w-9 text-center text-[10px] font-mono border border-slate-200 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-300 ${bgContact(c)}`}
          />
        );
      })}

      {/* Separator */}
      <span className="text-slate-600 mx-0.5 text-[10px]">|</span>

      {/* Amp */}
      <input type="number" value={prog.amp || ''} min={0} max={12} step={0.1}
        placeholder={modoAmplitude||'mA'}
        onChange={e => onChange({ ...prog, amp: parseFloat(e.target.value)||0 })}
        className={`w-12 text-center text-[10px] font-mono border border-slate-200 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-400 text-black bg-white ${noSpinner}`}
      />

      {/* PW */}
      <input type="number" value={prog.pw || ''} min={30} max={210} step={10}
        placeholder="µs"
        onChange={e => onChange({ ...prog, pw: parseInt(e.target.value)||60 })}
        className={`w-11 text-center text-[10px] font-mono border border-slate-200 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-400 text-black bg-white ${noSpinner}`}
      />

      {/* Freq */}
      <input type="number" value={prog.freq || ''} min={60} max={250} step={5}
        placeholder="Hz"
        onChange={e => onChange({ ...prog, freq: parseInt(e.target.value)||130 })}
        className={`w-11 text-center text-[10px] font-mono border border-slate-200 rounded px-0.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-400 text-black bg-white ${noSpinner}`}
      />

      {/* Cycling */}
      <label className="flex items-center gap-0.5 ml-0.5 cursor-pointer" title="Cycling">
        <input type="checkbox" checked={!!cycling} onChange={e => onCyclingChange(e.target.checked)}
          className="accent-indigo-500 w-2.5 h-2.5"/>
        <span className="text-[7px] text-slate-400">cyc</span>
      </label>
    </div>
  );
};

// ─── COMPACT GROUP CARD ───────────────────────────────────────────────────────
const GroupCard = ({ groupLabel, grupo, onChange, tipoEletrodo, modoAmplitude, cyclingL, cyclingR, onCyclingChange }) => {
  const makeEmpty = () => ({ contatos: getContatosIniciais(tipoEletrodo), amp:0, pw:60, freq:130, efeito:'neutro' });
  const hasData = (grupo?.L||[]).some(p=>p.amp>0) || (grupo?.R||[]).some(p=>p.amp>0);

  const setPrograma = (side, idx, newProg) => {
    const g = JSON.parse(JSON.stringify(grupo || { L:[makeEmpty()], R:[makeEmpty()] }));
    if (!Array.isArray(g[side])) g[side] = [makeEmpty()];
    while (g[side].length <= idx) g[side].push(makeEmpty());
    g[side][idx] = newProg;
    onChange(g);
  };

  return (
    <div className={`rounded-lg border text-[10px] ${hasData ? 'border-indigo-300 bg-indigo-950/40' : 'border-slate-700 bg-slate-900'}`}>
      <div className="px-2 py-0.5 font-bold text-[9px] uppercase tracking-wider border-b border-slate-700 text-slate-400 flex items-center justify-between">
        <span>Grupo {groupLabel}</span>
        {hasData && <span className="text-indigo-400 text-[7px]">●</span>}
      </div>
      <div className="px-1 py-1 flex flex-col gap-0.5">
        {[['L','E'],['R','D']].map(([side, lbl]) => {
          const progs = grupo?.[side] || [makeEmpty()];
          return progs.map((prog, idx) => (
            <LeadRow key={`${side}${idx}`}
              label={progs.length > 1 ? `${lbl}${idx+1}` : lbl}
              prog={prog}
              onChange={newP => setPrograma(side, idx, newP)}
              tipoEletrodo={tipoEletrodo}
              modoAmplitude={modoAmplitude}
              cycling={side === 'L' ? cyclingL : cyclingR}
              onCyclingChange={v => onCyclingChange(side, v)}
            />
          ));
        })}
      </div>
    </div>
  );
};

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export const ProgrammingEditor = ({
  dadosGrupos, setDadosGrupos,
  tipoEletrodo = '4-ring', modoAmplitude = 'mA',
  sessaoAnteriorGrupos = null,
  cyclingL = false, cyclingR = false,
  onCyclingChange,     // (side: 'L'|'R', value: bool) => void
  compact = false,     // when true, shows all 4 groups simultaneously (2×2)
}) => {
  const [swapFrom, setSwapFrom] = useState('A');
  const [swapTo, setSwapTo] = useState('D');
  const [activeGroup, setActiveGroup] = useState('A'); // only used in non-compact mode

  const grupos = ['A','B','C','D'];
  const makeEmpty = () => ({ contatos: getContatosIniciais(tipoEletrodo), amp:0, pw:60, freq:130, efeito:'neutro' });

  const setGrupo = (g, newGrupo) => {
    setDadosGrupos(prev => {
      const resolved = typeof prev === 'function' ? prev({}) : prev;
      return { ...resolved, [g]: newGrupo };
    });
  };

  const handleCycling = (side, val) => {
    onCyclingChange?.(side, val);
  };

  const swapGroups = () => {
    if (swapFrom === swapTo) return;
    setDadosGrupos(prev => {
      const next = { ...(prev||{}) };
      [next[swapFrom], next[swapTo]] = [
        JSON.parse(JSON.stringify(next[swapTo] || { L:[makeEmpty()], R:[makeEmpty()] })),
        JSON.parse(JSON.stringify(next[swapFrom] || { L:[makeEmpty()], R:[makeEmpty()] })),
      ];
      return next;
    });
  };

  const copyFromPrevious = () => {
    if (!sessaoAnteriorGrupos) return;
    setDadosGrupos(prev => {
      const next = { ...(prev||{}) };
      grupos.forEach(g => { if (sessaoAnteriorGrupos[g]) next[g] = JSON.parse(JSON.stringify(sessaoAnteriorGrupos[g])); });
      return next;
    });
  };

  // ── Legend ─────────────────────────────────────────────────────────────────
  const Legend = () => (
    <div className="flex items-center gap-2 text-[7px] text-slate-500 mb-1">
      <span className="bg-blue-100 text-black px-1 rounded">70 = cátodo 70%</span>
      <span className="bg-rose-100 text-black px-1 rounded">-30 = ânodo 30%</span>
      <span className="bg-white border border-slate-200 text-slate-400 px-1 rounded">R0 = off</span>
      <span className="text-slate-600">| amp µs Hz cyc</span>
    </div>
  );

  // ── Swap + Copy controls ───────────────────────────────────────────────────
  const Controls = () => (
    <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700 flex-wrap">
      <span className="text-[7px] text-slate-500">Permutar</span>
      {['from','to'].map(which => (
        <select key={which}
          value={which==='from'?swapFrom:swapTo}
          onChange={e => which==='from'?setSwapFrom(e.target.value):setSwapTo(e.target.value)}
          className="text-[8px] bg-slate-800 border border-slate-600 text-slate-300 rounded px-1 py-0.5 focus:outline-none">
          {grupos.map(g => <option key={g}>{g}</option>)}
        </select>
      ))}
      <button onClick={swapGroups}
        className="text-[8px] font-bold bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 border border-amber-600/40 rounded px-1.5 py-0.5">⇄</button>
      {sessaoAnteriorGrupos && (
        <button onClick={copyFromPrevious}
          className="ml-auto text-[8px] font-bold text-indigo-400 hover:text-indigo-300 border border-indigo-700 hover:border-indigo-500 rounded px-1.5 py-0.5">
          ⬇ Copiar sessão ant.
        </button>
      )}
    </div>
  );

  // ── COMPACT: all 4 groups in 2×2 grid ─────────────────────────────────────
  if (compact) {
    return (
      <div className="flex flex-col gap-1.5">
        <Legend />
        <div className="grid grid-cols-2 gap-1.5">
          {grupos.map(g => (
            <GroupCard key={g} groupLabel={g}
              grupo={dadosGrupos?.[g]}
              onChange={newG => setGrupo(g, newG)}
              tipoEletrodo={tipoEletrodo}
              modoAmplitude={modoAmplitude}
              cyclingL={cyclingL} cyclingR={cyclingR}
              onCyclingChange={handleCycling}
            />
          ))}
        </div>
        <Controls />
      </div>
    );
  }

  // ── STANDARD: tabbed single-group view ────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      <Legend />
      <div className="flex items-center gap-1 flex-wrap">
        {grupos.map(g => {
          const gd = dadosGrupos?.[g];
          const hasData = (gd?.L||[]).some(p=>p.amp>0)||(gd?.R||[]).some(p=>p.amp>0);
          return (
            <button key={g} onClick={() => setActiveGroup(g)}
              className={`px-2 py-1 rounded text-xs font-bold border transition-all ${activeGroup===g?'bg-indigo-600 text-white border-indigo-400':hasData?'bg-indigo-950 text-indigo-300 border-indigo-700':'bg-slate-800 text-slate-500 border-slate-600'}`}>
              {g}{hasData?'●':''}
            </button>
          );
        })}
        <div className="flex items-center gap-1 ml-auto">
          {['from','to'].map(w => (
            <select key={w} value={w==='from'?swapFrom:swapTo}
              onChange={e=>w==='from'?setSwapFrom(e.target.value):setSwapTo(e.target.value)}
              className="text-[8px] bg-slate-800 border border-slate-600 text-slate-300 rounded px-1 py-0.5 focus:outline-none">
              {grupos.map(g=><option key={g}>{g}</option>)}
            </select>
          ))}
          <button onClick={swapGroups} className="text-[8px] font-bold bg-amber-600/30 text-amber-400 border border-amber-600/40 rounded px-1.5 py-0.5">⇄</button>
        </div>
      </div>
      <GroupCard groupLabel={activeGroup}
        grupo={dadosGrupos?.[activeGroup]}
        onChange={newG => setGrupo(activeGroup, newG)}
        tipoEletrodo={tipoEletrodo}
        modoAmplitude={modoAmplitude}
        cyclingL={cyclingL} cyclingR={cyclingR}
        onCyclingChange={handleCycling}
      />
      {sessaoAnteriorGrupos && (
        <button onClick={copyFromPrevious}
          className="w-full py-1 rounded border border-dashed border-indigo-700 text-[9px] font-bold text-indigo-400 hover:bg-indigo-950">
          ⬇ Copiar sessão anterior
        </button>
      )}
    </div>
  );
};
