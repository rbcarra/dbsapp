// ─── MODELO DE VTA POR CAMPO ELÉTRICO ────────────────────────────────────────
// Substitui a antiga elipse r = k·√(I·PW) centrada no eletrodo.
//
// Método:
//  1. Cada contato ativo vira um conjunto de fontes pontuais de corrente na
//     superfície do eletrodo (anel → pontos ao redor de 360°; segmento → pontos
//     no seu arco de ~90°), em 3 alturas ao longo dos 1,5 mm do contato.
//  2. Corrente com sinal: cátodo = −I, ânodo = +I. Em modo "% por contato", a
//     amplitude total é distribuída dentro de cada polaridade conforme as %;
//     em modo "mA por contato", usa a corrente individual. O retorno pelo case
//     (monopolar ou desequilíbrio cátodo/ânodo) fica longe e é desprezado.
//  3. Superposição em meio homogêneo isotrópico:
//         E(p) = Σ q_j (p − p_j) / (4πσ |p − p_j|³)
//     Com I em mA, distâncias em mm e σ em S/m, E sai direto em V/mm.
//  4. VTA = região onde |E| ≥ E_limiar (critério de Åström et al. 2015, o mesmo
//     usado por Lead-DBS/OSS-DBS: ~0,2 V/mm para 60 µs). O limiar é ajustado
//     ao PW por uma curva força-duração de Lapicque (cronaxia ~150 µs).
//
// Consequências que o modelo antigo não capturava:
//  • bipolar gera um campo de dipolo, que decai mais rápido → VTA menor e
//    concentrado no cátodo, não um círculo maior;
//  • o ânodo não "puxa" a VTA na sua direção;
//  • contatos com correntes diferentes deformam a VTA proporcionalmente;
//  • a extensão no eixo do eletrodo (vista longitudinal) passa a existir.
//
// Limitações (é uma estimativa, não um modelo paciente-específico): meio
// homogêneo (sem anisotropia da cápsula/substância branca), corpo isolante do
// eletrodo desprezado, |E| em vez da função ativadora por orientação de fibra.

import { getEletrodo, nivelDoContato, segmentoDoContato, correntesPorContato } from './constants';
import { DIR_ANGLES } from './vectorHelpers';

export const LEAD_R_MM = 0.635;          // diâmetro 1,27 mm
export const CONTACT_H_MM = 1.5;         // altura do contato
// Distância centro-a-centro entre níveis (1,5 mm de contato + espaçamento).
// 3389 / Cartesia / SenSight / Vercise: 0,5 mm → 2,0 mm. (3387 seria 3,0 mm.)
const PITCH_MM = { '4-ring': 2.0, '8-ring': 2.0, 'directional': 2.0, 'cartesia-x': 2.0, 'cartesia-hx': 2.0 };
export const pitchDoEletrodo = (tipo) => PITCH_MM[tipo] || 2.0;

export const SIGMA_PADRAO = 0.2;         // S/m — média entre substância cinzenta e branca
export const E_LIMIAR_60US = 0.2;        // V/mm para PW = 60 µs
const CRONAXIA_US = 150;

export const limiarParaPW = (eLimiar60, pw) => {
  const p = Math.max(10, Number(pw) || 60);
  return eLimiar60 * (1 + CRONAXIA_US / p) / (1 + CRONAXIA_US / 60);
};

const SEG_ARCO_DEG = 90;                 // arco elétrico de um segmento direcional

// Lista de fontes pontuais {x, y, z, q} (mm, mA com sinal) para um programa.
// impedanciaOhm só é usada em modo voltagem (I = V / Z).
export const montarFontes = ({ contatos, amp, modoContato, tipoEletrodo, modoAmplitude, impedanciaOhm }) => {
  let ampmA = Number(amp) || 0;
  let modoC = modoContato;
  if (modoAmplitude === 'V') {
    const z = impedanciaOhm > 0 ? impedanciaOhm : 1000;   // sem impedância → assume 1 kΩ
    ampmA = ampmA / z * 1000;
    modoC = 'perc';
  }
  const correntes = correntesPorContato(contatos, ampmA, modoC);
  const pitch = pitchDoEletrodo(tipoEletrodo);
  const fontes = [];
  const alturas = [-CONTACT_H_MM / 3, 0, CONTACT_H_MM / 3];
  Object.entries(correntes).forEach(([k, { state, ma }]) => {
    if (!ma) return;
    const nivel = nivelDoContato(k);
    if (nivel === null) return;
    const zc = nivel * pitch;
    const sinal = state === '-' ? -1 : 1;
    const seg = segmentoDoContato(k);
    let angulos;
    if (seg) {
      const c = DIR_ANGLES[seg];
      angulos = [-0.375, -0.125, 0.125, 0.375].map(f => c + f * SEG_ARCO_DEG);
    } else {
      angulos = Array.from({ length: 12 }, (_, i) => i * 30);
    }
    const q = sinal * ma / (angulos.length * alturas.length);
    angulos.forEach(a => {
      const rad = a * Math.PI / 180;
      alturas.forEach(dz => fontes.push({ x: LEAD_R_MM * Math.cos(rad), y: LEAD_R_MM * Math.sin(rad), z: zc + dz, q }));
    });
  });
  return fontes;
};

// Campo no ponto (x, y, z): { e: |E| em V/mm, v: potencial em V }
export const campo = (fontes, x, y, z, sigma = SIGMA_PADRAO) => {
  let ex = 0, ey = 0, ez = 0, v = 0;
  for (let i = 0; i < fontes.length; i++) {
    const f = fontes[i];
    const dx = x - f.x, dy = y - f.y, dz = z - f.z;
    const r2 = dx * dx + dy * dy + dz * dz + 1e-4;
    const r = Math.sqrt(r2);
    const inv = f.q / (r2 * r);
    ex += inv * dx; ey += inv * dy; ez += inv * dz;
    v += f.q / r;
  }
  const k = 4 * Math.PI * sigma;
  return { e: Math.sqrt(ex * ex + ey * ey + ez * ez) / k, v: v / k };
};
export const campoE = (fontes, x, y, z, sigma) => campo(fontes, x, y, z, sigma).e;

// Ativação: |E| ≥ limiar. Em regiões de potencial positivo (dominadas por
// ânodo) o limiar é multiplicado por fatorAnodo — axônios próximos de um ânodo
// precisam de ~3–7× mais corrente (Ranck 1975). fatorAnodo = 1 → |E| puro.
const ativado = (fontes, x, y, z, eLimiar, sigma, fatorAnodo) => {
  const { e, v } = campo(fontes, x, y, z, sigma);
  return e >= (v > 0 ? eLimiar * fatorAnodo : eLimiar);
};
export const FATOR_ANODO_PADRAO = 3;

// Nível z (mm) "centro" da estimulação: média das posições dos cátodos
// ponderada pela corrente (ou dos ânodos, se não houver cátodo).
export const zCentral = (fontes) => {
  const cat = fontes.filter(f => f.q < 0);
  const usar = cat.length ? cat : fontes;
  const w = usar.reduce((s, f) => s + Math.abs(f.q), 0);
  return w > 0 ? usar.reduce((s, f) => s + f.z * Math.abs(f.q), 0) / w : 0;
};

// Contorno axial (plano perpendicular ao eletrodo em z): para cada ângulo,
// o raio mais externo onde |E| ≥ limiar. Devolve [{ang, r}] (ang em rad,
// referencial do eletrodo; r em mm, 0 se nada ativado naquele raio).
export const contornoAxial = (fontes, z, eLimiar, { nAng = 72, rMax = 8, passo = 0.05, sigma = SIGMA_PADRAO, fatorAnodo = FATOR_ANODO_PADRAO } = {}) => {
  const out = [];
  if (!fontes.length) return out;
  for (let i = 0; i < nAng; i++) {
    const ang = (i / nAng) * 2 * Math.PI;
    const c = Math.cos(ang), s = Math.sin(ang);
    let r = 0;
    for (let rr = rMax; rr > LEAD_R_MM; rr -= passo) {
      if (ativado(fontes, rr * c, rr * s, z, eLimiar, sigma, fatorAnodo)) { r = rr; break; }
    }
    out.push({ ang, r });
  }
  return out;
};

// Contorno longitudinal no plano que contém o eixo do eletrodo e a direção
// angDir (rad). Para cada altura z devolve o alcance para os dois lados.
// Retorna lista de faixas contíguas: [[{z, rPos, rNeg}], ...]
export const contornoLongitudinal = (fontes, angDir, eLimiar, { zMin, zMax, passoZ = 0.1, rMax = 8, passo = 0.05, sigma = SIGMA_PADRAO, fatorAnodo = FATOR_ANODO_PADRAO } = {}) => {
  const c = Math.cos(angDir), s = Math.sin(angDir);
  const faixas = [];
  let atual = null;
  for (let z = zMin; z <= zMax + 1e-9; z += passoZ) {
    const alcance = (sentido) => {
      for (let rr = rMax; rr > LEAD_R_MM; rr -= passo) {
        if (ativado(fontes, sentido * rr * c, sentido * rr * s, z, eLimiar, sigma, fatorAnodo)) return rr;
      }
      return 0;
    };
    const rPos = alcance(1), rNeg = alcance(-1);
    if (rPos > 0 || rNeg > 0) {
      if (!atual) { atual = []; faixas.push(atual); }
      atual.push({ z, rPos: Math.max(rPos, LEAD_R_MM), rNeg: Math.max(rNeg, LEAD_R_MM) });
    } else {
      atual = null;
    }
  }
  return faixas;
};

// Resumo de um contorno axial: raio máximo, ângulo do máximo, raio mínimo
// e anisotropia (max/min) — útil p/ posicionar marcadores de limiar.
export const resumoContorno = (contorno) => {
  if (!contorno.length) return { rMax: 0, angMax: 0, rMin: 0, aniso: 1 };
  let rMax = 0, angMax = 0, rMin = Infinity;
  contorno.forEach(({ ang, r }) => {
    if (r > rMax) { rMax = r; angMax = ang; }
    if (r < rMin) rMin = r;
  });
  // ângulo do máximo refinado pela média vetorial dos pontos perto do máximo
  let vx = 0, vy = 0;
  contorno.forEach(({ ang, r }) => { if (r >= rMax * 0.97) { vx += Math.cos(ang); vy += Math.sin(ang); } });
  if (vx || vy) angMax = Math.atan2(vy, vx);
  return { rMax, angMax, rMin: isFinite(rMin) ? rMin : 0, aniso: rMin > 0 ? rMax / rMin : Infinity };
};

// Atalho: estimativa completa de VTA para um programa
export const estimarVTA = (params, { eLimiar60 = E_LIMIAR_60US, sigma = SIGMA_PADRAO, fatorAnodo = FATOR_ANODO_PADRAO, nAng = 72, passo = 0.05 } = {}) => {
  const fontes = montarFontes(params);
  const eLimiar = limiarParaPW(eLimiar60, params.pw);
  if (!fontes.length) return { fontes, eLimiar, z: 0, axial: [], resumo: resumoContorno([]) };
  const z = zCentral(fontes);
  const axial = contornoAxial(fontes, z, eLimiar, { nAng, passo, sigma, fatorAnodo });
  return { fontes, eLimiar, z, axial, resumo: resumoContorno(axial) };
};

export const nNiveisDoEletrodo = (tipo) => getEletrodo(tipo).nNiveis;
