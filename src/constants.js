// Constantes e helpers globais do DBS Log
// Criado por Rafael Bernhart Carra — HCFMUSP 2026

const TIPOS_ELETRODO = {
  '4-ring': [['3'], ['2'], ['1'], ['0']],
  '8-ring': [['7'], ['6'], ['5'], ['4'], ['3'], ['2'], ['1'], ['0']],
  'directional': [['3'], ['2A', '2B', '2C'], ['1A', '1B', '1C'], ['0']]
};

const ORDEM_TEXTO_BAIXO_CIMA = {
  '4-ring': ['0', '1', '2', '3'],
  '8-ring': ['0', '1', '2', '3', '4', '5', '6', '7'],
  'directional': ['0', '1A', '1B', '1C', '2A', '2B', '2C', '3']
};

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
// btnCls     → Tailwind classes for feedback buttons
// timelineCls → Tailwind classes for timeline/monopolar markers
// hex        → SVG stroke/fill hex color
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

// ─── CONVERT PARSED GRUPOS ───────────────────────────────────────────────────
// Converts parseProgramming() output (string contatos) to internal object format.
// Single definition shared by App.jsx and ExtractorComponents.jsx.
const convertParsedGrupos = (parsed, tipoEl) => {
  const tipo = tipoEl || '4-ring';
  const result = {};
  Object.entries(parsed || {}).forEach(([g, grupo]) => {
    result[g] = {};
    ['L', 'R'].forEach(lado => {
      result[g][lado] = (grupo[lado] || []).map(prog => {
        if (prog.contatos && typeof prog.contatos === 'object' && !Array.isArray(prog.contatos))
          return prog;
        const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipo];
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

// ─── PROGRAM FACTORY ─────────────────────────────────────────────────────────
// Creates a blank program object. cycling is now per-program (not per-session).
const criarProgramaVazio = (tipoEl = '4-ring') => ({
  contatos: getContatosIniciais(tipoEl),
  amp: 0, pw: 60, freq: 130, efeito: 'neutro', cycling: false,
});

const opacidadeMarcador = (timestampMarcador, timestampSessaoAtual) => {
  const meses = (timestampSessaoAtual - timestampMarcador) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(1 - Math.min(Math.floor(meses / 6) * 0.06, 0.60), 0.40);
};

const getContatosIniciais = (tipo) => {
  const contatos = {};
  TIPOS_ELETRODO[tipo].flat().forEach(k => contatos[k] = { state: 'off', perc: 100 });
  return contatos;
};

const getStringConfig = (contatos, ignorarPerc = false) => {
  return Object.entries(contatos)
    .filter(([_, v]) => v.state !== 'off')
    .sort(([k1], [k2]) => k1.localeCompare(k2))
    .map(([k, v]) => `${k}${v.state}${ignorarPerc ? '' : v.perc}`)
    .join(',');
};

const formatarData = (timestamp) => {
  return new Date(timestamp).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export {
  TIPOS_ELETRODO, ORDEM_TEXTO_BAIXO_CIMA, MARCADOR_LETRAS,
  EFEITO_OPTS, getEfeitoCor,
  convertParsedGrupos, criarProgramaVazio,
  opacidadeMarcador, getContatosIniciais, getStringConfig, formatarData,
};
