import React, { useState, useMemo, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// Criado por Rafael Bernhart Carra em 2026 em um plantão longo no HC
// Talvez mais de um plantão
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dbs-logger-hcfmusp';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONFIGURAÇÕES BASE ---
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
  // Colaterais — vermelho
  'Parestesia': { letra: 'P', cor: 'text-rose-700' },
  'Cápsula': { letra: 'C', cor: 'text-rose-700' },
  'Disartria': { letra: 'D', cor: 'text-rose-700' },
  'Outros': { letra: 'O', cor: 'text-rose-700' },
  // Positivos — verde
  'tremor': { letra: 'T', cor: 'text-emerald-700' },
  'rigidez': { letra: 'R', cor: 'text-emerald-700' },
  'bradicinesia': { letra: 'B', cor: 'text-emerald-700' },
};

const opacidadeMarcador = (timestampMarcador, timestampSessaoAtual) => {
  const meses = (timestampSessaoAtual - timestampMarcador) / (1000 * 60 * 60 * 24 * 30.44);
  const reducao = Math.min(Math.floor(meses / 6) * 0.06, 0.60);
  return Math.max(1 - reducao, 0.40);
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
    hour: '2-digit', minute:'2-digit' 
  });
};


// --- COMPONENTES AUXILIARES ---

const LoginModal = ({ onLoginSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Erro na autenticação. Detalhe: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-in">
        <div className="bg-slate-900 p-6 text-center">
          <h2 className="text-xl font-bold text-white tracking-wider flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            DBS LOG ACCESS
          </h2>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Área Restrita HCFMUSP</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && <div className="p-2 bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold rounded-lg text-center">{error}</div>}
          
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">E-mail Profissional</label>
            <input 
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              placeholder="medico@hc.fm.usp.br"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Senha</label>
            <input 
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-md"
          >
            {loading ? 'Processando...' : (isLoginMode ? 'ENTRAR' : 'CRIAR CONTA')}
          </button>
        </form>

        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <button 
            type="button" onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }}
            className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-wide"
          >
            {isLoginMode ? 'Não tem conta? Criar acesso' : 'Já tem conta? Fazer Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PatientSelector = ({ patients, onSelectPatient, onCreatePatient, onDeletePatient, onImportFullCSV }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newName, setNewName] = useState('');
  const [newHc, setNewHc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // paciente a apagar
  const [importFeedback, setImportFeedback] = useState('');

  const filteredPatients = patients.filter(p => 
    (p.nome || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
    (p.hc || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const handleCreate = (e) => {
    e.preventDefault();
    if (newName && newHc) {
      onCreatePatient(newName, newHc);
      setNewName('');
      setNewHc('');
    }
  };

  const handleImportCSV = async (file) => {
    if (!file) return;
    setImportFeedback('Importando...');
    const resultado = await onImportFullCSV(file);
    setImportFeedback(resultado);
    setTimeout(() => setImportFeedback(''), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      {/* Diálogo de confirmação de apagar paciente */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Apagar Paciente?</h3>
            <p className="text-xs text-slate-500 mb-1">Um CSV com os dados de <span className="font-bold text-slate-700">{confirmDelete.nome}</span> será gerado antes da exclusão.</p>
            <p className="text-[10px] text-rose-500 font-bold mb-5">Esta ação não pode ser desfeita. Todas as sessões do paciente serão apagadas.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-1.5 rounded text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancelar</button>
              <button onClick={() => { onDeletePatient(confirmDelete); setConfirmDelete(null); }}
                className="px-4 py-1.5 rounded text-xs font-bold text-white bg-rose-600 hover:bg-rose-700">
                Gerar CSV e Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        <div className="w-full md:w-3/5 bg-slate-50 p-6 flex flex-col border-r border-slate-200">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-xl font-bold text-slate-800">Selecione o Paciente</h2>
            {/* Botão importar CSV de pacientes */}
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors">
              ⬆ Importar CSV
              <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleImportCSV(e.target.files[0])} />
            </label>
          </div>
          <p className="text-xs text-slate-500 mb-2">Escolha um paciente cadastrado para visualizar e registrar sessões de DBS.</p>
          {importFeedback && <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded mb-2">{importFeedback}</p>}
          
          <input 
            type="text" placeholder="Buscar por nome ou Registro HC..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 shadow-sm"
          />

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
            {filteredPatients.length === 0 ? (
              <p className="text-sm text-slate-400 text-center mt-10">Nenhum paciente encontrado.</p>
            ) : (
              filteredPatients.map(p => (
                <div key={p.id} className="w-full flex items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all">
                  <button onClick={() => onSelectPatient(p)} className="flex-1 flex justify-between items-center text-left min-w-0">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-700 truncate">{p.nome || 'Paciente sem nome'}</h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">HC: {p.hc || 'N/A'}</p>
                    </div>
                    <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full text-[10px] font-bold ml-3 shrink-0">Abrir</span>
                  </button>
                  {/* Botão apagar paciente */}
                  <button
                    onClick={() => setConfirmDelete(p)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    title="Apagar paciente"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="w-full md:w-2/5 p-6 flex flex-col bg-white">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Novo Cadastro</h2>
          <p className="text-xs text-slate-500 mb-6">Adicione um novo paciente. CSV aceita colunas: <span className="font-mono text-slate-600">Nome, HC</span></p>
          
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome Completo</label>
              <input 
                type="text" required value={newName} onChange={e => setNewName(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                placeholder="Ex: João da Silva"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Registro HC</label>
              <input 
                type="text" required value={newHc} onChange={e => setNewHc(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium font-mono"
                placeholder="Ex: 1234567"
              />
            </div>

            <button 
              type="submit" disabled={!newName || !newHc}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors text-sm shadow-md"
            >
              CADASTRAR E ABRIR
            </button>
          </form>

          <div className="mt-auto pt-6 text-center">
             <p className="text-[9px] text-slate-400">Os dados dos pacientes são salvos de forma segura no seu perfil criptografado no Firebase.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfirmDialog = ({ isOpen, title, message, confirmText, confirmColor, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 animate-slide-in">
        <h3 className="text-sm font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-xs text-slate-500 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-1.5 rounded text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancelar</button>
          <button onClick={onConfirm} className={`px-4 py-1.5 rounded text-xs font-bold text-white shadow-sm transition-colors ${confirmColor || 'bg-rose-600 hover:bg-rose-700'}`}>
            {confirmText || 'Sim, Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
};

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

const TimelineHistorico = ({ historicoRef, maxAmp, marcadores, sessaoAtualTimestamp }) => {
  const [timelineW, setTimelineW] = React.useState(null); // null = 100% natural
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

  const historicoPorPW = useMemo(() => {
    const grupos = {};
    if (!historicoRef) return grupos;
    historicoRef.forEach(h => {
      if (!grupos[h.pw]) grupos[h.pw] = [];
      grupos[h.pw].push(h);
    });
    return Object.keys(grupos).sort((a,b) => Number(a) - Number(b)).reduce((obj, key) => {
      obj[key] = grupos[key]; return obj;
    }, {});
  }, [historicoRef]);

  const effectiveMax = maxAmp > 0 ? maxAmp : 4;

  // Unir PWs do histórico com PWs dos marcadores clínicos (mudança 2)
  // Garante que uma linha seja criada mesmo sem histórico prévio naquele PW
  const pwsDosMarcadores = (marcadores || []).map(m => String(m.pw)).filter(Boolean);
  const todosOsPWs = [...new Set([...Object.keys(historicoPorPW), ...pwsDosMarcadores])]
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
        const items = historicoPorPW[pwStr] || [];
        const itemsByAmp = {};
        items.forEach(item => {
          if (!itemsByAmp[item.amp]) itemsByAmp[item.amp] = [];
          itemsByAmp[item.amp].push(item);
        });
        // Filtrar marcadores: para cada par <0.2mA, manter apenas o mais recente;
        // em caso de mesmo timestamp, priorizar efeito colateral sobre positivo
        const marcadoresRaw = (marcadores || []).filter(m => String(m.pw) === pwStr);
        const marcadoresDessePW = marcadoresRaw.filter((m, i) => {
          return !marcadoresRaw.some((outro, j) => {
            if (i === j) return false;
            if (Math.abs((m.amp || 0) - (outro.amp || 0)) >= 0.2) return false;
            const mIsPos = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
            const outroIsPos = ['tremor','rigidez','bradicinesia'].includes(outro.tipo);
            // outro vence se: é mais recente, OU mesmo tempo mas m é positivo e outro é colateral
            const outroMaisRecente = (outro.timestamp || 0) > (m.timestamp || 0);
            const outroTemPrioridade = (outro.timestamp || 0) === (m.timestamp || 0) && mIsPos && !outroIsPos;
            return outroMaisRecente || outroTemPrioridade;
          });
        });
        // Altura da linha = 64px (h-16). Indicadores (barras simples) têm h-9 = 36px, partindo do bottom-0.
        // Topo dos indicadores = 64 - 36 = 28px do bottom. Marcadores ficam 5px acima disso = 28 + 5 = 33px do bottom.
        const MARCADOR_BOTTOM = 33;

        return (
          <div key={pwStr}>
            {/* Separador cinza escuro entre linhas de PW quando há mais de uma (mudança 3) */}
            {pwIdx > 0 && todosOsPWs.length > 1 && (
              <div className="w-full h-px bg-slate-400 opacity-40 mx-0" />
            )}
            <div className="relative w-full h-16 flex items-center">
              <span className="absolute left-0 text-[9px] font-bold text-slate-400 bg-white px-1 rounded shadow-sm z-10 border border-slate-200 w-7 text-center">{pwStr}µs</span>
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
                          <span className="text-[8px] text-slate-700 font-bold mt-0.5" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: 1 }}>{h.freq}Hz</span>
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
                      title={`${m.tipo} | ${m.amp}mA | ${m.freq}Hz | ${Math.round(opacidade * 100)}%`}
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

const ControleParametro = ({ label, valor, unidade, step, min, max, onChange, isAmplitude, historicoRef, marcadores, sessaoAtualTimestamp }) => (
  <div className="flex flex-col mb-3">
    {isAmplitude && <TimelineHistorico historicoRef={historicoRef} maxAmp={max} marcadores={marcadores} sessaoAtualTimestamp={sessaoAtualTimestamp} />}
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

const RenderPrograma = ({ lado, programa, index, isInterleaving, tipoEletrodo, onUpdateProg, onUpdateState, onUpdatePerc, historicoRef, isMatchExato, marcadores, onAdicionarMarcador, onDesfazerMarcadores, cycling, onToggleCycling, impedancia, onImpedanciaChange, ignorarPerc }) => {
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
            onChange={(v) => onUpdateProg(lado, index, 'amp', v)} isAmplitude={true} historicoRef={historicoRef} marcadores={marcadores} sessaoAtualTimestamp={historicoRef.current?.[0]?.timestamp || Date.now()}
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

export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // States de Pacientes
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [fotoRecL, setFotoRecL] = useState(null);
  const [fotoRecR, setFotoRecR] = useState(null);

  // States do Prontuário / Sessão
  const [tipoEletrodo, setTipoEletrodo] = useState('4-ring');
  const criarProgramaInicial = (tipo = tipoEletrodo) => ({
    contatos: getContatosIniciais(tipo), amp: 0.0, pw: 60, freq: 130, efeito: 'neutro'
  });
  const [grupoAtivo, setGrupoAtivo] = useState('A');
  const [dadosGrupos, setDadosGrupos] = useState({
    A: { L: [criarProgramaInicial()], R: [criarProgramaInicial()] },
    B: { L: [criarProgramaInicial()], R: [criarProgramaInicial()] },
    C: { L: [criarProgramaInicial()], R: [criarProgramaInicial()] },
    D: { L: [criarProgramaInicial()], R: [criarProgramaInicial()] }
  });
  const [clinica, setClinica] = useState({ tremor: 0, rigidez: 0, bradicinesia: 0 });
  const [efeitosColaterais, setEfeitosColaterais] = useState({ L: [], R: [] });
  const [notasLivres, setNotasLivres] = useState("");
  const [resumoSessao, setResumoSessao] = useState("");
  const listaEfeitos = ["Parestesia", "Cápsula", "Disartria", "Outros"];
  const [textoProntuario, setTextoProntuario] = useState("");
  const [voltagemBateria, setVoltagemBateria] = useState("");
  const [impedanciaL, setImpedanciaL] = useState("");
  const [impedanciaR, setImpedanciaR] = useState("");
  const [cyclingL, setCyclingL] = useState(false);
  const [cyclingR, setCyclingR] = useState(false);
  const [marcadoresClinicosL, setMarcadoresClinicosL] = useState([]);
  const [marcadoresClinicosR, setMarcadoresClinicosR] = useState([]);

  // Banco de Dados States
  const [allSessions, setAllSessions] = useState([]);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showDeletedSessions, setShowDeletedSessions] = useState(false); 
  const [toastMessage, setToastMessage] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, sessionId: null, mode: 'soft' });
  const [showMonopolar, setShowMonopolar] = useState(false);
  const [considerarAmplitude, setConsiderarAmplitude] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token).catch(() => {});
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      if (!usr) setShowLoginModal(true);
      else setShowLoginModal(false);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPatients([]);
      setActivePatient(null);
      setAllSessions([]);
    } catch (err) {
      console.error("Erro ao fazer logout", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    const ptsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'patients');
    const unsubPts = onSnapshot(ptsRef, (snapshot) => {
      const pts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      pts.sort((a,b) => b.createdAt - a.createdAt);
      setPatients(pts);
    }, err => console.error(err));

    const sessRef = collection(db, 'artifacts', appId, 'users', user.uid, 'sessions');
    const unsubSessions = onSnapshot(sessRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllSessions(data);
    }, (err) => console.error(err));

    return () => { unsubPts(); unsubSessions(); };
  }, [user]);

  const sessions = useMemo(() => {
    if (!activePatient) return [];
    return allSessions.filter(s => s.patientId === activePatient.id).sort((a, b) => {
      if (a.type !== b.type) {
         if (a.type === 'active') return -1;
         if (b.type === 'active') return 1;
         if (a.type === 'deleted') return 1;
         if (b.type === 'deleted') return -1;
         return 1;
      }
      return b.timestamp - a.timestamp;
    });
  }, [allSessions, activePatient]);

  useEffect(() => {
    if (!user || !activePatient) return;
    const fetchTemp = async () => {
      setTipoEletrodo('4-ring');
      setGrupoAtivo('A');
      setDadosGrupos({
        A: { L: [criarProgramaInicial('4-ring')], R: [criarProgramaInicial('4-ring')] },
        B: { L: [criarProgramaInicial('4-ring')], R: [criarProgramaInicial('4-ring')] },
        C: { L: [criarProgramaInicial('4-ring')], R: [criarProgramaInicial('4-ring')] },
        D: { L: [criarProgramaInicial('4-ring')], R: [criarProgramaInicial('4-ring')] }
      });
      setClinica({ tremor: 0, rigidez: 0, bradicinesia: 0 });
      setEfeitosColaterais({ L: [], R: [] });
      setNotasLivres("");
      setResumoSessao("");
      setVoltagemBateria("");
      setImpedanciaL("");
      setImpedanciaR("");
      setCyclingL(false);
      setCyclingR(false);
      setMarcadoresClinicosL([]);
      setMarcadoresClinicosR([]);
      setEditingSessionId(null);

      try {
        const tempDoc = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'temp_sessions', activePatient.id));
        if (tempDoc.exists()) {
          const d = tempDoc.data();
          if (d.tipoEletrodo) setTipoEletrodo(d.tipoEletrodo);
          if (d.dadosGrupos) setDadosGrupos(d.dadosGrupos);
          if (d.clinica) setClinica(d.clinica);
          if (d.efeitosColaterais) setEfeitosColaterais(d.efeitosColaterais);
          if (d.notasLivres !== undefined) setNotasLivres(d.notasLivres);
          if (d.resumoSessao !== undefined) setResumoSessao(d.resumoSessao);
          if (d.voltagemBateria !== undefined) setVoltagemBateria(d.voltagemBateria);
          if (d.impedanciaL !== undefined) setImpedanciaL(d.impedanciaL);
          if (d.impedanciaR !== undefined) setImpedanciaR(d.impedanciaR);
          if (d.cyclingL !== undefined) setCyclingL(d.cyclingL);
          if (d.cyclingR !== undefined) setCyclingR(d.cyclingR);
          if (d.marcadoresClinicosL) setMarcadoresClinicosL(d.marcadoresClinicosL);
          if (d.marcadoresClinicosR) setMarcadoresClinicosR(d.marcadoresClinicosR);
          if (d.editingSessionId) setEditingSessionId(d.editingSessionId);
        }
      } catch (err) {}
    };
    fetchTemp();
  }, [user, activePatient]);

  useEffect(() => {
    if (!user || !activePatient || isInitializing || showLoginModal) return;
    const timer = setTimeout(() => {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'temp_sessions', activePatient.id), {
        tipoEletrodo, dadosGrupos, clinica, efeitosColaterais, notasLivres, resumoSessao,
        voltagemBateria, impedanciaL, impedanciaR, cyclingL, cyclingR,
        marcadoresClinicosL, marcadoresClinicosR,
        editingSessionId: editingSessionId || null,
        timestamp: Date.now()
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [tipoEletrodo, dadosGrupos, clinica, efeitosColaterais, notasLivres, resumoSessao, voltagemBateria, impedanciaL, impedanciaR, cyclingL, cyclingR, marcadoresClinicosL, marcadoresClinicosR, editingSessionId, user, activePatient, isInitializing, showLoginModal]);

  const historicoReal = useMemo(() => {
    const map = new Map();
    sessions.filter(s => s.type === 'active').forEach(sess => {
      Object.entries(sess.dadosGrupos || {}).forEach(([nomeGrupo, grupo]) => {
        ['L', 'R'].forEach(lado => {
          (grupo[lado] || []).forEach(prog => {
            // Se considerarAmplitude=false, normalizar % para 100 antes de gerar config key
            // ignorarPerc=true quando considerarAmplitude=false → key e config sem percentual
            const ignorarP = !considerarAmplitude;
            const config = getStringConfig(prog.contatos, ignorarP);
            if (config) {
              const key = `${lado}-${config}-${prog.amp}-${prog.pw}-${prog.freq}`;
              const newItem = {
                lado, config, amp: prog.amp, pw: prog.pw, freq: prog.freq,
                efeito: prog.efeito || 'neutro', sessionId: sess.id,
                date: sess.timestamp, grupo: nomeGrupo
              };
              
              const existing = map.get(key);
              if (!existing) {
                map.set(key, newItem);
              } else {
                if (newItem.date > existing.date) {
                  map.set(key, newItem);
                } else if (newItem.date === existing.date) {
                  if (newItem.grupo < existing.grupo) {
                    map.set(key, newItem);
                  }
                }
              }
            }
          });
        });
      });
    });
    return Array.from(map.values());
  }, [sessions, considerarAmplitude]);

  // Acumula todos os marcadores clínicos de todas as sessões ativas (igual ao historicoReal)
  const marcadoresHistoricos = useMemo(() => {
    const todos = { L: [], R: [] };
    sessions.filter(s => s.type === 'active').forEach(sess => {
      ['L', 'R'].forEach(lado => {
        const chave = lado === 'L' ? 'marcadoresClinicosL' : 'marcadoresClinicosR';
        (sess[chave] || []).forEach(m => {
          todos[lado].push({ ...m, sessionId: sess.id, sessionTimestamp: sess.timestamp });
        });
      });
    });
    return todos;
  }, [sessions]);

  const gerarTextoProntuario = (grupos, eletrodo) => {
    let text = '';
    const ordem = ORDEM_TEXTO_BAIXO_CIMA[eletrodo];
    
    ['A', 'B', 'C', 'D'].forEach(g => {
      text += `Grupo ${g}:\n`;
      ['L', 'R'].forEach(lado => {
        const progs = grupos[g][lado];
        progs.forEach((prog, idx) => {
          const leadStr = lado === 'L' ? 'E' : 'D';
          const leadName = progs.length > 1 ? `Lead ${leadStr}${idx + 1}` : `Lead ${leadStr}`;
          
          const contactStr = ordem.map(c => {
            const st = prog.contatos[c].state;
            if (st === 'off') return '0';
            const perc = prog.contatos[c].perc;
            if (perc < 100) return `${st}(${perc}%)`;
            return st;
          }).join('');
          if ((prog.amp || 0) > 0) {
            text += `${leadName} ${contactStr} ${prog.amp.toFixed(1)} mA ${prog.pw} µs ${prog.freq} Hz\n`;
          }
        });
      });
      text += '\n';
    });
    return text.trim();
  };

  useEffect(() => {
    setTextoProntuario(gerarTextoProntuario(dadosGrupos, tipoEletrodo));
  }, [dadosGrupos, tipoEletrodo]);

  const copiarConsultaClipboard = () => {
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const programacaoTexto = gerarTextoProntuario(dadosGrupos, tipoEletrodo);
    const cyclingStr = [cyclingL ? 'Esquerdo' : '', cyclingR ? 'Direito' : ''].filter(Boolean).join(', ') || 'Não';
    const texto = [
      '=== SESSÃO DE PROGRAMAÇÃO ONLINE ===',
      `Data: ${hoje}`,
      `Paciente: ${activePatient?.nome || ''}`,
      `Registro HC: ${activePatient?.hc || ''}`,
      '',
      '--- EVOLUÇÃO ---',
      notasLivres || '(sem anotações)',
      '',
      '--- PROGRAMAÇÃO ATUAL ---',
      voltagemBateria ? `Voltagem da bateria: ${voltagemBateria} V` : '',
      impedanciaL ? `Impedância Esquerdo: ${impedanciaL}` : '',
      impedanciaR ? `Impedância Direito: ${impedanciaR}` : '',
      `Cycling: ${cyclingStr}`,
      '',
      programacaoTexto,
    ].filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();

    const copiar = (txt) => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(txt);
      }
      // Fallback para contextos não-HTTPS
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok ? Promise.resolve() : Promise.reject();
    };
    copiar(texto).then(() => {
      showToast('Consulta copiada para o clipboard!');
    }).catch(() => {
      showToast('Erro ao acessar clipboard.');
    });
  };

  const aplicarProntuario = () => {
    let currentGroup = null;
    const novosGrupos = JSON.parse(JSON.stringify(dadosGrupos));
    const linhas = textoProntuario.split('\n');
    let applied = false;
    const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEletrodo];

    for (let linha of linhas) {
      linha = linha.trim();
      if (!linha) continue;

      const matchGrupo = linha.match(/Grupo\s+([A-D])/i);
      if (matchGrupo) {
        currentGroup = matchGrupo[1].toUpperCase();
        novosGrupos[currentGroup] = { L: [], R: [] }; 
        continue;
      }

      if (currentGroup) {
        const matchLead = linha.match(/Lead\s+(E|D)(\d+)?\s+(\S+)\s+([\d\.\,]+)\s*(V|mA)\s+(\d+)\s*(µs|us)\s+(\d+)\s*Hz/i);
        if (matchLead) {
          const lado = matchLead[1].toUpperCase() === 'E' ? 'L' : 'R';
          const contatosStr = matchLead[3];
          const ampStr = matchLead[4].replace(',', '.'); 
          const amp = parseFloat(ampStr);
          const pw = parseInt(matchLead[6], 10);
          const freq = parseInt(matchLead[8], 10);

          const novosContatos = getContatosIniciais(tipoEletrodo);
          const tokens = [...contatosStr.matchAll(/(0|\+|-)(?:\((\d+)%\))?/g)];
          
          if (tokens.length === ordem.length) {
            for(let i=0; i<tokens.length; i++) {
              const stateChar = tokens[i][1];
              const percValue = tokens[i][2];
              const cKey = ordem[i];

              if (stateChar === '-' || stateChar === '+') {
                novosContatos[cKey].state = stateChar;
                novosContatos[cKey].perc = percValue ? parseInt(percValue, 10) : 100;
              }
            }
          }

          novosGrupos[currentGroup][lado].push({
            contatos: novosContatos, amp, pw, freq, efeito: 'neutro'
          });
          applied = true;
        }
      }
    }

    ['A','B','C','D'].forEach(g => {
      if (novosGrupos[g].L.length === 0) novosGrupos[g].L.push(criarProgramaInicial(tipoEletrodo));
      if (novosGrupos[g].R.length === 0) novosGrupos[g].R.push(criarProgramaInicial(tipoEletrodo));
    });

    if (applied) {
      setDadosGrupos(novosGrupos);
      showToast("Programação importada do texto!");
    } else {
      showToast("Nenhum formato válido encontrado.");
    }
  };

  const handleCreatePatient = async (nome, hc) => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'patients'), {
        nome, hc, createdAt: Date.now()
      });
      setActivePatient({ id: docRef.id, nome, hc });
      showToast("Paciente cadastrado!");
    } catch(err) {
      console.error(err);
      showToast("Erro ao cadastrar paciente.");
    }
  };

  const handleImportFullCSV = async (file) => {
    if (!user || !file) return 'Erro: usuário não autenticado.';
    try {
      const text = await file.text();
      const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const linhas = clean.split('\n').map(l => l.trim()).filter(Boolean);
      if (linhas.length < 2) return 'Arquivo inválido ou vazio.';

      const primeiraLinha = linhas[0];
      const nVirgulas = (primeiraLinha.match(/,/g) || []).length;
      const nPontoVirgulas = (primeiraLinha.match(/;/g) || []).length;
      const sep = nPontoVirgulas > nVirgulas ? ';' : ',';
      const parseLine = (linha) => {
        const res = []; let cur = ''; let inQ = false;
        for (const c of linha) {
          if (c === '"') { inQ = !inQ; }
          else if (c === sep && !inQ) { res.push(cur.trim()); cur = ''; }
          else { cur += c; }
        }
        res.push(cur.trim()); return res;
      };

      const cabecalho = parseLine(primeiraLinha);
      const get = (cols, nome) => { const idx = cabecalho.indexOf(nome); return idx >= 0 ? cols[idx] || '' : ''; };
      const getH = (cols, nome) => { const idx = cabecalho.map(h => h.toLowerCase().replace(/[^a-z]/g, '')).findIndex(h => h.includes(nome)); return idx >= 0 ? cols[idx] || '' : ''; };

      const temColunasSessao = cabecalho.some(c => c.includes('Eletrodo') || c.includes('GrupoA'));

      // Agrupar linhas por HC para evitar criar o mesmo paciente múltiplas vezes
      const pacientesPorHc = {}; // hc -> { nome, linhasIdx[] }
      for (let i = 1; i < linhas.length; i++) {
        const cols = parseLine(linhas[i]);
        const nome = getH(cols, 'nome');
        const hc = getH(cols, 'hc') || getH(cols, 'registro');
        if (!nome || !hc) continue;
        if (!pacientesPorHc[hc]) pacientesPorHc[hc] = { nome, linhasIdx: [] };
        pacientesPorHc[hc].linhasIdx.push(i);
      }

      const hcsUnicos = Object.keys(pacientesPorHc);
      if (hcsUnicos.length === 0) return 'Nenhum paciente válido encontrado. CSV precisa ter colunas "Nome" e "HC".';

      let pacientesCriados = 0;
      let sessoesImportadas = 0;

      for (const hc of hcsUnicos) {
        const { nome, linhasIdx } = pacientesPorHc[hc];

        // Verificar se paciente já existe pelo HC
        let pacienteId = patients.find(p => (p.hc || '').trim() === hc.trim())?.id;

        if (!pacienteId) {
          // Criar paciente novo
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'patients'), {
            nome, hc, createdAt: Date.now()
          });
          pacienteId = docRef.id;
          pacientesCriados++;
        }

        // Importar sessões se o CSV tiver colunas de sessão
        if (temColunasSessao) {
          for (const i of linhasIdx) {
            const cols = parseLine(linhas[i]);
            const tipoEl = get(cols, 'Eletrodo') || '4-ring';
            const gruposKeys = ['A', 'B', 'C', 'D'];
            const dadosGruposImp = {};
            gruposKeys.forEach(g => {
              dadosGruposImp[g] = { L: [], R: [] };
              [['L','E'], ['R','D']].forEach(([l, ladoNome]) => {
                const contStr = get(cols, `Grupo${g}_Lead${ladoNome}_Contatos`);
                const amp = parseFloat(get(cols, `Grupo${g}_Lead${ladoNome}_Amp(mA)`)) || 0;
                const pw = parseInt(get(cols, `Grupo${g}_Lead${ladoNome}_PW(us)`)) || 60;
                const freq = parseInt(get(cols, `Grupo${g}_Lead${ladoNome}_Freq(Hz)`)) || 130;
                const efeito = get(cols, `Grupo${g}_Lead${ladoNome}_Efeito`) || 'neutro';
                const contatos = getContatosIniciais(tipoEl);
                const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEl];
                if (contStr) {
                  const tokens = [...contStr.matchAll(/(0|\+|-)(?:\((\d+)%\))?/g)];
                  if (tokens.length === ordem.length) {
                    for (let ti = 0; ti < tokens.length; ti++) {
                      const st = tokens[ti][1]; const perc = tokens[ti][2];
                      if (st === '-' || st === '+') {
                        contatos[ordem[ti]].state = st;
                        contatos[ordem[ti]].perc = perc ? parseInt(perc) : 100;
                      }
                    }
                  }
                }
                dadosGruposImp[g][l].push({ contatos, amp, pw, freq, efeito });
              });
            });
            const ecLStr = get(cols, 'EfeitosColateraisE');
            const ecRStr = get(cols, 'EfeitosColateraisD');
            try {
              await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), {
                patientId: pacienteId,
                timestamp: (() => {
                    const dataStr = get(cols, 'Data');
                    if (dataStr) {
                      const m = dataStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
                      if (m) {
                        const [, d, mo, y] = m;
                        const ano = y.length === 2 ? '20' + y : y;
                        const parsed = new Date(`${ano}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`).getTime();
                        if (!isNaN(parsed)) return parsed;
                      }
                    }
                    return Date.now() - (linhasIdx.length - linhasIdx.indexOf(i)) * 1000;
                  })(),
                type: 'active',
                tipoEletrodo: tipoEl,
                dadosGrupos: dadosGruposImp,
                clinica: { tremor: 0, rigidez: 0, bradicinesia: 0 },
                efeitosColaterais: { L: ecLStr ? ecLStr.split(';').filter(Boolean) : [], R: ecRStr ? ecRStr.split(';').filter(Boolean) : [] },
                notasLivres: get(cols, 'NotasLivres'),
                resumoSessao: get(cols, 'Resumo'),
                voltagemBateria: get(cols, 'Bateria(V)'),
                impedanciaL: get(cols, 'ImpedanciaE'),
                impedanciaR: get(cols, 'ImpedanciaD'),
                cyclingL: get(cols, 'CyclingE') === 'Sim',
                cyclingR: get(cols, 'CyclingD') === 'Sim',
                marcadoresClinicosL: [], marcadoresClinicosR: []
              });
              sessoesImportadas++;
            } catch(e) { console.error(e); }
          }
        }
      }

      const msg = temColunasSessao
        ? `${pacientesCriados} paciente(s) criado(s), ${sessoesImportadas} sessão(ões) importada(s).`
        : `${pacientesCriados} paciente(s) importado(s).`;
      return msg;
    } catch(err) {
      console.error(err);
      return 'Erro ao importar CSV.';
    }
  };

  const handleDeletePatient = async (paciente) => {
    if (!user || !paciente) return;
    try {
      // 1. Buscar todas as sessões do paciente
      const sessSnap = await new Promise(resolve => {
        const unsub = onSnapshot(
          collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'),
          snap => { unsub(); resolve(snap); }
        );
      });
      const sessDoPaciente = sessSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.patientId === paciente.id && s.type === 'active');

      // 2. Gerar CSV de backup das sessões
      if (sessDoPaciente.length > 0) {
        const gruposKeys = ['A', 'B', 'C', 'D'];
        const cabecalho = [
          'Nome', 'HC',
          'Data', 'Resumo', 'Eletrodo', 'Bateria(V)',
          'ImpedanciaE', 'ImpedanciaD', 'CyclingE', 'CyclingD',
          ...gruposKeys.flatMap(g => [['L','E'],['R','D']].flatMap(([l, ln]) => [
            `Grupo${g}_Lead${ln}_Contatos`, `Grupo${g}_Lead${ln}_Amp(mA)`,
            `Grupo${g}_Lead${ln}_PW(us)`, `Grupo${g}_Lead${ln}_Freq(Hz)`,
            `Grupo${g}_Lead${ln}_Efeito`
          ])),
          'EfeitosColateraisE', 'EfeitosColateraisD', 'NotasLivres'
        ];
        const linhas = sessDoPaciente.map(s => {
          const row = [
            paciente.nome || '',
            paciente.hc || '',
            formatarData(s.timestamp),
            (s.resumoSessao || '').replace(/[\n,]/g, ' '),
            s.tipoEletrodo || '', s.voltagemBateria || '',
            s.impedanciaL || '', s.impedanciaR || '',
            s.cyclingL ? 'Sim' : 'Não', s.cyclingR ? 'Sim' : 'Não'
          ];
          gruposKeys.forEach(g => {
            [['L','E'],['R','D']].forEach(([l]) => {
              const prog = s.dadosGrupos?.[g]?.[l]?.[0];
              if (prog) {
                const ordem = ORDEM_TEXTO_BAIXO_CIMA[s.tipoEletrodo || '4-ring'];
                const contStr = ordem.map(c => {
                  const st = prog.contatos?.[c]?.state || 'off';
                  if (st === 'off') return '0';
                  const perc = prog.contatos?.[c]?.perc;
                  return perc && perc < 100 ? `${st}(${perc}%)` : st;
                }).join('');
                row.push(contStr, prog.amp ?? '', prog.pw ?? '', prog.freq ?? '', prog.efeito || '');
              } else { row.push('', '', '', '', ''); }
            });
          });
          const ec = s.efeitosColaterais;
          row.push(
            Array.isArray(ec) ? ec.join(';') : (ec?.L || []).join(';'),
            Array.isArray(ec) ? '' : (ec?.R || []).join(';'),
            (s.notasLivres || '').replace(/[\n,]/g, ' ')
          );
          return row;
        });
        const csvContent = [cabecalho, ...linhas]
          .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
          .join('\n');
        const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DBS_BACKUP_${paciente.nome || 'paciente'}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // 3. Apagar todas as sessões do paciente
      const todasSessoesSnap = sessSnap.docs.filter(d => d.data().patientId === paciente.id);
      await Promise.all(todasSessoesSnap.map(d =>
        deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', d.id))
      ));

      // 4. Apagar fotos do paciente
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'patient_photos', paciente.id)).catch(() => {});

      // 5. Apagar sessão temporária
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'temp_sessions', paciente.id)).catch(() => {});

      // 6. Apagar o paciente
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'patients', paciente.id));

      showToast(`Paciente "${paciente.nome}" apagado.`);
    } catch(err) {
      console.error(err);
      showToast('Erro ao apagar paciente.');
    }
  };

  const handleSalvarSessao = async (modoAtualizar = false) => {
    if (!user || !activePatient) return;
    
    const sessionData = {
      patientId: activePatient.id, 
      timestamp: modoAtualizar && editingSessionId ? (sessions.find(s => s.id === editingSessionId)?.timestamp || Date.now()) : Date.now(),
      type: 'active',
      tipoEletrodo, dadosGrupos, clinica, efeitosColaterais, notasLivres, resumoSessao,
      voltagemBateria, impedanciaL, impedanciaR, cyclingL, cyclingR,
      marcadoresClinicosL, marcadoresClinicosR
    };

    try {
      if (editingSessionId) {
        const oldDoc = sessions.find(s => s.id === editingSessionId);
        if (oldDoc) {
          const { id, ...docWithoutId } = oldDoc;
          const idadeMs = Date.now() - (oldDoc.timestamp || 0);
          const maisde24h = idadeMs > 24 * 60 * 60 * 1000;
          // Só cria backup se a sessão tem mais de 1 dia — edições recentes são tratadas como correção
          if (maisde24h) {
            const backupData = {
              ...docWithoutId,
              type: modoAtualizar ? 'deleted' : 'inactive_backup',
              originalId: editingSessionId,
              backupTimestamp: Date.now()
            };
            if (modoAtualizar) {
              backupData.deletedAt = Date.now();
              backupData.sobreescrita = true;
            }
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), backupData);
          }
        }
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', editingSessionId), sessionData);
        showToast(modoAtualizar ? "Sessão atualizada!" : "Sessão atualizada com sucesso!");
      } else {
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), sessionData);
        if (!modoAtualizar) setEditingSessionId(null);
        showToast("Nova sessão registrada!");
      }
      
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'temp_sessions', activePatient.id)).catch(() => {});
      if (!modoAtualizar) setEditingSessionId(null);
    } catch(err) {
      console.error(err);
      showToast("Erro ao salvar sessão.");
    }
  };

  const handleExcluirSessao = async () => {
    if (!user || !confirmDialog.sessionId) return;
    try {
      if (confirmDialog.mode === 'hard') {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', confirmDialog.sessionId));
        showToast("Sessão excluída permanentemente.");
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', confirmDialog.sessionId), {
          type: 'deleted',
          deletedAt: Date.now()
        });
        showToast("Sessão movida para a lixeira.");
      }
      
      if (editingSessionId === confirmDialog.sessionId) setEditingSessionId(null);
      setConfirmDialog({ isOpen: false, sessionId: null, mode: 'soft' });
    } catch (err) {
      console.error(err);
      showToast("Erro ao processar exclusão.");
    }
  };

  const loadSession = (sess) => {
    setTipoEletrodo(sess.tipoEletrodo || '4-ring');
    setDadosGrupos(sess.dadosGrupos);
    setClinica(sess.clinica || { tremor: 0, rigidez: 0, bradicinesia: 0 });
    setEfeitosColaterais(sess.efeitosColaterais || { L: [], R: [] });
    setNotasLivres(sess.notasLivres || "");
    setResumoSessao(sess.resumoSessao || "");
    setVoltagemBateria(sess.voltagemBateria || "");
    setImpedanciaL(sess.impedanciaL || "");
    setImpedanciaR(sess.impedanciaR || "");
    setCyclingL(sess.cyclingL || false);
    setCyclingR(sess.cyclingR || false);
    setMarcadoresClinicosL(sess.marcadoresClinicosL || []);
    setMarcadoresClinicosR(sess.marcadoresClinicosR || []);
    setEditingSessionId(sess.type === 'active' ? sess.id : null); 
    setIsPanelOpen(false);
    showToast(sess.type === 'active' ? "Sessão carregada para edição" : "Visualizando sessão antiga");
  };

  const handleCopiarUltimaSessao = () => {
    const ultimaAtiva = sessions.find(s => s.type === 'active');
    if (ultimaAtiva) {
      setTipoEletrodo(ultimaAtiva.tipoEletrodo || '4-ring');
      setDadosGrupos(ultimaAtiva.dadosGrupos);
      setClinica(ultimaAtiva.clinica || { tremor: 0, rigidez: 0, bradicinesia: 0 });
      setEfeitosColaterais(ultimaAtiva.efeitosColaterais || { L: [], R: [] });
      setNotasLivres(ultimaAtiva.notasLivres || "");
      setResumoSessao(ultimaAtiva.resumoSessao || "");
      setVoltagemBateria(ultimaAtiva.voltagemBateria || "");
      setImpedanciaL(ultimaAtiva.impedanciaL || "");
      setImpedanciaR(ultimaAtiva.impedanciaR || "");
      setCyclingL(ultimaAtiva.cyclingL || false);
      setCyclingR(ultimaAtiva.cyclingR || false);
      setMarcadoresClinicosL(ultimaAtiva.marcadoresClinicosL || []);
      setMarcadoresClinicosR(ultimaAtiva.marcadoresClinicosR || []);
      setEditingSessionId(null); 
      showToast("Última sessão copiada com sucesso!");
    } else {
      showToast("Nenhuma sessão anterior encontrada.");
    }
  };
  const copiarParaGrupo = (alvo) => {
    if (!alvo || alvo === grupoAtivo) return;
    setDadosGrupos(prev => ({
      ...prev,
      [alvo]: {
        L: JSON.parse(JSON.stringify(prev[grupoAtivo].L)),
        R: JSON.parse(JSON.stringify(prev[grupoAtivo].R))
      }
    }));
    setGrupoAtivo(alvo); 
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // --- MARCADORES CLÍNICOS (Item 4) ---
  const adicionarMarcadorClinico = (lado, tipo, programaIdx) => {
    const progs = dadosGrupos[grupoAtivo][lado];
    const prog = progs[programaIdx];
    const config = getStringConfig(prog.contatos, !considerarAmplitude);
    const marcador = {
      id: Date.now() + Math.random(),
      tipo,
      config, amp: prog.amp, pw: prog.pw, freq: prog.freq,
      grupo: grupoAtivo, progIdx: programaIdx,
      timestamp: Date.now()
    };
    if (lado === 'L') setMarcadoresClinicosL(prev => [...prev, marcador]);
    else setMarcadoresClinicosR(prev => [...prev, marcador]);

    // Para efeitos colaterais: acrescentar texto na anotação
    const isColateral = !['tremor','rigidez','bradicinesia'].includes(tipo);
    if (isColateral) {
      const leadStr = lado === 'L' ? 'E' : 'D';
      // Gerar string de contatos
      const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEletrodo];
      const contactStr = ordem.map(c => {
        const st = prog.contatos[c]?.state || 'off';
        if (st === 'off') return '0';
        const perc = prog.contatos[c].perc;
        return perc < 100 ? `${st}(${perc}%)` : st;
      }).join('');
      const linha = `[Lead ${leadStr} ${contactStr} ${prog.amp.toFixed(1)} mA ${prog.pw} µs ${prog.freq} Hz — ${tipo}]`;
      setNotasLivres(prev => (prev ? prev + '\n' : '') + linha);
    }
  };

  const desfazerMarcadoresConfig = (lado, config) => {
    if (lado === 'L') setMarcadoresClinicosL(prev => prev.filter(m => m.config !== config));
    else setMarcadoresClinicosR(prev => prev.filter(m => m.config !== config));
  };

  // Grupos com ao menos uma sessão ativa registrada
  const gruposComSessao = useMemo(() => {
    const ativos = sessions.filter(s => s.type === 'active');
    if (ativos.length === 0) return [];
    const ultima = ativos[0]; // sessions já ordenadas por data desc
    return ['A','B','C','D'].filter(g => ultima.dadosGrupos?.[g]);
  }, [sessions]);

  const handleEfeitoGrupo = async (grupo, efeito, textoEfeito) => {
    if (!user || !activePatient) return;
    const ativos = sessions.filter(s => s.type === 'active');
    if (ativos.length === 0) return;
    const ultima = ativos[0];

    // Gerar texto da programação do grupo (E e D)
    const ordem = ORDEM_TEXTO_BAIXO_CIMA[ultima.tipoEletrodo || '4-ring'];
    let progTexto = '';
    ['L','R'].forEach(lado => {
      const leadStr = lado === 'L' ? 'E' : 'D';
      (ultima.dadosGrupos?.[grupo]?.[lado] || []).forEach((prog, idx) => {
        const progs = ultima.dadosGrupos[grupo][lado];
        const leadName = progs.length > 1 ? `Lead ${leadStr}${idx+1}` : `Lead ${leadStr}`;
        const contactStr = ordem.map(c => {
          const st = prog.contatos?.[c]?.state || 'off';
          if (st === 'off') return '0';
          const perc = prog.contatos[c].perc;
          return perc < 100 ? `${st}(${perc}%)` : st;
        }).join('');
        progTexto += `${leadName} ${contactStr} ${prog.amp?.toFixed(1)} mA ${prog.pw} µs ${prog.freq} Hz
`;
      });
    });

    // Salvar efeito em ambos os lados na última sessão
    const novosDadosGrupos = JSON.parse(JSON.stringify(ultima.dadosGrupos));
    ['L','R'].forEach(lado => {
      (novosDadosGrupos[grupo]?.[lado] || []).forEach(prog => { prog.efeito = efeito; });
    });
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', ultima.id), {
        dadosGrupos: novosDadosGrupos
      });
    } catch(e) { console.error('Erro ao salvar efeito:', e); }

    // Acrescentar texto na anotação
    const linhaTexto = `
--- Programação da última sessão ---
Grupo ${grupo}:
${progTexto}Avaliação: ${textoEfeito}
`;
    setNotasLivres(prev => (prev || '') + linhaTexto);
    showToast(`Efeito do Grupo ${grupo} salvo: ${textoEfeito}`);
  };

  // --- FOTOS DE RECONSTRUÇÃO (Item 9) ---
  const comprimirImagem = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 360;
        let w = img.width, h = img.height;
        if (w > h) { if (w > max) { h = Math.round(h * max / w); w = max; } }
        else { if (h > max) { w = Math.round(w * max / h); h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFotoRec = (lado, file) => {
    if (!file) return;
    comprimirImagem(file, (dataUrl) => {
      if (lado === 'L') setFotoRecL(dataUrl);
      else setFotoRecR(dataUrl);
    });
  };

  // Carregar fotos ao trocar paciente
  useEffect(() => {
    if (!user || !activePatient) return;
    const fetchFotos = async () => {
      try {
        const docFotos = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'patient_photos', activePatient.id));
        if (docFotos.exists()) {
          const d = docFotos.data();
          setFotoRecL(d.fotoL || null);
          setFotoRecR(d.fotoR || null);
        } else {
          setFotoRecL(null); setFotoRecR(null);
        }
      } catch(e) {}
    };
    fetchFotos();
  }, [user, activePatient]);

  const salvarFotos = async () => {
    if (!user || !activePatient) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'patient_photos', activePatient.id), {
        fotoL: fotoRecL || null, fotoR: fotoRecR || null, updatedAt: Date.now()
      });
      showToast("Fotos salvas!");
    } catch(e) { showToast("Erro ao salvar fotos."); }
  };

  // --- EXPORTAÇÃO / IMPORTAÇÃO (Item 11) ---
  const exportarHistoricoCSV = () => {
    const ativas = sessions.filter(s => s.type === 'active');
    if (ativas.length === 0) { showToast("Nenhuma sessão para exportar."); return; }

    const gruposKeys = ['A', 'B', 'C', 'D'];
    const lados = ['L', 'R'];

    const cabecalho = [
      'Nome', 'HC',
      'Data', 'Resumo', 'Eletrodo', 'Bateria(V)',
      'ImpedanciaE', 'ImpedanciaD', 'CyclingE', 'CyclingD',
      ...gruposKeys.flatMap(g => lados.flatMap(l => {
        const ladoNome = l === 'L' ? 'E' : 'D';
        return [
          `Grupo${g}_Lead${ladoNome}_Contatos`, `Grupo${g}_Lead${ladoNome}_Amp(mA)`,
          `Grupo${g}_Lead${ladoNome}_PW(us)`, `Grupo${g}_Lead${ladoNome}_Freq(Hz)`,
          `Grupo${g}_Lead${ladoNome}_Efeito`
        ];
      })),
      'EfeitosColateraisE', 'EfeitosColateraisD', 'NotasLivres'
    ];

    const linhas = ativas.map(s => {
      const row = [
        activePatient?.nome || '',
        activePatient?.hc || '',
        formatarData(s.timestamp),
        (s.resumoSessao || '').replace(/[\n,]/g, ' '),
        s.tipoEletrodo || '',
        s.voltagemBateria || '',
        s.impedanciaL || '', s.impedanciaR || '',
        s.cyclingL ? 'Sim' : 'Não', s.cyclingR ? 'Sim' : 'Não'
      ];
      gruposKeys.forEach(g => {
        lados.forEach(l => {
          const prog = (s.dadosGrupos?.[g]?.[l]?.[0]);
          if (prog) {
            const ordem = ORDEM_TEXTO_BAIXO_CIMA[s.tipoEletrodo || '4-ring'];
            const contStr = ordem.map(c => {
              const st = prog.contatos?.[c]?.state || 'off';
              if (st === 'off') return '0';
              const perc = prog.contatos?.[c]?.perc;
              return perc && perc < 100 ? `${st}(${perc}%)` : st;
            }).join('');
            row.push(contStr, prog.amp ?? '', prog.pw ?? '', prog.freq ?? '', prog.efeito || '');
          } else {
            row.push('', '', '', '', '');
          }
        });
      });
      const ec = s.efeitosColaterais;
      const ecL = Array.isArray(ec) ? ec.join(';') : (ec?.L || []).join(';');
      const ecR = Array.isArray(ec) ? '' : (ec?.R || []).join(';');
      row.push(ecL, ecR, (s.notasLivres || '').replace(/[\n,]/g, ' '));
      return row;
    });

    const csvContent = [cabecalho, ...linhas].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `DBS_${activePatient?.nome || 'paciente'}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Exportação concluída!");
  };

  const importarHistoricoCSV = async (file) => {
    if (!file || !user || !activePatient) return;
    const text = await file.text();
    const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const linhas = clean.split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length < 2) { showToast("Arquivo inválido."); return; }
    const primeiraLinha = linhas[0];
    const nVirgulas = (primeiraLinha.match(/,/g) || []).length;
    const nPontoVirgulas = (primeiraLinha.match(/;/g) || []).length;
    const sep = nPontoVirgulas > nVirgulas ? ';' : ',';
    const parseCsv = (linha) => {
      const res = []; let cur = ''; let inQ = false;
      for (let c of linha) {
        if (c === '"') { inQ = !inQ; }
        else if (c === sep && !inQ) { res.push(cur.trim()); cur = ''; }
        else { cur += c; }
      }
      res.push(cur.trim()); return res;
    };
    const cabeçalho = parseCsv(primeiraLinha);
    let importadas = 0;
    for (let i = 1; i < linhas.length; i++) {
      const cols = parseCsv(linhas[i]);
      const get = (nome) => { const idx = cabeçalho.indexOf(nome); return idx >= 0 ? cols[idx] || '' : ''; };
      const tipoEl = get('Eletrodo') || '4-ring';
      const gruposKeys = ['A', 'B', 'C', 'D'];
      const dadosGruposImp = {};
      gruposKeys.forEach(g => {
        dadosGruposImp[g] = { L: [], R: [] };
        [['L','E'], ['R','D']].forEach(([l, ladoNome]) => {
          const contStr = get(`Grupo${g}_Lead${ladoNome}_Contatos`);
          const amp = parseFloat(get(`Grupo${g}_Lead${ladoNome}_Amp(mA)`)) || 0;
          const pw = parseInt(get(`Grupo${g}_Lead${ladoNome}_PW(us)`)) || 60;
          const freq = parseInt(get(`Grupo${g}_Lead${ladoNome}_Freq(Hz)`)) || 130;
          const efeito = get(`Grupo${g}_Lead${ladoNome}_Efeito`) || 'neutro';
          const contatos = getContatosIniciais(tipoEl);
          const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEl];
          if (contStr) {
            const tokens = [...contStr.matchAll(/(0|\+|-)(?:\((\d+)%\))?/g)];
            if (tokens.length === ordem.length) {
              for (let ti = 0; ti < tokens.length; ti++) {
                const st = tokens[ti][1]; const perc = tokens[ti][2];
                if (st === '-' || st === '+') {
                  contatos[ordem[ti]].state = st;
                  contatos[ordem[ti]].perc = perc ? parseInt(perc) : 100;
                }
              }
            }
          }
          dadosGruposImp[g][l].push({ contatos, amp, pw, freq, efeito });
        });
      });
      const ecLStr = get('EfeitosColateraisE');
      const ecRStr = get('EfeitosColateraisD');
      try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), {
          patientId: activePatient.id,
          timestamp: (() => {
              const dataStr = get(cols, 'Data');
              if (dataStr) {
                const m = dataStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
                if (m) {
                  const [, d, mo, y] = m;
                  const ano = y.length === 2 ? '20' + y : y;
                  const parsed = new Date(`${ano}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`).getTime();
                  if (!isNaN(parsed)) return parsed;
                }
              }
              return Date.now() - (linhasIdx.length - linhasIdx.indexOf(i)) * 1000;
            })(),
          type: 'active',
          tipoEletrodo: tipoEl,
          dadosGrupos: dadosGruposImp,
          clinica: { tremor: 0, rigidez: 0, bradicinesia: 0 },
          efeitosColaterais: { L: ecLStr ? ecLStr.split(';').filter(Boolean) : [], R: ecRStr ? ecRStr.split(';').filter(Boolean) : [] },
          notasLivres: get('NotasLivres'),
          resumoSessao: get('Resumo'),
          voltagemBateria: get('Bateria(V)'),
          impedanciaL: get('ImpedanciaE'),
          impedanciaR: get('ImpedanciaD'),
          cyclingL: get('CyclingE') === 'Sim',
          cyclingR: get('CyclingD') === 'Sim',
          marcadoresClinicosL: [], marcadoresClinicosR: []
        });
        importadas++;
      } catch(e) { console.error(e); }
    }
    showToast(`${importadas} sessões importadas!`);
  };

  const handleMudarTipoEletrodo = (e) => {
    const novoTipo = e.target.value;
    setTipoEletrodo(novoTipo);
    const reset = {};
    ['A', 'B', 'C', 'D'].forEach(g => { reset[g] = { L: [criarProgramaInicial(novoTipo)], R: [criarProgramaInicial(novoTipo)] }; });
    setDadosGrupos(reset);
  };

  const setProgsAtual = (lado, novoValorOuFuncao) => {
    setDadosGrupos(prev => {
      const novo = { ...prev };
      novo[grupoAtivo] = { 
        ...novo[grupoAtivo], 
        [lado]: typeof novoValorOuFuncao === 'function' ? novoValorOuFuncao(novo[grupoAtivo][lado]) : novoValorOuFuncao 
      };
      return novo;
    });
  };

  const atualizarPrograma = (lado, index, campo, valor) => {
    setProgsAtual(lado, prev => {
      const novo = [...prev];
      novo[index] = { ...novo[index], [campo]: valor };
      return novo;
    });
  };

  const atualizarContatoState = (lado, index, chaveContato, novoEstado) => {
    setProgsAtual(lado, prev => {
      const novo = [...prev];
      novo[index].contatos = { ...novo[index].contatos, [chaveContato]: { state: novoEstado, perc: novoEstado === 'off' ? 100 : novo[index].contatos[chaveContato].perc } };
      return novo;
    });
  };

  const atualizarContatoPerc = (lado, index, chaveContato, novaPerc) => {
    setProgsAtual(lado, prev => {
      const novo = [...prev];
      novo[index].contatos = { ...novo[index].contatos, [chaveContato]: { ...novo[index].contatos[chaveContato], perc: novaPerc } };
      return novo;
    });
  };

  const toggleInterleaving = (lado) => {
    setProgsAtual(lado, prev => prev.length > 1 ? [prev[0]] : [...prev, criarProgramaInicial(tipoEletrodo)]);
  };

  // --- RENDER ---
  if (isInitializing) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center font-bold text-slate-300">Conectando ao HCFMUSP...</div>;
  }

  if (user && !activePatient) {
    return (
      <>
        {showLoginModal && <LoginModal onLoginSuccess={() => setShowLoginModal(false)} />}
        <PatientSelector patients={patients} onSelectPatient={setActivePatient} onCreatePatient={handleCreatePatient} onDeletePatient={handleDeletePatient} onImportFullCSV={handleImportFullCSV} />
        <button onClick={handleLogout} className="fixed bottom-4 right-4 text-xs font-bold text-slate-400 hover:text-rose-500 bg-white px-3 py-1.5 rounded shadow-sm">
          Sair da Conta
        </button>
      </>
    );
  }

  const programasL = dadosGrupos[grupoAtivo].L;
  const programasR = dadosGrupos[grupoAtivo].R;
  const displayedSessions = sessions.filter(s => showDeletedSessions ? true : (s.type !== 'deleted' && s.type !== 'inactive_backup'));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 relative">
      
      {showLoginModal && <LoginModal onLoginSuccess={() => setShowLoginModal(false)} />}

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen} 
        title={confirmDialog.mode === 'hard' ? 'Excluir Definitivamente?' : 'Excluir Sessão?'} 
        message={confirmDialog.mode === 'hard' ? 'Esta ação apagará a sessão permanentemente do banco de dados e não pode ser desfeita. Tem certeza?' : 'A sessão não será deletada do banco para manter o histórico médico, mas será ocultada da linha do tempo principal. Tem certeza?'}
        confirmText={confirmDialog.mode === 'hard' ? 'Sim, Apagar' : 'Sim, Excluir'}
        confirmColor={confirmDialog.mode === 'hard' ? 'bg-red-700 hover:bg-red-800' : 'bg-rose-600 hover:bg-rose-700'}
        onConfirm={handleExcluirSessao} 
        onCancel={() => setConfirmDialog({ isOpen: false, sessionId: null, mode: 'soft' })}
      />
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-md overflow-x-auto flex-nowrap z-40">
        <div className="flex-shrink-0 flex items-center mr-4 space-x-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-wide flex items-center leading-tight">
              DBS LOG <span className="ml-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-emerald-400"></span>
            </h1>
            <div className="text-[9px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{activePatient?.nome || 'Paciente Sem Nome'}</span>
              <span className="bg-slate-800 px-1.5 py-0.5 rounded">HC: {activePatient?.hc || 'N/A'}</span>
              <button onClick={() => setActivePatient(null)} className="text-indigo-400 hover:text-indigo-300 underline ml-1">Trocar Paciente</button>
            </div>
          </div>
          <button 
            onClick={() => setIsPanelOpen(true)}
            className="flex items-center text-xs font-bold bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
          >
            Histórico de Sessões
          </button>
        </div>
        
        <div className="flex items-center space-x-3 flex-shrink-0">
          
          <button
             onClick={handleCopiarUltimaSessao}
             disabled={!sessions.some(s => s.type === 'active')}
             className="px-3 py-1.5 rounded text-[10px] font-bold text-slate-900 bg-slate-200 hover:bg-slate-300 disabled:opacity-30 transition-colors shadow-sm hidden sm:flex items-center uppercase"
          >
             Copiar Anterior
          </button>

          <div className="flex items-center bg-indigo-900 rounded px-2 py-1.5 border border-indigo-700">
            <span className="text-[10px] uppercase tracking-wider text-indigo-300 mr-2">Grupo:</span>
            <select value={grupoAtivo} onChange={(e) => setGrupoAtivo(e.target.value)} className="bg-white text-slate-900 font-bold text-sm focus:outline-none cursor-pointer rounded px-1 py-0.5">
              {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="flex items-center bg-slate-800 rounded px-2 py-1.5 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-2 hidden lg:inline">Copiar p/:</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1 lg:hidden">Copiar:</span>
            <select value="" onChange={(e) => copiarParaGrupo(e.target.value)} className="bg-white text-slate-900 font-bold text-sm focus:outline-none cursor-pointer rounded px-1 py-0.5 w-12">
              <option value="">--</option>
              {['A', 'B', 'C', 'D'].filter(g => g !== grupoAtivo).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="flex items-center bg-slate-800 rounded px-2 py-1.5 hidden md:flex">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-2">Eletrodo:</span>
            <select value={tipoEletrodo} onChange={handleMudarTipoEletrodo} className="bg-white text-slate-900 font-bold text-sm focus:outline-none cursor-pointer rounded px-1 py-0.5">
              <option value="4-ring">4 Contatos</option>
              <option value="8-ring">8 Contatos</option>
              <option value="directional">Direcional</option>
            </select>
          </div>
          
          <button onClick={() => handleSalvarSessao(false)} className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white">
            Salvar Nova Sessão
          </button>
          {editingSessionId && (
            <button onClick={() => handleSalvarSessao(true)} className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white">
              Atualizar Sessão
            </button>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-800 rounded px-2 py-1.5 shrink-0" title="Se ativo, contatos com % diferentes são tratados como configurações distintas na timeline">
            <input type="checkbox" checked={considerarAmplitude} onChange={e => setConsiderarAmplitude(e.target.checked)} className="accent-indigo-400 w-3.5 h-3.5" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap">Div. Amplitude</span>
          </label>
          <button onClick={() => setShowMonopolar(true)} className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-violet-600 hover:bg-violet-700 text-white">
            🔬 Monopolar
          </button>
        </div>
      </header>

      {/* AVISOS E MODO DE EDIÇÃO */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-2 rounded-full shadow-xl font-bold text-sm animate-bounce">
          {toastMessage}
        </div>
      )}

      {editingSessionId && (
        <div className="bg-amber-100 text-amber-800 px-4 py-1 flex items-center justify-between text-xs font-bold border-b border-amber-200">
          <span>Editando registro antigo (Salvar irá sobrescrever e criar backup da original)</span>
          <button onClick={() => setEditingSessionId(null)} className="underline text-amber-700 hover:text-amber-900">Sair do modo edição (Nova Sessão)</button>
        </div>
      )}

      <main className="p-4 w-full flex-1 flex flex-col gap-4 overflow-hidden">
        
        {/* PAINEL EFEITO DE GRUPO — acima dos eletrodos */}
        {gruposComSessao.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-b pb-1">
              Avaliação da Última Sessão — Efeito por Grupo
            </h3>
            <div className="flex flex-col gap-2">
              {gruposComSessao.map(grupo => (
                <div key={grupo} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-slate-700 w-12 shrink-0">Grupo {grupo}</span>
                  {[
                    ['bom',   'Melhor grupo',           'bg-emerald-500 hover:bg-emerald-600 text-white'],
                    ['neutro', 'Bom / Mantido',         'bg-blue-500 hover:bg-blue-600 text-white'],
                    ['pouco', 'Pouco efeito',            'bg-slate-400 hover:bg-slate-500 text-white'],
                    ['ruim',  'Col. - Marcha',           'bg-rose-400 hover:bg-rose-500 text-white'],
                    ['ruim',  'Col. - Fala',             'bg-rose-600 hover:bg-rose-700 text-white'],
                    ['ruim',  'Col. - Outro',            'bg-rose-800 hover:bg-rose-900 text-white'],
                  ].map(([efVal, label, cls]) => (
                    <button
                      key={label}
                      onClick={() => handleEfeitoGrupo(grupo, efVal, label)}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all shadow-sm ${cls}`}
                    >{label}</button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PARTE VISUAL - ELETRODOS */}
        <div className="flex overflow-x-auto gap-4 pb-2 items-stretch custom-scrollbar min-h-[500px]">
          
          {/* HEMISFÉRIO ESQUERDO */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col shrink-0">
            <div className="flex justify-between items-center mb-3 px-2 border-b pb-2">
              <h2 className="font-bold text-slate-700">Hemisfério Esquerdo</h2>
              <button onClick={() => toggleInterleaving('L')} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ml-4 ${programasL.length > 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {programasL.length > 1 ? 'Desativar Interleaving' : '+ Ativar Interleaving'}
              </button>
            </div>
            <div className="flex gap-4 flex-1">
              {programasL.map((prog, idx) => {
                const configStr = getStringConfig(prog.contatos, !considerarAmplitude);
                const hist = configStr ? historicoReal.filter(h => h.lado === 'L' && h.config === configStr) : [];
                const isMatch = historicoReal.some(h => h.lado === 'L' && h.config === configStr && h.amp === prog.amp && h.pw === prog.pw && h.freq === prog.freq);
                const marcadoresSessaoL = marcadoresClinicosL.filter(m => m.config === configStr);
                const marcadoresHistL = marcadoresHistoricos.L.filter(m => m.config === configStr && !marcadoresClinicosL.some(mc => mc.id === m.id));
                return (
                  <div key={`L-${idx}`} className="w-[340px] shrink-0">
                    <RenderPrograma 
                      lado="L" programa={prog} index={idx} isInterleaving={programasL.length > 1} tipoEletrodo={tipoEletrodo}
                      isMatchExato={isMatch} historicoRef={hist}
                      marcadores={[...marcadoresSessaoL, ...marcadoresHistL]}
                      onAdicionarMarcador={(tipo) => adicionarMarcadorClinico('L', tipo, idx)}
                      onDesfazerMarcadores={(cfg) => desfazerMarcadoresConfig('L', cfg)}
                      cycling={cyclingL}
                      onToggleCycling={() => setCyclingL(v => !v)}
                      impedancia={impedanciaL}
                      onImpedanciaChange={setImpedanciaL}
                      onUpdateProg={atualizarPrograma} onUpdateState={atualizarContatoState} onUpdatePerc={atualizarContatoPerc}
                      ignorarPerc={!considerarAmplitude}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* HEMISFÉRIO DIREITO */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col shrink-0">
            <div className="flex justify-between items-center mb-3 px-2 border-b pb-2">
              <h2 className="font-bold text-slate-700">Hemisfério Direito</h2>
              <button onClick={() => toggleInterleaving('R')} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ml-4 ${programasR.length > 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {programasR.length > 1 ? 'Desativar Interleaving' : '+ Ativar Interleaving'}
              </button>
            </div>
            <div className="flex gap-4 flex-1">
              {programasR.map((prog, idx) => {
                const configStr = getStringConfig(prog.contatos, !considerarAmplitude);
                const hist = configStr ? historicoReal.filter(h => h.lado === 'R' && h.config === configStr) : [];
                const isMatch = historicoReal.some(h => h.lado === 'R' && h.config === configStr && h.amp === prog.amp && h.pw === prog.pw && h.freq === prog.freq);
                const marcadoresSessaoR = marcadoresClinicosR.filter(m => m.config === configStr);
                const marcadoresHistR = marcadoresHistoricos.R.filter(m => m.config === configStr && !marcadoresClinicosR.some(mc => mc.id === m.id));
                return (
                  <div key={`R-${idx}`} className="w-[340px] shrink-0">
                    <RenderPrograma 
                      lado="R" programa={prog} index={idx} isInterleaving={programasR.length > 1} tipoEletrodo={tipoEletrodo}
                      isMatchExato={isMatch} historicoRef={hist}
                      marcadores={[...marcadoresSessaoR, ...marcadoresHistR]}
                      onAdicionarMarcador={(tipo) => adicionarMarcadorClinico('R', tipo, idx)}
                      onDesfazerMarcadores={(cfg) => desfazerMarcadoresConfig('R', cfg)}
                      cycling={cyclingR}
                      onToggleCycling={() => setCyclingR(v => !v)}
                      impedancia={impedanciaR}
                      onImpedanciaChange={setImpedanciaR}
                      onUpdateProg={atualizarPrograma} onUpdateState={atualizarContatoState} onUpdatePerc={atualizarContatoPerc}
                      ignorarPerc={!considerarAmplitude}
                    />
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ÁREA CLÍNICA E NOTAS */}
        <div className="flex flex-col gap-4 flex-none mt-2 mb-4">

          {/* Item 1: Resumo da sessão + notas + Item 7: voltagem */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
            <div className="flex flex-col gap-3 w-full md:w-1/4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wider border-b pb-1">Resumo da Sessão</h3>
                <input
                  type="text"
                  value={resumoSessao}
                  onChange={e => setResumoSessao(e.target.value)}
                  placeholder="Resumo breve (aparece no histórico)"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                />
              </div>
              {/* Item 7: Voltagem bateria */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Voltagem da Bateria</label>
                <input
                  type="text"
                  value={voltagemBateria}
                  onChange={e => setVoltagemBateria(e.target.value)}
                  placeholder="Ex: 2.74 V"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-700"
                />
              </div>
            </div>
            <div className="flex flex-col w-full md:w-3/4">
              <h3 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wider border-b pb-1">Anotação da Consulta</h3>
              <textarea 
                value={notasLivres} onChange={(e) => setNotasLivres(e.target.value)}
                placeholder="Cole ou registre aqui a evolução do paciente. Não é necessário descrever a programação."
                className="w-full min-h-[180px] p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y text-slate-700 leading-relaxed"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={copiarConsultaClipboard}
                  className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm"
                  title="Copia cabeçalho, evolução e programação atual para colar no prontuário"
                >
                  📋 Copiar Consulta
                </button>
              </div>
            </div>
          </div>

          {/* Item 9: Fotos de reconstrução por paciente */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Reconstrução do Eletrodo</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Imagens salvas por paciente. Serão redimensionadas para máx. 360×360 px.</p>
              </div>
              <button onClick={salvarFotos} className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm">Salvar Fotos</button>
            </div>
            <div className="flex gap-6 flex-wrap">
              {[['L', 'Hemisfério Esquerdo', fotoRecL, setFotoRecL], ['R', 'Hemisfério Direito', fotoRecR, setFotoRecR]].map(([lado, label, foto, setFoto]) => (
                <div key={lado} className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
                  {foto ? (
                    <div className="relative group">
                      <img src={foto} alt={label} className="w-40 h-40 object-cover rounded-lg border border-slate-200 shadow-sm" />
                      <button onClick={() => setFoto(null)} className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold">✕</button>
                    </div>
                  ) : (
                    <label className="w-40 h-40 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                      <span className="text-2xl text-slate-300">📷</span>
                      <span className="text-[10px] text-slate-400 mt-1">Anexar JPG</span>
                      <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => e.target.files?.[0] && handleFotoRec(lado, e.target.files[0])} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Item 11: Exportar / Importar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Exportar / Importar Histórico</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Arquivo CSV com todas as sessões ativas do paciente. Uma linha por sessão.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportarHistoricoCSV} className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm">⬇ Exportar CSV</button>
                <label className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm cursor-pointer">
                  ⬆ Importar CSV
                  <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && importarHistoricoCSV(e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* PRONTUÁRIO (TEXTO SIMPLES) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-none mb-4">
          <div className="flex justify-between items-center mb-3 border-b pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Integração com Prontuário</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Copie o texto para o seu prontuário ou cole um texto no mesmo formato para importar a programação.</p>
            </div>
            <button 
              onClick={aplicarProntuario} 
              className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <span>Ler Texto e Aplicar</span>
            </button>
          </div>
          <textarea
            value={textoProntuario}
            onChange={(e) => setTextoProntuario(e.target.value)}
            className="w-full h-48 p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-y text-slate-700 whitespace-pre"
            spellCheck="false"
          />
        </div>

      </main>

      {/* MODAL MONOPOLAR REVIEW */}
      {showMonopolar && (() => {
        const todosL = [...marcadoresHistoricos.L, ...marcadoresClinicosL];
        const todosR = [...marcadoresHistoricos.R, ...marcadoresClinicosR];
        const ehMonopolar = (config) => {
          if (!config) return false;
          const ativos = config.match(/[-+]/g) || [];
          return ativos.length === 1;
        };
        const configsMonoL = [...new Set(todosL.filter(m => ehMonopolar(m.config)).map(m => m.config))];
        const configsMonoR = [...new Set(todosR.filter(m => ehMonopolar(m.config)).map(m => m.config))];
        const todasConfigs = [...new Set([...configsMonoL, ...configsMonoR])].sort();

        const maxAmpL = Math.max(0, ...todosL.map(m => m.amp || 0));
        const maxAmpR = Math.max(0, ...todosR.map(m => m.amp || 0));
        const effectiveMax = Math.max(maxAmpL, maxAmpR, 4);

        const renderMiniTimeline = (marcadores, config, lado) => {
          const filtradosRaw = marcadores.filter(m => m.config === config);
          // Mesmo filtro de sobreposição: <0.2mA → manter só o mais recente/colateral
          const filtrados = filtradosRaw.filter((m, i) => {
            return !filtradosRaw.some((outro, j) => {
              if (i === j) return false;
              if (Math.abs((m.amp || 0) - (outro.amp || 0)) >= 0.2) return false;
              const mIsPos = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
              const outroIsPos = ['tremor','rigidez','bradicinesia'].includes(outro.tipo);
              const outroMaisRecente = (outro.timestamp || 0) > (m.timestamp || 0);
              const outroTemPrioridade = (outro.timestamp || 0) === (m.timestamp || 0) && mIsPos && !outroIsPos;
              return outroMaisRecente || outroTemPrioridade;
            });
          });
          if (filtrados.length === 0) return <div className="text-[10px] text-slate-300 italic px-2">sem dados</div>;
          const ticks = [];
          for (let v = 0; v <= effectiveMax; v += 0.5) ticks.push(v);
          return (
            <div className="relative h-8 w-full bg-slate-50 rounded border border-slate-100" style={{ minWidth: 120 }}>
              {ticks.map(t => (
                <div key={t} className="absolute top-0 bottom-0 border-l border-slate-200 opacity-40" style={{ left: `${(t / effectiveMax) * 100}%` }} />
              ))}
              {filtrados.map((m, mi) => {
                const isPos = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
                const info = MARCADOR_LETRAS[m.tipo] || { letra: '?', cor: isPos ? 'text-emerald-700' : 'text-rose-700' };
                const corFundo = isPos ? 'bg-emerald-100 border-emerald-300' : 'bg-rose-100 border-rose-300';
                const leftPct = Math.min(98, (m.amp / effectiveMax) * 100);
                const sameAmpIdx = filtrados.filter((mm, mmi) => mm.amp === m.amp && mmi < mi).length;
                const offsetX = sameAmpIdx * 8;
                return (
                  <div key={mi}
                    className={`absolute w-5 h-5 rounded-full border ${corFundo} flex items-center justify-center`}
                    style={{ left: `calc(${leftPct}% + ${offsetX}px)`, top: '50%', transform: 'translateY(-50%)' }}
                    title={`${lado ? lado : ''}${config.match(/^([^-+]+)/)?.[1] || ''} | ${m.tipo} | ${m.amp}mA | ${m.freq}Hz | PW:${m.pw}`}
                  >
                    <span className={`text-[9px] font-black ${info.cor}`}>{info.letra}</span>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowMonopolar(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b bg-violet-700 text-white rounded-t-2xl">
                <div>
                  <h2 className="font-bold text-sm">Monopolar Review</h2>
                  <p className="text-[10px] text-violet-200">Apenas configs com 1 contato ativo. Eixo X = amplitude (mA), max: {effectiveMax} mA</p>
                </div>
                <button onClick={() => setShowMonopolar(false)} className="text-white hover:text-violet-200 font-bold text-lg leading-none">x</button>
              </div>

              {todasConfigs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm p-8 text-center gap-1">
                  <span>Nenhum marcador monopolar registrado ainda.</span>
                  <span className="text-xs text-slate-300">Registre efeitos com apenas 1 contato ativo para visualizar aqui.</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid gap-3 mb-1 px-1" style={{ gridTemplateColumns: '80px 1fr 1fr' }}>
                    <div />
                    <div className="text-[10px] font-bold text-slate-500 uppercase text-center">Hemisfério Esquerdo</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase text-center">Hemisfério Direito</div>
                  </div>
                  <div className="grid gap-3 mb-3 px-1" style={{ gridTemplateColumns: '80px 1fr 1fr' }}>
                    <div />
                    {[0,1].map(si => (
                      <div key={si} className="relative h-4">
                        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
                          <span key={frac} className="absolute text-[8px] text-slate-400 -translate-x-1/2"
                            style={{ left: `${frac * 100}%` }}>{(effectiveMax * frac).toFixed(1)}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                  {todasConfigs.map(config => (
                    <div key={config} className="grid items-center mb-2 px-1 py-1.5 rounded-lg hover:bg-slate-50" style={{ gridTemplateColumns: '80px 1fr 1fr', gap: '12px' }}>
                      <div className="text-[10px] font-mono font-bold text-slate-600 text-right pr-2 border-r border-slate-200">
                        {(() => {
                          // Extrair contato ativo: ex "0-100" → "C0", "1A-100" → "C1A"
                          const m = config.match(/^([^-+]+)/);
                          return m ? `C${m[1]}` : config;
                        })()}
                      </div>
                      {renderMiniTimeline(todosL, config, 'L')}
                      {renderMiniTimeline(todosR, config, 'R')}
                    </div>
                  ))}
                  <div className="mt-4 pt-3 border-t flex flex-wrap gap-3">
                    {Object.entries(MARCADOR_LETRAS).map(([tipo, {letra, cor}]) => (
                      <div key={tipo} className="flex items-center gap-1">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${cor.includes('emerald') ? 'bg-emerald-100 border-emerald-300' : 'bg-rose-100 border-rose-300'}`}>
                          <span className={`text-[8px] font-black ${cor}`}>{letra}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 capitalize">{tipo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* PAINEL LATERAL DE SESSÕES */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                Sessões
              </h2>
              <div className="flex items-center gap-4">
                 <label className="text-[10px] flex items-center gap-1.5 cursor-pointer text-slate-600 font-bold bg-slate-200 px-2 py-1 rounded">
                   <input type="checkbox" checked={showDeletedSessions} onChange={e => setShowDeletedSessions(e.target.checked)} className="accent-rose-500" />
                   LIXEIRA
                 </label>
                 <button onClick={() => setIsPanelOpen(false)} className="text-slate-500 hover:text-slate-800 font-bold">✕</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {displayedSessions.length === 0 && (
                <p className="text-sm text-slate-500 text-center mt-10">Nenhuma sessão encontrada para este filtro.</p>
              )}
              {displayedSessions.map(sess => {
                const isActive = sess.type === 'active';
                const isDeleted = sess.type === 'deleted';
                const ageInMs = isDeleted && sess.timestamp ? (Date.now() - sess.timestamp) : 0;
                const isRecentDelete = isDeleted && (ageInMs < 2 * 24 * 60 * 60 * 1000); 
                
                return (
                  <div 
                    key={sess.id} 
                    className={`p-3 rounded-lg border transition-all ${
                      isActive 
                        ? (editingSessionId === sess.id ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-400 hover:shadow-sm bg-white') 
                        : isDeleted
                          ? 'border-rose-100 bg-rose-50/50 opacity-70 hover:opacity-100'
                          : 'border-slate-200 bg-slate-100 opacity-60 hover:opacity-100 grayscale hover:grayscale-0'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => loadSession(sess)}>
                        <span className={`text-sm font-bold ${isActive ? 'text-slate-800' : isDeleted ? 'text-rose-500 line-through' : 'text-slate-500'}`}>
                          {formatarData(sess.timestamp)} 
                        </span>
                        {!isActive && !isDeleted && <span className="text-[9px] text-slate-400 font-bold">(Backup)</span>}
                        {isDeleted && <span className="text-[9px] text-rose-400 font-bold">{sess.sobreescrita ? '(Sobreescrita)' : '(Excluída)'}</span>}
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {isActive && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Ativa</span>}
                        
                        {isActive && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, sessionId: sess.id, mode: 'soft' }); }}
                            className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                            title="Excluir Sessão"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <p className={`text-xs line-clamp-2 mt-2 italic cursor-pointer ${isDeleted ? 'text-rose-400/80' : 'text-slate-500'}`} onClick={() => loadSession(sess)}>
                      {sess.resumoSessao ? `"${sess.resumoSessao}"` : sess.notasLivres ? `"${sess.notasLivres.slice(0,80)}"` : "Sem resumo."}
                    </p>
                    


                    {isRecentDelete && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, sessionId: sess.id, mode: 'hard' }); }}
                        className="mt-3 w-full bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-bold py-1.5 rounded transition-colors"
                      >
                        Apagar Permanentemente
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="text-center py-4 text-[10px] font-bold text-slate-400 tracking-wider">
        Feito por Rafael Carra e Victor Maciel. Grupo de neuroengenharia HCFMUSP. Comentários e sugestões envie para rafael.carra@hc.fm.usp.br.
      </footer>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
}
