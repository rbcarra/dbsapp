import React, { useMemo } from 'react';
import { MARCADOR_LETRAS, opacidadeMarcador, formatarData } from './constants';
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
            const cor = h.efeito === 'bom' ? '#10b981' : h.efeito === 'ruim' ? '#f43f5e' : h.efeito === 'pouco' ? '#94a3b8' : '#67e8f9';
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

const TripleView3D = ({ marcadores, historicoRef, maxAmp: maxAmpProp, sessaoAtualTimestamp, programaContatos, ampAtual, agruparPorFreq, marcadoresRing, anteriorContact = 'A', onOpenFullscreen, forcedSize }) => {
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
  const calcZCenter = (contatos) => {
    if (!contatos) return 1.5;
    let zSum = 0, wSum = 0;
    Object.entries(contatos).forEach(([k, v]) => {
      if (v.state === 'off') return;
      const perc = (v.perc ?? 100) / 100;
      const z = parseInt(k[0]);
      if (isNaN(z)) return; // skip non-numeric keys
      zSum += perc * z;
      wSum += perc;
    });
    const result = wSum > 0 ? zSum / wSum : 1.5;
    return isFinite(result) ? result : 1.5;
  };

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
      try { cache.set(m.config, classifyStim(parseConfigToContatos(m.config), 'directional')); }
      catch(e) { cache.set(m.config, 'ring'); }
    }
    return cache.get(m.config);
  }, []);
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

  // Fix 2: compute effective maxAmp from all visible data
  // Avoid Math.max(...hugeArray) stack overflow — use reduce instead
  let maxAmp = Math.max(maxAmpProp || 0, ampAtual || 0, 1);
  for (const m of marcadores) if ((m.amp || 0) > maxAmp) maxAmp = m.amp;
  for (const m of allRing) if ((m.amp || 0) > maxAmp) maxAmp = m.amp;
  for (const h of (historicoRef || [])) if ((h.amp || 0) > maxAmp) maxAmp = h.amp;

  const toR = (amp) => (Math.min(Math.max(amp, 0), maxAmp) / maxAmp) * R;
  const rings = [];
  for (let v = 1; v <= Math.ceil(maxAmp); v++) rings.push(v);

  const zOriginVal = programaContatos ? calcZCenter(programaContatos) : 1.5;
  // Fix 2: zToSvg uses R which is now scaled to actual maxAmp — electrode stays proportional
  const zScale = R * 0.45; // each z-unit = 45% of R
  const zToSvg = (zVal) => C - (zVal - zOriginVal) * zScale;
  const zOriginSvg = zToSvg(zOriginVal);

  const allKeys = [...new Set([
    ...Object.keys(byGroup),
    ...marcadoresRingExtras.map(m => String(agruparPorFreq ? (m.freq || 130) : (m.pw || 60))),
    ...Object.keys(histByGroup3D)
  ])].sort((a, b) => +a - +b)
    .slice(0, 8); // cap at 8 groups to prevent render explosion
  allKeys.forEach(k => { if (!byGroup[k]) byGroup[k] = { multiDir: [], singleDir: [] }; });

  const curVec = programaContatos ? dirVector3D(programaContatos, ampAtual || 0) : null;
  const labelPrefix = agruparPorFreq ? 'Hz' : 'µs';

  // Bug 1: electrode centered at origin (C, zOriginSvg)
  const ElectrodeSchematic = ({ highlightLevels }) => {
    const elecX = C; // centered horizontally
    return (
      <g>
        <line x1={elecX} y1={zToSvg(3) - 4} x2={elecX} y2={zToSvg(0) + 4}
          stroke="#334155" strokeWidth={3}/>
        {[3, 2, 1, 0].map(lv => {
          const y = zToSvg(lv);
          const hl = highlightLevels?.includes(String(lv));
          return (
            <g key={lv}>
              <rect x={elecX - 5} y={y - 4} width={10} height={8} rx={2}
                fill={hl ? '#2563eb' : (lv === 1 || lv === 2 ? '#475569' : '#94a3b8')}
                stroke={hl ? '#93c5fd' : '#cbd5e1'} strokeWidth={0.5}/>
              <text x={elecX + 8} y={y + 1} textAnchor="start"
                fontSize={Math.max(5, S * 0.04)} fill={hl ? '#2563eb' : '#94a3b8'}>{lv}</text>
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

  // Rotation from contact-anterior selection
  const anteriorRad = anteriorAngle * Math.PI / 180;
  // θ for XY: rotate so anterior points to SVG bottom (= math -Y direction)
  const xyTheta = -Math.PI / 2 - anteriorRad;
  const rotXY = (ux, uy) => ({
    rx: ux * Math.cos(xyTheta) - uy * Math.sin(xyTheta),
    ry: ux * Math.sin(xyTheta) + uy * Math.cos(xyTheta),
  });

  // XZ frente: looking from anterior direction → horizontal = lateral to AP
  // px = component perpendicular to anterior (lateral), py = Z
  const getXZ = (v) => ({
    px: -v.ux * Math.sin(anteriorRad) + v.uy * Math.cos(anteriorRad),
    py: v.uz,
  });
  // YZ lado: anterior=right, posterior=left → px = AP component, py = Z
  const getYZ = (v) => ({
    px: v.ux * Math.cos(anteriorRad) + v.uy * Math.sin(anteriorRad),
    py: v.uz,
  });

  // Per-contact label positions using rotation
  const xzDirLabels = Object.entries(DIR_ANGLES).map(([lt, deg]) => {
    const r = deg * Math.PI / 180;
    // lateral component of this contact direction relative to AP axis
    const lx = -Math.cos(r) * Math.sin(anteriorRad) + Math.sin(r) * Math.cos(anteriorRad);
    return { letter: lt, lx, ly: 0 };
  });
  const yzDirLabels = Object.entries(DIR_ANGLES).map(([lt, deg]) => {
    const r = deg * Math.PI / 180;
    // AP component of this contact
    const lx = Math.cos(r) * Math.cos(anteriorRad) + Math.sin(r) * Math.sin(anteriorRad);
    return { letter: lt, lx, ly: 0 };
  });

  const anteriorLabel = anteriorContact;
  const posteriorLabel = { 'A':'B/C','AB':'BC','B':'C/A','BC':'CA','C':'A/B','CA':'AB' }[anteriorContact] || 'Post';

  const projections = [
    { label: 'XY · axial', showSchematic: false,
      getXY: v => { const {rx,ry} = rotXY(v.ux, v.uy); return { px: rx, py: ry }; },
      dirLabels: Object.entries(DIR_ANGLES).map(([lt, deg]) => {
        const r = deg * Math.PI / 180;
        const {rx,ry} = rotXY(Math.cos(r), Math.sin(r));
        return { letter: lt, lx: rx, ly: ry };
      }),
      bottomLabel: anteriorLabel,
    },
    { label: `XZ · frente (→${anteriorLabel})`, showSchematic: true, getXY: getXZ,
      dirLabels: xzDirLabels,
      extraLabels: [{ letter: anteriorLabel, lx: 0.95, ly: 0, color: '#64748b', size: 0.04 },
                    { letter: posteriorLabel, lx: -0.85, ly: 0, color: '#94a3b8', size: 0.035 }],
    },
    { label: `YZ · lado (Post←→${anteriorLabel})`, showSchematic: true, getXY: getYZ,
      dirLabels: yzDirLabels,
    },
  ];

  // Helper: for each marker/item, compute its own Z-origin in SVG coords for XZ/YZ views
  // This allows each point to emanate from its actual charge-center height on the electrode
  const itemOriginY = (config, isZView) => {
    if (!isZView) return C;
    const contatos = parseConfigToContatos(config);
    const zc = calcZCenter(contatos);
    const y = zToSvg(isFinite(zc) ? zc : 1.5);
    return isFinite(y) ? y : C;
  };

  const renderOneSVG = (grpKey, { multiDir, singleDir }, histItems, showSchematic, getXY, dirLabels) => {
    const allLevels = [...new Set([...multiDir, ...singleDir].flatMap(m =>
      Object.keys(parseConfigToContatos(m.config)).map(k => k[0])))];
    const ringMks = marcadoresRingExtras.filter(m =>
      String(agruparPorFreq ? (m.freq || 130) : (m.pw || 60)) === grpKey);

    // Global origin = current program's charge center (for electrode, rings, stim line)
    const originX = C;
    const originY = showSchematic ? zOriginSvg : C;

    return (
      <svg key={`${grpKey}-${showSchematic}`} width={S} height={S} viewBox={tvVB}
        onPointerDown={tvZoom > 1 ? onTvPointerDown : undefined}
        onPointerMove={tvZoom > 1 ? onTvPointerMove : undefined}
        onPointerUp={tvZoom > 1 ? onTvPointerUp : undefined}
        style={{ cursor: tvZoom > 1 ? 'grab' : 'default' }}>
        <rect width={S} height={S} fill="#ffffff" rx="6"/>
        {/* Grid rings centered on current program origin */}
        {rings.map(v => (
          <circle key={v} cx={C} cy={originY} r={toR(v)} fill="none"
            stroke={v === Math.ceil(maxAmp) ? '#475569' : '#e2e8f0'}
            strokeWidth={(v === Math.ceil(maxAmp) ? 1.5 : 0.5) / tvEz}
            strokeDasharray={v < maxAmp ? '2,2' : undefined}/>
        ))}
        <line x1={margin} y1={originY} x2={S - margin} y2={originY} stroke="#e2e8f0" strokeWidth={0.5/tvEz}/>
        <line x1={C} y1={margin} x2={C} y2={S - margin} stroke="#e2e8f0" strokeWidth={0.5/tvEz}/>
        {dirLabels.map(({ letter, lx, ly }) => {
          const labelR = toR(Math.ceil(maxAmp)) + S * 0.07;
          return <text key={letter} x={C + lx * labelR} y={originY - ly * labelR}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(7, S * 0.055)} fontWeight="bold" fill="#1e293b">{letter}</text>;
        })}
        {showSchematic && <ElectrodeSchematic highlightLevels={allLevels}/>}
        {/* Current stim line from its own origin */}
        {curVec && isFinite(curVec.ux) && (() => {
          const { px: cux, py: cuy } = getXY(curVec);
          const cr = toR(curVec.amp || 0);
          if (!isFinite(cux) || cr <= 0) return null;
          return <line x1={originX} y1={originY}
            x2={originX + cux * cr} y2={originY - cuy * cr}
            stroke="#6366f1" strokeWidth={2/tvEz} strokeDasharray="4,3" opacity={0.5}/>;
        })()}
        <circle cx={originX} cy={originY} r={Math.max(2, S * 0.015) / tvEz} fill="#334155"/>
        {/* Ring markers: concentric rings — centered on marker's own Z-origin */}
        {ringMks.filter(m => filterMarcador(m, false)).map((m, mi) => {
          const mOY = itemOriginY(m.config, showSchematic);
          const isPos = ['tremor', 'rigidez', 'bradicinesia'].includes(m.tipo);
          const info = MARCADOR_LETRAS[m.tipo] || { letra: '?' };
          const fill = isPos ? '#059669' : '#e11d48';
          const opacity = Math.max(0.4, opacidadeMarcador(m.sessionTimestamp || m.timestamp || 0, sessaoAtualTimestamp || Date.now()));
          const rRing = toR(m.amp || 0);
          return (
            <g key={`ring-${mi}`} opacity={opacity}>
              <title>{`[ring] ${m.tipo} | ${m.amp}mA`}</title>
              <circle cx={originX} cy={mOY} r={rRing} fill="none" stroke={fill} strokeWidth={1.5/tvEz} strokeDasharray="2,2" opacity={0.5}/>
              <text x={originX + rRing * 0.707 + 2} y={mOY - rRing * 0.707 - 2}
                textAnchor="middle" fontSize={Math.max(5, S * 0.04)} fill={fill} fontWeight="bold">{info.letra}</text>
            </g>
          );
        })}
        {/* Single-dir extras — each from its own Z-origin */}
        {singleDir.filter(m => filterMarcador(m, false)).map((m, mi) => {
          const c = parseConfigToContatos(m.config);
          const vec = dirVector3D(c, m.amp || 0);
          if (!vec || !isFinite(vec.ux) || !isFinite(vec.uz)) return null;
          const { px: ux, py: uy } = getXY(vec);
          const r = toR(vec.amp || 0);
          const mOY = itemOriginY(m.config, showSchematic);
          const svgX = originX + ux * r, svgY = mOY - uy * r;
          if (!isFinite(svgX) || !isFinite(svgY)) return null;
          const isPos = ['tremor', 'rigidez', 'bradicinesia'].includes(m.tipo);
          const info = MARCADOR_LETRAS[m.tipo] || { letra: '?' };
          const fill = isPos ? '#059669' : '#e11d48';
          const opacity = Math.max(0.4, opacidadeMarcador(m.sessionTimestamp || m.timestamp || 0, sessaoAtualTimestamp || Date.now()));
          return (
            <g key={`sd-${mi}`} opacity={opacity * 0.7}>
              <title>{`[single] ${m.tipo} | ${m.amp}mA`}</title>
              <circle cx={svgX} cy={svgY} r={Math.max(3, S * 0.025)/tvEz} fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth={1/tvEz} strokeDasharray="1,1"/>
              <text x={svgX} y={svgY} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(5, S * 0.038)} fill="#fff" fontWeight="bold" stroke={fill} strokeWidth={0.3}>{info.letra}</text>
            </g>
          );
        })}
        {/* Multi-dir markers — each from its own Z-origin */}
        {multiDir.filter(m => filterMarcador(m, true)).map((m, mi) => {
          const c = parseConfigToContatos(m.config);
          const vec = dirVector3D(c, m.amp || 0);
          if (!vec || !isFinite(vec.ux) || !isFinite(vec.uz)) return null;
          const { px: ux, py: uy } = getXY(vec);
          const r = toR(vec.amp || 0);
          const mOY = itemOriginY(m.config, showSchematic);
          const svgX = originX + ux * r, svgY = mOY - uy * r;
          if (!isFinite(svgX) || !isFinite(svgY)) return null;
          const isPos = ['tremor', 'rigidez', 'bradicinesia'].includes(m.tipo);
          const info = MARCADOR_LETRAS[m.tipo] || { letra: '?' };
          const fill = isPos ? '#059669' : '#e11d48';
          const markerR = Math.max(3.5, S * 0.031);
          const opacity = Math.max(0.4, opacidadeMarcador(m.sessionTimestamp || m.timestamp || 0, sessaoAtualTimestamp || Date.now()));
          return (
            <g key={`md-${mi}`} opacity={opacity}>
              <title>{`${m.tipo} | ${m.amp}mA | ${m.freq}Hz`}</title>
              <circle cx={svgX} cy={svgY} r={markerR/tvEz} fill={fill} fillOpacity={0.3} stroke={fill} strokeWidth={1.5/tvEz}/>
              <text x={svgX} y={svgY} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(6, S * 0.045)} fill="#fff" fontWeight="bold" stroke={fill} strokeWidth={0.3}>{info.letra}</text>
            </g>
          );
        })}
        {/* Indicadores de programação prévia — ring shown as rings, dir as dots */}
        {mostrarPrevios && histItems.map((h, hi) => {
          if (!h || !h.config) return null;
          const hContatos = parseConfigToContatos(h.config);
          const hType = getStimType(h);
          const isRing = hType === 'ring' || !getDirLevel(h.config);
          if (isRing && !mostrarRing) return null;
          if (!isRing && !mostrarSingleDir) return null;
          const hVec = Object.keys(hContatos).length > 0 ? dirVector3D(hContatos, h.amp || 0) : null;
          if (!hVec || !isFinite(hVec.ux) || !isFinite(hVec.uz)) return null;
          const cor = h.efeito === 'bom' ? '#10b981'
            : h.efeito === 'ruim' ? '#f43f5e'
            : h.efeito === 'pouco' ? '#94a3b8' : '#67e8f9';
          const opacity = Math.max(0.35, opacidadeMarcador(h.date || 0, sessaoAtualTimestamp || Date.now()));
          const hr = toR(hVec.amp || 0);
          const hOY = itemOriginY(h.config, showSchematic);
          if (!isFinite(hOY)) return null;
          if (isRing) {
            return (
              <g key={`previo-${hi}`} opacity={opacity}>
                <title>{`[prev-ring] ${h.config} | ${h.amp}mA | ${h.efeito}`}</title>
                <circle cx={originX} cy={hOY} r={hr} fill="none" stroke={cor} strokeWidth={1.5/tvEz} strokeDasharray="3,2" opacity={0.6}/>
              </g>
            );
          }
          const { px: hux, py: huy } = getXY(hVec);
          const hx = originX + hux * hr, hy = hOY - huy * hr;
          if (!isFinite(hx) || !isFinite(hy)) return null;
          return (
            <g key={`previo-${hi}`} opacity={opacity}>
              <title>{`[prev-dir] ${h.config} | ${h.amp}mA | ${h.efeito}`}</title>
              <circle cx={hx} cy={hy} r={Math.max(3.5, S * 0.028)/tvEz}
                fill={cor} fillOpacity={0.3} stroke={cor} strokeWidth={1.5/tvEz}/>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-1 mb-2">
      <div className="flex items-center justify-between px-1 flex-wrap gap-1">
        <p className="text-[8px] text-slate-500 uppercase tracking-widest">Multi-nível</p>
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
            {projections.map(({ label, showSchematic, getXY, dirLabels }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className="text-[7px] text-slate-500">{label}</span>
                {renderOneSVG(grpKey, byGroup[grpKey], histByGroup3D[grpKey] || [], showSchematic, getXY, dirLabels)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};


const TimelineHistorico = ({ historicoRef, maxAmp, marcadores, sessaoAtualTimestamp, agruparPorFreq }) => {
  const [timelineW, setTimelineW] = React.useState(null);
  const dragRef = React.useRef(null);

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
    if (!historicoRef) return grupos;
    historicoRef.forEach(h => {
      const key = String(agruparPorFreq ? h.freq : h.pw);
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(h);
    });
    return Object.keys(grupos).sort((a,b) => Number(a) - Number(b)).reduce((obj, key) => {
      obj[key] = grupos[key]; return obj;
    }, {});
  }, [historicoRef, agruparPorFreq]);

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
      {/* Container com scroll horizontal */}
      <div className="overflow-x-auto custom-scrollbar rounded-t border border-slate-200 bg-slate-50 mb-1">
        <div ref={dragRef} className="flex flex-col p-1 space-y-1" style={{ width: `${innerW}px`, minWidth: '100%' }}>
      {/* Eixo X de amplitude */}
      <div className="relative h-4 mx-0 pl-8 pr-1">
        {ampTicks.map((tick) => {
          const leftPercent = Math.min(100, (tick / effectiveMax) * 100);
          return (
            <div key={tick} className="absolute flex flex-col items-center" style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}>
              <div className="w-px h-2 bg-slate-300"></div>
              {tick % 1 === 0 && <span className="text-[8px] text-slate-400 font-bold">{tick}</span>}
            </div>
          );
        })}
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
                    const cor = h.efeito === 'bom' ? 'bg-emerald-400' : h.efeito === 'ruim' ? 'bg-rose-500' : h.efeito === 'pouco' ? 'bg-slate-400' : 'bg-cyan-300';
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
// Uses analytical model: r ≈ k × √(I × PW) (Butson & McIntyre 2006, empirical)
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

const VTAView = ({ programaContatos, ampAtual, pw, marcadores, marcadoresRing,
                   historicoRef, anteriorContact, tipoEletrodo, sessaoAtualTimestamp,
                   forcedSize, structuralMap }) => {
  const [kFactor, setKFactor] = React.useState(0.45); // mm / sqrt(mA·µs)
  const [showThresh, setShowThresh] = React.useState(true);
  const [showHist, setShowHist] = React.useState(true);

  const S = forcedSize ?? 260;
  const C = S / 2;
  const MAX_MM = 5.0;  // display radius in mm
  const mmToSvg = (mm) => (mm / MAX_MM) * (C - 12);

  const anteriorRad = (CONTACT_ANTERIOR_ANGLES[anteriorContact] ?? 90) * Math.PI / 180;
  const xyTheta = -Math.PI / 2 - anteriorRad;
  const rotXY = (ux, uy) => ({
    rx: ux * Math.cos(xyTheta) - uy * Math.sin(xyTheta),
    ry: ux * Math.sin(xyTheta) + uy * Math.cos(xyTheta),
  });

  // Current VTA: elipsoid major axis along stim vector
  const curVec = programaContatos ? dirUnitVector2D(programaContatos) : null;
  const ampEf  = programaContatos && ampAtual ? calcAmpEfetiva(programaContatos, ampAtual) : 0;
  const vtaR   = ampEf > 0 && pw > 0 ? kFactor * Math.sqrt(ampEf * pw) : 0;
  // Ellipse: major = vtaR along stim dir, minor = vtaR * 0.65 perpendicular
  const vtaMinor = vtaR * 0.65;

  // Collect threshold markers: from marcadores + marcadoresRing + historicoRef
  const threshMarkers = [];
  const addMarker = (m, isHist) => {
    if (!m || !m.config || !m.amp || !m.tipo) return;
    const r_mm = kFactor * Math.sqrt((m.amp || 0) * (m.pw || pw || 60));
    if (!isFinite(r_mm) || r_mm <= 0) return;
    const c = parseConfigToContatos(m.config);
    const vec = dirUnitVector2D(c);
    if (!isFinite(vec.ux)) return;
    const { rx, ry } = rotXY(vec.ux, vec.uy);
    const isPos = POSITIVE_EFFECTS.has(m.tipo);
    const struct = VTA_STRUCTURES[m.tipo] || VTA_STRUCTURES['Outros'];
    const svgX = C + rx * mmToSvg(r_mm);
    const svgY = C - ry * mmToSvg(r_mm);
    if (!isFinite(svgX) || !isFinite(svgY)) return;
    threshMarkers.push({ ...m, r_mm, svgX, svgY, isPos, struct, isHist });
  };

  if (showThresh) {
    [...(marcadores || []), ...(marcadoresRing || [])].forEach(m => addMarker(m, false));
  }
  if (showHist) {
    (historicoRef || []).forEach(m => addMarker(m, true));
  }

  // Grid rings in mm
  const mmRings = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

  // Stim direction arrow for current program
  let stimArrow = null;
  if (curVec && vtaR > 0 && isFinite(curVec.ux)) {
    const { rx, ry } = rotXY(curVec.ux, curVec.uy);
    const ex = C + rx * mmToSvg(vtaR), ey = C - ry * mmToSvg(vtaR);
    stimArrow = { rx, ry, ex, ey };
  }

  // VTA ellipse: rotated by stim direction
  let vtaEllipseAngle = 0;
  if (stimArrow) {
    vtaEllipseAngle = Math.atan2(-stimArrow.ry, stimArrow.rx) * 180 / Math.PI;
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
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-slate-400 uppercase font-bold">k=</span>
          <input type="range" min={0.1} max={0.9} step={0.05} value={kFactor}
            onChange={e => setKFactor(parseFloat(e.target.value))}
            className="w-16 h-1 accent-blue-500 cursor-pointer"/>
          <span className="text-[7px] text-slate-500 w-8">{kFactor.toFixed(2)}</span>
        </div>
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="checkbox" checked={showThresh} onChange={e => setShowThresh(e.target.checked)} className="accent-slate-500 w-3 h-3"/>
          <span className="text-[7px] text-slate-500">Limiares</span>
        </label>
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="checkbox" checked={showHist} onChange={e => setShowHist(e.target.checked)} className="accent-slate-400 w-3 h-3"/>
          <span className="text-[7px] text-slate-400">Histórico</span>
        </label>
        {vtaR > 0 && (
          <span className="text-[7px] font-mono text-blue-600 font-bold ml-auto">
            VTA ≈ {vtaR.toFixed(1)}mm
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

        {/* VTA ellipse for current program */}
        {vtaR > 0 && (
          <g>
            <ellipse cx={C} cy={C}
              rx={mmToSvg(vtaR)} ry={mmToSvg(vtaMinor)}
              fill="#3b82f6" fillOpacity={0.12}
              stroke="#3b82f6" strokeWidth={1.5}
              strokeDasharray="4,2"
              transform={`rotate(${vtaEllipseAngle}, ${C}, ${C})`}/>
            {/* Stim direction arrow */}
            {stimArrow && (
              <line x1={C} y1={C}
                x2={stimArrow.ex} y2={stimArrow.ey}
                stroke="#3b82f6" strokeWidth={1.5}
                markerEnd="url(#vtaArrow)" opacity={0.7}/>
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

const ControleParametro = ({ label, valor, unidade, step, min, max, onChange, isAmplitude, historicoRef, marcadores, marcadoresRing, marcadoresTodosL, historicoTodos, structuralMap, sessaoAtualTimestamp, tipoEletrodo, programaContatos }) => {
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
      const currentPw = (historicoRef && historicoRef[0]?.pw) || 60;

      if (efectiveMode === 'vta') {
        const allThreshMarkers = [...(marcadoresTodosL || marcadores), ...(marcadoresRing || [])];
        return <>{toggleBar}<VTAView
          programaContatos={programaContatos}
          ampAtual={valor}
          pw={currentPw}
          marcadores={allThreshMarkers}
          marcadoresRing={[]}
          historicoRef={historicoTodos || historicoRef}
          anteriorContact={anteriorContact}
          tipoEletrodo={tipoEletrodo}
          sessaoAtualTimestamp={sessaoAtualTimestamp}
          structuralMap={structuralMap}
        /></>;
      }

      if (efectiveMode === 'single-dir') {
        return <>{toggleBar}<DirectionalHistorico marcadores={marcadoresDisplay} historicoRef={historicoDisplay} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq} anteriorContact={anteriorContact} onOpenFullscreen={(grpKey) => setFullscreenDisplay({tipo:'single', grpKey})}/></>;
      } else if (efectiveMode === 'multi-dir') {
        return <>{toggleBar}<TripleView3D marcadores={marcadoresDisplay} marcadoresRing={marcadoresRingDisplay} historicoRef={historicoDisplay} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq} anteriorContact={anteriorContact} onOpenFullscreen={() => setFullscreenDisplay({tipo:'multi'})}/></>;
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
            ? <VTAView programaContatos={programaContatos} ampAtual={valor} pw={currentPw}
                marcadores={marcadoresTodosL||marcadores} marcadoresRing={[]}
                historicoRef={historicoTodos||historicoRef} anteriorContact={anteriorContact}
                tipoEletrodo={tipoEletrodo} sessaoAtualTimestamp={sessaoAtualTimestamp}
                forcedSize={520}/>
            : fullscreenDisplay.tipo === 'single'
            ? <DirectionalHistorico marcadores={marcadores} historicoRef={historicoRef} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq} anteriorContact={anteriorContact} forcedSize={520}/>
            : <TripleView3D marcadores={marcadores} marcadoresRing={marcadoresRing} historicoRef={historicoRef} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq} anteriorContact={anteriorContact} forcedSize={460}/>
          }
        </div>
      </div>
    )}
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 mt-1">{label}</label>
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
  </div>
  );
};


export { PolarDisplay2D, DirectionalHistorico, TripleView3D, TimelineHistorico, ControleParametro };
