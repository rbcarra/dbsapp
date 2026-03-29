import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';

// ─── PARSER ────────────────────────────────────────────────────────────────

const DATE_RE = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
const KEYWORD_RE = /\b(ambulat[oó]rio|retorno|consulta|seguimento)\b/i;
const isDateLine = (line) => {
  const t = line.trim();
  if (DATE_RE.test(t) && (t.match(/^\d{1,2}[\/\-\.]/)||KEYWORD_RE.test(t))) return true;
  return false;
};

const parseDate = (text) => {
  const t = (text || '').trim();
  const m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\.\-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2,'0'), mo = m[2].padStart(2,'0');
    const y = m[3].length === 2 ? '20'+m[3] : m[3];
    return d+'/'+mo+'/'+y;
  }
  return t.split('\n')[0].slice(0,20).trim();
};

// Number before unit ("2,3 V", "130 Hz") OR after keyword ("pw 60", "freq 130")
const getParam = (seg, unitPatterns) => {
  for (const pat of unitPatterns) {
    const reBefore = new RegExp('([\\d][\\d\\.,]*)\\s*' + pat, 'gi');
    const reAfter  = new RegExp(pat + '[:\\s=]+([\\d][\\d\\.,]*)', 'gi');
    let m, last = null;
    while ((m = reBefore.exec(seg)) !== null) last = m[1];
    if (last !== null) return parseFloat(last.replace(',','.'));
    while ((m = reAfter.exec(seg))  !== null) last = m[1];
    if (last !== null) return parseFloat(last.replace(',','.'));
  }
  return null;
};

// Longest run of 0/+/- -- Correção 3: ignorar 5º símbolo (case marker)
const extractContacts = (seg) => {
  // Strip spaces between contact symbols so "+0 - -" → "+0--"
  const spaceStripped = seg.replace(/([0+\-])\s+(?=[0+\-])/g, '$1');
  const clean = spaceStripped.replace(/bipolar/gi,'').replace(/\bC[+\-]?(?=[\s\/])/gi,'');
  const matches = clean.match(/[0+\-]{2,}/g) || [];
  const best = matches.sort((a,b) => b.length-a.length)[0] || '';
  return (best.length === 5 && best[4] === '+') ? best.slice(0, 4) : best;
};

const parseSide = (s) =>
  /^(e|l|esq|left|esquerdo|1$)/i.test((s||'').trim()) ? 'L' : 'R';

// Correção 2: fallback sem unidade — menor entre 40-180 = pw, maior = freq
const parseParams = (seg) => {
  const amp  = getParam(seg, ['m[aA]', '[Vv](?![Hh][Zz])(?![a-zA-Z])']) ?? 0;
  const pw   = getParam(seg, ['\\bpw\\b', '(?<![a-zA-Z])ms\\b', '[\\xb5u\\u03bc]s', '\\bμs\\b']);
  const freq = getParam(seg, ['[Hh][Zz]\\b', '\\bfreq(?:u[eê]ncia)?\\b', '\\bfr\\b']);

  let resolvedPw = pw ?? 60;
  let resolvedFreq = freq ?? 130;

  // Se ambos não foram encontrados com unidade, inferir pelos números soltos
  if (pw === null && freq === null) {
    const numRe = /(?<![,\d])(\d{2,3})(?![,\d])/g;
    const nums = [];
    let m;
    while ((m = numRe.exec(seg)) !== null) {
      const v = parseInt(m[1]);
      if (v >= 40 && v <= 180 && Math.abs(v - amp) > 0.5) nums.push(v);
    }
    if (nums.length >= 2) {
      nums.sort((a,b) => a-b);
      resolvedPw   = nums[0];
      resolvedFreq = nums[nums.length-1];
    } else if (nums.length === 1) {
      if (nums[0] < 100) resolvedPw = nums[0];
      else resolvedFreq = nums[0];
    }
  }

  // Extract inline impedance: bare number 400-9999 that wasn't claimed by amp/pw/freq
  let impedancia = null;
  const impInline = getParam(seg, ['\\bimp(?:edân?cia)?\\b', '\\bimpedance\\b']);
  if (impInline !== null && impInline >= 400 && impInline <= 9999) {
    impedancia = Math.round(impInline);
  } else {
    // Bare number 400-9999 not matched by amp/pw/freq
    const bareRe = /(?<![,\d])(\d{3,4})(?![,\d])/g;
    let bm;
    while ((bm = bareRe.exec(seg)) !== null) {
      const v = parseInt(bm[1]);
      if (v >= 400 && v <= 9999 && Math.abs(v - amp) > 1 && v !== resolvedPw && v !== resolvedFreq) {
        impedancia = v; break;
      }
    }
  }

  return { contatos: extractContacts(seg), amp, pw: resolvedPw, freq: resolvedFreq, impedancia };
};

// ─── BATTERY + IMPEDANCE EXTRACTION ─────────────────────────────────────
// Scans the whole text block for battery voltage and impedance values

const extractBatteryImpedance = (fullText) => {
  if (!fullText) return { bateria: null, impedanciaL: null, impedanciaR: null };

  // Battery: "bateria 2.9v", "bateria: 2,9V", "bat 3.1 v", "IPG 2.9V"
  let bateria = null;
  const batMatch = fullText.match(
    /(?:bateria|batter[yi]|bat|ipg)\s*[:\-]?\s*([0-9]+[.,][0-9]+|[0-9]+)\s*[Vv]/i
  );
  if (batMatch) bateria = parseFloat(batMatch[1].replace(',', '.'));

  // Impedance — several formats:
  //   "imp 1234", "impedancia 1234", "impedância: 1234"
  //   "Imp E 1234 D 5678"  (paired)
  //   bare number 400-9999 on a lead line (handled per-line in parseProgramming)
  // Here we look for global/session-level mentions

  let impedanciaL = null;
  let impedanciaR = null;

  // Paired: "Imp E 1234 / D 5678" or "ImpE: 1234 ImpD: 5678"
  const pairedMatch = fullText.match(
    /imp(?:edân?cia)?\s*[Ee]\s*[:\-]?\s*([0-9]{3,5})\s*[\/,]?\s*[Dd]\s*[:\-]?\s*([0-9]{3,5})/i
  );
  if (pairedMatch) {
    impedanciaL = pairedMatch[1];
    impedanciaR = pairedMatch[2];
  }

  // Single mentions near side keywords
  // "Impedância Esquerdo: 1234" / "Imp E 1234" / "imp esq 1234"
  if (!impedanciaL) {
    const impLMatch = fullText.match(
      /imp(?:edân?cia)?\s*(?:esq(?:uerdo)?|left|e)\s*[:\-]?\s*([0-9]{3,5})/i
    );
    if (impLMatch) impedanciaL = impLMatch[1];
  }
  if (!impedanciaR) {
    const impRMatch = fullText.match(
      /imp(?:edân?cia)?\s*(?:dir(?:eito)?|right|d)\s*[:\-]?\s*([0-9]{3,5})/i
    );
    if (impRMatch) impedanciaR = impRMatch[1];
  }

  // Single global impedance (no side specified) → assign to both or L
  if (!impedanciaL && !impedanciaR) {
    const impGlobal = fullText.match(
      /(?:imp(?:edân?cia)?|impedance)\s*[:\-]?\s*([0-9]{3,5})/i
    );
    if (impGlobal) {
      impedanciaL = impGlobal[1];
      impedanciaR = impGlobal[1];
    }
  }

  return { bateria, impedanciaL, impedanciaR };
};

// ─── PROGRAMMING PARSER ───────────────────────────────────────────────────
const isImpedanceOnlyLine = (text) => {
  // Lines like "Lead E 2108 1.2mA" or "Lead E 2108" where there's no pw/freq
  // and the first number is 400-9999 (impedance range)
  const pw = text.match(/\bpw\b|[µu]s\b|\bms\b/i);
  const freq = text.match(/[Hh]z\b|\bfreq\b/i);
  if (pw || freq) return false; // has pw or freq → real program
  // Check if first significant number is impedance-range
  const nums = [...text.matchAll(/([0-9]+[.,]?[0-9]*)/g)].map(m => parseFloat(m[1].replace(',','.')));
  const hasImpedance = nums.some(n => n >= 400 && n <= 9999 && n === Math.floor(n));
  const hasContacts = /[0+\-]{2,}/.test(text.replace(/([0+\-])\s+(?=[0+\-])/g,'$1'));
  // If no contact pattern and has impedance-range number → skip as programming
  return hasImpedance && !hasContacts;
};

const parseProgramming = (rawText) => {
  if (!rawText) return {};
  const result = {};
  let currentGroup = 'A';
  let inGroupSection = false; // true after first explicit group header

  const push = (group, side, prog) => {
    if (!result[group]) result[group] = {};
    if (!result[group][side]) result[group][side] = [];
    // Limit to 2 programs per side per group (interleaving cap)
    if (result[group][side].length >= 2) return;
    // Skip entries with no contacts and no meaningful amp
    if (!prog.contatos && prog.amp === 0) return;
    result[group][side].push(prog);
  };

  for (const rawLine of rawText.split(/\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip comment/decision lines that start with - or • or #
    if (/^[\-•#]/.test(line) && !/^[-]{2,}/.test(line)) continue;

    // Group header: "Grupo A", "GRUPO B (EM USO...)", "A:", "A- SEGURANÇA", bare "B"/"C"/"D"
    const gm =
      line.match(/^grupo\s+([a-dA-D1-4])\b/i) ||
      line.match(/^([a-dA-D1-4])\s*[-:.]/) ||
      line.match(/^([a-dA-D1-4])\s*$/);
    if (gm) {
      const g = gm[1].toUpperCase();
      currentGroup = {'1':'A','2':'B','3':'C','4':'D'}[g] || g;
      inGroupSection = true;
      continue;
    }

    // "Lead 1 (E): ..." ou "Lead 2 (D): ..."
    const m1 = line.match(/lead\s+(?:\d+\s+)?\(([^)]+)\)\s*[:](.*)/i);
    if (m1) {
      if (!isImpedanceOnlyLine(m1[2]||line)) push(currentGroup, parseSide(m1[1]), parseParams(m1[2]||line));
      continue;
    }

    // "Lead E: ...", "Lead D1: ...", "Lead 1: ...", "Lead 2: ..."
    const m2 = line.match(/lead\s*\(?([EDLRedlr12]\d*)\)?\s*[:/ ](.*)/i);
    if (m2) {
      if (!isImpedanceOnlyLine(m2[2]||line)) push(currentGroup, parseSide(m2[1]), parseParams(m2[2]||line));
      continue;
    }

    // Interleaving: "(E2): ...", "(D1): ..."
    const m3 = line.match(/^\(([EDLRedlr]\d*)\)\s*[:](.*)/i);
    if (m3) { push(currentGroup, parseSide(m3[1]), parseParams(m3[2]||line)); continue; }

    // "ESQ ...", "DIR ..."
    const mEsqDir = line.match(/^(ESQ|DIR|ESQUERDO|DIREITO)\s+(.+)/i);
    if (mEsqDir) {
      const side = /^(ESQ|ESQUERDO)/i.test(mEsqDir[1]) ? 'L' : 'R';
      push(currentGroup, side, parseParams(mEsqDir[2])); continue;
    }

    // "E 0-00 2,8mA..." ou "D: 0-00 ..." sem palavra "Lead"
    const m4 = line.match(/^([EDed])\s*[:.\s]\s*(.*)/);
    if (m4 && !/^(eletrodo|desc|esq|dir)/i.test(line)) {
      push(currentGroup, parseSide(m4[1]), parseParams(m4[2]||line)); continue;
    }
  }
  return result;
};

// ─── CSV EXPORT ─────────────────────────────────────────────────
// ─── THRESHOLD TEST PARSER ───────────────────────────────────────────────────

const POSITIVE_EFFECTS = ['bradicinesia','rigidez','tremor'];

// Effect keyword → DBS Log tipo mapping
// Key = regex pattern (case insensitive), value = tipo
const EFFECT_PATTERNS = [
  [/c[aá]psula|cap|capsula/i,          'Cápsula'],
  [/parestesia|paresthesia/i,             'Parestesia'],
  [/disartria|dysarthria/i,               'Disartria'],
  [/bradicinesia|bradykinesia/i,          'bradicinesia'],
  [/rigidez|rigidity/i,                   'rigidez'],
  [/tremor/i,                             'tremor'],
  // Everything else → Outros
  [/mal.?estar|inespec[íi]fico|tontura|n[áa]usea|enjoo|cefaleia|visual|turvação|turva[çc]/i, 'Outros'],
  [/flex[ãa]o|extens[ãa]o|contra[çc][ãa]o|espasmo|contrac/i,                               'Outros'],
  [/calor|frio|formigamento|sensação|sens[ao]/i,                                             'Outros'],
];

// Map high contact numbers (8-15) to electrode contacts (0-7 → subtract 8 for right)
// Assumes: left uses 0-7, right uses 8-15 (or 0-3 and 8-11 for 4-contact)
const mapContactNum = (numStr) => {
  const n = parseInt(numStr);
  if (isNaN(n)) return null;
  // High numbers: map to local electrode contact
  if (n >= 8) return { local: String(n - 8), inferredSide: 'R' };
  return { local: String(n), inferredSide: 'L' };
};

const parseThresholdText = (text, ladoDefault, pw = 60, freq = 130) => {
  if (!text || !text.trim()) return [];
  const markers = [];

  // Split on "//" or newline, then process section by section for left/right
  // First detect if text has "Esquerdo:" / "Direito:" section markers
  const normalized = text.replace(/\/\//g, '\n');
  const allLines = normalized.split(/\n/).map(l => l.trim()).filter(Boolean);

  let currentSide = ladoDefault || 'L'; // track which side we're parsing

  for (const line of allLines) {
    // Side section headers: "Esquerdo:", "Direito:", "Hemisfério E:", etc.
    // After detecting side, continue processing the REMAINDER of the same line
    let lineToProcess = line;
    if (/^(esquerdo|hemisf[eé]rio\s*e|hsq?e?\b|lado\s*e)/i.test(line)) {
      currentSide = 'L';
      lineToProcess = line.replace(/^(esquerdo|hemisf[eé]rio\s*e|lado\s*e)[\s:]+/i, '').trim();
      if (!lineToProcess) continue;
    } else if (/^(direito|hemisf[eé]rio\s*d|hsd?\b|lado\s*d)/i.test(line)) {
      currentSide = 'R';
      lineToProcess = line.replace(/^(direito|hemisf[eé]rio\s*d|lado\s*d)[\s:]+/i, '').trim();
      if (!lineToProcess) continue;
    }

    // Skip lines that say "sem efeitos" clearly
    if (/sem\s+efeitos?\s+colaterais?/i.test(lineToProcess)) continue;

    // ── Find contact identifier ──
    const ctMatch =
      lineToProcess.match(/(?:contato|n[íi]vel|n[íi]vel\s+direcional|contact)[\s.:-]*([0-9]+[ABC]?)/i) ||
      lineToProcess.match(/^\s*([0-9]+[ABC]?)[\s.:-]/);

    if (!ctMatch) continue;
    const rawContact = ctMatch[1];

    // Determine contact string and infer side from high numbers
    let contactStr, side = currentSide;
    if (/[ABC]$/.test(rawContact)) {
      // Directional contact like "1A"
      contactStr = rawContact.toUpperCase();
    } else {
      const mapped = mapContactNum(rawContact);
      if (!mapped) continue;
      contactStr = mapped.local;
      // If high number detected, override current side
      if (parseInt(rawContact) >= 8) side = mapped.inferredSide;
    }

    // ── Find amplitude in this line (V or mA, comma or dot) ──
    // Look for patterns like "4,6V", "5.3 mA", "2,4V>"
    const ampMatch = lineToProcess.match(/([0-9]+[.,][0-9]+|[0-9]+)\s*[Vv](?![a-zA-Z])/i) ||
                     lineToProcess.match(/([0-9]+[.,][0-9]+|[0-9]+)\s*m[Aa]/i);
    if (!ampMatch) continue;
    const amp = parseFloat(ampMatch[1].replace(',', '.'));
    if (isNaN(amp) || amp <= 0 || amp > 20) continue; // sanity check

    // ── Classify effect from rest of line ──
    // Skip the contact+amplitude part, look at the remainder
    const remainder = lineToProcess.slice(ctMatch.index + ctMatch[0].length);
    
    if (/sem\s+efeitos?/i.test(remainder)) continue;

    let tipo = null;
    for (const [pattern, tipoName] of EFFECT_PATTERNS) {
      if (pattern.test(remainder) || pattern.test(lineToProcess)) {
        tipo = tipoName;
        break;
      }
    }

    // If no known effect found but line has content beyond amp → Outros
    const afterAmp = (remainder + ' ' + lineToProcess).replace(/[0-9]+[.,]?[0-9]*\s*[VvmMaA]+[><]?\s*/g,'').trim();
    if (!tipo && afterAmp.length > 3 && !/sem\s+efeito/i.test(afterAmp)) {
      tipo = 'Outros';
    }
    if (!tipo) continue;

    markers.push({
      id: Date.now() + Math.random(),
      tipo,
      config: `${contactStr}-100`,
      amp,
      pw,
      freq,
      grupo: 'A',
      lado: side,
      timestamp: Date.now(),
    });
  }
  return markers;
};

// Split combined threshold text into L and R markers
const parseThresholdBothSides = (text, pw = 60, freq = 130) => {
  const all = parseThresholdText(text, 'L', pw, freq);
  const L = all.filter(m => m.lado === 'L');
  const R = all.filter(m => m.lado === 'R');
  return { L, R };
};


const CSV_GKS   = ['A','B','C','D'];
const CSV_SIDES = [['E','L'],['D','R']];

// Cabeçalho único compartilhado
const CSV_HEADER = (() => {
  const h = ['Nome','HC','Data','Resumo','Eletrodo','Bateria(V)',
    'ImpedanciaE','ImpedanciaD','CyclingE','CyclingD'];
  CSV_GKS.forEach(g => CSV_SIDES.forEach(([ln]) => {
    h.push('Grupo'+g+'_Lead'+ln+'_Contatos');
    h.push('Grupo'+g+'_Lead'+ln+'_Amp(mA)');
    h.push('Grupo'+g+'_Lead'+ln+'_PW(us)');
    h.push('Grupo'+g+'_Lead'+ln+'_Freq(Hz)');
    h.push('Grupo'+g+'_Lead'+ln+'_Efeito');
  }));
  h.push('EfeitosColateraisE','EfeitosColateraisD','NotasLivres');
  return h;
})();

// Célula CSV: escapa aspas e envolve em "..."
// Newlines viram espaço para manter uma linha por sessão
const csvCell = (v) => {
  const s = String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
  return '"' + s + '"';
};

// Converte array de reviewed rows em string CSV completa
const buildCSVString = (rows) => {
  const lines = [];
  // Cabeçalho
  lines.push(CSV_HEADER.map(csvCell).join(','));
  // Dados
  rows.forEach(r => {
    const parsed = r.parsed || {};
    const row = [];
    row.push(r.nome, r.hc, r.date, r.resumo || '', '4-ring','','','','Não','Não');
    CSV_GKS.forEach(g => {
      CSV_SIDES.forEach(([, s]) => {
        const progs = parsed[g] && parsed[g][s];
        const ef = (r.efeitosGrupos || {})[g] || 'neutro';
        if (!progs || progs.length === 0) {
          row.push('','','','', ef);
        } else {
          const p = progs[0];
          row.push(p.contatos||'', p.amp||'', p.pw||'', p.freq||'', ef);
        }
      });
    });
    row.push('', '', r.evolution || '');
    lines.push(row.map(csvCell).join(','));
  });
  return lines.join('\n');
};

const exportCSV = (rows) => {
  const csv = buildCSVString(rows);
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'extracao_' + (rows[0]?.nome||'pac') + '_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const TIPOS_ELETRODO_EXTRATOR = ['4-ring', '8-ring', 'directional'];

const FIELDS = ['date','evolution','programming'];
const FIELDS_OPTIONAL = ['thresholdL', 'thresholdR'];
const FIELD_INFO = {
  date:        { label:'DATA DA CONSULTA',  icon:'📅', hint:'Selecione a data no texto — deixe sem preenchimento para estimar automaticamente', color:'amber'   },
  evolution:   { label:'EVOLUÇÃO CLÍNICA',  icon:'📋', hint:'Selecione o parágrafo de evolução', color:'sky' },
  programming: { label:'PROGRAMAÇÃO ATUAL', icon:'⚡', hint:'Selecione o trecho Lead E/D… mA… Hz', color:'emerald' },
  thresholdL:  { label:'LIMIARES – HEMISFÉRIO ESQ', icon:'🧪', hint:'Selecione o trecho de teste de contato E', color:'violet' },
  thresholdR:  { label:'LIMIARES – HEMISFÉRIO DIR', icon:'🧪', hint:'Selecione o trecho de teste de contato D', color:'violet' },
};
const EFEITO_OPTS = [
  {val:'bom',    label:'Melhor',  cls:'bg-emerald-600 hover:bg-emerald-500 text-white'},
  {val:'neutro', label:'Mantido', cls:'bg-blue-600 hover:bg-blue-500 text-white'},
  {val:'pouco',  label:'Pouco',   cls:'bg-slate-500 hover:bg-slate-400 text-white'},
  {val:'ruim',   label:'Ruim',    cls:'bg-rose-600 hover:bg-rose-500 text-white'},
];

// ─── STEP DOT ─────────────────────────────────────────────────────────────
const StepDot = ({label,active,done}) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all ${
      done?'bg-emerald-500 border-emerald-400 text-white':active?'bg-amber-400 border-amber-300 text-slate-900':'bg-slate-800 border-slate-600 text-slate-500'}`}>
      {done?'✓':active?'●':'○'}
    </div>
    <span className={`text-[10px] font-bold tracking-wider uppercase ${active?'text-amber-300':done?'text-emerald-400':'text-slate-600'}`}>{label}</span>
  </div>
);

// ─── PARSE PREVIEW ────────────────────────────────────────────────────────
const ParsePreview = ({rawText, onUpdate}) => {
  const [localRaw, setLocalRaw] = useState(rawText);
  const parsed = useMemo(() => parseProgramming(localRaw), [localRaw]);
  const groups = Object.keys(parsed).sort();

  useEffect(() => { onUpdate(localRaw, parsed); }, [localRaw]);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={localRaw}
        onChange={e => setLocalRaw(e.target.value)}
        rows={4}
        className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-300 w-full focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none leading-relaxed"
        placeholder="Texto da programação (editável)"
      />
      {groups.length > 0 ? (
        <div className="flex flex-col gap-1">
          {groups.map(g => (
            <div key={g}>
              {['L','R'].map(side => {
                const progs = parsed[g]?.[side];
                if (!progs || progs.length === 0) return null;
                return progs.map((p, pi) => (
                  <div key={`${g}${side}${pi}`}
                    className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] font-black text-emerald-400 w-16 shrink-0">
                      Gr.{g} Lead {side==='L'?'E':'D'}{progs.length>1?` (${pi+1})`:''}
                    </span>
                    <span className="text-[11px] font-mono text-slate-300">
                      {p.contatos||'?'} · {p.amp} mA · {p.pw} µs · {p.freq} Hz
                    </span>
                  </div>
                ));
              })}
            </div>
          ))}
        </div>
      ) : localRaw.trim() ? (
        <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-1.5">
          ⚠ Nenhum Lead detectado — edite o texto acima
        </div>
      ) : null}
    </div>
  );
};

// ─── MANUAL PROG EDITOR ──────────────────────────────────────────────────
// Shown when parse detects no leads — lets user fix the text and retry
const ManualProgEditor = ({ rawText, onSave }) => {
  const [val, setVal] = React.useState(rawText || '');
  const parsed = useMemo(() => parseProgramming(val), [val]);
  const groups = Object.keys(parsed).sort();

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        rows={5}
        className="bg-slate-800 border border-rose-700/40 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-300 w-full focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none leading-relaxed"
        placeholder={'Exemplo:\nGrupo A:\nLead 1 (E): 00-0 / 2,3 V / pw 60 / 130 Hz\nLead 2 (D): 00-0 / 2,6 V / pw 60 / 130 Hz'}
      />
      {groups.length > 0 ? (
        <div className="flex flex-col gap-1">
          {groups.flatMap(g => ['L','R'].flatMap(side => {
            const progs = parsed[g]?.[side] || [];
            return progs.map((p, pi) => (
              <div key={g+side+pi} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">
                <span className="text-[10px] font-black text-emerald-400 w-20 shrink-0">Gr.{g} Lead {side==='L'?'E':'D'}{progs.length>1?` (${pi+1})`:''}</span>
                <span className="text-[10px] font-mono text-slate-300">{p.contatos||'?'} · {p.amp}V · {p.pw}µs · {p.freq}Hz</span>
              </div>
            ));
          }))}
          <button onClick={() => onSave(val)}
            className="mt-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 rounded-lg text-[10px] transition-all">
            ✓ Confirmar {groups.length} grupo(s) detectado(s)
          </button>
        </div>
      ) : val.trim() ? (
        <p className="text-[10px] text-rose-400 italic">Ainda sem leads detectados — verifique o formato</p>
      ) : null}
      <p className="text-[9px] text-slate-600 leading-tight">
        Formatos aceitos: "Grupo A / Lead 1 (E): 00-0 / 2,3V / pw 60 / 130Hz" · "Lead D: 0-00 / 1,4mA / 90ms / 180Hz"
      </p>
    </div>
  );
};

// ─── APP ──────────────────────────────────────────────────────────────────
const ExtractorModal = ({ onClose, onImportarPaciente, pacienteInicial = null }) => {
  const [phase, setPhase] = useState(pacienteInicial ? 'divide' : 'patient');
  const [nome,  setNome]  = useState(pacienteInicial?.nome || '');
  const [hc,    setHc]    = useState(pacienteInicial?.hc || '');
  const [tipoEletrodoGlobal, setTipoEletrodoGlobal] = useState('4-ring');
  const [rawText,    setRawText]    = useState('');
  const [textReady,  setTextReady]  = useState(false);
  const [boundaries, setBoundaries] = useState(new Set([0]));
  const [consultIdx, setConsultIdx] = useState(0);
  const [fieldIdx,   setFieldIdx]   = useState(0);
  const [captured,   setCaptured]   = useState({});
  const [reviewed,   setReviewed]   = useState([]);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [lastCapture,setLastCapture]= useState('');
  const [flash,      setFlash]      = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const textPanelRef = useRef(null);
  const dividePanelRef = useRef(null);

  const lines = useMemo(() => rawText.split('\n'), [rawText]);
  const sortedB = useMemo(() => [...boundaries].sort((a,b)=>a-b), [boundaries]);
  const consultations = useMemo(() => sortedB.map((start,i) => {
    const end = sortedB[i+1] ?? lines.length;
    return {start, end, text: lines.slice(start,end).join('\n')};
  }), [sortedB, lines]);

  const currentConsultText = consultations[consultIdx]?.text || '';
  const currentField = FIELDS[fieldIdx];
  const capturedForConsult = captured[consultIdx] || {};
  const allFieldsDone = FIELDS.every(f => capturedForConsult[f] !== undefined);
  const thresholdLDone = capturedForConsult['thresholdL'] !== undefined;
  const thresholdRDone = capturedForConsult['thresholdR'] !== undefined;

  // ── Auto-fill: roda quando muda de consulta ──────────────────────────────
  const autoFillConsult = useCallback((cidx) => {
    const text = consultations[cidx]?.text || '';
    if (!text.trim()) return;
    const lines = text.split('\n');

    // 1. Primeira data
    let dateLine = '';
    for (const l of lines) {
      if (DATE_RE.test(l) && (KEYWORD_RE.test(l) || /^\d{1,2}[\/\-\.]/.test(l.trim()))) {
        dateLine = l.trim(); break;
      }
    }

    // 2. Último bloco de programação: última linha "Lead" / "Grupo" e tudo até o fim
    let progStartIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].trim().toLowerCase();
      if (/^grupo\s+[a-d1-4]/.test(l) || /lead\s+\d/.test(l) || /lead\s+[edlr]/.test(l)) {
        progStartIdx = i; break;
      }
    }
    // Walk back to include the whole programming section (contiguous block ending there)
    if (progStartIdx > 0) {
      for (let i = progStartIdx - 1; i >= 0; i--) {
        const l = lines[i].trim().toLowerCase();
        if (/^grupo\s+[a-d1-4]/.test(l) || /lead/.test(l) || /^[\(\-]/.test(l) || l === '') {
          progStartIdx = (l === '' && i < progStartIdx - 2) ? progStartIdx : i;
        } else break;
      }
    }
    const progText = progStartIdx >= 0 ? lines.slice(progStartIdx).join('\n').trim() : '';

    // 3. Evolution: everything between first date line and prog block, excluding header (first 2 lines)
    const dateLineIdx = dateLine ? lines.findIndex(l => l.includes(dateLine.slice(0,10))) : 0;
    const evoStart = Math.max(dateLineIdx + 1, 1);
    const evoEnd   = progStartIdx > 0 ? progStartIdx : lines.length;
    const evolution = lines.slice(evoStart, evoEnd).join('\n').trim();

    setCaptured(prev => ({
      ...prev,
      [cidx]: {
        date: dateLine,
        evolution,
        programming: progText,
        efeitosGrupos: {},
        ...(prev[cidx] || {}),  // don't override if already manually set
      }
    }));
  }, [consultations]);

  useEffect(() => {
    if (phase === 'extract') {
      // Only auto-fill if this consult hasn't been touched yet
      setCaptured(prev => {
        if (prev[consultIdx]) return prev; // already has data, don't override
        const text = consultations[consultIdx]?.text || '';
        if (!text.trim()) return prev;
        const lines = text.split('\n');
        let dateLine = '';
        for (const l of lines) {
          if (DATE_RE.test(l) && (KEYWORD_RE.test(l) || /^\d{1,2}[\/\-\.]/.test(l.trim()))) {
            dateLine = l.trim(); break;
          }
        }
        let progStartIdx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          const l = lines[i].trim().toLowerCase();
          if (/^grupo\s+[a-d1-4]/.test(l) || /lead\s+\d/.test(l) || /lead\s+[edlr]/.test(l)) {
            progStartIdx = i; break;
          }
        }
        if (progStartIdx > 0) {
          for (let i = progStartIdx - 1; i >= 0; i--) {
            const l = lines[i].trim().toLowerCase();
            if (/^grupo\s+[a-d1-4]/.test(l) || /lead/.test(l) || /^[\(\-]/.test(l) || l === '') {
              progStartIdx = i;
            } else break;
          }
        }
        const progText = progStartIdx >= 0 ? lines.slice(progStartIdx).join('\n').trim() : '';
        const dateLineIdx = dateLine ? lines.findIndex(l => l.includes(dateLine.slice(0,10))) : 0;
        const evoStart = Math.max(dateLineIdx + 1, 1);
        const evoEnd   = progStartIdx > 0 ? progStartIdx : lines.length;
        const evolution = lines.slice(evoStart, evoEnd).join('\n').trim();
        return {
          ...prev,
          [consultIdx]: { date: dateLine, evolution, programming: progText, efeitosGrupos: {} }
        };
      });
      setFieldIdx(0);
    }
  }, [consultIdx, phase]);

  // Auto-detect date lines when text is ready
  const autoDetectDates = useCallback((text) => {
    const ls = text.split('\n');
    const found = new Set([0]);
    ls.forEach((line, i) => { if (i > 0 && isDateLine(line)) found.add(i); });
    setBoundaries(found);
  }, []);

  const toggleBoundary = (li) => {
    if (li === 0) return;
    setBoundaries(prev => {
      const n = new Set(prev);
      n.has(li) ? n.delete(li) : n.add(li);
      return n;
    });
  };

  const doCapture = useCallback(() => {
    const sel = window.getSelection();
    const txt = sel?.toString().trim() || '';
    if (!txt) { setFlash(true); setTimeout(()=>setFlash(false),600); return; }
    setCaptured(prev => ({...prev, [consultIdx]: {...(prev[consultIdx]||{}), [FIELDS[fieldIdx]]: txt}}));
    setLastCapture(txt);
    sel.removeAllRanges();
    if (fieldIdx < FIELDS.length-1) setFieldIdx(f=>f+1);
  }, [fieldIdx, consultIdx]);

  const skipField = () => {
    setCaptured(prev => ({...prev, [consultIdx]: {...(prev[consultIdx]||{}), [FIELDS[fieldIdx]]: ''}}));
    if (fieldIdx < FIELDS.length-1) setFieldIdx(f=>f+1);
  };

  const nextConsult = () => {
    if (consultIdx < consultations.length-1) {
      setConsultIdx(c=>c+1); setFieldIdx(0); setLastCapture('');
    } else {
      const rows = consultations.map((_,i) => {
        const d = captured[i] || {};
        const parsed = parseProgramming(d.programming || '');
        const grupos = Object.keys(parsed).sort();
        const efeitosGrupos = {};
        grupos.forEach(g => { efeitosGrupos[g] = (d.efeitosGrupos||{})[g] || 'neutro'; });
        // Parse threshold markers
        const tipoEl = d.tipoEletrodo || tipoEletrodoGlobal;
        const pw0 = Object.values(parsed).flatMap(s=>Object.values(s)).flat()[0]?.pw || 60;
        const freq0 = Object.values(parsed).flatMap(s=>Object.values(s)).flat()[0]?.freq || 130;
        // If thresholdL text contains side markers (Esquerdo/Direito), split automatically
        const threshLText = d.thresholdL || '';
        const threshRText = d.thresholdR || '';
        const hasCombined = /esquerdo|direito/i.test(threshLText);
        let marcadoresL, marcadoresR;
        if (hasCombined) {
          const both = parseThresholdBothSides(threshLText, pw0, freq0);
          marcadoresL = both.L;
          marcadoresR = both.R.concat(parseThresholdText(threshRText, 'R', pw0, freq0));
        } else {
          marcadoresL = parseThresholdText(threshLText, 'L', pw0, freq0);
          marcadoresR = parseThresholdText(threshRText, 'R', pw0, freq0);
        }
        // Extract battery and impedance from evolution + programming text
        const fullBlock = [d.date||'', d.evolution||'', d.programming||''].join(' ');
        const { bateria, impedanciaL, impedanciaR } = extractBatteryImpedance(fullBlock);
        // Also pick up per-lead impedance from parsed progs if available
        const impLFromProg = Object.values(parsed).flatMap(s=>(s.L||[])).find(p=>p.impedancia)?.impedancia;
        const impRFromProg = Object.values(parsed).flatMap(s=>(s.R||[])).find(p=>p.impedancia)?.impedancia;

        return { nome, hc, date: parseDate(d.date||''), resumo:'',
                 evolution: d.evolution||'', programmingRaw: d.programming||'',
                 parsed, efeitosGrupos, tipoEletrodo: tipoEl,
                 voltagemBateria: bateria !== null ? String(bateria) : '',
                 impedanciaL: impedanciaL || (impLFromProg ? String(impLFromProg) : ''),
                 impedanciaR: impedanciaR || (impRFromProg ? String(impRFromProg) : ''),
                 marcadoresClinicosL: marcadoresL,
                 marcadoresClinicosR: marcadoresR,
                 dateEstimated: !d.date };
      });
      // Estimate dates for sessions without a detected date
      const toTs = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const d = parseInt(parts[0]), mo = parseInt(parts[1]);
          const y = parseInt(parts[2].length === 2 ? '20'+parts[2] : parts[2]);
          const dt = new Date(y, mo-1, d);
          return isNaN(dt.getTime()) ? null : dt.getTime();
        }
        return null;
      };
      const toDateStr = (ts) => {
        const d = new Date(ts);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      };
      const filledRows = rows.map((r, i) => {
        if (!r.dateEstimated) return r;
        // Find prev and next known dates
        let prevTs = null, nextTs = null;
        for (let j = i-1; j >= 0; j--) { const t = toTs(rows[j].date); if (t) { prevTs = t; break; } }
        for (let j = i+1; j < rows.length; j++) { const t = toTs(rows[j].date); if (t) { nextTs = t; break; } }
        let estTs;
        if (prevTs && nextTs) estTs = Math.round((prevTs + nextTs) / 2);
        else if (nextTs) estTs = nextTs - 6*30*24*60*60*1000; // 6 months before next
        else if (prevTs) estTs = prevTs + 6*30*24*60*60*1000; // 6 months after prev
        else return r;
        return { ...r, date: toDateStr(estTs) };
      });
      setReviewed(filledRows); setPhase('review');
    }
  };

  const updateReviewed = (ri, field, val) =>
    setReviewed(prev => prev.map((r,i) => i===ri ? {...r,[field]:val} : r));

  const updateParsedProg = (ri, group, side, idx, field, val) =>
    setReviewed(prev => prev.map((r,i) => {
      if (i!==ri) return r;
      const np = JSON.parse(JSON.stringify(r.parsed||{}));
      if (!np[group]) np[group] = {};
      if (!np[group][side]) np[group][side] = [];
      if (!np[group][side][idx]) np[group][side][idx] = {contatos:'',amp:0,pw:60,freq:130};
      np[group][side][idx][field] = val;
      return {...r, parsed: np};
    }));

  const onKeyDown = useCallback((e) => {
    if (phase === 'divide' && textReady && e.key === 'Enter') {
      e.preventDefault();
      const panel = dividePanelRef.current;
      if (panel) panel.scrollBy({top: panel.clientHeight * 0.9, behavior:'smooth'});
      return;
    }
    if (phase === 'extract' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (allFieldsDone) nextConsult();
      else doCapture();
    }
  }, [phase, textReady, doCapture, allFieldsDone]);

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 text-slate-100 flex flex-col overflow-hidden" onKeyDown={onKeyDown} tabIndex={-1} style={{outline:'none'}}>

      {/* TOP BAR */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded flex items-center justify-center text-slate-900 font-black text-sm">DBS</div>
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Extrator de Prontuários</p>
            {nome && <p className="text-[10px] text-amber-300 font-mono">{nome} · HC {hc}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {['patient','divide','extract','review'].map((p,i) => (
            <StepDot key={p} label={['Paciente','Divisão','Extração','Revisão'][i]}
              active={phase===p} done={['patient','divide','extract','review'].indexOf(phase)>i} />
          ))}
        </div>
        <button onClick={onClose}
          className="text-slate-400 hover:text-white text-2xl leading-none font-bold ml-4 shrink-0"
          title="Fechar extrator">
          ×
        </button>
      </header>

      {/* ══ PATIENT ════════════════════════════════════════════════════════ */}
      {phase==='patient' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h1 className="text-lg font-black text-white mb-1">Identificação do Paciente</h1>
            <p className="text-xs text-slate-400 mb-6">Dados incluídos em todas as consultas exportadas.</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nome Completo</label>
                <input value={nome} onChange={e=>setNome(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Ex: João da Silva" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Registro HC</label>
                <input value={hc} onChange={e=>setHc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Ex: 1234567" />
              </div>
              <button onClick={()=>{if(nome&&hc)setPhase('divide');}} disabled={!nome||!hc}
                className="mt-2 w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-900 font-black py-3 rounded-lg text-sm shadow-lg transition-all">
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DIVIDE ══════════════════════════════════════════════════════════ */}
      {phase==='divide' && (
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0 overflow-hidden">
          {!textReady ? (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div>
                <h2 className="text-sm font-black text-white">Cole o Prontuário Completo</h2>
                <p className="text-xs text-slate-400">Todas as consultas de {nome} juntas</p>
              </div>
              <textarea value={rawText} onChange={e=>setRawText(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed"
                placeholder={'Cole o texto completo do prontuário aqui...\n\n15/03/2022\nPaciente retorna...\nLead D: 0--0 / 1,4 mA / 180hz / 90mS\n\n22/06/2022\n...'}
              />
              <button onClick={()=>{if(rawText.trim()){autoDetectDates(rawText);setTextReady(true);}}}
                disabled={!rawText.trim()}
                className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-900 font-black px-6 py-3 rounded-xl text-sm shadow-lg self-end transition-all">
                Detectar Consultas →
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-black text-white">Verifique as divisões detectadas</h2>
                  <p className="text-xs text-slate-400">
                    <span className="text-amber-300 font-bold">{consultations.length} consulta(s)</span> detectada(s) automaticamente ·
                    Clique no nº para adicionar/remover divisão · <kbd className="bg-slate-800 border border-slate-600 rounded px-1 text-[9px]">Enter</kbd> rola o texto
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{setTextReady(false);setBoundaries(new Set([0]));}}
                    className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-all">
                    ← Reeditar
                  </button>
                  <button onClick={()=>{setConsultIdx(0);setFieldIdx(0);setPhase('extract');}}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-black px-5 py-1.5 rounded-lg text-sm transition-all">
                    Iniciar Extração ({consultations.length}) →
                  </button>
                </div>
              </div>
              <div ref={dividePanelRef}
                className="flex-1 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl font-mono text-sm leading-6 min-h-0">
                {lines.map((line,li) => {
                  const isBound = boundaries.has(li);
                  return (
                    <div key={li} className={`flex group transition-colors ${isBound?'bg-amber-400/10 border-l-2 border-amber-400':'border-l-2 border-transparent hover:bg-slate-800/40'}`}>
                      <button onClick={()=>toggleBoundary(li)}
                        className={`w-12 shrink-0 text-right pr-3 py-0.5 text-[11px] font-bold select-none transition-all ${
                          isBound?'text-amber-400':'text-slate-600 group-hover:text-slate-400 hover:text-amber-300'}`}
                        title={li===0?'Início':isBound?'Remover divisão':'Marcar início de consulta'}>
                        {li===0?'▶':isBound?'◆':li+1}
                      </button>
                      <span className={`py-0.5 pl-2 whitespace-pre-wrap break-all ${isBound?'text-amber-200 font-bold':'text-slate-400'}`}>
                        {line||<span className="text-slate-700">⌀</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ EXTRACT ═════════════════════════════════════════════════════════ */}
      {phase==='extract' && (
        <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">
          {/* Left: text */}
          <div className="flex-1 flex flex-col min-h-0 border-r border-slate-800">
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Consulta {consultIdx+1} / {consultations.length}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${flash?'bg-rose-500 text-white':'bg-slate-800 text-slate-500'}`}>
                {flash?'⚠ Nada selecionado':'Selecione texto → Enter'}
              </span>
            </div>
            <div ref={textPanelRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap select-text bg-slate-950 cursor-text"
              style={{userSelect:'text'}}>
              {currentConsultText||<span className="text-slate-600 italic">Consulta vazia</span>}
            </div>
          </div>

          {/* Right: form */}
          <div className="w-84 shrink-0 flex flex-col bg-slate-900 min-h-0 overflow-y-auto" style={{width:'22rem'}}>
            {/* Fields — sempre editáveis */}
            <div className="border-b border-slate-800 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Campos da Consulta</p>
                <span className="text-[9px] text-slate-600">Selecione no texto → Enter · ou edite abaixo</span>
              </div>

              {/* DATA */}
              {(() => {
                const val = capturedForConsult.date;
                const isActive = fieldIdx===0 && !allFieldsDone;
                return (
                  <div className={`rounded-lg border p-2 transition-all ${isActive?'border-amber-400/50 bg-amber-400/5':'border-slate-700 bg-slate-800/40'}`}>
                    <div className="flex items-center gap-1.5 mb-1 cursor-pointer" onClick={()=>setFieldIdx(0)}>
                      <span className="text-[10px] font-black text-amber-300">📅 DATA</span>
                      {isActive && <span className="text-[9px] text-amber-400/60 italic">← campo ativo</span>}
                    </div>
                    <input
                      value={val||''}
                      onChange={e=>setCaptured(prev=>({...prev,[consultIdx]:{...(prev[consultIdx]||{}),date:e.target.value}}))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="dd/mm/aaaa — deixe vazio para estimar automaticamente"
                    />
                  </div>
                );
              })()}

              {/* EVOLUÇÃO */}
              {(() => {
                const val = capturedForConsult.evolution;
                const isActive = fieldIdx===1 && !allFieldsDone;
                return (
                  <div className={`rounded-lg border p-2 transition-all ${isActive?'border-sky-400/50 bg-sky-400/5':'border-slate-700 bg-slate-800/40'}`}>
                    <div className="flex items-center gap-1.5 mb-1 cursor-pointer" onClick={()=>setFieldIdx(1)}>
                      <span className="text-[10px] font-black text-sky-300">📋 EVOLUÇÃO</span>
                      {isActive && <span className="text-[9px] text-sky-400/60 italic">← campo ativo</span>}
                    </div>
                    <textarea
                      value={val||''}
                      onChange={e=>setCaptured(prev=>({...prev,[consultIdx]:{...(prev[consultIdx]||{}),evolution:e.target.value}}))}
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400 resize-none leading-relaxed"
                      placeholder="Evolução clínica..."
                    />
                  </div>
                );
              })()}

              {/* PROGRAMAÇÃO */}
              {(() => {
                const val = capturedForConsult.programming;
                const isActive = fieldIdx===2 && !allFieldsDone;

                const handleVisionImport = async (file) => {
                  if (!file) return;
                  setVisionLoading(true);
                  try {
                    const toBase64 = (f) => new Promise((res, rej) => {
                      const r = new FileReader();
                      r.onload = () => res(r.result.split(',')[1]);
                      r.onerror = rej;
                      r.readAsDataURL(f);
                    });
                    const b64 = await toBase64(file);
                    const mediaType = file.type || 'image/jpeg';

                    const resp = await fetch('/api/claude', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 1000,
                        messages: [{
                          role: 'user',
                          content: [
                            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
                            { type: 'text', text: `Esta é uma tela de programadora de DBS. Extraia a configuração de estimulação de cada área/lead visível e retorne APENAS o texto no formato abaixo, sem explicações adicionais:\n\nGrupo A:\nLead E: [contatos] [amplitude] mA / pw [pw] / [freq] Hz\nLead D: [contatos] [amplitude] mA / pw [pw] / [freq] Hz\n\nSe houver múltiplos programas ou áreas, use Grupo B, C etc. Para eletrodos direcionais, use o formato de porcentagem dos contatos (ex: 3A+33% 3B+33% 3C+34%). Contatos cátodo são indicados com - e ânodo com +. Se houver interleaving, adicione uma linha (E2) ou (D2).` }
                          ]
                        }]
                      })
                    });
                    const data = await resp.json();
                    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
                    if (text) {
                      setCaptured(prev => ({
                        ...prev,
                        [consultIdx]: { ...(prev[consultIdx]||{}), programming: text }
                      }));
                    }
                  } catch(e) {
                    console.error('Vision error:', e);
                  } finally {
                    setVisionLoading(false);
                  }
                };

                return (
                  <div className={`rounded-lg border p-2 transition-all ${isActive?'border-emerald-400/50 bg-emerald-400/5':'border-slate-700 bg-slate-800/40'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 cursor-pointer" onClick={()=>setFieldIdx(2)}>
                        <span className="text-[10px] font-black text-emerald-300">⚡ PROGRAMAÇÃO</span>
                        {isActive && <span className="text-[9px] text-emerald-400/60 italic">← campo ativo</span>}
                      </div>
                      <label className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${visionLoading ? 'bg-slate-700 text-slate-500' : 'bg-violet-800 hover:bg-violet-700 text-violet-200'}`}
                        title="Fotografar tela da programadora para extração automática">
                        {visionLoading ? '⏳ Lendo...' : '📷 Foto'}
                        <input type="file" accept="image/*" className="hidden"
                          disabled={visionLoading}
                          onChange={e => e.target.files?.[0] && handleVisionImport(e.target.files[0])} />
                      </label>
                    </div>
                    <textarea
                      value={val||''}
                      onChange={e=>setCaptured(prev=>({...prev,[consultIdx]:{...(prev[consultIdx]||{}),programming:e.target.value}}))}
                      rows={4}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none leading-relaxed"
                      placeholder="Lead E/D, Grupo A/B... ou use 📷 para fotografar a programadora"
                    />
                  </div>
                );
              })()}

              {/* Botão capturar — só mostra se há campo ativo */}
              {!allFieldsDone && (
                <button onClick={doCapture}
                  className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-black py-2 rounded-lg text-xs transition-all shadow-md">
                  Capturar seleção (Enter)
                </button>
              )}
            </div>

            {/* Programming parse result (editable) */}
            {capturedForConsult.programming !== undefined && capturedForConsult.programming !== '' && (() => {
              const parsed = parseProgramming(capturedForConsult.programming);
              const groups = Object.keys(parsed).sort();
              return (
                <div className="p-4 border-b border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Parse automático</p>
                  {groups.length===0 && (
                    <p className="text-[10px] text-rose-400">Nenhum Lead detectado — revise na tela de Revisão</p>
                  )}
                  {groups.flatMap(g => ['L','R'].map(side => {
                    const progs = parsed[g]?.[side];
                    if (!progs) return null;
                    return progs.map((p,pi) => (
                      <div key={`${g}${side}${pi}`} className="mb-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[10px] font-bold text-emerald-400 mb-0.5">Gr.{g} Lead {side==='L'?'E':'D'}{progs.length>1?` (${pi+1})`:''}:</p>
                        <p className="text-[11px] font-mono text-slate-300">{p.contatos||'?'} · {p.amp} mA · {p.pw} µs · {p.freq} Hz</p>
                      </div>
                    ));
                  }))}
                </div>
              );
            })()}

            {/* Editor manual de programação quando parse não detectou nada */}
            {capturedForConsult.programming !== undefined && (() => {
              const parsed = parseProgramming(capturedForConsult.programming);
              const groups = Object.keys(parsed);
              const nenhum = groups.length === 0;
              if (!nenhum) return null;
              // Nenhum lead detectado — mostrar editor de texto direto
              return (
                <div className="p-4 border-b border-slate-800">
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 mb-2">
                    <p className="text-rose-400 font-black text-[10px] mb-1">⚠ Nenhum Lead detectado</p>
                    <p className="text-rose-300/70 text-[10px]">Edite o texto abaixo para corrigir o formato e tente novamente</p>
                  </div>
                  <ManualProgEditor
                    rawText={capturedForConsult.programming}
                    onSave={(newRaw) => {
                      setCaptured(prev => ({
                        ...prev,
                        [consultIdx]: { ...(prev[consultIdx]||{}), programming: newRaw }
                      }));
                    }}
                  />
                </div>
              );
            })()}

            {/* Efeito por grupo — refere-se à consulta ANTERIOR (N-1) */}
            {(() => {
              const prevIdx = consultIdx - 1;
              if (prevIdx < 0) return (
                <div className="p-3 border-b border-slate-800">
                  <p className="text-[10px] text-slate-600 italic">Primeira consulta — sem sessão anterior para avaliar</p>
                </div>
              );
              const prevCapt = captured[prevIdx] || {};
              const parsedAnterior = parseProgramming(prevCapt.programming || '');
              const grupos = Object.keys(parsedAnterior).sort();
              const efGrupos = prevCapt.efeitosGrupos || {};
              const setEfeitoGrupo = (g, val) => setCaptured(prev => ({
                ...prev,
                [prevIdx]: {
                  ...(prev[prevIdx]||{}),
                  efeitosGrupos: { ...(prev[prevIdx]?.efeitosGrupos||{}), [g]: val }
                }
              }));
              return (
                <div className="p-3 border-b border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Resultado da Sessão Anterior
                  </p>
                  <p className="text-[9px] text-slate-600 mb-2">
                    Grupos da consulta {prevIdx+1} · como o paciente evoluiu com aquela programação?
                  </p>
                  {grupos.length === 0 ? (
                    <p className="text-[10px] text-slate-600 italic">Consulta anterior sem programação detectada</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {grupos.map(g => (
                        <div key={g} className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black text-slate-400 w-8 shrink-0">Gr.{g}</span>
                          {EFEITO_OPTS.map(o => (
                            <button key={o.val}
                              onClick={()=>setEfeitoGrupo(g, o.val)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all border ${
                                (efGrupos[g]||'neutro')===o.val
                                  ? o.cls+' border-transparent shadow-sm'
                                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'
                              }`}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tipo de eletrodo + threshold + Próxima / Concluir */}
            <div className="p-4 flex flex-col gap-3">
              {/* Tipo de eletrodo */}
              <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Eletrodo:</span>
                {TIPOS_ELETRODO_EXTRATOR.map(t => (
                  <button key={t}
                    onClick={() => {
                      setTipoEletrodoGlobal(t);
                      setCaptured(prev => ({...prev, [consultIdx]: {...(prev[consultIdx]||{}), tipoEletrodo: t}}));
                    }}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                      (capturedForConsult.tipoEletrodo || tipoEletrodoGlobal) === t
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-400'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
              {/* Threshold input — select+capture OR direct textarea */}
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  {[['thresholdL','🧪 Limiares E'], ['thresholdR','🧪 Limiares D']].map(([field, label]) => {
                    const done = (capturedForConsult[field] || '').trim().length > 0;
                    return (
                      <button key={field}
                        onClick={() => {
                          const sel = window.getSelection();
                          const txt = sel?.toString().trim() || '';
                          if (txt) {
                            setCaptured(prev => ({...prev, [consultIdx]: {...(prev[consultIdx]||{}), [field]: txt}}));
                            sel.removeAllRanges();
                          }
                        }}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          done
                            ? 'bg-violet-800/60 border-violet-600 text-violet-300'
                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-violet-500 hover:text-violet-300'
                        }`}
                        title="Selecione texto e clique para capturar">
                        {done ? '✓ ' : ''}Capturar {label.replace('🧪 Limiares ','')}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  {[['thresholdL','Limiares E — cole ou digite'], ['thresholdR','Limiares D — cole ou digite']].map(([field, placeholder]) => (
                    <textarea key={field}
                      value={capturedForConsult[field] || ''}
                      onChange={e => setCaptured(prev => ({...prev, [consultIdx]: {...(prev[consultIdx]||{}), [field]: e.target.value}}))}
                      placeholder={placeholder}
                      rows={3}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-violet-200 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-slate-600 leading-relaxed"
                    />
                  ))}
                </div>
              </div>
              <button onClick={nextConsult}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-2.5 rounded-lg text-sm transition-all shadow-md">
                {consultIdx<consultations.length-1
                  ?`Próxima consulta (${consultIdx+2}/${consultations.length}) →`
                  :'Concluir e Revisar →'}
              </button>
              <p className="text-[9px] text-slate-600 text-center">Enter confirma campos obrigatórios · Limiares: selecione e clique no botão</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ REVIEW ══════════════════════════════════════════════════════════ */}
      {phase==='review' && (
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-black text-white">Revisão — {reviewed.length} consulta(s)</h2>
              <p className="text-xs text-slate-400">{nome} · HC {hc} · Edite células antes de exportar</p>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{setPhase('extract');setConsultIdx(0);setFieldIdx(0);}}
                className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-all">
                ← Refazer
              </button>
              <button onClick={()=>exportCSV(reviewed)}
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-black px-5 py-1.5 rounded-lg text-sm transition-all shadow-md">
                ⬇ Exportar CSV
              </button>
              {onImportarPaciente && (
                <button onClick={() => onImportarPaciente(nome, hc, reviewed)}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white font-black px-5 py-1.5 rounded-lg text-sm transition-all shadow-md">
                  ⬆ Importar para DBS Log
                </button>
              )}
              <button onClick={()=>setShowCsvPreview(p=>!p)}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-4 py-1.5 rounded-lg text-xs transition-all border border-slate-600">
                {showCsvPreview ? 'Ocultar' : '📋 Ver CSV'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-0 border border-slate-800 rounded-xl">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700">
                <tr>
                  {['#','Data','Eletrodo','Bat.(V)','Imp.E','Imp.D','Lead E','Lead D','Evolução','Efeito','Limiares E','Limiares D','Status'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviewed.map((r,ri) => {
                  const allGroups = Object.keys(r.parsed||{}).sort();
                  const hasL = allGroups.some(g => r.parsed[g]?.L?.length);
                  const hasR = allGroups.some(g => r.parsed[g]?.R?.length);
                  const parseOk = hasL || hasR;

                  const renderLeadCell = (side) => {
                    const entries = allGroups.flatMap(g =>
                      (r.parsed[g]?.[side]||[]).map((p,pi) => ({g, side, pi, p}))
                    );
                    if (entries.length === 0) return (
                      <button onClick={()=>updateParsedProg(ri,'A',side,0,'contatos','0000')}
                        className="text-[10px] text-rose-400 hover:text-rose-300 border border-rose-800 hover:border-rose-600 px-2 py-0.5 rounded transition-all">
                        + Add
                      </button>
                    );
                    return (
                      <div className="flex flex-col gap-1">
                        {entries.map(({g,pi,p}) => (
                          <div key={`${g}${side}${pi}`} className="flex flex-col gap-0.5 bg-slate-800/60 rounded p-1.5 border border-emerald-800/30">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[9px] font-black text-emerald-500">Gr.{g}</span>
                              <input value={p.contatos} onChange={e=>updateParsedProg(ri,g,side,pi,'contatos',e.target.value)}
                                className="bg-slate-700 border border-slate-600 rounded px-1 py-0 font-mono text-emerald-300 w-16 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                title="Contatos" />
                            </div>
                            <div className="flex gap-1">
                              <div className="flex items-center gap-0.5">
                                <input value={p.amp} onChange={e=>updateParsedProg(ri,g,side,pi,'amp',e.target.value)}
                                  className="bg-slate-700 border border-slate-600 rounded px-1 py-0 font-mono text-slate-300 w-12 text-[11px] focus:outline-none" title="mA"/>
                                <span className="text-[8px] text-slate-500">mA</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <input value={p.pw} onChange={e=>updateParsedProg(ri,g,side,pi,'pw',e.target.value)}
                                  className="bg-slate-700 border border-slate-600 rounded px-1 py-0 font-mono text-slate-300 w-10 text-[11px] focus:outline-none" title="µs"/>
                                <span className="text-[8px] text-slate-500">µs</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <input value={p.freq} onChange={e=>updateParsedProg(ri,g,side,pi,'freq',e.target.value)}
                                  className="bg-slate-700 border border-slate-600 rounded px-1 py-0 font-mono text-slate-300 w-12 text-[11px] focus:outline-none" title="Hz"/>
                                <span className="text-[8px] text-slate-500">Hz</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  };

                  return (
                    <tr key={ri} className="border-b border-slate-800 hover:bg-slate-900/40 transition-colors align-top">
                      <td className="px-3 py-2 text-slate-500 font-mono font-bold">{ri+1}</td>
                      <td className="px-3 py-2">
                        <input value={r.date} onChange={e=>updateReviewed(ri,'date',e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-white w-24 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={r.tipoEletrodo || '4-ring'}
                          onChange={e => updateReviewed(ri, 'tipoEletrodo', e.target.value)}
                          className="bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-slate-300 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500">
                          {TIPOS_ELETRODO_EXTRATOR.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      {/* Battery */}
                      <td className="px-3 py-2">
                        <input value={r.voltagemBateria || ''} onChange={e=>updateReviewed(ri,'voltagemBateria',e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-amber-300 w-14 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                          placeholder="V" title="Bateria (V)"/>
                      </td>
                      {/* Impedance L */}
                      <td className="px-3 py-2">
                        <input value={r.impedanciaL || ''} onChange={e=>updateReviewed(ri,'impedanciaL',e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-sky-300 w-14 text-[10px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                          placeholder="Ω" title="Impedância E"/>
                      </td>
                      {/* Impedance R */}
                      <td className="px-3 py-2">
                        <input value={r.impedanciaR || ''} onChange={e=>updateReviewed(ri,'impedanciaR',e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-sky-300 w-14 text-[10px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                          placeholder="Ω" title="Impedância D"/>
                      </td>
                      <td className="px-3 py-2">{renderLeadCell('L')}</td>
                      <td className="px-3 py-2">{renderLeadCell('R')}</td>
                      {/* Threshold markers summary */}
                      {['marcadoresClinicosL','marcadoresClinicosR'].map(field => (
                        <td key={field} className="px-3 py-2 text-[9px]">
                          {(r[field]||[]).length === 0
                            ? <span className="text-slate-700 italic">—</span>
                            : (r[field]||[]).map((m,mi) => {
                              const isPos = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
                              return (
                                <div key={mi} className={`mb-0.5 font-mono ${isPos?'text-emerald-400':'text-rose-400'}`}>
                                  {m.config} {m.tipo} {m.amp}mA
                                </div>
                              );
                            })
                          }
                        </td>
                      ))}
                      <td className="px-3 py-2 min-w-[180px]">
                        <textarea value={r.evolution} onChange={e=>updateReviewed(ri,'evolution',e.target.value)}
                          rows={3} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 w-full text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none leading-relaxed" />
                      </td>
                      <td className="px-3 py-2 min-w-[120px]">
                        {Object.keys(r.parsed||{}).sort().map(g => (
                          <div key={g} className="mb-1.5">
                            <p className="text-[8px] font-black text-slate-500 mb-0.5">Gr.{g}</p>
                            <div className="flex flex-wrap gap-0.5">
                              {EFEITO_OPTS.map(o => (
                                <button key={o.val}
                                  onClick={()=>setReviewed(prev=>prev.map((row,i)=>i!==ri?row:{...row,efeitosGrupos:{...(row.efeitosGrupos||{}),[g]:o.val}}))}
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${
                                    ((r.efeitosGrupos||{})[g]||'neutro')===o.val?o.cls:'bg-slate-800 border border-slate-700 text-slate-500 hover:border-slate-500'
                                  }`}>
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${parseOk?'bg-emerald-500/20 text-emerald-400':'bg-rose-500/20 text-rose-400'}`}>
                          {parseOk?'✓ OK':'⚠ sem prog.'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showCsvPreview && (
            <div className="shrink-0 flex flex-col gap-1 border-t border-slate-800 pt-2">
              <p className="text-[10px] text-slate-500 font-bold">CSV gerado — selecione tudo e copie (Ctrl+A, Ctrl+C):</p>
              <textarea readOnly value={buildCSVString(reviewed)} rows={6}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] font-mono text-slate-400 focus:outline-none resize-none"
                onClick={e=>e.target.select()}
              />
            </div>
          )}
          <div className="shrink-0 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-2">
            <span>{reviewed.filter(r=>Object.keys(r.parsed||{}).length>0).length}/{reviewed.length} com programação detectada</span>
            <span>Contatos no formato do app (ex: 0-00, 0-+0) · mA / µs / Hz editáveis</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { ExtractorModal };
