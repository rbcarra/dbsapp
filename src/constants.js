// Constantes e helpers globais do DBS Log
// Criado por Rafael Bernhart Carra — HCFMUSP 2026

// ─── REGISTRO DE ELETRODOS ───────────────────────────────────────────────────
// Fonte única de verdade. Cada eletrodo é descrito como uma lista de NÍVEIS,
// de baixo para cima (distal → proximal):
//
//   'ring' → contato anelar único    → chave = índice do nível ('0', '1', …)
//   'dir'  → 3 segmentos direcionais → chaves = '<nível><letra>' ('1A','1B','1C')
//
// Layout do desenho, ordem de texto, chaves de contato, número de níveis e
// número de contatos são TODOS derivados daqui. Para acrescentar um eletrodo
// novo basta uma linha nesta tabela — nenhum outro arquivo precisa mudar.

const ELETRODOS_SPEC = {
  '4-ring': {
    label: '4 anéis',
    descricao: 'Medtronic 3387/3389 · Abbott 6146',
    niveis: ['ring', 'ring', 'ring', 'ring'],
  },
  '8-ring': {
    label: '8 anéis',
    descricao: 'Boston Vercise Standard',
    niveis: ['ring', 'ring', 'ring', 'ring', 'ring', 'ring', 'ring', 'ring'],
  },
  'directional': {
    label: 'Direcional 1-3-3-1',
    descricao: 'Boston Cartesia · Medtronic SenSight · Abbott Infinity',
    niveis: ['ring', 'dir', 'dir', 'ring'],
  },
  'cartesia-x': {
    label: 'Cartesia X',
    descricao: 'Boston Vercise Cartesia X — 5 níveis direcionais + 1 anel proximal (16 contatos)',
    niveis: ['dir', 'dir', 'dir', 'dir', 'dir', 'ring'],
  },
  'cartesia-hx': {
    label: 'Cartesia HX',
    descricao: 'Boston Vercise Cartesia HX — 4 níveis direcionais + 4 anéis proximais (16 contatos)',
    niveis: ['dir', 'dir', 'dir', 'dir', 'ring', 'ring', 'ring', 'ring'],
  },
};

const SEGMENTOS = ['A', 'B', 'C'];

const construirEletrodo = (id, spec) => {
  const niveis = spec.niveis.map((tipo, idx) => ({
    idx,
    tipo,                                                     // 'ring' | 'dir'
    contatos: tipo === 'dir' ? SEGMENTOS.map(l => `${idx}${l}`) : [String(idx)],
  }));
  const ordemBaixoCima = niveis.flatMap(n => n.contatos);
  return {
    id,
    label: spec.label,
    descricao: spec.descricao || '',
    niveis,                                                   // baixo → cima
    ordemBaixoCima,                                           // chaves, baixo → cima
    layout: [...niveis].reverse().map(n => n.contatos),        // linhas, cima → baixo
    nNiveis: niveis.length,
    nContatos: ordemBaixoCima.length,
    temDirecional: niveis.some(n => n.tipo === 'dir'),
  };
};

const ELETRODOS = Object.fromEntries(
  Object.entries(ELETRODOS_SPEC).map(([id, spec]) => [id, construirEletrodo(id, spec)])
);

const ELETRODO_PADRAO = '4-ring';

// Nunca lança: tipo desconhecido cai no padrão em vez de quebrar a tela.
const getEletrodo = (tipo) => ELETRODOS[tipo] || ELETRODOS[ELETRODO_PADRAO];
const listaEletrodos = () => Object.values(ELETRODOS);
const temDirecional  = (tipo) => getEletrodo(tipo).temDirecional;
const nNiveisEletrodo = (tipo) => getEletrodo(tipo).nNiveis;

// ─── HELPERS DE CHAVE DE CONTATO ─────────────────────────────────────────────
// Tolerantes a níveis ≥ 10, para eletrodos futuros com mais de 10 níveis.
const nivelDoContato = (chave) => {
  const m = String(chave).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};
const segmentoDoContato = (chave) => {
  const m = String(chave).match(/([ABC])$/i);
  return m ? m[1].toUpperCase() : null;
};
const eContatoDirecional = (chave) => segmentoDoContato(chave) !== null;

// Ordena por nível numérico e depois por segmento.
// Para eletrodos de nível único-dígito o resultado é idêntico ao localeCompare
// usado antes — configs já gravadas no Firestore continuam batendo.
const compararChavesContato = (a, b) => {
  const na = nivelDoContato(a), nb = nivelDoContato(b);
  if (na !== nb) return (na ?? 0) - (nb ?? 0);
  return String(a).localeCompare(String(b));
};

// ─── COMPATIBILIDADE COM O CÓDIGO EXISTENTE ──────────────────────────────────
// Mesmas estruturas de antes, agora derivadas do registro.
const TIPOS_ELETRODO = Object.fromEntries(
  Object.entries(ELETRODOS).map(([id, el]) => [id, el.layout])
);
const ORDEM_TEXTO_BAIXO_CIMA = Object.fromEntries(
  Object.entries(ELETRODOS).map(([id, el]) => [id, el.ordemBaixoCima])
);

const MARCADOR_LETRAS = {
  'Parestesia': { letra: 'P', cor: 'text-rose-700' },
  'Cápsula':    { letra: 'C', cor: 'text-rose-700' },
  'Disartria':  { letra: 'D', cor: 'text-rose-700' },
  'Outros':     { letra: 'O', cor: 'text-rose-700' },
  'tremor':        { letra: 'T', cor: 'text-emerald-700' },
  'rigidez':       { letra: 'R', cor: 'text-emerald-700' },
  'bradicinesia':  { letra: 'B', cor: 'text-emerald-700' },
};

// ─── EFEITO DE GRUPO ─────────────────────────────────────────────────────────
// Single source of truth for group effect options and colors.
// btnCls      → Tailwind classes for feedback buttons
// timelineCls → Tailwind classes for timeline/monopolar markers
// hex         → SVG stroke/fill hex color
const EFEITO_OPTS = [
  { val:'bom',         label:'Melhor grupo',  btnCls:'bg-emerald-500 hover:bg-emerald-600 text-white',                                  timelineCls:'bg-emerald-400',  hex:'#10b981' },
  { val:'neutro',      label:'Bom / Mantido', btnCls:'bg-blue-500 hover:bg-blue-600 text-white',                                        timelineCls:'bg-blue-400',     hex:'#3b82f6' },
  { val:'pouco',       label:'Pouco efeito',  btnCls:'bg-slate-400 hover:bg-slate-500 text-white',                                      timelineCls:'bg-slate-400',    hex:'#94a3b8' },
  { val:'col_marcha',  label:'Col. marcha',   btnCls:'bg-orange-500 hover:bg-orange-600 text-white',                                    timelineCls:'bg-orange-400',   hex:'#f97316' },
  { val:'col_fala',    label:'Col. fala',     btnCls:'bg-purple-500 hover:bg-purple-600 text-white',                                    timelineCls:'bg-purple-400',   hex:'#a855f7' },
  { val:'col_outros',  label:'Col. outros',   btnCls:'bg-rose-700 hover:bg-rose-800 text-white',                                        timelineCls:'bg-rose-500',     hex:'#f43f5e' },
  { val:'nao_testado', label:'Não testado',   btnCls:'bg-transparent border border-dashed border-slate-400 text-slate-500 hover:bg-slate-50', timelineCls:'bg-transparent border border-dashed border-slate-300', hex:'transparent' },
];

const getEfeitoCor = (efeito, format = 'hex') => {
  const opt = EFEITO_OPTS.find(o => o.val === efeito);
  if (!opt) return format === 'hex' ? '#67e8f9' : format === 'timeline' ? 'bg-cyan-300' : 'bg-cyan-300';
  return format === 'hex' ? opt.hex : format === 'timeline' ? opt.timelineCls : opt.btnCls;
};

// ─── CONTATOS ────────────────────────────────────────────────────────────────
const getContatosIniciais = (tipo) => {
  const contatos = {};
  getEletrodo(tipo).ordemBaixoCima.forEach(k => { contatos[k] = { state: 'off', perc: 100 }; });
  return contatos;
};

const getStringConfig = (contatos, ignorarPerc = false) => {
  return Object.entries(contatos || {})
    .filter(([, v]) => v && v.state !== 'off')
    .sort(([k1], [k2]) => compararChavesContato(k1, k2))
    .map(([k, v]) => `${k}${v.state}${ignorarPerc ? '' : v.perc}`)
    .join(',');
};

// Texto de prontuário para um lead: "0-00", "0-(30%)0+", etc.
// Mesma regra usada em gerarTextoProntuario — exportada para não duplicar.
const contatosParaTextoProntuario = (contatos, tipo) => {
  return getEletrodo(tipo).ordemBaixoCima.map(c => {
    const st = contatos?.[c]?.state || 'off';
    if (st === 'off') return '0';
    const perc = contatos[c].perc;
    return perc < 100 ? `${st}(${perc}%)` : st;
  }).join('');
};

// ─── PROGRAM FACTORY ─────────────────────────────────────────────────────────
// Creates a blank program object. cycling is per-program (not per-session).
const criarProgramaVazio = (tipoEl = ELETRODO_PADRAO) => ({
  contatos: getContatosIniciais(tipoEl),
  amp: 0, pw: 60, freq: 130, efeito: 'neutro', cycling: false,
});

// ─── NORMALIZAÇÃO ────────────────────────────────────────────────────────────
// Garante que um objeto de contatos tenha exatamente as chaves do eletrodo
// informado. Chaves que existem nos dois eletrodos são preservadas; chaves
// desconhecidas são descartadas; chaves faltantes entram como 'off'.
const normalizeContatos = (contatos, tipoEl = ELETRODO_PADRAO) => {
  const base = getContatosIniciais(tipoEl);
  if (!contatos || typeof contatos !== 'object' || Array.isArray(contatos)) return base;
  Object.entries(contatos).forEach(([k, v]) => {
    if (base[k] === undefined) return;                 // contato não existe neste eletrodo
    if (!v || typeof v !== 'object') return;
    const state = ['-', '+', 'off'].includes(v.state) ? v.state : 'off';
    const percNum = Number(v.perc);
    const perc = Number.isFinite(percNum) ? Math.min(100, Math.max(0, Math.round(percNum))) : 100;
    base[k] = { state, perc: state === 'off' ? 100 : perc };
  });
  return base;
};

const normalizePrograma = (prog, tipoEl = ELETRODO_PADRAO) => {
  const p = prog || {};
  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    ...criarProgramaVazio(tipoEl),
    ...p,
    contatos: normalizeContatos(p.contatos, tipoEl),
    amp:  num(p.amp, 0),
    pw:   num(p.pw, 60),
    freq: num(p.freq, 130),
    efeito: p.efeito || 'neutro',
    cycling: !!p.cycling,
  };
};

// Normaliza a estrutura inteira A/B/C/D × L/R para um tipo de eletrodo.
// Também cobre o antigo capPrograms: no máximo 2 programas por lado
// (interleaving) e nunca um lado vazio ou nulo.
const normalizeGrupos = (grupos, tipoEl = ELETRODO_PADRAO) => {
  const out = {};
  ['A', 'B', 'C', 'D'].forEach(g => {
    const src = grupos && typeof grupos === 'object' ? grupos[g] : null;
    out[g] = { L: [], R: [] };
    ['L', 'R'].forEach(lado => {
      const progs = Array.isArray(src?.[lado]) ? src[lado] : [];
      out[g][lado] = progs.slice(0, 2).map(p => normalizePrograma(p, tipoEl));
      if (out[g][lado].length === 0) out[g][lado] = [criarProgramaVazio(tipoEl)];
    });
  });
  return out;
};

// ─── CONVERT PARSED GRUPOS ───────────────────────────────────────────────────
// Converts parseProgramming() output (string contatos) to internal object format.
// Single definition shared by App.jsx and ExtractorComponents.jsx.
const convertParsedGrupos = (parsed, tipoEl) => {
  const tipo = ELETRODOS[tipoEl] ? tipoEl : ELETRODO_PADRAO;
  const ordem = getEletrodo(tipo).ordemBaixoCima;
  const result = {};
  Object.entries(parsed || {}).forEach(([g, grupo]) => {
    result[g] = {};
    ['L', 'R'].forEach(lado => {
      result[g][lado] = (grupo?.[lado] || []).map(prog => {
        // Já veio no formato de objeto (parser direcional) → só normaliza
        if (prog.contatos && typeof prog.contatos === 'object' && !Array.isArray(prog.contatos))
          return { ...prog, contatos: normalizeContatos(prog.contatos, tipo) };

        // Formato string posicional: só é interpretável se o comprimento bater
        // exatamente com o número de contatos do eletrodo.
        const novosContatos = getContatosIniciais(tipo);
        const chars = [...(prog.contatos || '').replace(/([0+\-])\s+(?=[0+\-])/g, '$1')];
        if (chars.length === ordem.length) {
          chars.forEach((ch, i) => {
            if (ch === '-' || ch === '+') novosContatos[ordem[i]] = { state: ch, perc: 100 };
          });
        }
        return { ...prog, contatos: novosContatos };
      });
      if (result[g][lado].length > 2) result[g][lado] = result[g][lado].slice(0, 2);
    });
  });
  return result;
};

const opacidadeMarcador = (timestampMarcador, timestampSessaoAtual) => {
  const meses = (timestampSessaoAtual - timestampMarcador) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(1 - Math.min(Math.floor(meses / 6) * 0.06, 0.60), 0.40);
};

const formatarData = (timestamp) => {
  return new Date(timestamp).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export {
  // registro de eletrodos
  ELETRODOS_SPEC, ELETRODOS, ELETRODO_PADRAO, SEGMENTOS,
  getEletrodo, listaEletrodos, temDirecional, nNiveisEletrodo,
  nivelDoContato, segmentoDoContato, eContatoDirecional, compararChavesContato,
  // compatibilidade
  TIPOS_ELETRODO, ORDEM_TEXTO_BAIXO_CIMA, MARCADOR_LETRAS,
  EFEITO_OPTS, getEfeitoCor,
  // contatos e programas
  getContatosIniciais, getStringConfig, contatosParaTextoProntuario,
  criarProgramaVazio, convertParsedGrupos,
  normalizeContatos, normalizePrograma, normalizeGrupos,
  // diversos
  opacidadeMarcador, formatarData,
};
