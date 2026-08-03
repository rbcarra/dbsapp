import React, { useState, useRef, useEffect } from 'react';
import { getAIConfig, saveAIConfig, checkHealth } from './aiClient';

// ─── STATUS LIGHT ─────────────────────────────────────────────────────────────
// Small green/red dot indicating connection to the local AI PC.
// `status`: 'ok' | 'off' | 'checking' | null
export const AIStatusLight = ({ status, label, onClick }) => {
  const color = status === 'ok' ? 'bg-emerald-500'
    : status === 'checking' ? 'bg-amber-400 animate-pulse'
    : 'bg-rose-500';
  const title = status === 'ok' ? `IA conectada${label ? ` (${label})` : ''}`
    : status === 'checking' ? 'Verificando conexão…'
    : 'IA desconectada — clique para configurar';
  return (
    <button onClick={onClick} title={title}
      className="flex items-center gap-1 shrink-0 group">
      <span className={`w-2.5 h-2.5 rounded-full ${color} transition-colors ring-2 ring-white shadow`} />
      <span className="text-[8px] text-slate-400 group-hover:text-slate-600 hidden sm:inline">IA</span>
    </button>
  );
};

// ─── SETTINGS MODAL ───────────────────────────────────────────────────────────
export const AISettingsModal = ({ onClose, onSaved }) => {
  const [config, setConfig] = useState(getAIConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // {ollama, transcribe}

  const setField = (k, v) => setConfig(prev => ({ ...prev, [k]: v }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await checkHealth(config);
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    saveAIConfig(config);
    onSaved?.(config);
    onClose();
  };

  const inputCls = "w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono text-slate-700";
  const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1";

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b bg-indigo-50">
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Configuração de IA local</h2>
            <p className="text-[10px] text-slate-400">Conexão com seu PC (Ollama + transcrição)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[10px] text-amber-700 leading-relaxed">
            ⚠ Os dados são processados localmente no seu PC (conformidade LGPD). O PC deve expor
            HTTPS com certificado válido para o navegador aceitar a conexão.
          </div>

          <div>
            <label className={labelCls}>URL do servidor (PC local)</label>
            <input value={config.serverUrl} onChange={e => setField('serverUrl', e.target.value)}
              placeholder="https://meu-pc.local:8765" className={inputCls} />
            <p className="text-[9px] text-slate-400 mt-1">Um só endereço — o servidor faz proxy do Whisper e do Ollama.</p>
          </div>

          <div>
            <label className={labelCls}>Token de acesso (API_TOKEN)</label>
            <input type="password" value={config.apiToken || ''} onChange={e => setField('apiToken', e.target.value)}
              placeholder="cole aqui o token do servidor" className={inputCls} />
            <p className="text-[9px] text-slate-400 mt-1">Deve ser igual ao API_TOKEN definido no servidor (contorna o login do Cloudflare Access).</p>
          </div>

          <div>
            <label className={labelCls}>Modelo Ollama</label>
            <input value={config.ollamaModel} onChange={e => setField('ollamaModel', e.target.value)}
              placeholder="llama3.1" className={inputCls} />
            {testResult?.modelos?.length > 0 && (
              <p className="text-[9px] text-slate-400 mt-1">Disponíveis: {testResult.modelos.join(', ')}</p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={config.enabled}
              onChange={e => setField('enabled', e.target.checked)}
              className="accent-indigo-500 w-4 h-4" />
            <span className="text-xs font-bold text-slate-600">Ativar recursos de IA</span>
          </label>

          {/* Test connection */}
          <div>
            <button onClick={handleTest} disabled={testing}
              className="w-full py-2 rounded-lg font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50">
              {testing ? '⟳ Testando…' : '🔌 Testar conexão'}
            </button>
            {testResult && (
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`w-2 h-2 rounded-full ${testResult.ollama ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className={testResult.ollama ? 'text-emerald-600' : 'text-rose-600'}>
                    Ollama: {testResult.ollama ? 'conectado' : 'sem resposta'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`w-2 h-2 rounded-full ${testResult.transcribe ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className={testResult.transcribe ? 'text-emerald-600' : 'text-rose-600'}>
                    Whisper: {testResult.transcribe ? 'conectado' : 'sem resposta'}
                  </span>
                </div>
                {testResult.fila && (
                  <div className="text-[9px] text-slate-400 pl-4">
                    Fila: {testResult.fila.na_fila} aguardando · {testResult.fila.processando} processando · {testResult.fila.total_processado} total
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t flex gap-2">
          <button onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            Salvar
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── AUDIO RECORDER BUTTON ────────────────────────────────────────────────────
// Records audio via MediaRecorder and calls onRecorded(blob) when stopped.
export const AudioRecorderButton = ({ onRecorded, disabled }) => {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => {
    // Cleanup on unmount
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecorded?.(blob);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      alert('Não foi possível acessar o microfone: ' + err.message);
    }
  };

  const stop = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <button
      onClick={recording ? stop : start}
      disabled={disabled}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-all border ${
        recording
          ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-400 animate-pulse'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 disabled:opacity-40'
      }`}
      title={disabled ? 'Configure a conexão de IA primeiro' : recording ? 'Parar gravação' : 'Gravar áudio da consulta'}>
      {recording ? `⏹ ${fmt(elapsed)}` : '🎙 Gravar'}
    </button>
  );
};
