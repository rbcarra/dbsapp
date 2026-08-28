// Helpers para cálculo de vetores direcionais de estimulação DBS
import { getEletrodo, temDirecional, nivelDoContato, segmentoDoContato } from './constants';

const DIR_ANGLES = { A: 90, B: 210, C: 330 };

// Nível direcional de uma config string ('1A-100,1B-50' → '1').
// Aceita níveis de mais de um dígito para eletrodos futuros.
const getDirLevel = (configStr) => {
  const m = (configStr || '').match(/(\d+)[ABC]/);
  return m ? m[1] : null;
};

const parseConfigToContatos = (configStr) => {
  if (!configStr) return {};
  const contatos = {};
  configStr.split(',').forEach(part => {
    const m = part.trim().match(/^(\d+[ABC]?)([-+])(\d+)?$/);
    if (m) contatos[m[1]] = { state: m[2], perc: m[3] ? parseInt(m[3]) : 100 };
  });
  return contatos;
};

// Classifica o tipo de estimulação para decidir qual display usar
// 'ring' | 'single-dir' | 'multi-dir'
const classifyStim = (contatos, tipoEletrodo) => {
  // Qualquer eletrodo sem níveis direcionais é sempre 'ring'
  if (!temDirecional(tipoEletrodo)) return 'ring';

  const dirActive = Object.entries(contatos || {})
    .filter(([k, v]) => v && v.state !== 'off' && segmentoDoContato(k) !== null);
  if (dirActive.length === 0) return 'ring';

  const levels = [...new Set(dirActive.map(([k]) => String(nivelDoContato(k))))];

  if (levels.length === 1) {
    const lv = levels[0];
    const allThree = ['A', 'B', 'C'].map(x => contatos[lv + x]);
    const allActive = allThree.every(c => c && c.state !== 'off');
    if (allActive) {
      // Polaridade mista (cátodo + ânodo no mesmo nível) = single-dir, não ring
      const states = allThree.map(c => c.state);
      const hasMixedPolarity = states.some(s => s === '+') && states.some(s => s === '-');
      if (hasMixedPolarity) return 'single-dir';
      const percs = allThree.map(c => c.perc ?? 100);
      const allSame = percs.every(p => p === percs[0]);
      if (allSame) return 'ring';
    }
    return 'single-dir';
  }
  return 'multi-dir';
};

// ─── DIRECTIONAL VECTOR HELPERS ─────────────────────────────────────────────

// Direção: ambos cátodo E ânodo contribuem positivamente
// (vetor = centro ponderado de TODOS os contatos direcionais ativos)
// Assim: cátodo 1A → vetor para A; cátodo 1A + ânodo 1B (50/50) → 150°
const dirUnitVector2D = (contatos) => {
  let vx = 0, vy = 0;
  Object.entries(contatos || {}).forEach(([k, v]) => {
    if (!v || v.state === 'off') return;
    const letter = segmentoDoContato(k);
    if (!letter) return;
    const perc = (v.perc ?? 100) / 100;
    const rad = DIR_ANGLES[letter] * Math.PI / 180;
    vx += perc * Math.cos(rad);
    vy += perc * Math.sin(rad);
  });
  const rawMag = Math.sqrt(vx * vx + vy * vy);
  const mag = rawMag || 1;
  return { ux: vx / mag, uy: vy / mag, rawMag };
};

// Amplitude efetiva: ânodo reduz em 0.6 × percentual_ânodo
const calcAmpEfetiva = (contatos, amp) => {
  const totalAnodoPerc = Object.entries(contatos || {})
    .filter(([, v]) => v && v.state === '+')
    .reduce((s, [, v]) => s + (v.perc ?? 100), 0);
  return amp * (1 - 0.006 * totalAnodoPerc);
};

// Índice do nível do contato ('2B' → 2, '13A' → 13)
const getContactZ = (key) => {
  const n = nivelDoContato(key);
  return n === null ? 0 : n;
};

// Vetor 3D normalizado. O eixo Z é normalizado pelo número real de níveis do
// eletrodo, então funciona igual para 4, 6, 8 ou mais níveis.
// tipoEletrodo é opcional e cai em 'directional' (4 níveis) para preservar o
// comportamento das chamadas antigas.
const dirVector3D = (contatos, amp, tipoEletrodo = 'directional') => {
  const { ux, uy } = dirUnitVector2D(contatos);
  const nNiveis = getEletrodo(tipoEletrodo).nNiveis;
  const centro = (nNiveis - 1) / 2;
  const meia = centro || 1;

  let zSum = 0, wSum = 0;
  Object.entries(contatos || {}).forEach(([k, v]) => {
    if (!v || v.state === 'off') return;
    const perc = (v.perc ?? 100) / 100;
    zSum += perc * getContactZ(k);
    wSum += perc;
  });
  const uz = wSum > 0 ? (zSum / wSum - centro) / meia : 0;   // → -1 .. +1
  const mag3 = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
  const ampEf = calcAmpEfetiva(contatos, amp);
  return { ux: ux / mag3, uy: uy / mag3, uz: uz / mag3, amp: ampEf };
};

export {
  DIR_ANGLES, getDirLevel, parseConfigToContatos, classifyStim,
  dirUnitVector2D, calcAmpEfetiva, getContactZ, dirVector3D,
};
