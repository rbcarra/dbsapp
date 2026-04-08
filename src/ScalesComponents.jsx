import React, { useState } from 'react';

// ─── SHARED HELPERS ────────────────────────────────────────────────────────

const ROMAN = { 0:'0', 1:'I', 2:'II', 3:'III', 4:'IV', 5:'V' };

const ItemRow = ({ id, name, max, value, onChange, labels, hint }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-2 mb-1">
    <div className="flex items-start justify-between mb-1.5">
      <div>
        <span className="text-xs font-bold text-slate-700">{id && `${id}. `}{name}</span>
        {hint && <p className="text-[9px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <span className="text-xs font-black text-indigo-600 ml-2 shrink-0">{value}</span>
    </div>
    <div className="flex gap-1 flex-wrap">
      {Array.from({length: max + 1}, (_, i) => (
        <button key={i} onClick={() => onChange(i)}
          title={labels?.[i] || String(i)}
          className={`flex-1 min-w-[36px] px-1 py-1.5 rounded text-[10px] border transition-all ${
            value === i
              ? 'bg-teal-500 text-white border-teal-500 font-bold'
              : 'bg-white border-slate-200 text-slate-500 hover:border-teal-400'
          }`}>
          <span className="block font-bold">{i}</span>
          {labels?.[i] && <span className="block text-[8px] leading-tight opacity-80">{labels[i].slice(0,10)}</span>}
        </button>
      ))}
    </div>
  </div>
);

const ScaleShell = ({ title, subtitle, total, maxTotal, children, onInserir, onClose, resultText, color = 'teal' }) => (
  <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
    onClick={e => e.stopPropagation()}>
    <div className={`flex items-center justify-between px-5 py-3 bg-${color}-700 text-white rounded-t-2xl shrink-0`}>
      <div>
        <h2 className="font-bold text-sm">{title}</h2>
        {subtitle && <p className={`text-[10px] text-${color}-200`}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xl font-black bg-${color}-600 px-3 py-1 rounded-lg`}>
          {total}{maxTotal ? `/${maxTotal}` : ''}
        </span>
        <button onClick={onClose} className="text-white hover:opacity-70 text-xl font-bold">×</button>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto p-4">{children}</div>
    <div className="shrink-0 border-t bg-white px-4 py-3 flex items-center gap-3">
      <div className="flex-1 font-mono text-[10px] text-slate-600 bg-slate-100 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
        {resultText}
      </div>
      <button onClick={() => navigator.clipboard.writeText(resultText)}
        className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg shrink-0">📋</button>
      <button onClick={() => { onInserir(resultText); onClose(); }}
        className={`text-[10px] font-bold bg-${color}-600 hover:bg-${color}-500 text-white px-3 py-2 rounded-lg shrink-0`}>
        ✓ Inserir
      </button>
    </div>
  </div>
);

// ─── 1. EXAME PARKINSONIANO RÁPIDO ─────────────────────────────────────────

const PARK_ITEMS = [
  { id: 'rigD',    name: 'Rigidez D',                lateral: 'D' },
  { id: 'rigE',    name: 'Rigidez E',                lateral: 'E' },
  { id: 'bradD',   name: 'Bradicinesia D',           lateral: 'D' },
  { id: 'bradE',   name: 'Bradicinesia E',           lateral: 'E' },
  { id: 'trRepD',  name: 'Tremor de repouso D',      lateral: 'D' },
  { id: 'trRepE',  name: 'Tremor de repouso E',      lateral: 'E' },
  { id: 'trAcD',   name: 'Tremor de ação D',         lateral: 'D' },
  { id: 'trAcE',   name: 'Tremor de ação E',         lateral: 'E' },
  { id: 'disar',   name: 'Disartrofonia',             lateral: null },
  { id: 'post',    name: 'Postura',                   lateral: null },
  { id: 'march',   name: 'Marcha',                    lateral: null },
  { id: 'congel',  name: 'Congelamento de marcha',    lateral: null },
  { id: 'instab',  name: 'Instabilidade postural',    lateral: null },
];

const genParkText = (scores) => {
  const pairs = [
    ['Rigidez',            'rigD',   'rigE'],
    ['Bradicinesia',       'bradD',  'bradE'],
    ['Tremor de repouso',  'trRepD', 'trRepE'],
    ['Tremor de ação',     'trAcD',  'trAcE'],
  ];
  const singles = [
    ['Disartrofonia',          'disar'],
    ['Postura',                'post'],
    ['Marcha',                 'march'],
    ['Congelamento de marcha', 'congel'],
    ['Instabilidade postural', 'instab'],
  ];

  const parts = [];
  for (const [label, idD, idE] of pairs) {
    const vD = scores[idD], vE = scores[idE];
    if (vD === 0 && vE === 0) continue;
    if (vD === vE) parts.push(`${label} ${ROMAN[vD]} bilateral`);
    else {
      const sub = [];
      if (vD > 0) sub.push(`${ROMAN[vD]} à direita`);
      if (vE > 0) sub.push(`${ROMAN[vE]} à esquerda`);
      parts.push(`${label} ${sub.join(', ')}`);
    }
  }
  for (const [label, id] of singles) {
    const v = scores[id];
    if (v > 0) parts.push(`${label} ${ROMAN[v]}`);
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const header = `Exame Parkinsoniano Rápido (total ${total}/52)`;
  return parts.length > 0 ? `${header}: ${parts.join('. ')}.` : `${header}: sem alterações.`;
};

const ExameParkinsoniano = ({ onClose, onInserir }) => {
  const [scores, setScores] = useState(() => Object.fromEntries(PARK_ITEMS.map(it => [it.id, 0])));
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const resultText = genParkText(scores);

  return (
    <ScaleShell title="Exame Parkinsoniano Rápido" subtitle="Pontuação 0–4 em cada item" total={total} maxTotal={52}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color="indigo">
      {PARK_ITEMS.map(it => (
        <ItemRow key={it.id} name={it.name} max={4} value={scores[it.id]}
          onChange={v => setScores(s => ({ ...s, [it.id]: v }))}
          labels={['Normal','I','II','III','IV']} />
      ))}
    </ScaleShell>
  );
};

// ─── 2. BFM – BURKE-FAHN-MARSDEN DYSTONIA RATING SCALE ───────────────────

const BFM_REGIONS = [
  { id:'eyes',    name:'Olhos',                     w:0.5 },
  { id:'mouth',   name:'Boca',                      w:0.5 },
  { id:'speech',  name:'Fala / Deglutição',          w:1.0 },
  { id:'neck',    name:'Pescoço',                    w:0.5 },
  { id:'rarm',    name:'Membro superior D',          w:1.0 },
  { id:'larm',    name:'Membro superior E',          w:1.0 },
  { id:'trunk',   name:'Tronco',                     w:1.0 },
  { id:'rleg',    name:'Membro inferior D',          w:1.0 },
  { id:'lleg',    name:'Membro inferior E',          w:1.0 },
];

const PROV_LABELS = ['Nenhuma', 'Ação específica', 'Ação geral / espontânea ocasional', 'Espontânea frequente', 'Constante'];
const PROV_VALS   = [0, 1, 2, 4]; // official factors

const BFM_DS_ITEMS = [
  { id:'speech_d', name:'Fala' },
  { id:'writing',  name:'Escrita' },
  { id:'feeding',  name:'Alimentação' },
  { id:'eating',   name:'Comer / morder' },
  { id:'hygiene',  name:'Higiene' },
  { id:'dressing', name:'Vestir-se' },
  { id:'walking',  name:'Deambulação' },
];

const calcBFM_MS = (sev, prov) => {
  return BFM_REGIONS.reduce((sum, r) => {
    const s = sev[r.id] || 0;
    const p = PROV_VALS[prov[r.id] || 0] || 0;
    return sum + s * p * r.w;
  }, 0);
};

const BFMScale = ({ onClose, onInserir }) => {
  const [sev,  setSev]  = useState(() => Object.fromEntries(BFM_REGIONS.map(r => [r.id, 0])));
  const [prov, setProv] = useState(() => Object.fromEntries(BFM_REGIONS.map(r => [r.id, 0])));
  const [ds,   setDs]   = useState(() => Object.fromEntries(BFM_DS_ITEMS.map(r => [r.id, 0])));

  const ms = Math.round(calcBFM_MS(sev, prov) * 10) / 10;
  const dsTotal = Object.values(ds).reduce((a, b) => a + b, 0);
  const resultText = `BFM Escala de Movimento: ${ms}/120 | Escala de Incapacidade: ${dsTotal}/30`;

  return (
    <ScaleShell title="BFM – Burke-Fahn-Marsden" subtitle="Escala de Movimento + Incapacidade" total={ms} maxTotal={120}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color="violet">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Escala de Movimento</p>
      {BFM_REGIONS.map(r => (
        <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-2 mb-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-700">{r.name}</span>
            <span className="text-[10px] text-violet-600 font-black">
              {(sev[r.id] * (PROV_VALS[prov[r.id]] || 0) * r.w).toFixed(1)} pts
            </span>
          </div>
          <div className="flex gap-2 items-center mb-1">
            <span className="text-[9px] text-slate-400 w-16 shrink-0">Gravidade</span>
            <div className="flex gap-1 flex-1">
              {[0,1,2,3,4].map(v => (
                <button key={v} onClick={() => setSev(s => ({...s,[r.id]:v}))}
                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${sev[r.id]===v?'bg-violet-500 text-white border-violet-400':'bg-slate-50 border-slate-200 text-slate-500 hover:border-violet-300'}`}>{v}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-[9px] text-slate-400 w-16 shrink-0">Provocab.</span>
            <div className="flex gap-1 flex-1">
              {[0,1,2,3].map(v => (
                <button key={v} onClick={() => setProv(s => ({...s,[r.id]:v}))}
                  title={PROV_LABELS[v]}
                  className={`flex-1 py-1 rounded text-[9px] border transition-all ${prov[r.id]===v?'bg-slate-700 text-white border-slate-600':'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-400'}`}>
                  {['0','×1','×2','×4'][v]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3 mb-2">Escala de Incapacidade</p>
      {BFM_DS_ITEMS.map(it => (
        <ItemRow key={it.id} name={it.name} max={4} value={ds[it.id]}
          onChange={v => setDs(s => ({...s,[it.id]:v}))}
          labels={['Normal','Discreta','Moderada','Grave','Impossível']} />
      ))}
    </ScaleShell>
  );
};

// ─── 3. SARA ──────────────────────────────────────────────────────────────

const SARA_ITEMS = [
  { id:'gait',    name:'1. Marcha',                    max:8,
    labels:['Normal','Pequenas dificuldades','Claramente anormal, sem suporte','Suporte intermitente','Suporte constante','Cadeira de rodas (capaz de ficar de pé)','Cadeira de rodas (incapaz)','Incapaz de caminhar'] },
  { id:'stance',  name:'2. Postura ortostática',       max:6,
    labels:['Normal','Pés juntos: leve dificuldade','Pés juntos: impossível','Largura dos ombros: possível','Largura dos ombros: impossível','Apoio unilateral necessário','Apoio bilateral necessário'] },
  { id:'sitting', name:'3. Sentar',                    max:4,
    labels:['Normal','Leve instabilidade','Instabilidade moderada (sem suporte de braços)','Instabilidade grave (com suporte de braços)','Incapaz de sentar sem suporte'] },
  { id:'speech',  name:'4. Distúrbio da fala',         max:6,
    labels:['Normal','Mínima','Leve mas claramente presente','Moderada','Grave','Anártrico'] },
  { id:'fcD',     name:'5. Finger-chase D',            max:4,
    labels:['Normal','Discrepância discreta','Discrepância evidente','Discrepância grave','Incapaz de realizar'] },
  { id:'fcE',     name:'5. Finger-chase E',            max:4,
    labels:['Normal','Discrepância discreta','Discrepância evidente','Discrepância grave','Incapaz de realizar'] },
  { id:'nfD',     name:'6. Nariz-dedo D',              max:4,
    labels:['Normal','Discrepância discreta','Discrepância evidente','Discrepância grave','Incapaz de realizar'] },
  { id:'nfE',     name:'6. Nariz-dedo E',              max:4,
    labels:['Normal','Discrepância discreta','Discrepância evidente','Discrepância grave','Incapaz de realizar'] },
  { id:'fahmD',   name:'7. Mov. alternados rápidos D', max:4,
    labels:['Normal','Levemente irregular','Claramente irregular','Muito irregular','Incapaz de realizar'] },
  { id:'fahmE',   name:'7. Mov. alternados rápidos E', max:4,
    labels:['Normal','Levemente irregular','Claramente irregular','Muito irregular','Incapaz de realizar'] },
  { id:'hsD',     name:'8. Calcanhar-joelho D',        max:4,
    labels:['Normal','Discrepância discreta','Discrepância evidente','Discrepância grave','Incapaz de realizar'] },
  { id:'hsE',     name:'8. Calcanhar-joelho E',        max:4,
    labels:['Normal','Discrepância discreta','Discrepância evidente','Discrepância grave','Incapaz de realizar'] },
];

const SARaScale = ({ onClose, onInserir }) => {
  const [scores, setScores] = useState(() => Object.fromEntries(SARA_ITEMS.map(it => [it.id, 0])));
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const details = SARA_ITEMS.map(it => `${it.id}:${scores[it.id]}`).join(' ');
  const resultText = `SARA total: ${total}/40 | ${details}`;

  return (
    <ScaleShell title="SARA – Scale for Assessment and Rating of Ataxia" subtitle="Total: 0–40" total={total} maxTotal={40}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color="cyan">
      {SARA_ITEMS.map(it => (
        <ItemRow key={it.id} name={it.name} max={it.max} value={scores[it.id]}
          labels={it.labels}
          onChange={v => setScores(s => ({...s,[it.id]:v}))} />
      ))}
    </ScaleShell>
  );
};

// ─── 4. PDQ-39 ─────────────────────────────────────────────────────────────

const PDQ39_DIMS = [
  { id:'mob',  name:'Mobilidade',           qs: ['Dificuldade de atividades de lazer?','Dificuldade de tarefas domésticas?','Dificuldade de carregar sacolas?','Problemas para andar por cerca de 1km?','Problemas para caminhar por cerca de 100m?','Problemas para se movimentar em casa?','Dificuldade para se mover em locais públicos?','Precisou de acompanhante?'] },
  { id:'adl',  name:'AVD',                  qs: ['Dificuldade de cuidados pessoais?','Dificuldade de se alimentar?','Dificuldade de se vestir?','Botões e fechos causam problema?','Escrita dificultada?','Dificuldade de cortar comida?','Beber líquidos sem derramar?'] },
  { id:'emo',  name:'Bem-estar emocional',  qs: ['Sentiu-se deprimido?','Sentiu-se isolado?','Sentiu-se com vontade de chorar?','Sentiu-se irritado?','Sentiu-se ansioso?'] },
  { id:'stig', name:'Estigma',              qs: ['Tentou esconder o Parkinson?','Evitou situações que envolviam comer?','Sentiu vergonha em público?','Preocupou-se com a reação das pessoas?'] },
  { id:'soc',  name:'Suporte social',       qs: ['Contou com apoio do cônjuge?','Contou com apoio de familiares?','Sentiu falta de apoio social?'] },
  { id:'cog',  name:'Cognição',             qs: ['Concentração falhou inesperadamente?','Memória ruim?','Sonhos perturbadores?','Fala ou escrita difícil?','Dificuldade de comunicação?'] },
  { id:'comm', name:'Comunicação',          qs: ['Dificuldade de comunicação?','Sentiu-se ignorado?','Problemas de fala que geram constrangimento?'] },
  { id:'body', name:'Desconforto corporal', qs: ['Dores musculares?','Sensação de frio ou calor?','Dormência/formigamento?'] },
];

const PDQ_LABELS = ['Nunca','Raramente','Às vezes','Frequentemente','Sempre'];

const PDQ39Scale = ({ onClose, onInserir }) => {
  const initScores = () => {
    const s = {};
    PDQ39_DIMS.forEach((d, di) => d.qs.forEach((_, qi) => { s[`${d.id}_${qi}`] = 0; }));
    return s;
  };
  const [scores, setScores] = useState(initScores);

  const dimScores = PDQ39_DIMS.map(d => {
    const vals = d.qs.map((_, qi) => scores[`${d.id}_${qi}`] || 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    const pct = Math.round((sum / (d.qs.length * 4)) * 100);
    return { id: d.id, name: d.name, pct };
  });
  const summaryIndex = Math.round(dimScores.reduce((a, d) => a + d.pct, 0) / 8);
  const details = dimScores.map(d => `${d.name}:${d.pct}%`).join(' | ');
  const resultText = `PDQ-39 Summary Index: ${summaryIndex}/100 | ${details}`;

  return (
    <ScaleShell title="PDQ-39 – Parkinson's Disease Questionnaire" subtitle="0=Nunca  4=Sempre/Sempre" total={summaryIndex} maxTotal={100}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color="emerald">
      {PDQ39_DIMS.map((dim, di) => (
        <div key={dim.id} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{dim.name}</p>
            <span className="text-[10px] font-black text-emerald-600">{dimScores[di].pct}%</span>
          </div>
          {dim.qs.map((q, qi) => (
            <div key={qi} className="bg-white border border-slate-200 rounded-lg p-2 mb-1">
              <p className="text-[10px] text-slate-600 mb-1.5">{q}</p>
              <div className="flex gap-1">
                {PDQ_LABELS.map((label, v) => (
                  <button key={v} onClick={() => setScores(s => ({...s,[`${dim.id}_${qi}`]:v}))}
                    title={label}
                    className={`flex-1 py-1 rounded text-[9px] border transition-all ${scores[`${dim.id}_${qi}`]===v?'bg-emerald-500 text-white border-emerald-400 font-bold':'bg-white border-slate-200 text-slate-400 hover:border-emerald-300'}`}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </ScaleShell>
  );
};

// ─── 5. PDQ-8 ──────────────────────────────────────────────────────────────

const PDQ8_ITEMS = [
  'Dificuldade de realizar atividades de lazer?',
  'Dificuldade de cuidar de si mesmo?',
  'Sentiu-se deprimido(a)?',
  'Sentiu-se isolado(a) e solitário(a)?',
  'Sentiu-se embaraçado(a) em público por ter Parkinson?',
  'Você teve problemas de concentração?',
  'Sentiu-se desconfortável por problemas de comunicação?',
  'Teve dores musculares ou corporais?',
];

const PDQ8Scale = ({ onClose, onInserir }) => {
  const [scores, setScores] = useState(() => Array(8).fill(0));
  const sum = scores.reduce((a, b) => a + b, 0);
  const index = Math.round((sum / 32) * 100);
  const details = scores.map((v, i) => `Q${i+1}:${v}`).join(' ');
  const resultText = `PDQ-8 Index: ${index}/100 (soma bruta ${sum}/32) | ${details}`;

  return (
    <ScaleShell title="PDQ-8 – Parkinson's Disease Questionnaire (versão curta)" subtitle="0=Nunca  4=Sempre" total={index} maxTotal={100}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color="emerald">
      {PDQ8_ITEMS.map((q, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-lg p-2 mb-1">
          <p className="text-[10px] text-slate-600 mb-1.5">{i+1}. {q}</p>
          <div className="flex gap-1">
            {PDQ_LABELS.map((label, v) => (
              <button key={v} onClick={() => setScores(s => { const n=[...s]; n[i]=v; return n; })}
                title={label}
                className={`flex-1 py-1 rounded text-[9px] border transition-all ${scores[i]===v?'bg-emerald-500 text-white border-emerald-400 font-bold':'bg-white border-slate-200 text-slate-400 hover:border-emerald-300'}`}>{v}</button>
            ))}
          </div>
        </div>
      ))}
    </ScaleShell>
  );
};

// ─── 6. YGTSS ──────────────────────────────────────────────────────────────

const YGTSS_SUBSCALES = [
  { id:'number',      name:'1. Número',         hint:'0=Nenhum  1=Único  2=Múltiplos distintos  3=Múltiplos distintos + orquestrados  4=Múltiplos + orquestrados',  max:5 },
  { id:'frequency',   name:'2. Frequência',      hint:'0=Nenhum  1=Raramente  2=Ocasional  3=Frequente  4=Quase sempre  5=Sempre',                                    max:5 },
  { id:'intensity',   name:'3. Intensidade',     hint:'0=Nenhum  1=Mínima  2=Leve  3=Moderada  4=Marcante  5=Grave',                                                  max:5 },
  { id:'complexity',  name:'4. Complexidade',    hint:'0=Nenhum  1=Vago  2=Claramente complexo  3=Complexo  4=Intrincado  5=Extremamente complexo',                    max:5 },
  { id:'interference',name:'5. Interferência',   hint:'0=Nenhuma  1=Mínima  2=Leve  3=Moderada  4=Marcante  5=Grave',                                                 max:5 },
];

const YGTSSScale = ({ onClose, onInserir }) => {
  const [motor, setMotor] = useState(() => Object.fromEntries(YGTSS_SUBSCALES.map(s => [s.id, 0])));
  const [phonic, setPhonic] = useState(() => Object.fromEntries(YGTSS_SUBSCALES.map(s => [s.id, 0])));
  const [impair, setImpair] = useState(0);

  const motorTotal  = Object.values(motor).reduce((a, b) => a + b, 0);
  const phonicTotal = Object.values(phonic).reduce((a, b) => a + b, 0);
  const total = motorTotal + phonicTotal + impair;
  const resultText = `YGTSS total: ${total}/100 | Motor: ${motorTotal}/25 | Fônico: ${phonicTotal}/25 | Comprometimento: ${impair}/50`;

  return (
    <ScaleShell title="YGTSS – Yale Global Tic Severity Scale" subtitle="Motor + Fônico + Comprometimento" total={total} maxTotal={100}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color="rose">
      <div className="grid grid-cols-2 gap-3">
        {[['Motor', motor, setMotor, 'blue'], ['Fônico', phonic, setPhonic, 'rose']].map(([label, scores, setScores, col]) => (
          <div key={label}>
            <p className={`text-[10px] font-bold text-${col}-600 uppercase tracking-wider mb-1`}>{label} — {Object.values(scores).reduce((a,b)=>a+b,0)}/25</p>
            {YGTSS_SUBSCALES.map(s => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-lg p-2 mb-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-700">{s.name}</span>
                  <span className={`text-[10px] font-black text-${col}-600`}>{scores[s.id]}</span>
                </div>
                <p className="text-[8px] text-slate-400 mb-1">{s.hint}</p>
                <div className="flex gap-0.5">
                  {Array.from({length:s.max+1},(_,v)=>(
                    <button key={v} onClick={()=>setScores(sc=>({...sc,[s.id]:v}))}
                      className={`flex-1 py-1 rounded text-[9px] border transition-all ${scores[s.id]===v?`bg-${col}-500 text-white border-${col}-400 font-bold`:'bg-white border-slate-200 text-slate-400 hover:border-slate-400'}`}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Comprometimento global — {impair}/50</p>
        <div className="bg-white border border-slate-200 rounded-lg p-2">
          <p className="text-[9px] text-slate-400 mb-1">0=Nenhum  10=Mínimo  20=Leve  30=Moderado  40=Grave  50=Extremo</p>
          <div className="flex gap-1">
            {[0,10,20,30,40,50].map(v=>(
              <button key={v} onClick={()=>setImpair(v)}
                className={`flex-1 py-1 rounded text-[10px] border font-bold transition-all ${impair===v?'bg-amber-500 text-white border-amber-400':'bg-white border-slate-200 text-slate-400 hover:border-amber-300'}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>
    </ScaleShell>
  );
};

// ─── MAIN SCALES MODAL ──────────────────────────────────────────────────────

const SCALE_LIST = [
  { id:'park',  label:'🧠 Parkinsoniano Rápido', color:'indigo' },
  { id:'updrs', label:'📊 UPDRS-III',            color:'teal'   },
  { id:'bfm',   label:'🔄 BFM Distonia',          color:'violet' },
  { id:'sara',  label:'🌀 SARA Ataxia',           color:'cyan'   },
  { id:'pdq39', label:'📋 PDQ-39',                color:'emerald'},
  { id:'pdq8',  label:'📋 PDQ-8',                 color:'emerald'},
  { id:'ygtss', label:'⚡ YGTSS Tiques',          color:'rose'   },
];

const ScalesModal = ({ onClose, onInserir }) => {
  const [active, setActive] = useState(null);

  if (active === 'park')  return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}><ExameParkinsoniano onClose={onClose} onInserir={onInserir} /></div>;
  if (active === 'bfm')   return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}><BFMScale onClose={onClose} onInserir={onInserir} /></div>;
  if (active === 'sara')  return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}><SARaScale onClose={onClose} onInserir={onInserir} /></div>;
  if (active === 'pdq39') return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}><PDQ39Scale onClose={onClose} onInserir={onInserir} /></div>;
  if (active === 'pdq8')  return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}><PDQ8Scale onClose={onClose} onInserir={onInserir} /></div>;
  if (active === 'ygtss') return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}><YGTSSScale onClose={onClose} onInserir={onInserir} /></div>;

  // Selector screen
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-slate-800">Escalas Clínicas</h2>
            <p className="text-[10px] text-slate-400">Selecione a escala a aplicar</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {SCALE_LIST.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 font-bold text-sm text-slate-700 transition-all">
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export { ScalesModal };
