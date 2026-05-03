import React, { useState, useMemo } from 'react';

// ─── LED (Levodopa Equivalent Dose) CALCULATOR ───────────────────────────────
// Conversion factors based on:
//   Tomlinson et al. (2010) Mov Disord; Jost et al. (2022) J Neural Transm

const LED_MEDS = [
  // [id, name, category, unit, factor, hint]
  // Levodopa
  { id:'levo_ir',   name:'Levodopa IR',            cat:'Levodopa',    unit:'mg/dia', factor: 1.0,   hint:'Referência (1:1)' },
  { id:'levo_cr',   name:'Levodopa CR/LP',          cat:'Levodopa',    unit:'mg/dia', factor: 0.75,  hint:'75% biodisponibilidade' },
  { id:'levo_lcig', name:'Levodopa gel intestinal', cat:'Levodopa',    unit:'mg/dia', factor: 1.0,   hint:'LCIG (Duodopa/Lecigon)' },
  { id:'levo_apo_subcutaneo', name:'Levo-carbidopa SC', cat:'Levodopa',unit:'mg/dia', factor: 1.0,  hint:'ONAPGO/foslevodopa' },
  // Agonistas
  { id:'prami',     name:'Pramipexol',              cat:'Agonista',    unit:'mg/dia', factor: 100,   hint:'×100 (base livre)' },
  { id:'ropi',      name:'Ropinirol',               cat:'Agonista',    unit:'mg/dia', factor: 20,    hint:'×20' },
  { id:'roti',      name:'Rotigotina',              cat:'Agonista',    unit:'mg/dia', factor: 30,    hint:'×30 (patch)' },
  { id:'apo_sc',    name:'Apomorfina SC',           cat:'Agonista',    unit:'mg/dia', factor: 10,    hint:'×10 (infusão/caneta)' },
  { id:'bromo',     name:'Bromocriptina',           cat:'Agonista',    unit:'mg/dia', factor: 10,    hint:'×10' },
  { id:'cabergo',   name:'Cabergolina',             cat:'Agonista',    unit:'mg/dia', factor: 67,    hint:'×67' },
  { id:'lisurida',  name:'Lisurida',                cat:'Agonista',    unit:'mg/dia', factor: 100,   hint:'×100' },
  // Inibidores MAO-B (dose fixa em LED)
  { id:'rasagilina', name:'Rasagilina',             cat:'MAO-B',       unit:'mg/dia', factor: 'fixed_100', hint:'+100 LED fixo' },
  { id:'selegilina', name:'Selegilina oral',        cat:'MAO-B',       unit:'mg/dia', factor: 10,    hint:'×10' },
  { id:'safinamida', name:'Safinamida',             cat:'MAO-B',       unit:'mg/dia', factor: 'fixed_50',  hint:'+50 LED fixo' },
  { id:'zonisamida', name:'Zonisamida',             cat:'MAO-B',       unit:'mg/dia', factor: 'fixed_20',  hint:'+20 LED fixo' },
  // Inibidores COMT (aumentam efeito da levodopa)
  { id:'entacapona', name:'Entacapona',             cat:'COMT',        unit:'doses/dia', factor: 'comt_0.33', hint:'+33% dose levodopa' },
  { id:'tolcapona',  name:'Tolcapona',              cat:'COMT',        unit:'doses/dia', factor: 'comt_0.5',  hint:'+50% dose levodopa' },
  { id:'opicapona',  name:'Opicapona',              cat:'COMT',        unit:'mg/dia', factor: 'fixed_50',  hint:'+50 LED fixo (25mg+)' },
  // Outros
  { id:'amantadina', name:'Amantadina',             cat:'Outro',       unit:'mg/dia', factor: 'fixed_100', hint:'+100 LED fixo' },
];

// Parser: try to extract medication names and doses from evolution text
// ─── LED MEDICATION PARSER ─────────────────────────────────────────────────────
const parseLEDFromText = (text) => {
  if (!text) return {};
  const found = {};
  const LED_PATTERNS = {
    levodopa:    /prolopa(?:\s*bd)?|levodopa|sinemet|stalevo|rytary/i,
    amantadina:  /amantadina|mantadan/i,
    pramipexol:  /pramipexol|sifrol|mirapexin/i,
    ropinirol:   /ropinirol|requip/i,
    rotigotina:  /rotigotina|neupro/i,
    rasagilina:  /rasagilina|azilect/i,
    safinamida:  /safinamida|xadago/i,
    selegilina:  /selegilina|eldepryl/i,
    entacapona:  /entacapona|comtan/i,
    opicapona:   /opicapona|ongentys/i,
  };
  const FRAC = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
  const pf = (s) => FRAC[s] ?? parseFloat((s||'').replace(',','.')) ?? 0;
  for (const line of text.split(/\n/)) {
    for (const [id, pat] of Object.entries(LED_PATTERNS)) {
      if (!(id in found) && pat.test(line)) {
        let unit = 0;
        const dm = line.match(/(\d+(?:[.,]\d+)?)(?:\/\d+)?\s*(?:mg|mcg)/i);
        if (dm) unit = parseFloat(dm[1].replace(',','.'));
        const xyz = line.match(/(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)/);
        if (xyz) { found[id] = unit * ((+xyz[1])+(+xyz[2])+(+xyz[3])); continue; }
        const fracs = [...line.matchAll(/([¼½¾]|\d+(?:[.,]\d+)?)\s*cps?\b/gi)];
        if (fracs.length > 0) { found[id] = unit * fracs.reduce((s,m) => s+pf(m[1]),0); continue; }
        const nx = line.match(/(\d+)\s*[xX×]\s*ao\s*dia/i);
        if (nx) { found[id] = unit * +nx[1]; continue; }
        found[id] = unit;
      }
    }
  }
  return found;
};

const calcLED = (doses, levodopaDoses) => {
  let total = 0;
  let levodopa = 0;

  // First calculate levodopa total (needed for COMT)
  ['levo_ir','levo_cr','levo_lcig','levo_apo_subcutaneo'].forEach(id => {
    if (doses[id]) {
      const med = LED_MEDS.find(m => m.id === id);
      levodopa += doses[id] * med.factor;
    }
  });

  for (const med of LED_MEDS) {
    const dose = doses[med.id];
    if (!dose) continue;
    if (typeof med.factor === 'number') {
      total += dose * med.factor;
    } else if (med.factor === 'fixed_100') { total += 100; }
    else if (med.factor === 'fixed_50')  { total += 50; }
    else if (med.factor === 'fixed_20')  { total += 20; }
    else if (med.factor === 'comt_0.33') { total += levodopa * 0.33; }
    else if (med.factor === 'comt_0.5')  { total += levodopa * 0.5; }
  }
  return Math.round(total);
};

export const LEDCalculator = ({ notasLivres }) => {
  const parsedDoses = useMemo(() => parseLEDFromText(notasLivres), [notasLivres]);
  const [doses, setDoses] = useState(() => parsedDoses);
  const [showAll, setShowAll] = useState(false);

  // Re-parse if notes change
  React.useEffect(() => {
    setDoses(prev => ({ ...parsedDoses, ...prev })); // parsed fills gaps only
  }, [notasLivres]);

  const total = useMemo(() => calcLED(doses), [doses]);
  const categories = [...new Set(LED_MEDS.map(m => m.cat))];
  const activeMeds = LED_MEDS.filter(m => doses[m.id] > 0);

  const setDose = (id, val) => setDoses(d => ({ ...d, [id]: val }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-700">LED — Dose Equivalente de Levodopa</h3>
          <p className="text-[10px] text-slate-400">Tomlinson et al. (2010) · Jost et al. (2022)</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-indigo-700">{total}</div>
          <div className="text-[10px] text-slate-500">mg LED/dia</div>
        </div>
      </div>

      {Object.keys(parsedDoses).length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
            Detectado na evolução: {Object.keys(parsedDoses).map(id => LED_MEDS.find(m=>m.id===id)?.name).filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      {categories.map(cat => {
        const meds = LED_MEDS.filter(m => m.cat === cat);
        const activeCat = meds.filter(m => doses[m.id] > 0);
        const showCat = showAll || activeCat.length > 0;
        if (!showCat) return null;
        return (
          <div key={cat}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{cat}</p>
            {meds.map(med => {
              const val = doses[med.id] || 0;
              if (!showAll && !val) return null;
              return (
                <div key={med.id} className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-slate-600 flex-1">{med.name}</span>
                  <span className="text-[9px] text-slate-400 w-16 text-right shrink-0">{med.hint}</span>
                  <input type="number" min={0} step={1} value={val || ''}
                    onChange={e => setDose(med.id, parseFloat(e.target.value)||0)}
                    placeholder="0"
                    className="w-20 text-right text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"/>
                  <span className="text-[9px] text-slate-400 w-12">{med.unit}</span>
                  {val > 0 && (
                    <span className="text-[9px] text-indigo-600 font-bold w-16 text-right">
                      ={typeof med.factor === 'number' ? Math.round(val*med.factor) : '—'} mg
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <button onClick={() => setShowAll(v => !v)}
        className="text-[10px] text-slate-400 hover:text-slate-600 self-start underline">
        {showAll ? 'Mostrar apenas ativos' : 'Mostrar todos os medicamentos'}
      </button>
    </div>
  );
};

// ─── TEED (Total Electrical Energy Delivered) CALCULATOR ─────────────────────
// TEED (µJ/s = µW) per contact:
//   Current-controlled: TEED = I² × R × PW × F  (R = impedance)
//   Simplified (no R):  TEED_proxy = I × PW × F  (charge-rate, µC/s)
//
// Ref: Koss et al. (1999); Frankemolle et al. (2010)

const calcTEED = (amp, pw, freq, impedance, isVMode) => {
  if (amp <= 0 || pw <= 0 || freq <= 0) return null;
  const PW_s = pw / 1e6;
  if (isVMode) {
    // Voltage-controlled: TEED = V² / R × PW × F  (requires impedance)
    if (impedance > 0) {
      return Math.round(amp * amp / impedance * PW_s * freq * 1e6 * 10) / 10; // µJ/s
    }
    // No impedance → proxy in V·µC/s (V × PW × F, different unit, show as proxy)
    return Math.round(amp * pw * freq / 1000 * 10) / 10;
  } else {
    // Current-controlled: TEED = I² × R × PW × F
    if (impedance > 0) {
      const I_A = amp / 1000;
      return Math.round(I_A * I_A * impedance * PW_s * freq * 1e6 * 10) / 10; // µJ/s
    }
    // No impedance → proxy: charge rate µC/s
    return Math.round(amp * pw * freq / 1000 * 10) / 10;
  }
};

export const TEEDCalculator = ({ dadosGrupos, impedanciaL, impedanciaR, modoAmplitude }) => {
  const [customImpL, setCustomImpL] = useState('');
  const [customImpR, setCustomImpR] = useState('');
  const [activeGroup, setActiveGroup] = useState('A');

  const impL = parseFloat(customImpL || impedanciaL || '0') || 0;
  const impR = parseFloat(customImpR || impedanciaR || '0') || 0;

  const results = useMemo(() => {
    const out = {};
    ['A','B','C','D'].forEach(g => {
      out[g] = { L: [], R: [], totalL: 0, totalR: 0 };
      ['L','R'].forEach(side => {
        const imp = side === 'L' ? impL : impR;
        (dadosGrupos?.[g]?.[side] || []).forEach((prog, i) => {
          const teed = calcTEED(prog.amp, prog.pw, prog.freq, imp, modoAmplitude === 'V');
          out[g][side].push({ prog, teed, idx: i });
          if (teed) {
            if (side === 'L') out[g].totalL += teed;
            else out[g].totalR += teed;
          }
        });
      });
    });
    return out;
  }, [dadosGrupos, impL, impR]);

  const hasImp = impL > 0 || impR > 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-slate-700">TEED — Energia Elétrica Total Entregue</h3>
        <p className="text-[10px] text-slate-400">
          {modoAmplitude === 'V' ? (hasImp ? 'V²/R×PW×F (µJ/s) — voltagem controlada' : 'Proxy: V×PW×F/1000 — forneça impedância para resultado preciso') : (hasImp ? 'I²×R×PW×F (µJ/s) — corrente controlada' : 'Proxy: I×PW×F/1000 (µC/s, sem impedância)')}
        </p>
      </div>

      {/* Impedance inputs */}
      <div className="flex gap-3">
        {[['L','E',impL,setCustomImpL], ['R','D',impR,setCustomImpR]].map(([side,label,val,setter]) => (
          <div key={side} className="flex-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Impedância {label} (Ω)</label>
            <input type="number" value={(side==='L' ? customImpL : customImpR) || (side==='L' ? impedanciaL : impedanciaR) || ''}
              onChange={e => setter(e.target.value)}
              placeholder={`Auto: ${val || 'não definida'}`}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"/>
          </div>
        ))}
      </div>

      {/* Group selector */}
      <div className="flex gap-1">
        {['A','B','C','D'].map(g => (
          <button key={g} onClick={() => setActiveGroup(g)}
            className={`flex-1 py-1 rounded text-xs font-bold border transition-all ${activeGroup===g?'bg-indigo-600 text-white border-indigo-400':'bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
            Grupo {g}
          </button>
        ))}
      </div>

      {/* Results for active group */}
      {['L','R'].map(side => {
        const data = results[activeGroup][side];
        const total = side==='L' ? results[activeGroup].totalL : results[activeGroup].totalR;
        if (!data.length) return null;
        return (
          <div key={side} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Hemisfério {side==='L'?'Esquerdo':'Direito'}</span>
              <span className="text-sm font-black text-indigo-700">
                {total.toFixed(1)} {hasImp?'µJ/s':'µC/s'}
              </span>
            </div>
            {data.map(({prog, teed, idx}) => (
              <div key={idx} className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span>{prog.amp}mA × {prog.pw}µs × {prog.freq}Hz</span>
                {(side==='L'?impL:impR)>0 && <span>× {side==='L'?impL:impR}Ω</span>}
                <span className="ml-auto font-bold text-slate-700">= {teed?.toFixed(1)} {hasImp?'µJ/s':'µC/s'}</span>
              </div>
            ))}
          </div>
        );
      })}

      {/* Summary across all groups */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resumo todos os grupos</p>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {['A','B','C','D'].map(g => (
            <div key={g} className="flex justify-between">
              <span className="text-slate-500">Grupo {g}:</span>
              <span className="font-mono font-bold text-slate-700">
                E={results[g].totalL.toFixed(1)} D={results[g].totalR.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
