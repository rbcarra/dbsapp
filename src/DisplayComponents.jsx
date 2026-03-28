import React, { useMemo } from 'react';
import { MARCADOR_LETRAS, opacidadeMarcador, formatarData } from './constants';
import { DIR_ANGLES, parseConfigToContatos, classifyStim, getDirLevel,
  dirUnitVector2D, calcAmpEfetiva, dirVector3D } from './vectorHelpers';

const PolarDisplay2D = ({ marcadores, historicoRef, maxAmp, grupoKey, sessaoAtualTimestamp, programaContatos, ampAtual, labelGrupo, mostrarPositivos = true, mostrarNegativos = true, mostrarPrevios = true }) => {
  const [isZoomed, setIsZoomed] = React.useState(false);
  const S = isZoomed ? 300 : 160;
  const C = S / 2, margin = S * 0.14, R = C - margin;
  const toR = (amp) => (Math.min(Math.max(amp,0), maxAmp) / Math.max(maxAmp, 0.1)) * R;
  const rings = [];
  for (let v = 1; v <= Math.ceil(maxAmp); v++) rings.push(v);

  const currentVec = programaContatos ? dirUnitVector2D(programaContatos) : null;
  const currentAmpEf = programaContatos && ampAtual ? calcAmpEfetiva(programaContatos, ampAtual) : 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {labelGrupo && <span className="text-[8px] text-slate-500 font-mono">{labelGrupo}</span>}
      <div className="relative cursor-pointer" onClick={() => setIsZoomed(!isZoomed)} title="Clique para ampliar">
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
          <rect width={S} height={S} fill="#ffffff" rx="8"/>
          {rings.map(v => (
            <g key={v}>
              <circle cx={C} cy={C} r={toR(v)} fill="none"
                stroke={v === Math.ceil(maxAmp) ? '#475569' : '#cbd5e1'}
                strokeWidth={v === Math.ceil(maxAmp) ? 1.5 : 0.5}
                strokeDasharray={v < maxAmp ? '2,2' : undefined}/>
              <text x={C + toR(v) + 2} y={C - 2} fontSize={Math.max(5, S*0.033)} fill="#94a3b8">{v}mA</text>
            </g>
          ))}
          {Object.entries(DIR_ANGLES).map(([letter, deg]) => {
            const rad = deg * Math.PI / 180;
            const labelR = toR(Math.ceil(maxAmp)) + S * 0.07;
            return (
              <g key={letter}>
                <line x1={C} y1={C} x2={C + Math.cos(rad)*toR(Math.ceil(maxAmp))} y2={C - Math.sin(rad)*toR(Math.ceil(maxAmp))} stroke="#94a3b8" strokeWidth={0.5}/>
                <text x={C + Math.cos(rad)*labelR} y={C - Math.sin(rad)*labelR} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(9, S*0.06)} fontWeight="bold" fill="#1e293b">{letter}</text>
              </g>
            );
          })}
          {currentVec && currentAmpEf > 0 && (
            <line x1={C} y1={C} x2={C + currentVec.ux*toR(currentAmpEf)} y2={C - currentVec.uy*toR(currentAmpEf)}
              stroke="#6366f1" strokeWidth={2} strokeDasharray="4,3" opacity={0.5}/>
          )}
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
                <circle cx={px} cy={py} r={Math.max(4, S * 0.033)}
                  fill={cor} fillOpacity={0.25} stroke={cor} strokeWidth={1.5}/>
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
            const { ux, uy } = dirUnitVector2D(contatos);
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
    </div>
  );
};

const DirectionalHistorico = ({ marcadores, historicoRef, maxAmp, sessaoAtualTimestamp, programaContatos, ampAtual, agruparPorFreq }) => {
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TripleView3D = ({ marcadores, historicoRef, maxAmp, sessaoAtualTimestamp, programaContatos, ampAtual, agruparPorFreq, marcadoresRing }) => {
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [mostrarRing, setMostrarRing] = React.useState(true);
  const [mostrarSingleDir, setMostrarSingleDir] = React.useState(true);
  const [mostrarPositivos, setMostrarPositivos] = React.useState(true);
  const [mostrarNegativos, setMostrarNegativos] = React.useState(true);
  const [mostrarPrevios, setMostrarPrevios] = React.useState(true);
  const S = isZoomed ? 240 : 140;
  const C = S / 2, margin = S * 0.12, R = C - margin;
  const toR = (amp) => (Math.min(Math.max(amp, 0), maxAmp) / Math.max(maxAmp, 0.1)) * R;
  const rings = [];
  for (let v = 1; v <= Math.ceil(maxAmp); v++) rings.push(v);

  // Bug 2: calculate charge center (z origin) from programaContatos
  const calcZCenter = (contatos) => {
    if (!contatos) return 1.5; // default: middle of 0-3 range
    let zSum = 0, wSum = 0;
    Object.entries(contatos).forEach(([k, v]) => {
      if (v.state === 'off') return;
      const perc = (v.perc ?? 100) / 100;
      zSum += perc * parseInt(k[0]);
      wSum += perc;
    });
    return wSum > 0 ? zSum / wSum : 1.5;
  };
  const zOriginVal = programaContatos ? calcZCenter(programaContatos) : 1.5;
  // Convert z value (0-3) to SVG y coordinate — origin is at zOriginVal
  const zToSvg = (zVal) => C - (zVal - zOriginVal) * (R * 0.45);
  // Origin in SVG space
  const zOriginSvg = zToSvg(zOriginVal); // = C always, by definition

  // Bug 3: separate ring markers properly
  const allRing = marcadoresRing || [];
  const marcadoresSingleDirExtras = mostrarSingleDir ? allRing.filter(m => {
    const c = parseConfigToContatos(m.config);
    return classifyStim(c, 'directional') === 'single-dir';
  }) : [];
  const marcadoresRingExtras = mostrarRing ? allRing.filter(m => {
    const c = parseConfigToContatos(m.config);
    const st = classifyStim(c, 'directional');
    return st === 'ring' || (!getDirLevel(m.config) && st !== 'single-dir');
  }) : [];

  // Filter by positivos/negativos/previos
  const filterMarcador = (m, isCurrent) => {
    const isPos = ['tremor', 'rigidez', 'bradicinesia'].includes(m.tipo);
    if (isPos && !mostrarPositivos) return false;
    if (!isPos && !mostrarNegativos) return false;
    if (!isCurrent && !mostrarPrevios) return false;
    return true;
  };

  // Group by PW or Freq
  const byGroup = {};
  const allMarcadores = [...marcadores, ...marcadoresSingleDirExtras];
  allMarcadores.forEach(m => {
    const key = String(agruparPorFreq ? (m.freq || 130) : (m.pw || 60));
    if (!byGroup[key]) byGroup[key] = { multiDir: [], singleDir: [] };
    if (marcadores.includes(m)) byGroup[key].multiDir.push(m);
    else byGroup[key].singleDir.push(m);
  });
  // Group historicoRef by PW/Freq
  const histByGroup3D = {};
  (historicoRef || []).forEach(h => {
    const key = String(agruparPorFreq ? (h.freq || 130) : (h.pw || 60));
    if (!histByGroup3D[key]) histByGroup3D[key] = [];
    histByGroup3D[key].push(h);
  });

  const allKeys = [...new Set([
    ...Object.keys(byGroup),
    ...marcadoresRingExtras.map(m => String(agruparPorFreq ? (m.freq || 130) : (m.pw || 60))),
    ...Object.keys(histByGroup3D)
  ])].sort((a, b) => +a - +b);
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

  const projections = [
    { label: 'XY · topo', showSchematic: false, getXY: v => ({ px: v.ux, py: v.uy }),
      dirLabels: Object.entries(DIR_ANGLES).map(([lt, deg]) => ({ letter: lt, lx: Math.cos(deg * Math.PI / 180), ly: Math.sin(deg * Math.PI / 180) })) },
    { label: 'XZ · frente', showSchematic: true, getXY: v => ({ px: v.ux, py: v.uz }),
      dirLabels: [{ letter: 'A', lx: 1, ly: 0 }, { letter: 'B/C', lx: -0.5, ly: 0 }] },
    { label: 'YZ · lado', showSchematic: true, getXY: v => ({ px: v.uy, py: v.uz }),
      dirLabels: [{ letter: 'B', lx: -1, ly: 0 }, { letter: 'C', lx: 0.87, ly: 0 }] },
  ];

  // Helper: for each marker/item, compute its own Z-origin in SVG coords for XZ/YZ views
  // This allows each point to emanate from its actual charge-center height on the electrode
  const itemOriginY = (config, isZView) => {
    if (!isZView) return C; // XY view: flat, always center
    const contatos = parseConfigToContatos(config);
    return zToSvg(calcZCenter(contatos));
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
      <svg key={`${grpKey}-${showSchematic}`} width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <rect width={S} height={S} fill="#ffffff" rx="6"/>
        {/* Grid rings centered on current program origin */}
        {rings.map(v => (
          <circle key={v} cx={C} cy={originY} r={toR(v)} fill="none"
            stroke={v === Math.ceil(maxAmp) ? '#475569' : '#e2e8f0'}
            strokeWidth={v === Math.ceil(maxAmp) ? 1.5 : 0.5}
            strokeDasharray={v < maxAmp ? '2,2' : undefined}/>
        ))}
        <line x1={margin} y1={originY} x2={S - margin} y2={originY} stroke="#e2e8f0" strokeWidth={0.5}/>
        <line x1={C} y1={margin} x2={C} y2={S - margin} stroke="#e2e8f0" strokeWidth={0.5}/>
        {dirLabels.map(({ letter, lx, ly }) => {
          const labelR = toR(Math.ceil(maxAmp)) + S * 0.07;
          return <text key={letter} x={C + lx * labelR} y={originY - ly * labelR}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(7, S * 0.055)} fontWeight="bold" fill="#1e293b">{letter}</text>;
        })}
        {showSchematic && <ElectrodeSchematic highlightLevels={allLevels}/>}
        {/* Current stim line from its own origin */}
        {curVec && (() => {
          const { px: cux, py: cuy } = getXY(curVec);
          const cr = toR(curVec.amp || 0);
          return cr > 0 ? <line x1={originX} y1={originY}
            x2={originX + cux * cr} y2={originY - cuy * cr}
            stroke="#6366f1" strokeWidth={2} strokeDasharray="4,3" opacity={0.5}/> : null;
        })()}
        <circle cx={originX} cy={originY} r={Math.max(2, S * 0.015)} fill="#334155"/>
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
              <circle cx={originX} cy={mOY} r={rRing} fill="none" stroke={fill} strokeWidth={1.5} strokeDasharray="2,2" opacity={0.5}/>
              <text x={originX + rRing * 0.707 + 2} y={mOY - rRing * 0.707 - 2}
                textAnchor="middle" fontSize={Math.max(5, S * 0.04)} fill={fill} fontWeight="bold">{info.letra}</text>
            </g>
          );
        })}
        {/* Single-dir extras — each from its own Z-origin */}
        {singleDir.filter(m => filterMarcador(m, false)).map((m, mi) => {
          const c = parseConfigToContatos(m.config);
          const vec = dirVector3D(c, m.amp || 0);
          const { px: ux, py: uy } = getXY(vec);
          const r = toR(vec.amp || 0);
          const mOY = itemOriginY(m.config, showSchematic);
          const svgX = originX + ux * r, svgY = mOY - uy * r;
          const isPos = ['tremor', 'rigidez', 'bradicinesia'].includes(m.tipo);
          const info = MARCADOR_LETRAS[m.tipo] || { letra: '?' };
          const fill = isPos ? '#059669' : '#e11d48';
          const opacity = Math.max(0.4, opacidadeMarcador(m.sessionTimestamp || m.timestamp || 0, sessaoAtualTimestamp || Date.now()));
          return (
            <g key={`sd-${mi}`} opacity={opacity * 0.7}>
              <title>{`[single] ${m.tipo} | ${m.amp}mA`}</title>
              <circle cx={svgX} cy={svgY} r={Math.max(3, S * 0.025)} fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth={1} strokeDasharray="1,1"/>
              <text x={svgX} y={svgY} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(5, S * 0.038)} fill="#fff" fontWeight="bold" stroke={fill} strokeWidth={0.3}>{info.letra}</text>
            </g>
          );
        })}
        {/* Multi-dir markers — each from its own Z-origin */}
        {multiDir.filter(m => filterMarcador(m, true)).map((m, mi) => {
          const c = parseConfigToContatos(m.config);
          const vec = dirVector3D(c, m.amp || 0);
          const { px: ux, py: uy } = getXY(vec);
          const r = toR(vec.amp || 0);
          const mOY = itemOriginY(m.config, showSchematic);
          const svgX = originX + ux * r, svgY = mOY - uy * r;
          const isPos = ['tremor', 'rigidez', 'bradicinesia'].includes(m.tipo);
          const info = MARCADOR_LETRAS[m.tipo] || { letra: '?' };
          const fill = isPos ? '#059669' : '#e11d48';
          const markerR = Math.max(3.5, S * 0.031);
          const opacity = Math.max(0.4, opacidadeMarcador(m.sessionTimestamp || m.timestamp || 0, sessaoAtualTimestamp || Date.now()));
          return (
            <g key={`md-${mi}`} opacity={opacity}>
              <title>{`${m.tipo} | ${m.amp}mA | ${m.freq}Hz`}</title>
              <circle cx={svgX} cy={svgY} r={markerR} fill={fill} fillOpacity={0.3} stroke={fill} strokeWidth={1.5}/>
              <text x={svgX} y={svgY} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(6, S * 0.045)} fill="#fff" fontWeight="bold" stroke={fill} strokeWidth={0.3}>{info.letra}</text>
            </g>
          );
        })}
        {/* Indicadores de programação prévia — ring shown as rings, dir as dots */}
        {mostrarPrevios && histItems.map((h, hi) => {
          const hContatos = parseConfigToContatos(h.config);
          const hType = classifyStim(hContatos, 'directional');
          const isRing = hType === 'ring' || !getDirLevel(h.config);
          if (isRing && !mostrarRing) return null;
          if (!isRing && !mostrarSingleDir) return null;
          const hVec = dirVector3D(hContatos, h.amp || 0);
          const cor = h.efeito === 'bom' ? '#10b981'
            : h.efeito === 'ruim' ? '#f43f5e'
            : h.efeito === 'pouco' ? '#94a3b8' : '#67e8f9';
          const opacity = Math.max(0.35, opacidadeMarcador(h.date || 0, sessaoAtualTimestamp || Date.now()));
          const hr = toR(hVec.amp || 0);
          const hOY = itemOriginY(h.config, showSchematic);
          if (isRing) {
            return (
              <g key={`previo-${hi}`} opacity={opacity}>
                <title>{`[prev-ring] ${h.config} | ${h.amp}mA | ${h.efeito}`}</title>
                <circle cx={originX} cy={hOY} r={hr} fill="none" stroke={cor} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.6}/>
              </g>
            );
          }
          const { px: hux, py: huy } = getXY(hVec);
          const hx = originX + hux * hr, hy = hOY - huy * hr;
          return (
            <g key={`previo-${hi}`} opacity={opacity}>
              <title>{`[prev-dir] ${h.config} | ${h.amp}mA | ${h.efeito}`}</title>
              <circle cx={hx} cy={hy} r={Math.max(3.5, S * 0.028)}
                fill={cor} fillOpacity={0.3} stroke={cor} strokeWidth={1.5}/>
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
          <button onClick={() => setIsZoomed(!isZoomed)} className="text-[8px] text-slate-500 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200">
            {isZoomed ? '−' : '+'}
          </button>
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

const ControleParametro = ({ label, valor, unidade, step, min, max, onChange, isAmplitude, historicoRef, marcadores, marcadoresRing, sessaoAtualTimestamp, tipoEletrodo, programaContatos }) => {
  const [agruparPorFreq, setAgruparPorFreq] = React.useState(false);
  const [forcarMultiDir, setForcarMultiDir] = React.useState(false);

  return (
  <div className="flex flex-col mb-3">
    {isAmplitude && (() => {
      const stimType = forcarMultiDir ? 'multi-dir'
        : (tipoEletrodo === 'directional' && programaContatos
          ? classifyStim(programaContatos, tipoEletrodo)
          : 'ring');

      // Botões de controle do display
      const toggleBar = (
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <button onClick={() => setAgruparPorFreq(v => !v)}
            className={`text-[8px] font-bold px-1.5 py-0.5 rounded border transition-all ${agruparPorFreq ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
            title="Alternar agrupamento: Largura de Pulso ↔ Frequência">
            {agruparPorFreq ? 'Ag: Freq' : 'Ag: PW'}
          </button>
          <button onClick={() => setForcarMultiDir(v => !v)}
            className={`text-[8px] font-bold px-1.5 py-0.5 rounded border transition-all ${forcarMultiDir ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
            title="Forçar visão 3D multi-dir">
            3D
          </button>
        </div>
      );

      if (stimType === 'single-dir') {
        return <>{toggleBar}<DirectionalHistorico marcadores={marcadores} historicoRef={historicoRef} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq}/></>;
      } else if (stimType === 'multi-dir') {
        return <>{toggleBar}<TripleView3D marcadores={marcadores} marcadoresRing={marcadoresRing} historicoRef={historicoRef} maxAmp={max} sessaoAtualTimestamp={sessaoAtualTimestamp} programaContatos={programaContatos} ampAtual={valor} agruparPorFreq={agruparPorFreq}/></>;
      } else {
        return <>{toggleBar}<TimelineHistorico historicoRef={historicoRef} maxAmp={max} marcadores={marcadores} sessaoAtualTimestamp={sessaoAtualTimestamp} agruparPorFreq={agruparPorFreq}/></>;
      }
    })()}
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
