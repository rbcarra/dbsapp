// Helpers para cálculo de vetores direcionais de estimulação DBS
import { MARCADOR_LETRAS, opacidadeMarcador } from './constants';

const DIR_ANGLES = { A: 90, B: 210, C: 330 };

const getDirLevel = (configStr) => {
  const m = (configStr || '').match(/(\d)[ABC]/);
  return m ? m[1] : null;
};

const parseConfigToContatos = (configStr) => {
  if (!configStr) return {};
  const contatos = {};
  configStr.split(',').forEach(part => {
    const m = part.match(/^([0-9]+[ABC]?|[0-9])([-+])(\d+)?$/);
    if (m) contatos[m[1]] = { state: m[2], perc: m[3] ? parseInt(m[3]) : 100 };
  });
  return contatos;
};

// Classifica o tipo de estimulação para decidir qual display usar
// 'ring' | 'single-dir' | 'multi-dir'
const classifyStim = (contatos, tipoEletrodo) => {
  if (tipoEletrodo !== 'directional') return 'ring';
  const dirActive = Object.entries(contatos)
    .filter(([k, v]) => v.state !== 'off' && /\d[ABC]$/.test(k));
  if (dirActive.length === 0) return 'ring';

  const levels = [...new Set(dirActive.map(([k]) => k.slice(0, -1)))];

  if (levels.length === 1) {
    const lv = levels[0];
    const allThree = ['A','B','C'].map(x => contatos[lv + x]);
    const allActive = allThree.every(c => c && c.state !== 'off');
    if (allActive) {
      // Fix: mixed polarity (catodo + anodo on same level) = single-dir, not ring
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

// Fix direção: ambos catodo E anodo contribuem positivamente para a direção
// (vetor = centro ponderado de TODOS os contatos direcionais ativos)
// Isso garante: catodo 1A → vetor para A; catodo 1A + anodo 1B (50/50) → vetor a 150° (médio entre A e B)
const dirUnitVector2D = (contatos) => {
  let vx = 0, vy = 0;
  Object.entries(contatos).forEach(([k, v]) => {
    if (v.state === 'off' || !k.match(/[ABC]$/)) return;
    const perc = (v.perc ?? 100) / 100;
    const letter = k.slice(-1);
    const rad = DIR_ANGLES[letter] * Math.PI / 180;
    // Ambos catodo e anodo contribuem na direção do contato
    vx += perc * Math.cos(rad);
    vy += perc * Math.sin(rad);
  });
  const rawMag = Math.sqrt(vx * vx + vy * vy);
  const mag = rawMag || 1;
  return { ux: vx / mag, uy: vy / mag, rawMag };
};

// Amplitude efetiva: anodo reduz em 0.6 × percentual_anodo
const calcAmpEfetiva = (contatos, amp) => {
  const totalAnodoPerc = Object.entries(contatos)
    .filter(([, v]) => v.state === '+')
    .reduce((s, [, v]) => s + (v.perc ?? 100), 0);
  return amp * (1 - 0.006 * totalAnodoPerc);
};

const getContactZ = (key) => parseInt(key[0]);

const dirVector3D = (contatos, amp) => {
  const { ux, uy } = dirUnitVector2D(contatos);
  // Z: centro ponderado de TODOS os contatos (mesma lógica de direção)
  let zSum = 0, wSum = 0;
  Object.entries(contatos).forEach(([k, v]) => {
    if (v.state === 'off') return;
    const perc = (v.perc ?? 100) / 100;
    zSum += perc * getContactZ(k);
    wSum += perc;
  });
  const uz = wSum > 0 ? (zSum / wSum - 1.5) / 1.5 : 0; // normalizar 0-3 → -1..+1
  const mag3 = Math.sqrt(ux*ux + uy*uy + uz*uz) || 1;
  const ampEf = calcAmpEfetiva(contatos, amp);
  return { ux: ux/mag3, uy: uy/mag3, uz: uz/mag3, amp: ampEf };
};



export { DIR_ANGLES, getDirLevel, parseConfigToContatos, classifyStim,
  dirUnitVector2D, calcAmpEfetiva, getContactZ, dirVector3D };
