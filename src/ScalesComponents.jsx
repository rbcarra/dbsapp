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


// ─── SIMPLE SCORE SCALES ─────────────────────────────────────────────────────
// Shared reusable component for simple single-value scales

const SimpleScoreScale = ({ title, subtitle, field, min, max, step=1, unit='', options, onClose, onInserir, color='slate' }) => {
  const [val, setVal] = React.useState(options ? options[0].v : min);
  const label = options ? (options.find(o=>o.v===val)?.label || '') : '';
  const resultText = `${title}: ${val}${unit}${label ? ' — '+label : ''}`;
  const pct = max > 0 ? Math.round(((val - min) / (max - min)) * 100) : 0;
  return (
    <ScaleShell title={title} subtitle={subtitle} total={val} maxTotal={max}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color={color}>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className={`text-5xl font-black text-${color}-600`}>{val}{unit}</div>
        {options ? (
          <div className="flex flex-wrap justify-center gap-1 w-full">
            {options.map(o=>(
              <button key={o.v} onClick={()=>setVal(o.v)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${val===o.v?`bg-${color}-600 text-white border-${color}-400`:'bg-white border-slate-200 text-slate-500 hover:border-'+color+'-300'}`}>
                {o.v}{unit}{o.label ? ' '+o.label : ''}
              </button>
            ))}
          </div>
        ) : (
          <>
            <input type="range" min={min} max={max} step={step} value={val}
              onChange={e=>setVal(+e.target.value)}
              className={`w-full accent-${color}-500`}/>
            <div className="flex justify-between w-full text-[9px] text-slate-400">
              <span>{min}{unit}</span><span>{max}{unit}</span>
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={()=>setVal(v=>Math.max(min,+(v-step).toFixed(2)))} className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 font-bold text-sm">−</button>
              <input type="number" value={val} min={min} max={max} step={step}
                onChange={e=>setVal(Math.min(max,Math.max(min,+e.target.value)))}
                className="w-20 text-center text-sm font-bold border border-slate-200 rounded px-2 py-1"/>
              <button onClick={()=>setVal(v=>Math.min(max,+(v+step).toFixed(2)))} className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 font-bold text-sm">+</button>
            </div>
          </>
        )}
        {label && <p className="text-xs text-slate-500 italic text-center">{label}</p>}
      </div>
    </ScaleShell>
  );
};

// ─── MULTI-ITEM SCALE HELPER ─────────────────────────────────────────────────
const ItemScale = ({ items, scores, setScores, colorCls='bg-indigo-500 text-white border-indigo-400', borderHover='hover:border-indigo-300' }) => (
  <div className="flex flex-col gap-2">
    {items.map(it => (
      <div key={it.id} className="bg-white border border-slate-200 rounded-lg p-2">
        <div className="flex items-start justify-between mb-1 gap-2">
          <span className="text-[10px] font-bold text-slate-700 leading-snug flex-1">{it.name}</span>
          <span className="text-[10px] font-black text-indigo-600 shrink-0">{scores[it.id]}</span>
        </div>
        {it.hint && <p className="text-[8px] text-slate-400 mb-1">{it.hint}</p>}
        <div className="flex gap-0.5 flex-wrap">
          {Array.from({length: it.max+1}, (_,v)=>(
            <button key={v} onClick={()=>setScores(s=>({...s,[it.id]:v}))}
              className={`flex-1 min-w-0 py-1 rounded text-[9px] border transition-all ${scores[it.id]===v ? colorCls : 'bg-white border-slate-200 text-slate-400 '+borderHover}`}>
              {v}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ─── 8. HOEHN & YAHR ─────────────────────────────────────────────────────────
const HY_OPTIONS = [
  {v:0, label:'Normal — sem sinais'},
  {v:1, label:'Unilateral'},
  {v:1.5, label:'Unilateral + axial'},
  {v:2, label:'Bilateral, sem alt. equilíbrio'},
  {v:2.5, label:'Bilateral leve, recupera no pull test'},
  {v:3, label:'Bilateral moderado, instabilidade'},
  {v:4, label:'Incapacidade grave, ainda deambula'},
  {v:5, label:'Cadeira de rodas ou acamado'},
];
const HoehnYahrScale = ({ onClose, onInserir }) => (
  <SimpleScoreScale title="Hoehn & Yahr" subtitle="Estadiamento funcional na DP (0–5)"
    field="hoehn_yahr" min={0} max={5} step={0.5} options={HY_OPTIONS}
    onClose={onClose} onInserir={onInserir} color="teal" />
);

// ─── 9. SCHWAB & ENGLAND ─────────────────────────────────────────────────────
const SE_OPTIONS = [
  {v:100,label:'Completamente independente'},
  {v:90, label:'Independente, lentidão leve'},
  {v:80, label:'Independente com dificuldade'},
  {v:70, label:'Não independente, dificuldade em 50% das tarefas'},
  {v:60, label:'Alguma dependência'},
  {v:50, label:'Mais dependente, dificuldade em tudo'},
  {v:40, label:'Muito dependente'},
  {v:30, label:'Esforço com assistência frequente'},
  {v:20, label:'Nada sozinho'},
  {v:10, label:'Totalmente dependente'},
  {v:0,  label:'Disfunções vegetativas'},
];
const SchwabEnglandScale = ({ onClose, onInserir }) => (
  <SimpleScoreScale title="Schwab & England" subtitle="Capacidade de atividades da vida diária (%)"
    field="schwab_england" min={0} max={100} step={10} unit="%" options={SE_OPTIONS}
    onClose={onClose} onInserir={onInserir} color="emerald" />
);

// ─── 10. QUEDAS (últimos 3 meses) ────────────────────────────────────────────
const QuedasScale = ({ onClose, onInserir }) => (
  <SimpleScoreScale title="Quedas — últimos 3 meses" subtitle="Número de quedas reportadas"
    field="falls_3m" min={0} max={50} step={1}
    onClose={onClose} onInserir={onInserir} color="rose" />
);

// ─── 11. EPWORTH SLEEPINESS SCALE (ESS) ──────────────────────────────────────
const ESS_ITEMS = [
  {id:'sit_read',   name:'Sentado lendo',                max:3},
  {id:'tv',         name:'Assistindo TV',                max:3},
  {id:'sit_inact',  name:'Sentado inativo em lugar público', max:3},
  {id:'car_pass',   name:'Como passageiro de carro por 1h', max:3},
  {id:'lie_down',   name:'Deitado à tarde (se possível)', max:3},
  {id:'sit_talk',   name:'Sentado conversando',          max:3},
  {id:'after_lunch',name:'Sentado após almoço sem álcool',max:3},
  {id:'car_drive',  name:'Em carro parado no trânsito',  max:3},
];
const EpworthScale = ({ onClose, onInserir }) => {
  const [s, setS] = React.useState(()=>Object.fromEntries(ESS_ITEMS.map(i=>[i.id,0])));
  const total = Object.values(s).reduce((a,b)=>a+b,0);
  const level = total<=10?'Normal':total<=15?'Sonolência moderada':'Sonolência grave';
  const resultText = `Epworth: ${total}/24 — ${level}`;
  return (
    <ScaleShell title="Escala de Sonolência de Epworth" subtitle="0=Nunca adormeço  3=Alta chance" total={total} maxTotal={24}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color="amber">
      <p className="text-[9px] text-slate-500 mb-2">Chance de adormecer nas situações abaixo:</p>
      <ItemScale items={ESS_ITEMS} scores={s} setScores={setS} colorCls="bg-amber-500 text-white border-amber-400" borderHover="hover:border-amber-300"/>
      <p className="text-xs font-bold text-center mt-2 text-amber-600">Total: {total}/24 — {level}</p>
    </ScaleShell>
  );
};

// ─── 12. FREEZING OF GAIT QUESTIONNAIRE (FOG-Q) ──────────────────────────────
const FOGQ_ITEMS = [
  {id:'q1', name:'Durante seus melhores períodos do dia, você caminha?', max:4,
   hint:'0=sim normalmente, 1=sim mas lento, 2=Sim com dificuldade, 3=com andador/bengala, 4=incapaz'},
  {id:'q2', name:'Suas dificuldades de marcha afetam suas atividades diárias?', max:4,
   hint:'0=nada, 1=pouco, 2=moderadamente, 3=muito, 4=não consigo mais realizar'},
  {id:'q3', name:'Você sente que seus pés ficam presos ao chão ao tentar iniciar o passo?', max:4,
   hint:'0=nunca, 1=raramente, 2=às vezes, 3=frequentemente, 4=sempre'},
  {id:'q4', name:'Episódios de congelamento de marcha ao iniciar o passo — duração?', max:4,
   hint:'0=nenhum, 1=1-2s, 2=3-10s, 3=11-30s, 4=>30s'},
  {id:'q5', name:'Episódios de congelamento durante a marcha — frequência?', max:4,
   hint:'0=nunca, 1=1×/mês, 2=1×/semana, 3=1×/dia, 4=>1×/dia'},
  {id:'q6', name:'Episódios de congelamento ao girar — duração?', max:4,
   hint:'0=nenhum, 1=1-2s, 2=3-10s, 3=11-30s, 4=>30s'},
];
const FOGQScale = ({ onClose, onInserir }) => {
  const [s, setS] = React.useState(()=>Object.fromEntries(FOGQ_ITEMS.map(i=>[i.id,0])));
  const total = Object.values(s).reduce((a,b)=>a+b,0);
  const resultText = `FOG-Q: ${total}/24`;
  return (
    <ScaleShell title="Freezing of Gait Questionnaire" subtitle="0–24 (maior = pior)" total={total} maxTotal={24}
      onClose={onClose} onInserir={onInserir} resultText={resultText} color="slate">
      <ItemScale items={FOGQ_ITEMS} scores={s} setScores={setS} colorCls="bg-slate-600 text-white border-slate-500" borderHover="hover:border-slate-400"/>
    </ScaleShell>
  );
};

// ─── 13. NMS QUESTIONNAIRE (NMSQuest) ────────────────────────────────────────
const NMS_ITEMS = [
  {id:'s1', name:'Babação excessiva',max:1},{id:'s2', name:'Distorção do olfato',max:1},
  {id:'s3', name:'Dificuldade p/ engolir',max:1},{id:'s4', name:'Vômito/náusea',max:1},
  {id:'s5', name:'Constipação',max:1},{id:'s6', name:'Incontinência fecal',max:1},
  {id:'s7', name:'Urgência miccional',max:1},{id:'s8', name:'Noctúria',max:1},
  {id:'s9', name:'Disfunção sexual',max:1},{id:'s10',name:'Hipotensão ortostática',max:1},
  {id:'s11',name:'Cansaço/fadiga',max:1},{id:'s12',name:'Dor',max:1},
  {id:'s13',name:'Memória/concentração',max:1},{id:'s14',name:'Delúcio/alucinação',max:1},
  {id:'s15',name:'Depressão',max:1},{id:'s16',name:'Ansiedade',max:1},
  {id:'s17',name:'Anedonia',max:1},{id:'s18',name:'Flutuações do humor',max:1},
  {id:'s19',name:'Sonolência diurna',max:1},{id:'s20',name:'Insônia',max:1},
  {id:'s21',name:'Sonhos vívidos/perturbadores',max:1},{id:'s22',name:'Fala/grito durante sono',max:1},
  {id:'s23',name:'Pernas inquietas',max:1},{id:'s24',name:'Inchaço nos membros',max:1},
  {id:'s25',name:'Transpiração excessiva',max:1},{id:'s26',name:'Diplopia',max:1},
  {id:'s27',name:'Disfunção sexual — desejo',max:1},{id:'s28',name:'Perda de peso involuntária',max:1},
  {id:'s29',name:'Sangramento gastrointestinal',max:1},{id:'s30',name:'Alteração de sabor',max:1},
];
const NMSQuestScale = ({ onClose, onInserir }) => {
  const [s, setS] = React.useState(()=>Object.fromEntries(NMS_ITEMS.map(i=>[i.id,0])));
  const total = Object.values(s).reduce((a,b)=>a+b,0);
  const resultText = `NMS-Quest: ${total}/30`;
  return (
    <ScaleShell title="Non-Motor Symptoms Questionnaire" subtitle="0=Ausente  1=Presente — total 0–30"
      total={total} maxTotal={30} onClose={onClose} onInserir={onInserir} resultText={resultText} color="indigo">
      <div className="grid grid-cols-2 gap-1">
        {NMS_ITEMS.map(it=>(
          <button key={it.id} onClick={()=>setS(ss=>({...ss,[it.id]:ss[it.id]?0:1}))}
            className={`p-1.5 rounded border text-[9px] font-bold text-left transition-all ${s[it.id]?'bg-indigo-600 text-white border-indigo-400':'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
            {it.name}
          </button>
        ))}
      </div>
      <p className="text-xs font-bold text-center mt-2 text-indigo-600">{total}/30 sintomas presentes</p>
    </ScaleShell>
  );
};

// ─── 14. BDI-II ───────────────────────────────────────────────────────────────
const BDI_ITEMS = [
  {id:'q1', name:'Tristeza',max:3},{id:'q2', name:'Pessimismo',max:3},
  {id:'q3', name:'Fracasso',max:3},{id:'q4', name:'Prazer',max:3},
  {id:'q5', name:'Culpa',max:3},{id:'q6', name:'Punição',max:3},
  {id:'q7', name:'Autoimagem',max:3},{id:'q8', name:'Autocrítica',max:3},
  {id:'q9', name:'Suicídio',max:3},{id:'q10',name:'Choro',max:3},
  {id:'q11',name:'Agitação',max:3},{id:'q12',name:'Interesse social',max:3},
  {id:'q13',name:'Indecisão',max:3},{id:'q14',name:'Inutilidade',max:3},
  {id:'q15',name:'Energia/disposição',max:3},{id:'q16',name:'Sono',max:3},
  {id:'q17',name:'Irritabilidade',max:3},{id:'q18',name:'Apetite',max:3},
  {id:'q19',name:'Concentração',max:3},{id:'q20',name:'Cansaço',max:3},
  {id:'q21',name:'Interesse sexual',max:3},
];
const BDIScale = ({ onClose, onInserir }) => {
  const [s, setS] = React.useState(()=>Object.fromEntries(BDI_ITEMS.map(i=>[i.id,0])));
  const total = Object.values(s).reduce((a,b)=>a+b,0);
  const level = total<=13?'Mínima':total<=19?'Leve':total<=28?'Moderada':'Grave';
  const resultText = `BDI-II: ${total}/63 — ${level}`;
  return (
    <ScaleShell title="Beck Depression Inventory-II" subtitle="0–63 (≤13 mínima  14–19 leve  20–28 moderada  ≥29 grave)"
      total={total} maxTotal={63} onClose={onClose} onInserir={onInserir} resultText={resultText} color="sky">
      <ItemScale items={BDI_ITEMS} scores={s} setScores={setS} colorCls="bg-sky-600 text-white border-sky-400" borderHover="hover:border-sky-300"/>
      <p className="text-xs font-bold text-center mt-2 text-sky-600">Total: {total}/63 — {level}</p>
    </ScaleShell>
  );
};

// ─── 15. MMSE ─────────────────────────────────────────────────────────────────
const MMSE_ITEMS = [
  {id:'orient_t', name:'Orientação temporal (ano, estação, mês, data, dia)', max:5},
  {id:'orient_s', name:'Orientação espacial (país, estado, cidade, local, andar)', max:5},
  {id:'register', name:'Registro (3 palavras)', max:3},
  {id:'attention',name:'Atenção/cálculo (serial 7 ou soletrar MUNDO invertido)', max:5},
  {id:'recall',   name:'Evocação (3 palavras)', max:3},
  {id:'naming',   name:'Nomeação (lápis, relógio)', max:2},
  {id:'repeat',   name:'Repetição ("Nem aqui, nem ali, nem lá")', max:1},
  {id:'command',  name:'Comando de 3 etapas', max:3},
  {id:'read',     name:'Leitura e execução ("Feche os olhos")', max:1},
  {id:'write',    name:'Escrita espontânea', max:1},
  {id:'copy',     name:'Cópia do pentágono', max:1},
];
const MMSEScale = ({ onClose, onInserir }) => {
  const [s, setS] = React.useState(()=>Object.fromEntries(MMSE_ITEMS.map(i=>[i.id,0])));
  const total = Object.values(s).reduce((a,b)=>a+b,0);
  const level = total>=27?'Normal':total>=24?'Questionável':total>=19?'Déficit leve':total>=10?'Déficit moderado':'Déficit grave';
  const resultText = `MMSE: ${total}/30 — ${level}`;
  return (
    <ScaleShell title="Mini-Mental State Examination" subtitle="0–30 (≥27 normal  24–26 questionável  ≤23 déficit)"
      total={total} maxTotal={30} onClose={onClose} onInserir={onInserir} resultText={resultText} color="violet">
      <ItemScale items={MMSE_ITEMS} scores={s} setScores={setS} colorCls="bg-violet-600 text-white border-violet-400" borderHover="hover:border-violet-300"/>
      <p className="text-xs font-bold text-center mt-2 text-violet-600">Total: {total}/30 — {level}</p>
    </ScaleShell>
  );
};

// ─── 16. MoCA ────────────────────────────────────────────────────────────────
const MOCA_ITEMS = [
  {id:'visosp',  name:'Visuoespacial/executivo (relógio + cubos)', max:5},
  {id:'naming',  name:'Nomeação (3 animais)', max:3},
  {id:'attention',name:'Atenção (série numérica + vigilância + serial 7)', max:6},
  {id:'language',name:'Linguagem (repetição + fluência verbal)', max:3},
  {id:'abstrac', name:'Abstração', max:2},
  {id:'recall',  name:'Memória (evocação tardia 5 palavras)', max:5},
  {id:'orient',  name:'Orientação (data, mês, ano, dia, local, cidade)', max:6},
];
const MoCAScale = ({ onClose, onInserir }) => {
  const [s, setS] = React.useState(()=>Object.fromEntries(MOCA_ITEMS.map(i=>[i.id,0])));
  const [edu, setEdu] = React.useState(false);
  const raw = Object.values(s).reduce((a,b)=>a+b,0);
  const total = Math.min(30, raw + (edu?1:0));
  const level = total>=26?'Normal':total>=18?'Comprometimento leve':total>=10?'Comprometimento moderado':'Comprometimento grave';
  const resultText = `MoCA: ${total}/30 — ${level}`;
  return (
    <ScaleShell title="Montreal Cognitive Assessment" subtitle="0–30 (≥26 normal; +1 se ≤12 anos escolaridade)"
      total={total} maxTotal={30} onClose={onClose} onInserir={onInserir} resultText={resultText} color="purple">
      <ItemScale items={MOCA_ITEMS} scores={s} setScores={setS} colorCls="bg-purple-600 text-white border-purple-400" borderHover="hover:border-purple-300"/>
      <label className="flex items-center gap-2 mt-2 cursor-pointer">
        <input type="checkbox" checked={edu} onChange={e=>setEdu(e.target.checked)} className="accent-purple-500"/>
        <span className="text-[10px] text-slate-600">+1 ponto (≤12 anos de escolaridade)</span>
      </label>
      <p className="text-xs font-bold text-center mt-2 text-purple-600">Total: {total}/30 — {level}</p>
    </ScaleShell>
  );
};

// ─── 17. TWSTRS ────────────────────────────────────────────────────────────────
const TWSTRS_SEVERITY_ITEMS = [
  {id:'maxDev',    name:'Desvio máximo (amplitude)', max:5},
  {id:'duration',  name:'Duração do desvio (% do tempo)', max:5},
  {id:'effect',    name:'Efeito dos truques sensoriais', max:3},
  {id:'elevation', name:'Elevação do ombro/cabeça', max:3},
  {id:'laterofl',  name:'Laterofletão do pescoço', max:4},
  {id:'anterior',  name:'Componente anterior/posterior', max:4},
];
const TWSTRS_DISABILITY_ITEMS = [
  {id:'work',   name:'Trabalho/escola', max:4},
  {id:'adl',    name:'Atividades da vida diária', max:4},
  {id:'driving',name:'Dirigir', max:4},
  {id:'reading',name:'Ler', max:4},
  {id:'tv',     name:'Assistir TV', max:4},
  {id:'eat',    name:'Comer fora de casa', max:4},
  {id:'public', name:'Atividades fora de casa', max:4},
];
const TWSTRS_PAIN_ITEMS = [
  {id:'severity', name:'Gravidade da dor', max:5},
  {id:'duration', name:'Duração da dor', max:5},
  {id:'incapacity',name:'Incapacidade por dor', max:5},
];
const TWSTRSScale = ({ onClose, onInserir }) => {
  const [sev,  setSev]  = React.useState(()=>Object.fromEntries(TWSTRS_SEVERITY_ITEMS.map(i=>[i.id,0])));
  const [dis,  setDis]  = React.useState(()=>Object.fromEntries(TWSTRS_DISABILITY_ITEMS.map(i=>[i.id,0])));
  const [pain, setPain] = React.useState(()=>Object.fromEntries(TWSTRS_PAIN_ITEMS.map(i=>[i.id,0])));
  const totSev  = Object.values(sev).reduce((a,b)=>a+b,0);
  const totDis  = Object.values(dis).reduce((a,b)=>a+b,0);
  const totPain = Object.values(pain).reduce((a,b)=>a+b,0);
  const total   = totSev + totDis + totPain;
  const resultText = `TWSTRS: ${total}/87 | Gravidade:${totSev}/24 Incapacidade:${totDis}/28 Dor:${totPain}/15`;
  return (
    <ScaleShell title="TWSTRS — Torticolis Espasmódica" subtitle="Total 0–87 | Gravidade+Incapacidade+Dor"
      total={total} maxTotal={87} onClose={onClose} onInserir={onInserir} resultText={resultText} color="orange">
      <p className="text-[9px] font-bold text-orange-600 uppercase tracking-wider mb-1">Gravidade — {totSev}/24</p>
      <ItemScale items={TWSTRS_SEVERITY_ITEMS} scores={sev} setScores={setSev} colorCls="bg-orange-500 text-white border-orange-400" borderHover="hover:border-orange-300"/>
      <p className="text-[9px] font-bold text-orange-600 uppercase tracking-wider mt-3 mb-1">Incapacidade — {totDis}/28</p>
      <ItemScale items={TWSTRS_DISABILITY_ITEMS} scores={dis} setScores={setDis} colorCls="bg-orange-500 text-white border-orange-400" borderHover="hover:border-orange-300"/>
      <p className="text-[9px] font-bold text-orange-600 uppercase tracking-wider mt-3 mb-1">Dor — {totPain}/15</p>
      <ItemScale items={TWSTRS_PAIN_ITEMS} scores={pain} setScores={setPain} colorCls="bg-orange-500 text-white border-orange-400" borderHover="hover:border-orange-300"/>
    </ScaleShell>
  );
};

// ─── 18. FAHN-TOLOSA-MARÍN TREMOR RATING SCALE ─────────────────────────────
const FTM_ITEMS = [
  {id:'h_r',  name:'Cabeça — repouso',         max:4},
  {id:'h_p',  name:'Cabeça — postural',         max:4},
  {id:'f_r',  name:'Face — repouso',            max:4},
  {id:'l_r',  name:'Língua — repouso',          max:4},
  {id:'r_rr', name:'MMSS D — repouso',          max:4},
  {id:'l_rr', name:'MMSS E — repouso',          max:4},
  {id:'r_rp', name:'MMSS D — postural',         max:4},
  {id:'l_rp', name:'MMSS E — postural',         max:4},
  {id:'r_rk', name:'MMSS D — cinético',         max:4},
  {id:'l_rk', name:'MMSS E — cinético',         max:4},
  {id:'r_ll', name:'MMII D — repouso',          max:4},
  {id:'l_ll', name:'MMII E — repouso',          max:4},
  {id:'r_lp', name:'MMII D — postural',         max:4},
  {id:'l_lp', name:'MMII E — postural',         max:4},
  {id:'writ_r',name:'Escrita D',                max:4},
  {id:'writ_l',name:'Escrita E',                max:4},
  {id:'pour',  name:'Derramar água',            max:4},
  {id:'feed',  name:'Alimentar-se',             max:4},
  {id:'speech',name:'Fala',                     max:4},
  {id:'face2', name:'Face — outros',            max:4},
];
const FTMScale = ({ onClose, onInserir }) => {
  const [s, setS] = React.useState(()=>Object.fromEntries(FTM_ITEMS.map(i=>[i.id,0])));
  const total = Object.values(s).reduce((a,b)=>a+b,0);
  const resultText = `FTM Tremor: ${total}/80`;
  return (
    <ScaleShell title="Fahn-Tolosa-Marín Tremor Rating Scale" subtitle="0–80 (subconjunto clínico)"
      total={total} maxTotal={80} onClose={onClose} onInserir={onInserir} resultText={resultText} color="cyan">
      <ItemScale items={FTM_ITEMS} scores={s} setScores={setS} colorCls="bg-cyan-600 text-white border-cyan-400" borderHover="hover:border-cyan-300"/>
    </ScaleShell>
  );
};

// ─── 19. SF-36 (entrada simplificada de PCS e MCS) ────────────────────────────
const SF36Scale = ({ onClose, onInserir }) => {
  const [pcs, setPcs] = React.useState(50);
  const [mcs, setMcs] = React.useState(50);
  const resultText = `SF-36 PCS: ${pcs.toFixed(1)} | MCS: ${mcs.toFixed(1)}`;
  return (
    <ScaleShell title="SF-36" subtitle="Physical (PCS) e Mental (MCS) Component Summary — 0–100"
      total={Math.round((pcs+mcs)/2)} maxTotal={100} onClose={onClose} onInserir={onInserir} resultText={resultText} color="teal">
      <p className="text-[9px] text-slate-400 mb-3">Insira os scores calculados externamente pelo algoritmo SF-36 (média populacional = 50).</p>
      {[['PCS — Componente Físico', pcs, setPcs],['MCS — Componente Mental', mcs, setMcs]].map(([label,val,setter])=>(
        <div key={label} className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-600">{label}</span>
            <span className="text-sm font-black text-teal-600">{val.toFixed(1)}</span>
          </div>
          <input type="range" min={0} max={100} step={0.1} value={val} onChange={e=>setter(+e.target.value)} className="w-full accent-teal-500"/>
          <div className="flex justify-between text-[8px] text-slate-400 mt-0.5"><span>0</span><span>50 (média)</span><span>100</span></div>
        </div>
      ))}
    </ScaleShell>
  );
};

// ─── 20. EQ-5D-5L ────────────────────────────────────────────────────────────
const EQ5D_DIMS = [
  {id:'mobility',  name:'Mobilidade',        opts:['Sem problemas','Problemas leves','Problemas moderados','Problemas graves','Incapaz']},
  {id:'selfcare',  name:'Cuidado pessoal',   opts:['Sem problemas','Problemas leves','Problemas moderados','Problemas graves','Incapaz']},
  {id:'activity',  name:'Atividades habituais',opts:['Sem problemas','Problemas leves','Problemas moderados','Problemas graves','Incapaz']},
  {id:'pain',      name:'Dor / Desconforto', opts:['Sem dor','Dor leve','Dor moderada','Dor grave','Dor extrema']},
  {id:'anxiety',   name:'Ansiedade / Depressão',opts:['Sem ansiedade','Ansiedade leve','Ansiedade moderada','Ansiedade grave','Ansiedade extrema']},
];
const EQ5DScale = ({ onClose, onInserir }) => {
  const [dims, setDims] = React.useState(()=>Object.fromEntries(EQ5D_DIMS.map(d=>[d.id,1])));
  const [vas, setVas] = React.useState(75);
  const [indexVal, setIndexVal] = React.useState('');
  const profile = EQ5D_DIMS.map(d=>dims[d.id]).join('');
  const resultText = `EQ-5D-5L: Perfil ${profile} | VAS: ${vas}${indexVal?` | Index: ${indexVal}`:''}`;
  return (
    <ScaleShell title="EQ-5D-5L" subtitle="5 dimensões (1–5) + VAS + índice"
      total={vas} maxTotal={100} onClose={onClose} onInserir={onInserir} resultText={resultText} color="green">
      {EQ5D_DIMS.map(d=>(
        <div key={d.id} className="mb-3">
          <p className="text-[9px] font-bold text-slate-600 mb-1">{d.name}</p>
          <div className="flex gap-1 flex-wrap">
            {d.opts.map((opt,i)=>(
              <button key={i} onClick={()=>setDims(dd=>({...dd,[d.id]:i+1}))}
                className={`flex-1 text-[8px] px-1 py-1.5 rounded border font-bold text-center transition-all ${dims[d.id]===i+1?'bg-green-600 text-white border-green-400':'bg-white border-slate-200 text-slate-400 hover:border-green-300'}`}>
                {i+1}<br/><span className="font-normal">{opt}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-slate-600">Saúde geral hoje (VAS 0–100)</span>
          <span className="text-sm font-black text-green-600">{vas}</span>
        </div>
        <input type="range" min={0} max={100} value={vas} onChange={e=>setVas(+e.target.value)} className="w-full accent-green-500 mb-2"/>
        <div>
          <label className="text-[9px] font-bold text-slate-600 block mb-0.5">Índice calculado (opcional — tabela de valores brasileira):</label>
          <input type="number" min={-0.5} max={1} step={0.001} value={indexVal} placeholder="ex: 0.856"
            onChange={e=>setIndexVal(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"/>
        </div>
      </div>
    </ScaleShell>
  );
};

// ─── MAIN SCALES MODAL ──────────────────────────────────────────────────────

const SCALE_LIST = [
  // Parkinson
  { id:'park',  label:'🧠 Parkinsoniano Rápido', group:'Parkinson', color:'indigo' },
  { id:'updrs', label:'📊 UPDRS-III',            group:'Parkinson', color:'teal'   },
  { id:'hy',    label:'🏷 Hoehn & Yahr',          group:'Parkinson', color:'teal'   },
  { id:'se',    label:'📐 Schwab & England',      group:'Parkinson', color:'emerald'},
  { id:'pdq39', label:'📋 PDQ-39',               group:'Parkinson', color:'emerald'},
  { id:'pdq8',  label:'📋 PDQ-8',                group:'Parkinson', color:'emerald'},
  // Distonia / tremor
  { id:'bfm',   label:'🔄 BFM Distonia',         group:'Distonia',  color:'violet' },
  { id:'twstrs',label:'🔄 TWSTRS Torticolis',    group:'Distonia',  color:'orange' },
  // Ataxia
  { id:'sara',  label:'🌀 SARA Ataxia',          group:'Ataxia',    color:'cyan'   },
  // Tremor
  { id:'ftm',   label:'🤚 FTM Tremor',           group:'Tremor',    color:'cyan'   },
  // Tiques
  { id:'ygtss', label:'⚡ YGTSS Tiques',         group:'Tiques',    color:'rose'   },
  // Neuropsicológico
  { id:'bdi',   label:'😔 BDI-II Depressão',     group:'Neuropsico',color:'sky'    },
  { id:'mmse',  label:'🧩 MMSE',                 group:'Neuropsico',color:'violet' },
  { id:'moca',  label:'🧩 MoCA',                 group:'Neuropsico',color:'purple' },
  // Não-motores / QV
  { id:'nms',   label:'📋 NMS-Quest',            group:'Não-motor', color:'indigo' },
  { id:'ess',   label:'😴 Epworth Sonolência',   group:'Não-motor', color:'amber'  },
  { id:'fogq',  label:'🚶 FOG-Q Freezing',       group:'Não-motor', color:'slate'  },
  { id:'quedas',label:'⚠️ Quedas (3 meses)',      group:'Não-motor', color:'rose'   },
  // QV
  { id:'sf36',  label:'📊 SF-36 PCS/MCS',        group:'QV',        color:'teal'   },
  { id:'eq5d',  label:'📊 EQ-5D-5L',             group:'QV',        color:'green'  },
];


// ─── SIMPLE NUMERIC SCALES ────────────────────────────────────────────────────
// Generic component for scales that are just a total score

const NumericScaleInput = ({ label, value, onChange, min, max, step=1, unit='', hint='' }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
    <div className="flex-1 pr-3">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      {hint && <span className="text-[9px] text-slate-400 ml-1">({hint})</span>}
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <input type="number" min={min} max={max} step={step} value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder="—"
        className="w-20 text-right text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"/>
      {unit && <span className="text-[9px] text-slate-400 w-10">{unit}</span>}
      {max && <span className="text-[9px] text-slate-300">/{max}</span>}
    </div>
  </div>
);

const SIMPLE_SCALE_GROUPS = [
  {
    id: 'parkinson', label: '🧠 Parkinson / Movimento',
    scales: [
      { key:'hoehn_yahr',   label:'Hoehn & Yahr',              min:0, max:5,   step:0.5, unit:'estágio', hint:'0–5' },
      { key:'schwab_england',label:'Schwab & England',         min:0, max:100, step:10,  unit:'%',       hint:'0–100%' },
      { key:'fog_q',        label:'Freezing of Gait Quest.',   min:0, max:24,  step:1,   unit:'pts' },
      { key:'falls_3m',     label:'Quedas (últimos 3 meses)',  min:0, max:999, step:1,   unit:'n' },
      { key:'tug_s',        label:'Timed Up and Go',          min:0, max:300, step:0.1, unit:'seg' },
    ],
  },
  {
    id: 'distonia', label: '🔄 Distonia / Tremor',
    scales: [
      { key:'twstrs',       label:'TWSTRS (Torcicolo)',        min:0, max:87,  step:1,   unit:'pts' },
      { key:'ftm_tremor',   label:'Fahn-Tolosa-Marín Tremor',  min:0, max:144, step:1,   unit:'pts' },
    ],
  },
  {
    id: 'cognicao', label: '🧩 Cognição',
    scales: [
      { key:'mmse',         label:'MMSE',                      min:0, max:30,  step:1,   unit:'pts' },
      { key:'moca',         label:'MoCA',                      min:0, max:30,  step:1,   unit:'pts' },
    ],
  },
  {
    id: 'humor', label: '😔 Humor',
    scales: [
      { key:'bdi_ii',       label:'BDI-II (Depressão)',         min:0, max:63,  step:1,   unit:'pts' },
    ],
  },
  {
    id: 'qv', label: '📋 Qualidade de Vida',
    scales: [
      { key:'sf36_pcs',     label:'SF-36 PCS (Físico)',        min:0, max:100, step:0.1, unit:'pts' },
      { key:'sf36_mcs',     label:'SF-36 MCS (Mental)',        min:0, max:100, step:0.1, unit:'pts' },
      { key:'eq5d_index',   label:'EQ-5D-5L',                  min:0, max:1,   step:0.001,unit:'índice', hint:'0–1' },
    ],
  },
  {
    id: 'nao_motor', label: '🌙 Não-motores',
    scales: [
      { key:'nms_quest',    label:'NMS-Quest',                  min:0, max:30,  step:1,   unit:'pts' },
      { key:'epworth',      label:'Epworth (Sonolência)',        min:0, max:24,  step:1,   unit:'pts' },
    ],
  },
];

const SimpleScalesScreen = ({ onClose, onInserir }) => {
  const [values, setValues] = React.useState({});
  const [activeGroup, setActiveGroup] = React.useState('parkinson');

  const setVal = (key, val) => setValues(prev => ({...prev, [key]: val}));

  const group = SIMPLE_SCALE_GROUPS.find(g => g.id === activeGroup);
  const filled = Object.entries(values).filter(([,v]) => v !== null && v !== undefined && v !== '');

  const handleInserir = () => {
    if (!filled.length) { onClose(); return; }
    const text = filled.map(([k, v]) => {
      const scale = SIMPLE_SCALE_GROUPS.flatMap(g=>g.scales).find(s=>s.key===k);
      return `${scale?.label||k}: ${v}${scale?.max ? '/'+scale.max : ''}`;
    }).join(' | ');
    onInserir(text);
    onClose();
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]"
      onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b bg-teal-50">
        <div>
          <h2 className="font-bold text-slate-800 text-sm">Escalas Numéricas</h2>
          <p className="text-[10px] text-slate-400">
            {filled.length > 0 ? `${filled.length} escala(s) preenchida(s)` : 'Preencha as escalas aplicadas'}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
      </div>

      {/* Group tabs */}
      <div className="flex gap-1 px-3 pt-2 pb-0 overflow-x-auto scrollbar-hide flex-wrap">
        {SIMPLE_SCALE_GROUPS.map(g => (
          <button key={g.id} onClick={() => setActiveGroup(g.id)}
            className={`text-[9px] font-bold px-2 py-1 rounded-full border whitespace-nowrap transition-all ${activeGroup===g.id?'bg-teal-600 text-white border-teal-400':'bg-slate-50 text-slate-500 border-slate-200 hover:border-teal-300'}`}>
            {g.label}
          </button>
        ))}
      </div>

      {/* Scale inputs */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {group && group.scales.map(s => (
          <NumericScaleInput key={s.key}
            label={s.label} hint={s.hint} unit={s.unit}
            min={s.min} max={s.max} step={s.step}
            value={values[s.key] ?? ''}
            onChange={v => setVal(s.key, v)}/>
        ))}
      </div>

      {/* Summary of filled values */}
      {filled.length > 0 && (
        <div className="px-5 py-2 bg-teal-50 border-t border-teal-100">
          <p className="text-[9px] text-teal-700 font-bold">Preenchidos:</p>
          <p className="text-[9px] text-teal-600 leading-relaxed">
            {filled.map(([k,v]) => {
              const sc = SIMPLE_SCALE_GROUPS.flatMap(g=>g.scales).find(s=>s.key===k);
              return `${sc?.label||k}: ${v}`;
            }).join(' · ')}
          </p>
        </div>
      )}

      <div className="px-5 py-3 border-t flex gap-2">
        <button onClick={handleInserir}
          className="flex-1 py-2 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-500 text-white transition-colors">
          Inserir nas notas
        </button>
        <button onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
          Fechar
        </button>
      </div>
    </div>
  );
};

const ScalesModal = ({ onClose, onInserir }) => {
  const [active, setActive] = useState(null);

  const W = ({children}) => <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>{children}</div>;
  if (active === 'park')  return <W><ExameParkinsoniano onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'updrs') return <W><div onClick={e=>e.stopPropagation()} className="text-xs text-white p-4">UPDRS abre via botão dedicado na interface</div></W>;
  if (active === 'bfm')   return <W><BFMScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'sara')  return <W><SARaScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'pdq39') return <W><PDQ39Scale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'pdq8')  return <W><PDQ8Scale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'ygtss') return <W><YGTSSScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'hy')    return <W><HoehnYahrScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'se')    return <W><SchwabEnglandScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'quedas')return <W><QuedasScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'ess')   return <W><EpworthScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'fogq')  return <W><FOGQScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'nms')   return <W><NMSQuestScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'bdi')   return <W><BDIScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'mmse')  return <W><MMSEScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'moca')  return <W><MoCAScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'twstrs')return <W><TWSTRSScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'ftm')   return <W><FTMScale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'sf36')  return <W><SF36Scale onClose={onClose} onInserir={onInserir} /></W>;
  if (active === 'eq5d')  return <W><EQ5DScale onClose={onClose} onInserir={onInserir} /></W>;

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
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          {[...new Set(SCALE_LIST.map(s=>s.group))].map(group => (
            <div key={group} className="mb-3">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">{group}</p>
              <div className="flex flex-col gap-1">
                {SCALE_LIST.filter(s=>s.group===group).map(s => (
                  <button key={s.id} onClick={() => setActive(s.id)}
                    className="w-full text-left px-4 py-2 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 font-bold text-sm text-slate-700 transition-all">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { ScalesModal };
