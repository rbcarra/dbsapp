import React, { useState, useRef } from 'react';
import { TIPOS_ELETRODO, MARCADOR_LETRAS, getStringConfig } from './constants';
import { classifyStim, getDirLevel, parseConfigToContatos } from './vectorHelpers';
import { ControleParametro } from './DisplayComponents';

const VisualizadorEletrodo = ({ lado, tipoEletrodo, contatos, onChangeState, onChangePerc }) => {
  const [editandoMICC, setEditandoMICC] = useState(null);
  const timerRef = useRef(null);

  const cores = {
    'off': 'bg-slate-200 border-slate-300 text-slate-500 hover:bg-slate-300',
    '-': 'bg-cyan-500 border-cyan-600 text-white shadow-cyan-200 shadow-md',
    '+': 'bg-rose-500 border-rose-600 text-white shadow-rose-200 shadow-md'
  };

  const hasCathode = Object.values(contatos).some(c => c.state === '-');
  const hasAnode = Object.values(contatos).some(c => c.state === '+');
  let caseState = 'off';
  if (hasCathode && !hasAnode) caseState = '+';
  else if (hasAnode && !hasCathode) caseState = '-';

  const caseCores = {
    'off': 'bg-slate-100 border-slate-200 text-slate-400',
    '-': 'bg-cyan-500 border-cyan-600 text-white shadow-cyan-200 shadow-md opacity-90',
    '+': 'bg-rose-500 border-rose-600 text-white shadow-rose-200 shadow-md opacity-90'
  };

  const layout = TIPOS_ELETRODO[tipoEletrodo];

  const handlePointerDown = (chave, e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; 
    timerRef.current = setTimeout(() => {
      if (contatos[chave].state !== 'off') setEditandoMICC(chave);
    }, 500);
  };

  const handlePointerUp = (chave) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (editandoMICC !== chave) {
        const estadoAtual = contatos[chave].state;
        const proximoEstado = estadoAtual === 'off' ? '-' : estadoAtual === '-' ? '+' : 'off';
        onChangeState(chave, proximoEstado);
      }
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 w-full relative">
      <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">
        Hemisfério {lado === 'L' ? 'Esq.' : 'Dir.'}
      </h3>
      
      <div className="flex items-center justify-center w-full relative">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <div 
            className={`w-10 h-16 rounded-xl border-2 flex items-center justify-center font-bold text-[10px] tracking-wide uppercase select-none transition-colors duration-300 ${caseCores[caseState]}`}
            title="Case (IPG)"
          >
            Case
          </div>
        </div>

        <div className="flex flex-col items-center relative z-10">
          <div className="w-2 h-8 bg-slate-300 rounded-t-full mb-1"></div>
          <div className="flex flex-col space-y-2 z-10 relative">
            {layout.map((linha, rowIndex) => (
              <div key={rowIndex} className="flex justify-center space-x-2 relative">
                {linha.map(chave => {
                  const contato = contatos[chave];
                  const label = `${lado}${chave}`;
                  const widthClass = linha.length > 1 ? 'w-10' : 'w-16';

                  return (
                    <div key={chave} className="relative">
                      <button
                        onPointerDown={(e) => handlePointerDown(chave, e)}
                        onPointerUp={() => handlePointerUp(chave)}
                        onPointerLeave={() => { if(timerRef.current) clearTimeout(timerRef.current); }}
                        onContextMenu={(e) => { e.preventDefault(); handlePointerDown(chave, e); setEditandoMICC(chave); }}
                        className={`${widthClass} h-10 rounded-lg border-2 flex flex-col items-center justify-center font-bold text-xs transition-transform select-none ${cores[contato.state]}`}
                      >
                        <span>{label}</span>
                        {contato.state !== 'off' && contato.perc < 100 && (
                          <span className="text-[9px] opacity-90 leading-tight">{contato.perc}%</span>
                        )}
                      </button>

                      {editandoMICC === chave && (
                        <div 
                          className="absolute top-0 left-full ml-2 w-36 bg-white border border-slate-300 shadow-2xl rounded-lg p-3 z-50"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Corrente {label}</label>
                          <input 
                            type="range" min="0" max="100" step="5"
                            value={contato.perc}
                            onChange={(e) => onChangePerc(chave, parseInt(e.target.value))}
                            className="w-full accent-indigo-600 mb-2 cursor-pointer"
                          />
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-indigo-700">{contato.perc}%</span>
                            <button onClick={() => setEditandoMICC(null)} className="text-[10px] bg-slate-100 px-3 py-1 rounded font-bold hover:bg-slate-200">OK</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="w-4 h-6 bg-slate-300 rounded-b-full mt-1"></div>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 mt-4 text-center leading-tight">Segure o clique para %</p>
    </div>
  );
};



const RenderPrograma = ({ lado, programa, index, isInterleaving, tipoEletrodo, onUpdateProg, onUpdateState, onUpdatePerc, historicoRef, isMatchExato, marcadores, marcadoresRing, onAdicionarMarcador, onDesfazerMarcadores, cycling, onToggleCycling, impedancia, onImpedanciaChange, ignorarPerc }) => {
  const listaColaterais = ["Parestesia", "Cápsula", "Disartria", "Outros"];
  const listaPositivos = ["tremor", "rigidez", "bradicinesia"];
  const configStr = getStringConfig(programa.contatos, ignorarPerc);

  return (
    <div className={`flex flex-col bg-white rounded-xl border ${isMatchExato ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-emerald-100' : 'border-slate-200'} shadow-sm relative overflow-hidden h-full`}>
      <div className={`p-2 border-b flex justify-between items-center ${isMatchExato ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <span className="text-xs font-bold text-slate-600">{isInterleaving ? `Programa ${index + 1}` : 'Programa Principal'}</span>
        <div className="flex items-center gap-3">
          {/* Item 5: Cycling */}
          <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-slate-500">
            <input type="checkbox" checked={cycling} onChange={onToggleCycling} className="accent-indigo-600" />
            Cycling
          </label>
          {isMatchExato && (
            <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>Match
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 flex-1">
        <div className="w-full flex justify-center">
          <VisualizadorEletrodo 
            lado={lado} tipoEletrodo={tipoEletrodo} contatos={programa.contatos} 
            onChangeState={(k, s) => onUpdateState(lado, index, k, s)}
            onChangePerc={(k, p) => onUpdatePerc(lado, index, k, p)}
          />
        </div>

        {/* Item 6: Impedância */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Impedância da Terapia</label>
          <input
            type="text" value={impedancia} onChange={e => onImpedanciaChange(e.target.value)}
            placeholder="Ex: 1200 Ω"
            className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
          />
        </div>

        <div className="w-full flex flex-col justify-center flex-1">
          <ControleParametro 
            label="Amplitude" valor={programa.amp} unidade="mA" step={0.1} min={0} max={8}
            onChange={(v) => onUpdateProg(lado, index, 'amp', v)} isAmplitude={true} historicoRef={historicoRef} marcadores={marcadores} marcadoresRing={marcadoresRing} tipoEletrodo={tipoEletrodo} programaContatos={programa.contatos} sessaoAtualTimestamp={historicoRef.current?.[0]?.timestamp || Date.now()}
          />
          <div className="flex flex-col mt-2">
            <ControleParametro label="Pulso" valor={programa.pw} unidade="µs" step={10} min={30} max={210} onChange={(v) => onUpdateProg(lado, index, 'pw', v)}/>
            <ControleParametro label="Freq." valor={programa.freq} unidade="Hz" step={5} min={60} max={250} onChange={(v) => onUpdateProg(lado, index, 'freq', v)}/>
          </div>
        </div>

        {/* Efeitos colaterais e positivos — todos funcionam como botões de registro imediato */}
        <div className="flex flex-col mt-1 pt-2 border-t border-slate-100 gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Registrar Colateral:</span>
          <div className="flex flex-wrap gap-1">
            {listaColaterais.map(ef => (
              <button key={ef}
                onClick={() => onAdicionarMarcador(ef)}
                className="px-2 py-1 rounded text-[10px] font-bold border bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100 transition-all active:scale-95"
              >✕ {ef}</button>
            ))}
          </div>

          <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">Registrar Efeito Positivo:</span>
          <div className="flex flex-wrap gap-1">
            {listaPositivos.map(tipo => (
              <button key={tipo}
                onClick={() => onAdicionarMarcador(tipo)}
                className="px-2 py-1 rounded text-[10px] font-bold border bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 capitalize transition-all active:scale-95"
              >✓ {tipo}</button>
            ))}
            {configStr && (
              <button
                onClick={() => onDesfazerMarcadores(configStr)}
                className="px-2 py-1 rounded text-[10px] font-bold border bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
              >↩ Desfazer</button>
            )}
          </div>
        </div>


      </div>
    </div>
  );
};

// --- APLICATIVO PRINCIPAL ---

export { VisualizadorEletrodo, RenderPrograma };
