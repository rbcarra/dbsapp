import React, { useMemo } from 'react';
import { MARCADOR_LETRAS, opacidadeMarcador, formatarData, getEfeitoCor, getEletrodo as getEletrodoDisplay } from './constants';
import { estimarVTA, estimarVTA3Planos, pontoMaxLongitudinal, contornoLongitudinal, pitchDoEletrodo, nNiveisDoEletrodo, LEAD_R_MM, CONTACT_H_MM, E_LIMIAR_60US, FATOR_ANODO_PADRAO } from './vtaModel';
import { DIR_ANGLES, parseConfigToContatos, classifyStim, getDirLevel,
  dirUnitVector2D, calcAmpEfetiva, dirVector3D } from './vectorHelpers';


// Contact anterior angle lookup (degrees)
const CONTACT_ANTERIOR_ANGLES = {
  'A':  90,
  'AB': 150,
  'B':  210,
  'BC': 270,
  'C':  330,
  'CA': 30,
};

const PolarDisplay2D = ({ marcadores, historicoRef, maxAmp: maxAmpProp, grupoKey, sessaoAtualTimestamp, programaContatos, ampAtual, labelGrupo, mostrarPositivos = true, mostrarNegativos = true, mostrarPrevios = true, anteriorContact = 'A', onOpenFullscreen, forcedSize }) => {
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
  const panRef = React.useRef(null);
  const S = forcedSize ?? (isZoomed ? 300 : 160);
  const C = S / 2, margin = S * 0.14, R = C - margin;
  const anteriorRad = (CONTACT_ANTERIOR_ANGLES[anteriorContact] ?? 90) * Math.PI / 180;
  const xyTheta2D = -Math.PI / 2 - anteriorRad;
  const rot2D = (ux, uy) => ({
    rx: ux * Math.cos(xyTheta2D) - uy * Math.sin(xyTheta2D),
    ry: ux * Math.sin(xyTheta2D) + uy * Math.cos(xyTheta2D),
  });
  // ViewBox for zoom+pan: shrink the visible area, offset by pan
  const vpW = S / zoomLevel, vpH = S / zoomLevel;
  const vpX = C + panOffset.x - vpW / 2;
  const vpY = C + panOffset.y - vpH / 2;
  const vb2D = `${vpX} ${vpY} ${vpW} ${vpH}`;
  // Element size divisor: keeps elements proportional (except electrode)
  const ez = zoomLevel; // divide element sizes by this
  // Pan handlers
  const onPdPointerDown = (e) => {
    if (e.button !== 0) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, ox: panOffset.x, oy: panOffset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };
  const onPdPointerMove = (e) => {
    if (!panRef.current) return;
    const scale = vpW / S; // SVG units per pixel
    const dx = (e.clientX - panRef.current.startX) * scale * -1;
    const dy = (e.clientY - panRef.current.startY) * scale * -1;
    setPanOffset({ x: panRef.current.ox + dx, y: panRef.current.oy + dy });
  };
  const onPdPointerUp = (e) => { panRef.current = null; };
  // Fix 2: maxAmp from actual displayed data
  let maxAmp = Math.max(maxAmpProp || 0, ampAtual || 0, 1);
  for (const m of marcadores) if ((m.amp || 0) > maxAmp) maxAmp = m.amp;
  for (const h of (historicoRef || [])) if ((h.amp || 0) > maxAmp) maxAmp = h.amp;
  const toR = (amp) => (Math.min(Math.max(amp,0), maxAmp) / maxAmp) * R;
  const rings = [];
  for (let v = 1; v <= Math.ceil(maxAmp); v++) rings.push(v);

  const currentVec = programaContatos ? dirUnitVector2D(programaContatos) : null;
  const currentAmpEf = programaContatos && ampAtual ? calcAmpEfetiva(programaContatos, ampAtual) : 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {labelGrupo && <span className="text-[8px] text-slate-500 font-mono">{labelGrupo}</span>}
      <div className="relative cursor-pointer" onClick={() => setIsZoomed(!isZoomed)} title="Clique para ampliar">
        {onOpenFullscreen && !isZoomed && (
          <button onClick={e => { e.stopPropagation(); onOpenFullscreen(); }}
            className="absolute top-0.5 right-0.5 z-10 w-4 h-4 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-500 text-[8px] flex items-center justify-center"
            title="Abrir em tela cheia">⛶</button>
        )}
        <svg width={S} height={S} viewBox={vb2D}
          onPointerDown={zoomLevel > 1 ? onPdPointerDown : undefined}
          onPointerMove={zoomLevel > 1 ? onPdPointerMove : undefined}
          onPointerUp={zoomLevel > 1 ? onPdPointerUp : undefined}
          style={{ cursor: zoomLevel > 1 ? 'grab' : 'pointer' }}>
          <rect width={S} height={S} fill="#ffffff" rx="8"/>
          {rings.map(v => (
            <g key={v}>
              <circle cx={C} cy={C} r={toR(v)} fill="none"
                stroke={v === Math.ceil(maxAmp) ? '#475569' : '#cbd5e1'}
                strokeWidth={(v === Math.ceil(maxAmp) ? 1.5 : 0.5) / ez}
                strokeDasharray={v < maxAmp ? '2,2' : undefined}/>
              <text x={C + toR(v) + 2} y={C - 2} fontSize={Math.max(5, S*0.033)} fill="#94a3b8">{v}mA</text>
            </g>
          ))}
          {Object.entries(DIR_ANGLES).map(([letter, deg]) => {
            const rad = deg * Math.PI / 180;
            const {rx, ry} = rot2D(Math.cos(rad), Math.sin(rad));
            const labelR = toR(Math.ceil(maxAmp)) + S * 0.07;
            const isAnterior = letter === anteriorContact || anteriorContact.includes(letter);
            return (
              <g key={letter}>
                <line x1={C} y1={C} x2={C + rx*toR(Math.ceil(maxAmp))} y2={C - ry*toR(Math.ceil(maxAmp))} stroke={isAnterior ? '#64748b' : '#cbd5e1'} strokeWidth={isAnterior ? 1 : 0.5}/>
                <text x={C + rx*labelR} y={C - ry*labelR} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(9, S*0.06)} fontWeight="bold" fill="#1e293b">{letter}</text>
              </g>
            );
          })}
          {/* Anterior indicator at bottom */}
          <text x={C} y={C + toR(Math.ceil(maxAmp)) + S*0.09} textAnchor="middle" fontSize={Math.max(6, S*0.04)} fill="#64748b" fontStyle="italic">↓ {anteriorContact}</text>
          {currentVec && currentAmpEf > 0 && (() => {
            const {rx, ry} = rot2D(currentVec.ux, currentVec.uy);
            return <line x1={C} y1={C} x2={C + rx*toR(currentAmpEf)} y2={C - ry*toR(currentAmpEf)}
              stroke="#6366f1" strokeWidth={2/ez} strokeDasharray="4,3" opacity={0.5}/>;
          })()}
          <circle cx={C} cy={C} r={Math.max(2, S*0.015)} fill="#334155"/>

          {/* Indicadores de programação prévia — bolinhas coloridas por efeito */}
          {mostrarPrevios && (historicoRef || []).map((h, hi) => {
            const hContatos = parseConfigToContatos(h.config);
            const hType = classifyStim(hContatos, 'directional');
            const isRing = hType === 'ring' || !getDirLevel(h.config);
            const ampEf = calcAmpEfetiva(hContatos, h.amp || 0);
            const cor = getEfeitoCor(h.efeito, 'hex');
            const opacity = Math.max(0.4, opacidadeMarcador(h.date || 0, sessaoAtualTimestamp || Date.now()));
            const rr = toR(ampEf);
            if (isRing) {
              // Draw as concentric ring
              return (
                <g key={`hist-${hi}`} opacity={opacity}>
                  <title>{`[prev-ring] ${h.config} | ${h.amp}mA | ${h.efeito}`}</title>
                  <circle cx={C} cy={C} r={rr} fill="none" stroke={cor} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.6}/>
                </g>
              );
            }
            const { ux, uy } = dirUnitVector2D(hContatos);
            const px = C + ux * rr, py = C - uy * rr;
            return (
              <g key={`hist-${hi}`} opacity={opacity}>
                <title>{`[prev-dir] ${h.config} | ${h.amp}mA | ${h.efeito}`}</title>
                <circle cx={px} cy={py} r={Math.max(4, S * 0.033) / ez}
                  fill={cor} fillOpacity={0.25} stroke={cor} strokeWidth={1.5/ez}/>
              </g>
            );
          })}
          {marcadores.filter(m => {
            const isPos = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
            if (isPos && !mostrarPositivos) return false;
            if (!isPos && !mostrarNegativos) return false;
            return true;
          }).map((m, mi) => {
            const contatos = m._contatos || parseConfigToContatos(m.config);
            const { ux: ux0, uy: uy0 } = dirUnitVector2D(contatos);
            const { rx: ux, ry: uy } = rot2D(ux0, uy0);
            const ampEf = calcAmpEfetiva(contatos, m.amp || 0);
            const r = toR(ampEf);
            const px = C + ux * r, py = C - uy * r;
            const isPos = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
            const info = MARCADOR_LETRAS[m.tipo] || { letra: '?' };
            const fill = isPos ? '#059669' : '#e11d48';
            const markerR = Math.max(3.5, S * 0.031);
            const opacity = Math.max(0.4, opacidadeMarcador(m.sessionTimestamp || m.timestamp || 0, sessaoAtualTimestamp || Date.now()));
            return (
              <g key={mi} opacity={opacity}>
                <title>{`${m.tipo} | ${m.amp}mA | ${m.freq}Hz | PW:${m.pw}`}</title>
                <circle cx={px} cy={py} r={markerR} fill={fill} fillOpacity={0.3} stroke={fill} strokeWidth={1.5}/>
                <text x={px} y={py} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(6, S*0.045)} fill="#fff" fontWeight="bold" stroke={fill} strokeWidth={0.3}>{info.letra}</text>
              </g>
            );
          })}
        </svg>
        {isZoomed && <div className="absolute top-1 right-2 text-[9px] text-slate-500 font-bold bg-white/80 px-1 rounded">×</div>}
      </div>
      {/* Zoom slider */}
      {(isZoomed || forcedSize) && (
        <div className="flex items-center gap-1.5 w-full px-1 mt-0.5">
          <span className="text-[7px] text-slate-400 shrink-0">🔍</span>
          <input type="range" min={1} max={8} step={0.5} value={zoomLevel}
            onChange={e => { setZoomLevel(parseFloat(e.target.value)); setPanOffset({x:0,y:0}); }}
            className="flex-1 h-1 accent-indigo-500 cursor-pointer"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          />
          <span className="text-[7px] text-slate-400 shrink-0 w-6">{zoomLevel.toFixed(1)}×</span>
          {(zoomLevel !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
            <button onClick={e => { e.stopPropagation(); setZoomLevel(1); setPanOffset({x:0,y:0}); }}
              className="text-[7px] text-slate-500 hover:text-slate-700 px-1 py-0 rounded bg-slate-100">↺</button>
          )}
        </div>
      )}
    </div>
  );
};

const DirectionalHistorico = ({ marcadores, historicoRef, maxAmp, sessaoAtualTimestamp, programaContatos, ampAtual, agruparPorFreq, anteriorContact = 'A', onOpenFullscreen, forcedSize }) => {
  const [mostrarPositivos, setMostrarPositivos] = React.useState(true);
  const [mostrarNegativos, setMostrarNegativos] = React.useState(true);
  const [mostrarPrevios, setMostrarPrevios] = React.useState(true);
  const byGroup = {};
  marcadores.forEach(m => {
    const key = String(agruparPorFreq ? (m.freq || 130) : (m.pw || 60));
    if (!byGroup[key]) byGroup[key] = [];
    byGroup[key].push({ ...m, _contatos: parseConfigToContatos(m.config) });
  });
  // Also group historicoRef by the same key so each PolarDisplay2D gets the right slice
  const histByGroup = {};
  (historicoRef || []).forEach(h => {
    const key = String(agruparPorFreq ? (h.freq || 130) : (h.pw || 60));
    if (!histByGroup[key]) histByGroup[key] = [];
    histByGroup[key].push(h);
  });
  const keys = [...new Set([...Object.keys(byGroup), ...Object.keys(histByGroup)])].sort((a, b) => +a - +b);
  const labelPrefix = agruparPorFreq ? 'Hz' : 'µs';

  return (
    <div className="flex flex-col gap-1 mb-2">
      <div className="flex items-center gap-1.5 px-1">
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="checkbox" checked={mostrarPositivos} onChange={e => setMostrarPositivos(e.target.checked)} className="accent-emerald-500 w-3 h-3"/>
          <span className="text-[8px] text-emerald-600">Positivos</span>
        </label>
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="checkbox" checked={mostrarNegativos} onChange={e => setMostrarNegativos(e.target.checked)} className="accent-rose-500 w-3 h-3"/>
          <span className="text-[8px] text-rose-600">Colaterais</span>
        </label>
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="checkbox" checked={mostrarPrevios} onChange={e => setMostrarPrevios(e.target.checked)} className="accent-slate-500 w-3 h-3"/>
          <span className="text-[8px] text-slate-500">Prev</span>
        </label>
      </div>
      {keys.length === 0 ? (
        <div className="text-[9px] text-slate-600 italic px-1">Sem marcadores neste nível direcional</div>
      ) : (
        <div className="flex gap-2 flex-wrap px-1">
          {keys.map(k => (
            <PolarDisplay2D key={k}
              marcadores={byGroup[k] || []}
              historicoRef={histByGroup[k] || []}
              maxAmp={maxAmp}
              labelGrupo={`${k}${labelPrefix}`}
              sessaoAtualTimestamp={sessaoAtualTimestamp}
              programaContatos={programaContatos}
              ampAtual={ampAtual}
              mostrarPositivos={mostrarPositivos}
              mostrarNegativos={mostrarNegativos}
              mostrarPrevios={mostrarPrevios}
              anteriorContact={anteriorContact}
              onOpenFullscreen={onOpenFullscreen ? () => onOpenFullscreen(k) : undefined}
              forcedSize={forcedSize}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Visão "3D": VTA (modelo de campo elétrico) em 3 planos — axial, frente e lado —
// do programa atual, com as programações prévias sobrepostas como contornos
// na cor do efeito e os marcadores de limiar na borda da VTA de cada um.
const TripleView3D = ({ marcadores, historicoRef, sessaoAtualTimestamp, programaContatos, ampAtual, agruparPorFreq, marcadoresRing, anteriorContact = 'A', onOpenFullscreen, forcedSize,
                        tipoEletrodo = 'directional', pwAtual, modoContato, modoAmplitude, impedancia }) => {
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [mostrarRing, setMostrarRing] = React.useState(true);
  const [mostrarSingleDir, setMostrarSingleDir] = React.useState(true);
  const [mostrarPositivos, setMostrarPositivos] = React.useState(true);
  const [mostrarNegativos, setMostrarNegativos] = React.useState(true);
  const [mostrarPrevios, setMostrarPrevios] = React.useState(true);
  const [apenasSimilar, setApenasSimilar] = React.useState(false);
  const [tvZoom, setTvZoom] = React.useState(1);
  const [tvPan, setTvPan] = React.useState({ x: 0, y: 0 });
  const tvPanRef = React.useRef(null);
  const anteriorAngle = CONTACT_ANTERIOR_ANGLES[anteriorContact] ?? 90;
  const S = forcedSize ?? (isZoomed ? 240 : 140);
  const C = S / 2, margin = S * 0.12, R = C - margin;

  // Fix 2: maxAmp from actual data, not slider max
  const allRing = marcadoresRing || [];
  // Fix 1: similar filter based on programaContatos level
  const currentLevel = programaContatos
    ? [...new Set(Object.keys(programaContatos).filter(k => programaContatos[k].state !== 'off' && /[ABC]$/.test(k)).map(k => k[0]))]
    : [];
  const isSimilar = (config) => {
    if (!apenasSimilar || currentLevel.length === 0) return true;
    const levels = [...new Set(Object.keys(parseConfigToContatos(config)).filter(k => /[ABC]$/.test(k)).map(k => k[0]))];
    if (levels.length === 0) return true; // ring config: always show (no directional levels to filter by)
    return levels.some(l => currentLevel.includes(l));
  };

  // Cache classifyStim results to avoid recomputing for each filter
  const ringClassCacheRef = React.useRef(new Map());
  const getStimType = React.useCallback((m) => {
    if (!m || !m.config) return 'ring';
    const cache = ringClassCacheRef.current;
    if (!cache.has(m.config)) {
      try { cache.set(m.config, classifyStim(parseConfigToContatos(m.config), tipoEletrodo)); }
      catch(e) { cache.set(m.config, 'ring'); }
    }
    return cache.get(m.config);
  }, [tipoEletrodo]);
  const marcadoresSingleDirExtras = mostrarSingleDir ? allRing.filter(m => getStimType(m) === 'single-dir') : [];
  const marcadoresRingExtras = mostrarRing ? allRing.filter(m => {
    const st = getStimType(m);
    return st === 'ring' || (!getDirLevel(m.config) && st !== 'single-dir');
  }) : [];

  const filterMarcador = (m, isCurrent) => {
    const isPos = ['tremor', 'rigidez', 'bradicinesia'].includes(m.tipo);
    if (isPos && !mostrarPositivos) return false;
    if (!isPos && !mostrarNegativos) return false;
    if (!isCurrent && !mostrarPrevios) return false;
    if (!isCurrent && !isSimilar(m.config)) return false;
    return true;
  };

  // Group by PW or Freq
  const byGroup = {};
  const marcadoresSet = new Set(marcadores); // O(1) lookup vs O(n) includes()
  // Deduplicate: marcadoresSingleDirExtras may overlap with marcadores when in 3d mode
  const allMarcadores = [...marcadores, ...marcadoresSingleDirExtras.filter(m => !marcadoresSet.has(m))];
  allMarcadores.forEach(m => {
    const key = String(agruparPorFreq ? (m.freq || 130) : (m.pw || 60));
    if (!byGroup[key]) byGroup[key] = { multiDir: [], singleDir: [] };
    if (marcadoresSet.has(m)) byGroup[key].multiDir.push(m);
    else byGroup[key].singleDir.push(m);
  });
  const histByGroup3D = {};
  const MAX_HIST_PER_GROUP = 30; // cap to prevent render slowdown with many sessions
  (historicoRef || []).forEach(h => {
    if (mostrarPrevios && isSimilar(h.config)) {
      const key = String(agruparPorFreq ? (h.freq || 130) : (h.pw || 60));
      if (!histByGroup3D[key]) histByGroup3D[key] = [];
      if (histByGroup3D[key].length < MAX_HIST_PER_GROUP) histByGroup3D[key].push(h);
    }
  });

  // ── Modelo de VTA (mesmo da aba VTA): cada programação vira contornos
  //    |E| ≥ limiar em 3 planos — axial, frente (lateral) e lado (AP).
  const anteriorRad = anteriorAngle * Math.PI / 180;
  const angAP  = anteriorRad;                   // lado: anterior → direita
  const angLat = anteriorRad + Math.PI / 2;     // frente: eixo lateral
  const xyTheta = -Math.PI / 2 - anteriorRad;   // axial: anterior → embaixo
  const rotXY = (ux, uy) => ({
    rx: ux * Math.cos(xyTheta) - uy * Math.sin(xyTheta),
    ry: ux * Math.sin(xyTheta) + uy * Math.cos(xyTheta),
  });
  const imp = Number(impedancia) || 0;
  const opcoesVTA = { eLimiar60: E_LIMIAR_60US, fatorAnodo: FATOR_ANODO_PADRAO, angLat, angAP };
  const vtaDeConfig = (config, amp, pwItem) => {
    if (!config || !(amp > 0)) return null;
    const pwi = pwItem || pwAtual || 60;
    return estimarVTA3Planos(
      { contatos: parseConfigToContatos(config), amp, pw: pwi, modoContato: 'perc', tipoEletrodo, modoAmplitude, impedanciaOhm: imp },
      { ...opcoesVTA, chave: `${config}|${amp}|${pwi}|${tipoEletrodo}|${modoAmplitude}|${imp}` });
  };
  const vtaAtual = (programaContatos && ampAtual > 0)
    ? estimarVTA3Planos(
        { contatos: programaContatos, amp: ampAtual, pw: pwAtual || 60, modoContato, tipoEletrodo, modoAmplitude, impedanciaOhm: imp },
        { ...opcoesVTA, detalhe: 'fino' })
    : null;

  // Escala em mm: alcance máximo entre tudo que será desenhado (mín. 3 mm)
  let maxMm = 3;
  const considerar = (v) => { if (v && v.resumo.rMax > maxMm) maxMm = v.resumo.rMax; };
  considerar(vtaAtual);
  for (const m of [...marcadores, ...allRing]) considerar(vtaDeConfig(m.config, m.amp, m.pw));
  for (const h of (historicoRef || []).slice(0, 60)) considerar(vtaDeConfig(h.config, h.amp, h.pw));
  maxMm = Math.min(7, Math.ceil(maxMm + 0.25));
  const pxPorMm = R / maxMm;
  const rings = [];
  for (let v = 1; v <= maxMm; v++) rings.push(v);

  // Referência vertical das vistas longitudinais: z do cátodo do programa atual
  const pitch = pitchDoEletrodo(tipoEletrodo);
  const elDesenho = getEletrodoDisplay(tipoEletrodo);
  const zRef = vtaAtual ? vtaAtual.z : ((elDesenho.nNiveis - 1) * pitch) / 2;
  const zToSvg = (z) => C - (z - zRef) * pxPorMm;
  const mmToX = (x) => C + x * pxPorMm;

  const labelPrefix = agruparPorFreq ? 'Hz' : 'µs';

  // Eletrodo em escala real (vistas longitudinais)
  const ElectrodeSchematic = () => {
    const w = LEAD_R_MM * pxPorMm;
    const zTop = (elDesenho.nNiveis - 1) * pitch + 8, zBot = -2;
    return (
      <g>
        <rect x={C - w} y={zToSvg(zTop)} width={2 * w} height={(zTop - zBot) * pxPorMm}
          fill="#e2e8f0" stroke="#94a3b8" strokeWidth={0.4 / tvEz}/>
        {elDesenho.niveis.map(n => {
          const estados = n.contatos.map(k => programaContatos?.[k]?.state || 'off');
          const st = estados.includes('-') ? '-' : estados.includes('+') ? '+' : 'off';
          const fill = st === '-' ? '#06b6d4' : st === '+' ? '#f43f5e' : '#94a3b8';
          const y = zToSvg(n.idx * pitch + CONTACT_H_MM / 2);
          return (
            <g key={n.idx}>
              <rect x={C - w} y={y} width={2 * w} height={CONTACT_H_MM * pxPorMm}
                fill={fill} stroke="#475569" strokeWidth={0.4 / tvEz} rx={1 / tvEz}/>
              <text x={C + w + 2 / tvEz} y={y + CONTACT_H_MM * pxPorMm / 2} dominantBaseline="middle"
                fontSize={Math.max(5, S * 0.038) / tvEz} fill="#64748b">{n.tipo === 'dir' ? `${n.idx}ABC` : n.idx}</text>
            </g>
          );
        })}
      </g>
    );
  };

  // ViewBox for zoom+pan (shared across all 3 projection SVGs)
  const tvVpW = S / tvZoom, tvVpH = S / tvZoom;
  const tvVpX = C + tvPan.x - tvVpW / 2;
  const tvVpY = C + tvPan.y - tvVpH / 2;
  const tvVB = `${tvVpX} ${tvVpY} ${tvVpW} ${tvVpH}`;
  const tvEz = tvZoom; // divide element sizes by this
  const onTvPointerDown = (e) => {
    if (e.button !== 0) return;
    const scale = tvVpW / S;
    tvPanRef.current = { startX: e.clientX, startY: e.clientY, ox: tvPan.x, oy: tvPan.y, scale };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onTvPointerMove = (e) => {
    if (!tvPanRef.current) return;
    const dx = (e.clientX - tvPanRef.current.startX) * tvPanRef.current.scale * -1;
    const dy = (e.clientY - tvPanRef.current.startY) * tvPanRef.current.scale * -1;
    setTvPan({ x: tvPanRef.current.ox + dx, y: tvPanRef.current.oy + dy });
  };
  const onTvPointerUp = () => { tvPanRef.current = null; };

  const anteriorLabel = anteriorContact;
  const posteriorLabel = { 'A':'B/C','AB':'BC','B':'C/A','BC':'CA','C':'A/B','CA':'AB' }[anteriorContact] || 'Post';
  // rótulos dos segmentos A/B/C em cada vista
  const dirLabelsXY = Object.entries(DIR_ANGLES).map(([lt, deg]) => {
    const r = deg * Math.PI / 180; const { rx, ry } = rotXY(Math.cos(r), Math.sin(r));
    return { letter: lt, lx: rx, ly: ry };
  });
  const dirLabelsLong = (ang) => Object.entries(DIR_ANGLES).map(([lt, deg]) => {
    const r = deg * Math.PI / 180;
    return { letter: lt, lx: Math.cos(r - ang), ly: 0.88 };   // projeção no eixo horizontal da vista
  });
  const comSegmentos = elDesenho.temDirecional;

  const projections = [
    { id: 'axial', label: 'XY · axial', longitudinal: false, dirLabels: dirLabelsXY },
    { id: 'lat',   label: `XZ · frente (→${anteriorLabel}+90°)`, longitudinal: true, dirLabels: dirLabelsLong(angLat) },
    { id: 'ap',    label: `YZ · lado (${posteriorLabel}←→${anteriorLabel})`, longitudinal: true, dirLabels: dirLabelsLong(angAP) },
  ];

  // Contorno → path SVG, conforme a vista
  const pathAxial = (axial) => axial.map(({ ang, r }, i) => {
    const { rx, ry } = rotXY(Math.cos(ang), Math.sin(ang));
    const rr = Math.max(r, LEAD_R_MM) * pxPorMm;
    return `${i ? 'L' : 'M'}${(C + rx * rr).toFixed(1)},${(C - ry * rr).toFixed(1)}`;
  }).join(' ') + ' Z';
  const pathLong = (faixas) => faixas.map(f => {
    const dir = f.map(p => `${mmToX(p.rPos).toFixed(1)},${zToSvg(p.z).toFixed(1)}`);
    const esq = [...f].reverse().map(p => `${mmToX(-p.rNeg).toFixed(1)},${zToSvg(p.z).toFixed(1)}`);
    return `M${dir.join(' L')} L${esq.join(' L')} Z`;
  }).join(' ');
  const pathDe = (v, id) => !v ? null : id === 'axial' ? pathAxial(v.axial) : pathLong(v[id]);

  // Ponto de limiar de um marcador na vista: borda da VTA do seu programa,
  // na direção de maior alcance (simétrico no axial → círculo)
  const pontoMarcador = (v, id) => {
    if (!v) return null;
    if (id === 'axial') {
      if (v.resumo.aniso <= 1.08) return { circulo: v.resumo.rMax * pxPorMm };
      const { rx, ry } = rotXY(Math.cos(v.resumo.angMax), Math.sin(v.resumo.angMax));
      const rr = v.resumo.rMax * pxPorMm;
      return { x: C + rx * rr, y: C - ry * rr };
    }
    const p = pontoMaxLongitudinal(v[id]);
    return p ? { x: mmToX(p.x), y: zToSvg(p.z) } : null;
  };

  const allKeys = [...new Set([
    ...Object.keys(byGroup),
    ...marcadoresRingExtras.map(m => String(agruparPorFreq ? (m.freq || 130) : (m.pw || 60))),
    ...Object.keys(histByGroup3D)
  ])].sort((a, b) => +a - +b)
    .slice(0, 8); // cap at 8 groups to prevent render explosion
  allKeys.forEach(k => { if (!byGroup[k]) byGroup[k] = { multiDir: [], singleDir: [] }; });

  const renderOneSVG = (grpKey, { multiDir, singleDir }, histItems, id, longitudinal, dirLabels) => {
    const ringMks = marcadoresRingExtras.filter(m =>
      String(agruparPorFreq ? (m.freq || 130) : (m.pw || 60)) === grpKey);
    const fs = Math.max(5, S * 0.04) / tvEz;

    const desenharMarcador = (m, mi, tipoMk) => {
      const v = vtaDeConfig(m.config, m.amp, m.pw);
      const pt = pontoMarcador(v, id);
      if (!pt) return null;
      const isPos = ['tremor', 'rigidez', 'bradicinesia'].includes(m.tipo);
      const info = MARCADOR_LETRAS[m.tipo] || { letra: '?' };
      const fill = isPos ? '#059669' : '#e11d48';
      const opacity = Math.max(0.4, opacidadeMarcador(m.sessionTimestamp || m.timestamp || 0, sessaoAtualTimestamp || Date.now()));
      const titulo = `${m.tipo} | ${m.config} | ${m.amp}mA | ${m.pw || '?'}µs | alcance ${v.resumo.rMax.toFixed(1)}mm`;
      if (pt.circulo) {
        return (
          <g key={`${tipoMk}-${mi}`} opacity={opacity * 0.8}>
            <title>{titulo}</title>
            <circle cx={C} cy={C} r={pt.circulo} fill="none" stroke={fill} strokeWidth={1 / tvEz} strokeDasharray="2,2"/>
            <text x={C + pt.circulo * 0.707 + 2 / tvEz} y={C - pt.circulo * 0.707} textAnchor="middle"
              fontSize={fs} fill={fill} fontWeight="bold">{info.letra}</text>
          </g>
        );
      }
      const mr = Math.max(3.5, S * 0.03) / tvEz;
      return (
        <g key={`${tipoMk}-${mi}`} opacity={tipoMk === 'md' ? opacity : opacity * 0.75}>
          <title>{titulo}</title>
          <circle cx={pt.x} cy={pt.y} r={mr} fill={fill} fillOpacity={0.3} stroke={fill} strokeWidth={1.2 / tvEz}
            strokeDasharray={tipoMk === 'md' ? undefined : '1,1'}/>
          <text x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(5, S * 0.04) / tvEz} fill="#fff" fontWeight="bold" stroke={fill} strokeWidth={0.3}>{info.letra}</text>
        </g>
      );
    };

    const yEixo = longitudinal ? zToSvg(zRef) : C;

    return (
      <svg key={`${grpKey}-${id}`} width={S} height={S} viewBox={tvVB}
        onPointerDown={tvZoom > 1 ? onTvPointerDown : undefined}
        onPointerMove={tvZoom > 1 ? onTvPointerMove : undefined}
        onPointerUp={tvZoom > 1 ? onTvPointerUp : undefined}
        style={{ cursor: tvZoom > 1 ? 'grab' : 'default' }}>
        <rect x={tvVpX} y={tvVpY} width={tvVpW} height={tvVpH} fill="#ffffff" rx="6"/>
        {/* Grade em mm: círculos no axial, linhas verticais nas longitudinais */}
        {!longitudinal ? rings.map(v => (
          <g key={v}>
            <circle cx={C} cy={C} r={v * pxPorMm} fill="none"
              stroke={v === maxMm ? '#94a3b8' : '#e2e8f0'} strokeWidth={(v === maxMm ? 1 : 0.5) / tvEz}
              strokeDasharray={v < maxMm ? '2,2' : undefined}/>
            <text x={C + v * pxPorMm + 1 / tvEz} y={C - 1 / tvEz} fontSize={fs * 0.8} fill="#94a3b8">{v}</text>
          </g>
        )) : rings.map(v => (
          <g key={v}>
            {[-1, 1].map(sg => (
              <line key={sg} x1={mmToX(sg * v)} y1={tvVpY} x2={mmToX(sg * v)} y2={tvVpY + tvVpH}
                stroke="#e2e8f0" strokeWidth={0.5 / tvEz} strokeDasharray="2,2"/>
            ))}
            <text x={mmToX(v) + 1 / tvEz} y={C + R - 1} fontSize={fs * 0.8} fill="#94a3b8">{v}</text>
          </g>
        ))}
        <line x1={margin} y1={yEixo} x2={S - margin} y2={yEixo} stroke="#e2e8f0" strokeWidth={0.5 / tvEz}/>
        {!longitudinal && <line x1={C} y1={margin} x2={C} y2={S - margin} stroke="#e2e8f0" strokeWidth={0.5 / tvEz}/>}
        {comSegmentos && dirLabels.map(({ letter, lx, ly }) => {
          const labelR = R + S * 0.06;
          return <text key={letter} x={C + lx * labelR} y={longitudinal ? C - ly * R + 2 : C - ly * labelR}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(7, S * 0.05) / tvEz} fontWeight="bold" fill={longitudinal ? '#94a3b8' : '#1e293b'}>{letter}</text>;
        })}

        {/* Programações prévias: contorno de VTA na cor do efeito */}
        {mostrarPrevios && histItems.map((h, hi) => {
          if (!h || !h.config) return null;
          const hType = getStimType(h);
          const isRing = hType === 'ring' || !getDirLevel(h.config);
          if (isRing && !mostrarRing) return null;
          if (!isRing && !mostrarSingleDir) return null;
          const d = pathDe(vtaDeConfig(h.config, h.amp, h.pw), id);
          if (!d) return null;
          const cor = getEfeitoCor(h.efeito, 'hex');
          const corTraco = cor === 'transparent' ? '#94a3b8' : cor;
          const opacity = Math.max(0.35, opacidadeMarcador(h.date || 0, sessaoAtualTimestamp || Date.now()));
          return (
            <path key={`previo-${hi}`} d={d} fill={corTraco} fillOpacity={0.04} stroke={corTraco}
              strokeWidth={1.2 / tvEz} strokeDasharray={h.efeito === 'nao_testado' ? '2,2' : undefined}
              strokeLinejoin="round" opacity={opacity}>
              <title>{`${h.config} | ${h.amp}mA | ${h.pw}µs | ${h.efeito}${h.date ? ' | ' + formatarData(h.date) : ''}`}</title>
            </path>
          );
        })}

        {/* Programa atual: VTA preenchida */}
        {vtaAtual && (
          <path d={pathDe(vtaAtual, id)} fill="#6366f1" fillOpacity={0.15} stroke="#6366f1"
            strokeWidth={1.8 / tvEz} strokeDasharray="4,2" strokeLinejoin="round">
            <title>{`Programa atual | ${Number(ampAtual).toFixed(1)}mA | ${pwAtual || 60}µs | alcance ${vtaAtual.resumo.rMax.toFixed(1)}mm`}</title>
          </path>
        )}

        {longitudinal ? <ElectrodeSchematic/> : (
          <>
            <circle cx={C} cy={C} r={LEAD_R_MM * pxPorMm} fill="#cbd5e1" stroke="#64748b" strokeWidth={0.6 / tvEz}/>
          </>
        )}

        {/* Marcadores de limiar na borda da VTA do respectivo programa */}
        {ringMks.filter(m => filterMarcador(m, false)).map((m, mi) => desenharMarcador(m, mi, 'ring'))}
        {singleDir.filter(m => filterMarcador(m, false)).map((m, mi) => desenharMarcador(m, mi, 'sd'))}
        {multiDir.filter(m => filterMarcador(m, true)).map((m, mi) => desenharMarcador(m, mi, 'md'))}
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-1 mb-2">
      <div className="flex items-center justify-between px-1 flex-wrap gap-1">
        <p className="text-[8px] text-slate-500 uppercase tracking-widest" title="Contornos de VTA pelo modelo de campo elétrico (|E| ≥ 0,2 V/mm a 60 µs, ajustado ao PW). Escala em mm.">VTA · 3 planos (mm)</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={mostrarRing} onChange={e => setMostrarRing(e.target.checked)} className="accent-indigo-500 w-3 h-3"/>
            <span className="text-[8px] text-slate-500">Ring</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={mostrarSingleDir} onChange={e => setMostrarSingleDir(e.target.checked)} className="accent-indigo-500 w-3 h-3"/>
            <span className="text-[8px] text-slate-500">S-dir</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={mostrarPositivos} onChange={e => setMostrarPositivos(e.target.checked)} className="accent-emerald-500 w-3 h-3"/>
            <span className="text-[8px] text-emerald-600">+</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={mostrarNegativos} onChange={e => setMostrarNegativos(e.target.checked)} className="accent-rose-500 w-3 h-3"/>
            <span className="text-[8px] text-rose-600">−</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={mostrarPrevios} onChange={e => setMostrarPrevios(e.target.checked)} className="accent-slate-500 w-3 h-3"/>
            <span className="text-[8px] text-slate-500">Prev</span>
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer">
            <input type="checkbox" checked={apenasSimilar} onChange={e => setApenasSimilar(e.target.checked)} className="accent-amber-500 w-3 h-3"/>
            <span className="text-[8px] text-amber-600">Sim.</span>
          </label>
          {/* Zoom slider */}
          <div className="flex items-center gap-1 ml-1">
            <span className="text-[7px] text-slate-400">🔍</span>
            <input type="range" min={1} max={8} step={0.5} value={tvZoom}
              onChange={e => { setTvZoom(parseFloat(e.target.value)); setTvPan({x:0,y:0}); }}
              className="w-16 h-1 accent-indigo-500 cursor-pointer"/>
            <span className="text-[7px] text-slate-400 w-6">{tvZoom.toFixed(1)}×</span>
            {(tvZoom !== 1 || tvPan.x !== 0 || tvPan.y !== 0) && (
              <button onClick={() => { setTvZoom(1); setTvPan({x:0,y:0}); }}
                className="text-[7px] text-slate-500 hover:text-slate-700 px-1 rounded bg-slate-100">↺</button>
            )}
          </div>
          <button onClick={() => setIsZoomed(!isZoomed)} className="text-[8px] text-slate-500 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200">
            {isZoomed ? '−' : '+'}
          </button>
          {onOpenFullscreen && (
            <button onClick={onOpenFullscreen} className="text-[8px] text-slate-500 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200" title="Tela cheia">⛶</button>
          )}
        </div>
      </div>
      {allKeys.length === 0 ? (
        <p className="text-[9px] text-slate-400 italic px-1">Sem marcadores</p>
      ) : allKeys.map(grpKey => (
        <div key={grpKey} className="flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-400 font-mono px-1">{grpKey}{labelPrefix}</span>
          <div className="flex gap-2 flex-wrap">
            {projections.map(({ id, label, longitudinal, dirLabels }) => (
              <div key={id} className="flex flex-col items-center gap-0.5">
                <span className="text-[7px] text-slate-500">{label}</span>
                {renderOneSVG(grpKey, byGroup[grpKey], histByGroup3D[grpKey] || [], id, longitudinal, dirLabels)}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="flex items-center gap-0.5 text-[7px] text-slate-500"><span className="inline-block w-3 h-2 rounded-sm border border-dashed border-indigo-500 bg-indigo-100"/>atual</span>
        {EFEITO_LEGENDA_3D.map(([val, lbl]) => (
          <span key={val} className="flex items-center gap-0.5 text-[7px] text-slate-500">
            <span className="inline-block w-3 h-0.5" style={{ background: getEfeitoCor(val, 'hex') }}/>{lbl}
          </span>
        ))}
        <span className="text-[7px] text-slate-400">· mais antigas mais claras</span>
      </div>
    </div>
  );
};

const EFEITO_LEGENDA_3D = [['bom','melhor'],['neutro','bom'],['pouco','pouco efeito'],['col_marcha','col. marcha'],['col_fala','col. fala'],['col_outros','col. outros']];


const SessionFilterDropdown = ({ sessions, hiddenSessions, onToggle }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  // Close on outside click
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const hidden = hiddenSessions.size;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 text-[7px] font-bold px-1.5 py-0.5 rounded border transition-all ${hidden > 0 ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-400'}`}
        title="Filtrar sessões visíveis">
        👁 Sessões{hidden > 0 ? ` (${sessions.length - hidden}/${sessions.length})` : ''}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[220px] max-h-64 overflow-y-auto">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">Sessões na timeline</p>
          {sessions.map(sess => {
            const isVisible = !hiddenSessions.has(sess.id);
            return (
              <label key={sess.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={isVisible}
                  onChange={() => onToggle(sess.id)}
                  className="accent-indigo-500 w-3 h-3"/>
                <span className={`text-[9px] font-mono ${isVisible ? 'text-slate-700' : 'text-slate-300'}`}>
                  {new Date(sess.ts).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit'})}
                </span>
                {sess.resumo && (
                  <span className={`text-[8px] truncate flex-1 ${isVisible ? 'text-slate-500' : 'text-slate-300'}`}>
                    {sess.resumo.slice(0,30)}
                  </span>
                )}
                <span className={`text-[7px] px-1 rounded font-bold ${isVisible ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {isVisible ? 'vis.' : 'oculta'}
                </span>
              </label>
            );
          })}
          <div className="flex gap-1 mt-2 px-1">
            <button onClick={() => sessions.forEach(s => hiddenSessions.has(s.id) && onToggle(s.id))}
              className="text-[8px] text-slate-500 hover:text-slate-700 underline">Mostrar todas</button>
            <button onClick={() => sessions.forEach(s => !hiddenSessions.has(s.id) && onToggle(s.id))}
              className="text-[8px] text-slate-500 hover:text-slate-700 underline ml-2">Ocultar todas</button>
          </div>
        </div>
      )}
    </div>
  );
};

const TimelineHistorico = ({ historicoRef, maxAmp, marcadores, sessaoAtualTimestamp, agruparPorFreq }) => {
  const [timelineW, setTimelineW] = React.useState(null);
  const [hiddenSessions, setHiddenSessions] = React.useState(new Set());
  const dragRef = React.useRef(null);

  // Extract unique sessions from historicoRef
  const sessionList = React.useMemo(() => {
    if (!historicoRef) return [];
    const map = new Map();
    historicoRef.forEach(h => {
      const id = h.sessionId || h.date || String(h.amp);
      if (!map.has(id)) map.set(id, { id, ts: h.date || 0, resumo: h.resumo || '' });
    });
    return [...map.values()].sort((a, b) => b.ts - a.ts);
  }, [historicoRef]);

  const toggleSession = (id) => setHiddenSessions(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Filtered historicoRef
  const historicoFiltered = React.useMemo(() => {
    if (!historicoRef || hiddenSessions.size === 0) return historicoRef;
    return historicoRef.filter(h => {
      const id = h.sessionId || h.date || String(h.amp);
      return !hiddenSessions.has(id);
    });
  }, [historicoRef, hiddenSessions]);

  const iniciarResize = (e) => {
    e.preventDefault();
    const container = dragRef.current?.parentElement;
    if (!container) return;
    const startX = e.clientX;
    const startW = container.getBoundingClientRect().width;
    const onMove = (ev) => {
      const newW = Math.max(180, startW + (ev.clientX - startX));
      setTimelineW(newW);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const historicoPorGrupo = useMemo(() => {
    const grupos = {};
    if (!historicoFiltered) return grupos;
    historicoFiltered.forEach(h => {
      const key = String(agruparPorFreq ? h.freq : h.pw);
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(h);
    });
    return Object.keys(grupos).sort((a,b) => Number(a) - Number(b)).reduce((obj, key) => {
      obj[key] = grupos[key]; return obj;
    }, {});
  }, [historicoFiltered, agruparPorFreq]);

  const effectiveMax = maxAmp > 0 ? maxAmp : 4;

  const gruposDosMarcadores = (marcadores || []).map(m => String(agruparPorFreq ? m.freq : m.pw)).filter(Boolean);
  const todosOsPWs = [...new Set([...Object.keys(historicoPorGrupo), ...gruposDosMarcadores])]
    .sort((a, b) => Number(a) - Number(b));

  // Gerar marcações de eixo X a cada 0.5 mA
  const ampTicks = [];
  for (let a = 0; a <= effectiveMax; a += 0.5) ampTicks.push(parseFloat(a.toFixed(1)));

  if (todosOsPWs.length === 0) {
    return (
      <div className="relative w-full h-16 mb-2 border-b border-slate-200 bg-slate-50 rounded-t flex items-center justify-center">
        <span className="text-[10px] text-slate-400 italic">Combinação inédita</span>
      </div>
    );
  }

  const innerW = timelineW || 300; // largura interna em px, default 300

  return (
    <div className="relative w-full">
      {/* Session filter */}
      {sessionList.length > 1 && (
        <div className="flex justify-end mb-1">
          <SessionFilterDropdown sessions={sessionList} hiddenSessions={hiddenSessions} onToggle={toggleSession}/>
        </div>
      )}
      {/* Container com scroll horizontal */}
      <div className="overflow-x-auto custom-scrollbar rounded-t border border-slate-200 bg-slate-50 mb-1">
        <div ref={dragRef} className="flex flex-col p-1 space-y-1" style={{ width: `${innerW}px`, minWidth: '100%' }}>
      {/* Eixo X de amplitude */}
      {/* Os ticks ficam num container com as MESMAS margens (ml-8 mr-1) das linhas de
          marcação abaixo; antes usava pl-8 e o left:% de elementos absolute é medido
          a partir da borda do padding, o que deslocava a escala em relação às barras. */}
      <div className="relative h-4 flex">
       <div className="relative flex-1 ml-8 mr-1">
        {ampTicks.map((tick) => {
          const leftPercent = Math.min(100, (tick / effectiveMax) * 100);
          return (
            <div key={tick} className="absolute flex flex-col items-center" style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}>
              <div className="w-px h-2 bg-slate-300"></div>
              {tick % 1 === 0 && <span className="text-[8px] text-slate-400 font-bold">{tick}</span>}
            </div>
          );
        })}
       </div>
        <span className="absolute right-0 top-3 text-[7px] text-slate-400">mA</span>
      </div>

      {todosOsPWs.map((pwStr, pwIdx) => {
        const items = historicoPorGrupo[pwStr] || [];
        const itemsByAmp = {};
        items.forEach(item => {
          if (!itemsByAmp[item.amp]) itemsByAmp[item.amp] = [];
          itemsByAmp[item.amp].push(item);
        });
        // Filtrar marcadores: para cada par <0.2mA, manter apenas o mais recente;
        // em caso de mesmo timestamp, priorizar efeito colateral sobre positivo
        const marcadoresRaw = (marcadores || []).filter(m => String(agruparPorFreq ? m.freq : m.pw) === pwStr);
        const marcadoresDessePW = marcadoresRaw.filter((m, i) => {
          return !marcadoresRaw.some((outro, j) => {
            if (i === j) return false;
            if (Math.abs((m.amp || 0) - (outro.amp || 0)) >= 0.2) return false;
            const mIsPos = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
            const outroIsPos = ['tremor','rigidez','bradicinesia'].includes(outro.tipo);
            // outro vence se: é mais recente, OU mesmo tempo mas m é positivo e outro é colateral
            const tsM     = m.timestamp     || m.sessionTimestamp     || 0;
            const tsOutro = outro.timestamp || outro.sessionTimestamp || 0;
            const outroMaisRecente    = tsOutro > tsM;
            const outroTemPrioridade  = tsOutro === tsM && mIsPos && !outroIsPos;
            return outroMaisRecente || outroTemPrioridade;
          });
        });
        const MARCADOR_BOTTOM = 33;

        return (
          <div key={pwStr}>
            {/* Separador cinza escuro entre linhas de PW quando há mais de uma (mudança 3) */}
            {pwIdx > 0 && todosOsPWs.length > 1 && (
              <div className="w-full h-px bg-slate-400 opacity-40 mx-0" />
            )}
            <div className="relative w-full h-16 flex items-center">
              <span className="absolute left-0 text-[9px] font-bold text-slate-400 bg-white px-1 rounded shadow-sm z-10 border border-slate-200 w-7 text-center">{pwStr}{agruparPorFreq ? 'Hz' : 'µs'}</span>
              <div className="relative flex-1 h-full ml-8 mr-1">

                {/* Indicadores clínicos históricos — z-10, renderizados ANTES dos marcadores no DOM
                    mas com z maior para ficar na frente */}
                {Object.entries(itemsByAmp).map(([ampStr, ampItems]) => {
                  const leftPercent = Math.min(100, (Number(ampStr) / effectiveMax) * 100);
                  ampItems.sort((a, b) => b.freq - a.freq); 
                  const isMultiple = ampItems.length > 1;

                  return ampItems.map((h, i) => {
                    const cor = getEfeitoCor(h.efeito, 'timeline');
                    const opacidade = opacidadeMarcador(h.date || 0, sessaoAtualTimestamp || Date.now());                    
                    if (isMultiple) {
                      const bottomPos = (ampItems.length - 1 - i) * 14 + 2;
                      return (
                        <div key={`${ampStr}-${h.freq}`}
                             className={`absolute w-3 h-3 rounded-full shadow-sm border border-white flex items-center justify-center ${cor} z-10`}
                             style={{ left: `${leftPercent}%`, bottom: `${bottomPos}px`, transform: 'translateX(-50%)', opacity: opacidade }}
                             title={`${h.amp}mA | ${h.freq}Hz | ${h.efeito} | Sessão: ${formatarData(h.date)}`}
                        >
                          <span className="text-[7px] text-slate-800 font-bold" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: 1 }}>{h.freq}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div key={`${ampStr}-${h.freq}`}
                          className={`absolute bottom-0 w-2.5 h-9 rounded-t shadow-sm flex items-start justify-center overflow-visible ${cor} z-10`}
                          style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)', opacity: opacidade }}
                          title={`${h.amp}mA | ${h.freq}Hz | ${h.efeito} | Sessão: ${formatarData(h.date)}`}
                        >
                          <span className="text-[8px] text-slate-700 font-bold mt-0.5" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: 1 }}>{agruparPorFreq ? `${h.pw}µs` : `${h.freq}Hz`}</span>
                        </div>
                      );
                    }
                  });
                })}

                {/* Marcadores clínicos — z-0, atrás dos indicadores, todos na mesma altura fixa */}
                {marcadoresDessePW.map((m, mi) => {
                  const leftPercent = Math.min(100, (m.amp / effectiveMax) * 100);
                  const isPositivo = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
                  const corFundo = isPositivo ? 'bg-emerald-100 border-emerald-300' : 'bg-rose-100 border-rose-300';
                  const info = MARCADOR_LETRAS[m.tipo] || { letra: '?', cor: isPositivo ? 'text-emerald-700' : 'text-rose-700' };
                  const sameAmpIdx = marcadoresDessePW.filter((mm, mmi) => mm.amp === m.amp && mmi < mi).length;
                  const offsetX = sameAmpIdx * 8 - (marcadoresDessePW.filter(mm => mm.amp === m.amp).length - 1) * 4;
                  const opacidade = opacidadeMarcador(m.timestamp || 0, sessaoAtualTimestamp || Date.now());
                  const corBase = isPositivo ? '16, 185, 129' : '244, 63, 94'; // emerald-400 / rose-400 em RGB
                  const corBorda = isPositivo ? '5, 150, 105' : '225, 29, 72';
                  return (
                    <div key={`m-${mi}`}
                      className="absolute w-4 h-4 rounded-full z-0 flex items-center justify-center"
                      style={{
                        left: `calc(${leftPercent}% + ${offsetX}px)`,
                        bottom: `${MARCADOR_BOTTOM}px`,
                        backgroundColor: `rgba(${corBase}, ${opacidade * 0.25})`,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: `rgba(${corBorda}, ${opacidade})`,
                        transform: 'translateX(-50%)'
                      }}
                      title={`${m.tipo} | ${m.amp}mA | ${agruparPorFreq ? `PW:${m.pw}µs` : `${m.freq}Hz`} | ${Math.round(opacidade * 100)}%`}
                    >
                      <span className={`text-[8px] font-black leading-none ${info.cor}`}>{info.letra}</span>
                    </div>
                  );
                })}

              </div>
            </div>
          </div>
        );
      })}
        </div>
      </div>
      {/* Controle de largura interna */}
      <div className="flex items-center gap-1 mt-0.5 mb-1">
        <span className="text-[8px] text-slate-400 shrink-0">zoom</span>
        <input
          type="range" min={200} max={1200} step={50}
          value={innerW}
          onChange={e => setTimelineW(Number(e.target.value))}
          className="flex-1 h-1 accent-indigo-400 cursor-pointer"
          title="Largura da timeline"
        />
        <span className="text-[8px] text-slate-400 shrink-0 w-8">{innerW}px</span>
      </div>
    </div>
  );
};



// ─── ANATOMICAL ATLAS PANEL ──────────────────────────────────────────────────
// Schematic 3-plane atlas based on published stereotactic coordinates
// (Morel 2007, DISTAL atlas, Yelnik 2007, Plantinga 2016)
// Positions in mm relative to electrode center for typical targeting

const ATLAS_DATA = {
  STN: {
    label: 'Núcleo Subtalâmico (STN)',
    hint: 'GPi/STN: alvo em Parkinson/distonia',
    coronal: [ // x (lat-med), z (inf-sup), rx, rz, name, color
      { x:  0,   z:  0,   rx: 1.5, rz: 1.2, name: 'STN',  color: '#10b981', fill: true },
      { x: -0.5, z:  2.5, rx: 1.0, rz: 0.8, name: 'ZI',   color: '#06b6d4', fill: false },
      { x:  3.5, z:  1.0, rx: 0.8, rz: 3.5, name: 'C.Int.',color:'#f97316', fill: false },
      { x:  0,   z: -2.5, rx: 1.8, rz: 1.0, name: 'SNr',  color: '#94a3b8', fill: false },
      { x: -2.5, z:  0.5, rx: 1.0, rz: 1.0, name: 'RN',   color: '#e11d48', fill: false },
    ],
    axial: [ // x, y (ant-post), rx, ry
      { x:  0,   y:  0,   rx: 1.2, ry: 0.8, name: 'STN',  color: '#10b981', fill: true },
      { x:  3.5, y:  0.5, rx: 0.8, ry: 2.5, name: 'C.Int.',color:'#f97316', fill: false },
      { x: -2.5, y:  0,   rx: 1.0, ry: 1.0, name: 'RN',   color: '#e11d48', fill: false },
      { x:  0.5, y:  2.5, rx: 0.8, ry: 0.8, name: 'ZI',   color: '#06b6d4', fill: false },
    ],
    sagital: [ // y (ant-post), z (inf-sup), ry, rz
      { y:  0,   z:  0,   ry: 0.8, rz: 1.2, name: 'STN',  color: '#10b981', fill: true },
      { y:  0.5, z:  2.5, ry: 0.8, rz: 0.8, name: 'ZI',   color: '#06b6d4', fill: false },
      { y:  0,   z: -2.5, ry: 1.5, rz: 1.0, name: 'SNr',  color: '#94a3b8', fill: false },
      { y: -0.5, z:  1.5, ry: 1.0, rz: 1.5, name: 'Thal.',color: '#a78bfa', fill: false },
    ],
  },
  GPi: {
    label: 'Globus Pallidus internus (GPi)',
    hint: 'Alvo em distonia, DP com discinesia',
    coronal: [
      { x:  0,   z:  0,   rx: 1.8, rz: 1.5, name: 'GPi',  color: '#10b981', fill: true },
      { x:  2.5, z:  0.5, rx: 1.5, rz: 1.0, name: 'GPe',  color: '#06b6d4', fill: false },
      { x:  4.0, z:  0.5, rx: 0.8, rz: 4.0, name: 'C.Int.',color:'#f97316', fill: false },
      { x: -0.5, z: -2.0, rx: 2.0, rz: 1.0, name: 'SNr',  color: '#94a3b8', fill: false },
      { x: -2.0, z:  0.5, rx: 1.5, rz: 1.0, name: 'Putamen',color:'#a78bfa',fill: false },
    ],
    axial: [
      { x:  0,   y:  0,   rx: 1.5, ry: 1.0, name: 'GPi',  color: '#10b981', fill: true },
      { x:  2.5, y:  0,   rx: 1.2, ry: 0.8, name: 'GPe',  color: '#06b6d4', fill: false },
      { x:  4.0, y: -1.0, rx: 0.8, ry: 2.5, name: 'C.Int.',color:'#f97316', fill: false },
      { x: -2.5, y:  0,   rx: 1.5, ry: 1.2, name: 'Putamen',color:'#a78bfa',fill: false },
    ],
    sagital: [
      { y:  0,   z:  0,   ry: 1.0, rz: 1.5, name: 'GPi',  color: '#10b981', fill: true },
      { y: -2.0, z:  0.5, ry: 1.0, rz: 1.0, name: 'GPe',  color: '#06b6d4', fill: false },
      { y:  0,   z:  2.5, ry: 1.5, rz: 1.0, name: 'Put.',  color: '#a78bfa', fill: false },
    ],
  },
  VIM: {
    label: 'VIM (núcleo ventral intermediário)',
    hint: 'Alvo em tremor essencial / DP tremorigênico',
    coronal: [
      { x:  0,   z:  0,   rx: 1.2, rz: 1.2, name: 'VIM',  color: '#10b981', fill: true },
      { x:  1.5, z:  0,   rx: 1.0, rz: 1.0, name: 'Vc',   color: '#06b6d4', fill: false },
      { x: -2.5, z:  0,   rx: 1.0, rz: 1.0, name: 'VA/VL', color:'#a78bfa', fill: false },
      { x:  3.5, z:  0,   rx: 0.8, rz: 4.0, name: 'C.Int.',color:'#f97316', fill: false },
      { x: -0.5, z: -2.5, rx: 1.5, rz: 0.8, name: 'ZI',   color: '#64748b', fill: false },
    ],
    axial: [
      { x:  0,   y:  0,   rx: 1.2, ry: 1.0, name: 'VIM',  color: '#10b981', fill: true },
      { x:  2.0, y:  0,   rx: 1.0, ry: 1.0, name: 'Vc',   color: '#06b6d4', fill: false },
      { x: -2.0, y:  0,   rx: 1.0, ry: 1.2, name: 'VA/VL', color:'#a78bfa', fill: false },
      { x:  3.5, y: -0.5, rx: 0.8, ry: 2.5, name: 'C.Int.',color:'#f97316', fill: false },
    ],
    sagital: [
      { y:  0,   z:  0,   ry: 1.0, rz: 1.2, name: 'VIM',  color: '#10b981', fill: true },
      { y:  2.0, z:  0,   ry: 0.8, rz: 1.0, name: 'Vc',   color: '#06b6d4', fill: false },
      { y: -2.0, z:  0,   ry: 1.0, rz: 1.0, name: 'VA',   color: '#a78bfa', fill: false },
      { y:  0,   z: -2.5, ry: 1.5, rz: 0.8, name: 'ZI',   color: '#64748b', fill: false },
    ],
  },
};

const AtlasPanel = ({ target, S, C, mmToSvg, anteriorContact }) => {
  const atlas = ATLAS_DATA[target];
  if (!atlas) return null;

  const renderPlane = (structures, getX, getY, getRx, getRy, xlabel, ylabel, label) => (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[7px] text-slate-500 font-bold">{label}</span>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="rounded-lg border border-slate-200 bg-slate-50/80">
        {/* Grid rings */}
        {[1,2,3,4,5].map(mm => (
          <circle key={mm} cx={C} cy={C} r={mmToSvg(mm)} fill="none"
            stroke={mm===Math.floor(mm)?'#e2e8f0':'#f1f5f9'}
            strokeWidth={0.6} strokeDasharray={mm%1===0?undefined:'1,3'}/>
        ))}
        <line x1={12} y1={C} x2={S-12} y2={C} stroke="#e2e8f0" strokeWidth={0.4}/>
        <line x1={C} y1={12} x2={C} y2={S-12} stroke="#e2e8f0" strokeWidth={0.4}/>
        {/* mm labels */}
        {[1,2,3].map(mm => (
          <text key={mm} x={C+mmToSvg(mm)+2} y={C-2} fontSize={5.5} fill="#cbd5e1">{mm}mm</text>
        ))}
        {/* Electrode */}
        <circle cx={C} cy={C} r={4} fill="#334155"/>
        <circle cx={C} cy={C} r={2} fill="#94a3b8"/>
        {/* Axis labels */}
        <text x={S-8} y={C-3} textAnchor="end" fontSize={6} fill="#94a3b8">{xlabel}+</text>
        <text x={C+3} y={10} fontSize={6} fill="#94a3b8">{ylabel}+</text>
        {/* Structures */}
        {structures.map((s, i) => {
          const cx = C + getX(s) * mmToSvg(1);
          const cy = C - getY(s) * mmToSvg(1);
          const rx = getRx(s) * mmToSvg(1);
          const ry = getRy(s) * mmToSvg(1);
          return (
            <g key={i}>
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
                fill={s.color} fillOpacity={s.fill ? 0.3 : 0.08}
                stroke={s.color} strokeWidth={s.fill ? 1.5 : 1}
                strokeDasharray={s.fill ? undefined : '2,2'}/>
              <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle"
                fontSize={5.5} fontWeight="bold" fill={s.color} opacity={0.9}>
                {s.name}
              </text>
            </g>
          );
        })}
        {/* Anterior indicator */}
        <text x={C} y={S-4} textAnchor="middle" fontSize={5.5} fill="#94a3b8" fontStyle="italic">
          ↓ ant
        </text>
      </svg>
    </div>
  );

  return (
    <div className="mt-1 px-0.5">
      <p className="text-[7px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
        🧠 Atlas — {atlas.label}
      </p>
      <p className="text-[7px] text-slate-400 mb-1.5 italic">{atlas.hint}</p>
      <div className="flex gap-2 flex-wrap">
        {renderPlane(atlas.coronal,  s => s.x,  s => s.z, s => s.rx, s => s.rz, 'lat', 'sup', 'Coronal')}
        {renderPlane(atlas.axial,    s => s.x,  s => s.y, s => s.rx, s => s.ry, 'lat', 'ant', 'Axial')}
        {renderPlane(atlas.sagital,  s => s.y,  s => s.z, s => s.ry, s => s.rz, 'ant', 'sup', 'Sagital')}
      </div>
      <p className="text-[6px] text-slate-300 mt-1">
        Posições esquemáticas relativas ao eletrodo (Morel 2007, DISTAL atlas). Não substitui reconstrução de imagem.
      </p>
    </div>
  );
};

// ─── VTA VIEW ────────────────────────────────────────────────────────────────
// Estimated Volume of Tissue Activated overlay in physical space (mm)
// Modelo por campo elétrico (src/vtaModel.js): fontes por contato com corrente
// e polaridade próprias, superposição, região |E| ≥ limiar(PW).
// Displayed as alternative mode to avoid polluting the clinical marker view

const VTA_STRUCTURES = {
  'Cápsula':     { color: '#f97316', label: 'Cáps.' },
  'Parestesia':  { color: '#a78bfa', label: 'Pares.' },
  'Disartria':   { color: '#f43f5e', label: 'Disar.' },
  'bradicinesia':{ color: '#10b981', label: 'Brad.' },
  'rigidez':     { color: '#06b6d4', label: 'Rig.' },
  'tremor':      { color: '#3b82f6', label: 'Trem.' },
  'Outros':      { color: '#94a3b8', label: 'Outro' },
};

const POSITIVE_EFFECTS = new Set(['bradicinesia','rigidez','tremor']);

const VTAView = ({ programaContatos, modoContato, ampAtual, pw, marcadores, marcadoresRing,
                   historicoRef, anteriorContact, tipoEletrodo, sessaoAtualTimestamp,
                   forcedSize, structuralMap, modoAmplitude, impedanciaL, impedanciaR, lado }) => {
  // Modelo por campo elétrico (ver src/vtaModel.js): |E| ≥ limiar, superposição
  // das fontes de cada contato com sua corrente e polaridade.
  const [eLimiar60, setELimiar60] = React.useState(E_LIMIAR_60US);
  const [penalizarAnodo, setPenalizarAnodo] = React.useState(true);
  const [showThresh, setShowThresh] = React.useState(true);
  const [showHist, setShowHist] = React.useState(true);

  const isVMode = modoAmplitude === 'V';
  const fatorAnodo = penalizarAnodo ? FATOR_ANODO_PADRAO : 1;

  const S = forcedSize ?? 260;
  const C = S / 2;
  const MAX_MM = 5.0;
  const mmToSvg = (mm) => (mm / MAX_MM) * (C - 12);

  const anteriorRad = (CONTACT_ANTERIOR_ANGLES[anteriorContact] ?? 90) * Math.PI / 180;
  const xyTheta = -Math.PI / 2 - anteriorRad;
  const rotXY = (ux, uy) => ({
    rx: ux * Math.cos(xyTheta) - uy * Math.sin(xyTheta),
    ry: ux * Math.sin(xyTheta) + uy * Math.cos(xyTheta),
  });
  // ponto (ângulo no referencial do eletrodo, raio mm) → coordenadas SVG
  const polarToSvg = (ang, r) => {
    const { rx, ry } = rotXY(Math.cos(ang), Math.sin(ang));
    return { x: C + rx * mmToSvg(r), y: C - ry * mmToSvg(r) };
  };

  const imp = parseFloat((lado === 'L' ? impedanciaL : impedanciaR) || '0') || 0;
  const opcoes = { eLimiar60, fatorAnodo };

  // VTA do programa atual
  const vta = React.useMemo(() => {
    if (!programaContatos || !(ampAtual > 0)) return null;
    return estimarVTA({ contatos: programaContatos, amp: ampAtual, pw, modoContato, tipoEletrodo,
                        modoAmplitude, impedanciaOhm: imp }, opcoes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaContatos, ampAtual, pw, modoContato, tipoEletrodo, modoAmplitude, imp, eLimiar60, fatorAnodo]);
  const vtaR = vta?.resumo.rMax || 0;
  const anisotropica = vta && vta.resumo.aniso > 1.08;

  const vtaPath = React.useMemo(() => {
    if (!vta || !vta.axial.length) return null;
    return vta.axial.map(({ ang, r }, i) => {
      const p = polarToSvg(ang, Math.max(r, LEAD_R_MM));
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ') + ' Z';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vta, S, anteriorContact]);

  // Marcadores de limiar: cada um é posicionado na borda da VTA que o seu
  // próprio programa (config + amp + PW) teria, na direção de maior alcance.
  // Configs simétricas (anel) viram um círculo tracejado.
  const threshMarkers = React.useMemo(() => {
    const out = [];
    const cache = new Map();
    const addMarker = (m, isHist) => {
      if (!m || !m.config || !m.amp || !m.tipo) return;
      const key = `${m.config}|${m.amp}|${m.pw || pw}`;
      let res = cache.get(key);
      if (!res) {
        const c = parseConfigToContatos(m.config);
        res = estimarVTA({ contatos: c, amp: m.amp, pw: m.pw || pw || 60, modoContato: 'perc',
                           tipoEletrodo, modoAmplitude, impedanciaOhm: imp },
                         { ...opcoes, nAng: 24, passo: 0.1 }).resumo;
        cache.set(key, res);
      }
      if (!(res.rMax > 0)) return;
      const isPos = POSITIVE_EFFECTS.has(m.tipo);
      const struct = VTA_STRUCTURES[m.tipo] || VTA_STRUCTURES['Outros'];
      const simetrico = res.aniso <= 1.08;
      const p = polarToSvg(res.angMax, res.rMax);
      out.push({ ...m, r_mm: res.rMax, svgX: p.x, svgY: p.y, simetrico, isPos, struct, isHist });
    };
    if (showThresh) [...(marcadores || []), ...(marcadoresRing || [])].forEach(m => addMarker(m, false));
    if (showHist) (historicoRef || []).forEach(m => addMarker(m, true));
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcadores, marcadoresRing, historicoRef, showThresh, showHist, pw, tipoEletrodo, modoAmplitude, imp, eLimiar60, fatorAnodo, S, anteriorContact]);

  // Vista longitudinal: plano que contém o eixo do eletrodo e a direção de
  // maior alcance (ou a anterior, se simétrica). z = 0 no nível mais distal.
  const pitch = pitchDoEletrodo(tipoEletrodo);
  const nNiv = nNiveisDoEletrodo(tipoEletrodo);
  const zLo = -3, zHi = (nNiv - 1) * pitch + 3;
  const angLong = anisotropica ? vta.resumo.angMax : (CONTACT_ANTERIOR_ANGLES[anteriorContact] ?? 90) * Math.PI / 180;
  const faixasLong = React.useMemo(() => {
    if (!vta || !vta.fontes.length) return [];
    return contornoLongitudinal(vta.fontes, angLong, vta.eLimiar, { zMin: zLo, zMax: zHi, passoZ: 0.1, fatorAnodo });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vta, angLong, zLo, zHi, fatorAnodo]);
  const zExt = faixasLong.length
    ? [Math.min(...faixasLong.map(f => f[0].z)), Math.max(...faixasLong.map(f => f[f.length - 1].z))]
    : null;

  // Grid rings in mm
  const mmRings = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

  // Seta: direção de maior alcance (só quando a VTA não é simétrica)
  let stimArrow = null;
  if (anisotropica && vtaR > 0) {
    const e = polarToSvg(vta.resumo.angMax, vtaR);
    stimArrow = { ex: e.x, ey: e.y };
  }

  const [showAtlas, setShowAtlas] = React.useState(false);
  const [atlasTarget, setAtlasTarget] = React.useState('STN'); // STN | GPi | VIM

  // Structure colors consistent with Python mapper
  const STRUCT_COLORS = {
    'bradicinesia': '#10b981', 'rigidez': '#06b6d4', 'tremor': '#3b82f6',
    'Cápsula': '#f97316', 'Disartria': '#f43f5e', 'Parestesia': '#a78bfa', 'Outros': '#94a3b8',
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap px-0.5">
        {/* Mode indicator */}
        <div className={`text-[7px] font-bold px-1.5 py-0.5 rounded border ${isVMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-indigo-100 border-indigo-200 text-indigo-600'}`}
          title={isVMode ? (imp > 0 ? `Voltagem convertida em corrente: I = V / ${imp} Ω` : 'Voltagem sem impedância informada: assume 1000 Ω') : 'Corrente controlada'}>
          {isVMode ? (imp > 0 ? 'V→mA/R' : 'V (Z≈1kΩ)') : 'I-ctrl'}
        </div>
        <div className="flex items-center gap-1" title="Limiar de campo elétrico para ativação axonal a 60 µs (Åström 2015 ≈ 0,2 V/mm). Ajustado automaticamente ao PW atual.">
          <span className="text-[7px] text-slate-400 uppercase font-bold">E≥</span>
          <input type="range" min={0.1} max={0.5} step={0.01} value={eLimiar60}
            onChange={e => setELimiar60(parseFloat(e.target.value))}
            className="w-14 h-1 accent-blue-500 cursor-pointer"/>
          <span className="text-[7px] text-slate-500 w-14">{eLimiar60.toFixed(2)} V/mm</span>
        </div>
        <label className="flex items-center gap-0.5 cursor-pointer" title="Limiar 3× maior perto de ânodos (estimulação anódica é menos eficiente). Desligado = |E| puro, simétrico.">
          <input type="checkbox" checked={penalizarAnodo} onChange={e => setPenalizarAnodo(e.target.checked)} className="accent-rose-500 w-3 h-3"/>
          <span className="text-[7px] text-slate-500">Ânodo 3×</span>
        </label>
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="checkbox" checked={showThresh} onChange={e => setShowThresh(e.target.checked)} className="accent-slate-500 w-3 h-3"/>
          <span className="text-[7px] text-slate-500">Limiares</span>
        </label>
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="checkbox" checked={showHist} onChange={e => setShowHist(e.target.checked)} className="accent-slate-400 w-3 h-3"/>
          <span className="text-[7px] text-slate-400">Histórico</span>
        </label>
        {vtaR > 0 && (
          <span className="text-[7px] font-mono text-blue-600 font-bold ml-auto"
            title={`Alcance radial no plano do cátodo (z=${vta.z.toFixed(1)} mm). Limiar efetivo p/ ${pw} µs: ${vta.eLimiar.toFixed(2)} V/mm`}>
            VTA ≈ {vtaR.toFixed(1)}{anisotropica ? `/${vta.resumo.rMin.toFixed(1)}` : ''}mm
          </span>
        )}
      </div>

      {/* Main SVG */}
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}
        className="rounded-xl border border-slate-200 bg-white">
        {/* Background */}
        <rect width={S} height={S} fill="#f8fafc" rx={10}/>

        {/* mm rings */}
        {mmRings.map(mm => {
          const r = mmToSvg(mm);
          const isMajor = mm === Math.floor(mm);
          return (
            <g key={mm}>
              <circle cx={C} cy={C} r={r} fill="none"
                stroke={isMajor ? '#cbd5e1' : '#e2e8f0'}
                strokeWidth={isMajor ? 0.8 : 0.4}
                strokeDasharray={isMajor ? undefined : '2,3'}/>
              {isMajor && <text x={C + r + 2} y={C - 2}
                fontSize={7} fill="#94a3b8">{mm}mm</text>}
            </g>
          );
        })}

        {/* Crosshairs */}
        <line x1={12} y1={C} x2={S-12} y2={C} stroke="#e2e8f0" strokeWidth={0.5}/>
        <line x1={C} y1={12} x2={C} y2={S-12} stroke="#e2e8f0" strokeWidth={0.5}/>

        {/* Anterior indicator */}
        <text x={C} y={S-6} textAnchor="middle" fontSize={7} fill="#94a3b8" fontStyle="italic">
          ↓ {anteriorContact}
        </text>

        {/* VTA do programa atual — contorno |E| ≥ limiar no plano do cátodo */}
        {vtaPath && (
          <g>
            <path d={vtaPath} fill="#3b82f6" fillOpacity={0.12}
              stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4,2" strokeLinejoin="round"/>
            {stimArrow && (
              <line x1={C} y1={C} x2={stimArrow.ex} y2={stimArrow.ey}
                stroke="#3b82f6" strokeWidth={1.5} markerEnd="url(#vtaArrow)" opacity={0.7}/>
            )}
          </g>
        )}

        {/* Arrow marker def */}
        <defs>
          <marker id="vtaArrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6"/>
          </marker>
        </defs>

        {/* Electrode center */}
        <circle cx={C} cy={C} r={4} fill="#334155"/>
        <circle cx={C} cy={C} r={2} fill="#94a3b8"/>

        {/* Structural map peaks overlay */}
        {structuralMap?.structures?.map((s, si) => {
          const color = STRUCT_COLORS[s.tipo_efeito] || '#94a3b8';
          const p = s.peak_mm;
          const rawAngle = Math.atan2(p.y, p.x);
          const { rx, ry } = rotXY(Math.cos(rawAngle), Math.sin(rawAngle));
          const dist = Math.sqrt(p.x**2 + p.y**2);
          if (!isFinite(dist) || dist <= 0) return null;
          const sx = C + rx * mmToSvg(dist);
          const sy = C - ry * mmToSvg(dist);
          const opacity = Math.max(0.4, s.confidence);
          return (
            <g key={`smap-${si}`} opacity={opacity}>
              <title>{s.name} — conf {Math.round(s.confidence*100)}% — r={dist.toFixed(1)}mm</title>
              <circle cx={sx} cy={sy} r={mmToSvg(s.spread_mm || 0.5)}
                fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.5} strokeDasharray="3,2"/>
              <circle cx={sx} cy={sy} r={3} fill={color} opacity={0.9}/>
              <text x={sx+5} y={sy-3} fontSize={6} fill={color} fontWeight="bold">{s.name.split(' ')[0]}</text>
            </g>
          );
        })}

        {/* Threshold / structure markers */}
        {threshMarkers.map((m, mi) => {
          const opacity = m.isHist
            ? Math.max(0.3, opacidadeMarcador(m.sessionTimestamp || m.timestamp || 0, sessaoAtualTimestamp || Date.now()))
            : 0.9;
          const r = m.isHist ? 4 : 6;
          if (m.simetrico) {
            // Config anelar: o limiar vale para todas as direções → círculo
            return (
              <g key={`vta-mk-${mi}`} opacity={opacity * 0.8}>
                <title>{m.tipo} — {m.r_mm.toFixed(1)}mm (anel) — {m.amp}mA/{m.pw||'?'}µs</title>
                <circle cx={C} cy={C} r={mmToSvg(m.r_mm)} fill="none"
                  stroke={m.struct.color} strokeWidth={m.isHist ? 0.6 : 1} strokeDasharray="1,2"/>
                {!m.isHist && (
                  <text x={C} y={C - mmToSvg(m.r_mm) - 1.5} textAnchor="middle"
                    fontSize={5.5} fontWeight="bold" fill={m.struct.color}>{m.struct.label}</text>
                )}
              </g>
            );
          }
          return (
            <g key={`vta-mk-${mi}`} opacity={opacity}>
              <title>{m.tipo} — {m.r_mm.toFixed(1)}mm — {m.amp}mA/{m.pw||'?'}µs</title>
              <circle cx={m.svgX} cy={m.svgY} r={r}
                fill={m.struct.color} fillOpacity={m.isPos ? 0.3 : 0.15}
                stroke={m.struct.color} strokeWidth={m.isHist ? 1 : 1.5}
                strokeDasharray={m.isHist ? '2,2' : undefined}/>
              {!m.isHist && (
                <text x={m.svgX} y={m.svgY + 0.5} textAnchor="middle" dominantBaseline="middle"
                  fontSize={5.5} fontWeight="bold" fill={m.struct.color}>{m.struct.label}</text>
              )}
              {/* Radial distance line from center */}
              <line x1={C} y1={C} x2={m.svgX} y2={m.svgY}
                stroke={m.struct.color} strokeWidth={0.5} opacity={0.3}
                strokeDasharray="1,3"/>
            </g>
          );
        })}
      </svg>

      {/* Vista longitudinal */}
      {vta && faixasLong.length > 0 && (() => {
        const sc = (C - 12) / MAX_MM;                 // px por mm (mesma escala)
        const W = S, H = Math.round((zHi - zLo) * sc + 16);
        const X0 = W / 2;
        const zToY = (z) => 8 + (zHi - z) * sc;       // distal embaixo
        const el = getEletrodoDisplay(tipoEletrodo);
        const pathFaixa = (f) => {
          const dir = f.map(p => `${(X0 + p.rPos * sc).toFixed(1)},${zToY(p.z).toFixed(1)}`);
          const esq = [...f].reverse().map(p => `${(X0 - p.rNeg * sc).toFixed(1)},${zToY(p.z).toFixed(1)}`);
          return `M${dir.join(' L')} L${esq.join(' L')} Z`;
        };
        return (
          <div className="flex flex-col gap-0.5">
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
              Corte longitudinal · {anisotropica ? 'plano da direção de estímulo' : `plano anterior (${anteriorContact})`}
              {zExt && <span className="normal-case font-mono text-blue-600"> · extensão axial ≈ {(zExt[1] - zExt[0]).toFixed(1)} mm</span>}
            </p>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="rounded-xl border border-slate-200 bg-white">
              <rect width={W} height={H} fill="#f8fafc" rx={10}/>
              {[1, 2, 3, 4].map(mm => (
                <g key={mm}>
                  <line x1={X0 + mm * sc} y1={6} x2={X0 + mm * sc} y2={H - 6} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="2,3"/>
                  <line x1={X0 - mm * sc} y1={6} x2={X0 - mm * sc} y2={H - 6} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="2,3"/>
                  <text x={X0 + mm * sc + 1} y={H - 4} fontSize={6} fill="#94a3b8">{mm}</text>
                </g>
              ))}
              {faixasLong.map((f, i) => (
                <path key={i} d={pathFaixa(f)} fill="#3b82f6" fillOpacity={0.12} stroke="#3b82f6" strokeWidth={1.2} strokeDasharray="4,2" strokeLinejoin="round"/>
              ))}
              {/* corpo do eletrodo */}
              <rect x={X0 - LEAD_R_MM * sc} y={zToY(zHi)} width={2 * LEAD_R_MM * sc} height={(zHi - zLo + 0.5) * sc}
                fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.5}/>
              {el.niveis.map(n => {
                const zc = n.idx * pitch;
                const y = zToY(zc + CONTACT_H_MM / 2), h = CONTACT_H_MM * sc;
                // estado mais "forte" do nível (cátodo > ânodo > off)
                const estados = n.contatos.map(k => programaContatos?.[k]?.state || 'off');
                const st = estados.includes('-') ? '-' : estados.includes('+') ? '+' : 'off';
                const fill = st === '-' ? '#06b6d4' : st === '+' ? '#f43f5e' : '#e2e8f0';
                return (
                  <g key={n.idx}>
                    <rect x={X0 - LEAD_R_MM * sc} y={y} width={2 * LEAD_R_MM * sc} height={h}
                      fill={fill} stroke="#64748b" strokeWidth={0.5} rx={1}/>
                    <text x={X0 - LEAD_R_MM * sc - 3} y={y + h / 2 + 2} textAnchor="end" fontSize={6} fill="#64748b">
                      {n.tipo === 'dir' ? `${n.idx}ABC` : n.idx}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })()}

      {/* Structural map overlay from Python mapper */}
      {structuralMap && structuralMap.structures && structuralMap.structures.length > 0 ? (
        <div className="mt-1 px-0.5">
          <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Mapa estrutural · {new Date(structuralMap.updated_at).toLocaleDateString('pt-BR')} · n={structuralMap.n_markers}
          </p>
          {structuralMap.structures.map((s, si) => {
            const color = STRUCT_COLORS[s.tipo_efeito] || '#94a3b8';
            const p = s.peak_mm;
            const svgR = mmToSvg(Math.sqrt(p.x**2 + p.y**2));
            // Project to XY plane using rotation
            const rawAngle = Math.atan2(p.y, p.x);
            const rotated = { rx: Math.cos(rawAngle + xyTheta - Math.PI/2),
                               ry: Math.sin(rawAngle + xyTheta - Math.PI/2) };
            if (!isFinite(svgR)) return null;
            return (
              <div key={si} className="flex items-center gap-1.5 mb-0.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{background:color}}/>
                <span className="text-[8px] font-bold" style={{color}}>
                  {s.is_positive ? '✓' : '✗'} {s.name}
                </span>
                <span className="text-[7px] text-slate-400 font-mono">
                  r={Math.sqrt(p.x**2+p.y**2).toFixed(1)}mm conf={Math.round(s.confidence*100)}%
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-1 px-0.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-[8px] text-amber-700 font-bold">⚠ Sem mapa estrutural calculado</p>
          <p className="text-[7px] text-amber-600 mt-0.5">
            Execute o script Python <code className="bg-amber-100 px-0.5 rounded">run_patient.py</code> para gerar o mapeamento probabilístico.
          </p>
        </div>
      )}

      {/* Atlas toggle */}
      <div className="flex items-center gap-1.5 mt-1 px-0.5">
        <button onClick={() => setShowAtlas(v => !v)}
          className={`text-[8px] font-bold px-2 py-0.5 rounded border transition-all ${showAtlas ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-400'}`}>
          🧠 Atlas
        </button>
        {showAtlas && ['STN','GPi','VIM'].map(t => (
          <button key={t} onClick={() => setAtlasTarget(t)}
            className={`text-[7px] font-bold px-1.5 py-0.5 rounded border transition-all ${atlasTarget===t ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-300'}`}>{t}</button>
        ))}
      </div>

      {/* Atlas panels — 3 planes */}
      {showAtlas && <AtlasPanel target={atlasTarget} S={S} C={C} mmToSvg={mmToSvg} anteriorContact={anteriorContact} />}

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 px-0.5">
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-3 rounded-full bg-blue-500 opacity-50 border border-blue-500"/>
          <span className="text-[7px] text-slate-500">VTA atual</span>
        </div>
        {Object.entries(VTA_STRUCTURES).slice(0,4).map(([k,v]) => (
          <div key={k} className="flex items-center gap-0.5">
            <div className="w-2 h-2 rounded-full" style={{background: v.color}}/>
            <span className="text-[7px] text-slate-400">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ControleParametro = ({ label, valor, unidade, step, min, max, onChange, travado, modoContato, pwAtual, isAmplitude, historicoRef, marcadores, marcadoresRing, marcadoresTodosL, historicoTodos, structuralMap, sessaoAtualTimestamp, tipoEletrodo, programaContatos, modoAmplitude, impedanciaL, impedanciaR, lado }) => {
  const [agruparPorFreq, setAgruparPorFreq] = React.useState(false);
  const [anteriorContact, setAnteriorContact] = React.useState('A');
  const [fullscreenDisplay, setFullscreenDisplay] = React.useState(null); // {tipo, grpKey}
  // modoVis: 'auto' | '3d' | 'timeline'
  // 'auto'     → normal behavior based on stimType
  // '3d'       → force TripleView3D with ALL markers (no contact filter)
  // 'timeline' → force TimelineHistorico with exact-config filter
  const [modoVis, setModoVis] = React.useState('auto');

  return (
  <div className="flex flex-col mb-3">
    {isAmplitude && (() => {
      const stimType = (tipoEletrodo === 'directional' && programaContatos)
        ? classifyStim(programaContatos, tipoEletrodo)
        : 'ring';

      // Botões de controle do display
      const toggleBar = (
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <button onClick={() => setAgruparPorFreq(v => !v)}
            className={`text-[8px] font-bold px-1.5 py-0.5 rounded border transition-all ${agruparPorFreq ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
            title="Alternar agrupamento: Largura de Pulso ↔ Frequência">
            {agruparPorFreq ? 'Ag: Freq' : 'Ag: PW'}
          </button>

          {/* Visualization mode selector */}
          <div className="flex items-center gap-0.5 border border-slate-200 rounded overflow-hidden">
            {[
              ['auto',     'Auto',   'Modo automático (baseado no tipo de estimulação)'],
              ['3d',       '⬡ 3D',   'Visão 3D com todos os marcadores de qualquer contato'],
              ['timeline', '📈 TL',  'Timeline com filtro de contatos exatos'],
              ['vta',      '🔵 VTA', 'Campo elétrico estimado em mm (modelo analítico)'],
            ].map(([mode, label, title]) => (
              <button key={mode} onClick={() => setModoVis(mode)} title={title}
                className={`text-[7px] font-bold px-1.5 py-0.5 transition-all ${
                  modoVis === mode
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}>
                {label}
              </button>
            ))}
          </div>
          {tipoEletrodo === 'directional' && (
            <div className="flex items-center gap-1">
              <span className="text-[7px] text-slate-400 uppercase font-bold">Ant.:</span>
              <select value={anteriorContact} onChange={e => setAnteriorContact(e.target.value)}
                className="text-[8px] font-bold bg-slate-100 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer">
                {['A','AB','B','BC','C','CA'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      );

      // Effective markers and historicoRef based on modoVis
      const marcadoresDisplay = modoVis === '3d'
        ? (marcadoresTodosL || marcadores)  // ALL markers for 3D view
        : marcadores;
      const historicoDisplay = modoVis === '3d'
        ? (historicoTodos || historicoRef)  // ALL sessions for 3D
        : modoVis === 'timeline'
          ? (historicoRef)                  // filtered by exact config (passed from App)
          : historicoRef;
      const marcadoresRingDisplay = modoVis === '3d'
        ? (marcadoresTodosL || marcadoresRing)  // ALL for 3D
        : marcadoresRing;

      // Which component to render
      const efectiveMode = modoVis === 'auto' ? stimType
        : modoVis === '3d'       ? 'multi-dir'
        : modoVis === 'vta'      ? 'vta'
        : /* timeline */           'timeline';

      // Infer current PW from historicoRef or fall back to 60µs
      // PW do PROGRAMA ATUAL (antes vinha do histórico → VTA com PW errado)
      const currentPw = pwAtual || (historicoRef && historicoRef[0]?.pw) || 60;

      if (efectiveMode === 'vta') {
        const allThreshMarkers = [...(marcadoresTodosL || marcadores), ...(marcadoresRing || [])];
        return <>{toggleBar}<VTAView
          programaContatos={programaContatos}
          modoContato={modoContato}
          ampAtual={valor}
          pw={currentPw}
          marcadores={allThreshMarkers}
          marcadoresRing={[]}
          historicoRef={historicoTodos || historicoRef}
          anteriorContact={anteriorContact}
          tipoEletrodo={tipoEletrodo}
          sessaoAtualTimestamp={sessaoAtualTimestamp}
          structuralMap={structuralMap}
          modoAmplitude={modoAmplitude}
          impedanciaL={impedanciaL}
          impedanciaR={impedanciaR}
          lado={lado}
        /></>;
      }

      if (efectiveMode === 'single-dir') {
        return <>{toggleBar}<DirectionalHistorico marcadores={marcadoresDisplay} historicoRef={historicoDisplay} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq} anteriorContact={anteriorContact} onOpenFullscreen={(grpKey) => setFullscreenDisplay({tipo:'single', grpKey})}/></>;
      } else if (efectiveMode === 'multi-dir') {
        return <>{toggleBar}<TripleView3D marcadores={marcadoresDisplay} marcadoresRing={marcadoresRingDisplay} historicoRef={historicoDisplay} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq} anteriorContact={anteriorContact} tipoEletrodo={tipoEletrodo} pwAtual={pwAtual} modoContato={modoContato} modoAmplitude={modoAmplitude} impedancia={parseFloat((lado === 'L' ? impedanciaL : impedanciaR) || '0') || 0} onOpenFullscreen={() => setFullscreenDisplay({tipo:'multi'})}/></>;
      } else {
        return <>{toggleBar}<TimelineHistorico historicoRef={historicoRef} maxAmp={max} marcadores={marcadores} sessaoAtualTimestamp={sessaoAtualTimestamp} agruparPorFreq={agruparPorFreq}/></>;
      }
    })()}
    {/* Fullscreen modal for polar display */}
    {fullscreenDisplay && (
      <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setFullscreenDisplay(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-auto p-6 flex flex-col gap-4"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">Visualização ampliada — {label}</h3>
            <button onClick={() => setFullscreenDisplay(null)} className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none">×</button>
          </div>
          {fullscreenDisplay.tipo === 'vta'
            ? <VTAView programaContatos={programaContatos} modoContato={modoContato} ampAtual={valor} pw={pwAtual || (historicoRef && historicoRef[0]?.pw) || 60}
                marcadores={marcadoresTodosL||marcadores} marcadoresRing={[]}
                historicoRef={historicoTodos||historicoRef} anteriorContact={anteriorContact}
                tipoEletrodo={tipoEletrodo} sessaoAtualTimestamp={sessaoAtualTimestamp}
                structuralMap={structuralMap} modoAmplitude={modoAmplitude}
                impedanciaL={impedanciaL} impedanciaR={impedanciaR} lado={lado}
                forcedSize={520}/>
            : fullscreenDisplay.tipo === 'single'
            ? <DirectionalHistorico marcadores={marcadores} historicoRef={historicoRef} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq} anteriorContact={anteriorContact} forcedSize={520}/>
            : <TripleView3D marcadores={marcadores} marcadoresRing={marcadoresRing} historicoRef={historicoRef} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq} anteriorContact={anteriorContact} tipoEletrodo={tipoEletrodo} pwAtual={pwAtual} modoContato={modoContato} modoAmplitude={modoAmplitude} impedancia={parseFloat((lado === 'L' ? impedanciaL : impedanciaR) || '0') || 0} forcedSize={460}/>
          }
        </div>
      </div>
    )}
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 mt-1">{label}</label>
    {travado ? (
      <div className="flex items-center gap-1.5" title="Modo mA por contato: amplitude total = soma das correntes dos contatos">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-lg relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-indigo-300" style={{ width: `${Math.min(100, (valor / (max || 1)) * 100)}%` }} />
        </div>
        <span className="text-[9px] font-bold text-indigo-500 uppercase">Σ contatos</span>
        <span className="w-12 text-right font-bold text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1">{Number(valor || 0).toFixed(1)}</span>
        <span className="text-[10px] font-bold text-slate-500">{unidade}</span>
      </div>
    ) : (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onChange(Math.max(min, Number((valor - step).toFixed(2))))} className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold text-sm flex-shrink-0 flex items-center justify-center">-</button>
      <input type="range" min={min} max={max} step={step} value={valor} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
      <button onClick={() => onChange(Math.min(max, Number((valor + step).toFixed(2))))} className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold text-sm flex-shrink-0 flex items-center justify-center">+</button>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <input
          type="number" value={valor} step={step}
          onChange={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) onChange(val); }}
          className="w-12 text-right font-bold text-sm text-indigo-700 bg-slate-100 border border-slate-200 rounded focus:outline-none px-1"
        />
        <span className="text-[10px] font-bold text-slate-500">{unidade}</span>
      </div>
    </div>
    )}
  </div>
  );
};


export { PolarDisplay2D, DirectionalHistorico, TripleView3D, TimelineHistorico, ControleParametro };
