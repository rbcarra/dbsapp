import React, { useState, useMemo, useRef, useEffect } from 'react';
import { signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, onSnapshot, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';

import { ORDEM_TEXTO_BAIXO_CIMA, MARCADOR_LETRAS, EFEITO_OPTS, getEfeitoCor,
  opacidadeMarcador, getContatosIniciais, getStringConfig, formatarData,
  convertParsedGrupos, criarProgramaVazio } from './constants';
import { getDirLevel, dirUnitVector2D, calcAmpEfetiva, classifyStim } from './vectorHelpers';
import { BlocoColapsavel, LoginModal, PatientSelector, ConfirmDialog } from './PatientComponents';
import { RenderPrograma } from './ProgramComponents';
import { TimelineHistorico } from './DisplayComponents';
import { ExtractorModal } from './ExtractorComponents';
import { UPDRSModal } from './UPDRSComponents';
import { ScalesModal } from './ScalesComponents';
import { JSONImportModal } from './JSONImportModal';
import { ProgrammingEditor } from './ProgrammingEditor';
import { AIStatusLight, AISettingsModal, AudioRecorderButton } from './AIComponents';
import { getAIConfig, checkHealth, ollamaGenerate, transcribeAudio, buildOrganizePrompt } from './aiClient';
import { LEDCalculator, TEEDCalculator } from './CalculadorasTab';
import { ReceitasSection } from './ReceitasTab';

import { auth, db, appId } from './firebase';




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
  const [modoAmplitude, setModoAmplitude] = useState('mA'); // 'mA' | 'V'
  const criarProgramaInicial = (tipo = tipoEletrodo) => criarProgramaVazio(tipo);
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
  const [transcricaoBruta, setTranscricaoBruta] = useState("");
  const [transcricaoOrganizada, setTranscricaoOrganizada] = useState("");
  const [aiConfig, setAiConfig] = useState(getAIConfig);
  const [aiHealth, setAiHealth] = useState({ ollama: false, transcribe: false });
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiBusy, setAiBusy] = useState(false); // transcribing or organizing
  const listaEfeitos = ["Parestesia", "Cápsula", "Disartria", "Outros"];

  // ── AI health-check: single shared poll every 30s ──────────────────────────
  useEffect(() => {
    if (!aiConfig.enabled || !aiConfig.serverUrl) {
      setAiHealth({ ollama: false, transcribe: false });
      return;
    }
    let cancelled = false;
    const run = async () => {
      setAiChecking(true);
      const h = await checkHealth(aiConfig);
      if (!cancelled) { setAiHealth(h); setAiChecking(false); }
    };
    run();
    const iv = setInterval(run, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [aiConfig]);

  const aiLightStatus = (which) => {
    if (!aiConfig.enabled) return 'off';
    if (aiChecking) return 'checking';
    return aiHealth[which] ? 'ok' : 'off';
  };

  // ── Transcribe recorded audio ──────────────────────────────────────────────
  const handleAudioRecorded = async (blob) => {
    if (!aiConfig.serverUrl) { showToast('Configure a URL do servidor primeiro.'); return; }
    setAiBusy(true);
    showToast('Transcrevendo áudio…');
    try {
      const text = await transcribeAudio({ audioBlob: blob, config: aiConfig });
      setTranscricaoBruta(prev => prev ? prev + '\n' + text : text);
      showToast('Transcrição concluída.');
    } catch (e) {
      showToast('Erro na transcrição: ' + e.message);
    } finally {
      setAiBusy(false);
    }
  };

  // ── Organize raw transcription with LLM ────────────────────────────────────
  const handleOrganizeTranscription = async () => {
    if (!transcricaoBruta.trim()) { showToast('Nada para organizar.'); return; }
    if (!aiConfig.serverUrl) { showToast('Configure a URL do servidor primeiro.'); return; }
    setAiBusy(true);
    showToast('Organizando com IA…');
    try {
      const prompt = buildOrganizePrompt(transcricaoBruta, notasLivres);
      const result = await ollamaGenerate({ prompt, config: aiConfig });
      setTranscricaoOrganizada(result.trim());
      showToast('Organização concluída.');
    } catch (e) {
      showToast('Erro ao organizar: ' + e.message);
    } finally {
      setAiBusy(false);
    }
  };
  const [textoProntuario, setTextoProntuario] = useState("");
  const [voltagemBateria, setVoltagemBateria] = useState("");
  const [impedanciaL, setImpedanciaL] = useState("");
  const [impedanciaR, setImpedanciaR] = useState("");
  const [tendenciasEstimulacao, setTendenciasEstimulacao] = useState("");
  const [dispositivoInfo, setDispositivoInfo] = useState({
    fabricante: '', modeloIPG: '', modeloEletrodoE: '', modeloEletrodoD: '',
    alvoAnatomicoE: '', alvoAnatomicoD: '',
    dataImplante: '', dataTrocaIPG: '',
  });
  const [enderecoSalvo, setEnderecoSalvo] = useState("");
  const [prescricoesSalvas, setPrescricoesSalvas] = useState({});
  const [customDocs, setCustomDocs] = useState([]);
  const [activeTab, setActiveTab] = useState('programacao'); // 'programacao' | 'calculadoras'
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
  const [hiddenMonopolarSessions, setHiddenMonopolarSessions] = useState(new Set());
  const toggleMonopolarSession = (id) => setHiddenMonopolarSessions(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const [showExtrator, setShowExtrator] = useState(false);
  const [confirmNewSession, setConfirmNewSession] = useState(null); // null | 'copy' | 'empty'
  const [showHistoricoText, setShowHistoricoText] = useState(false);
  const [showUPDRS, setShowUPDRS] = useState(false);
  const [showScales, setShowScales] = useState(false);
  const [showJSONImport, setShowJSONImport] = useState(false);
  const [structuralMapL, setStructuralMapL] = useState(null);
  const [structuralMapR, setStructuralMapR] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  // Helper: cap programs to max 2 per side in any dadosGrupos object
  const capPrograms = (grupos) => {
    if (!grupos) return grupos;
    try {
      const safe = JSON.parse(JSON.stringify(grupos));
      Object.values(safe).forEach((grupo, gi) => {
        if (!grupo || typeof grupo !== 'object') {
          // Replace null/non-object group with empty valid structure
          const keys = Object.keys(safe);
          safe[keys[gi]] = { L: [], R: [] };
          return;
        }
        ['L','R'].forEach(lado => {
          if (!Array.isArray(grupo[lado])) { grupo[lado] = []; return; }
          if (grupo[lado].length > 2) grupo[lado] = grupo[lado].slice(0, 2);
        });
      });
      return safe;
    } catch(e) { console.error('capPrograms error:', e); return grupos; }
  };


  const [considerarAmplitude, setConsiderarAmplitude] = useState(false);
  const [blocosAbertos, setBlocosAbertos] = useState({
    progAnterior: true,
    transcricaoBruta: false,
    transcricaoOrganizada: false,
    progAtual: true,
    prontuario: true,
    reconstrucao: true,
    importExport: false,
  });
  const toggleBloco = (bloco) => setBlocosAbertos(prev => ({ ...prev, [bloco]: !prev[bloco] }));

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
      setModoAmplitude('mA');
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
      setEnderecoSalvo("");
      setPrescricoesSalvas({});
      setCustomDocs([]);
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
          if (d.modoAmplitude) setModoAmplitude(d.modoAmplitude);
          if (d.dadosGrupos) {
            const tipoEl = d.tipoEletrodo || '4-ring';
            setDadosGrupos(capPrograms(normalizeGrupos(d.dadosGrupos, tipoEl)) || d.dadosGrupos);
          }
          if (d.clinica) setClinica(d.clinica);
          if (d.efeitosColaterais) setEfeitosColaterais(d.efeitosColaterais);
          if (d.notasLivres !== undefined) setNotasLivres(d.notasLivres);
          if (d.resumoSessao !== undefined) setResumoSessao(d.resumoSessao);
          if (d.transcricaoBruta !== undefined) setTranscricaoBruta(d.transcricaoBruta);
          if (d.transcricaoOrganizada !== undefined) setTranscricaoOrganizada(d.transcricaoOrganizada);
          if (d.voltagemBateria !== undefined) setVoltagemBateria(d.voltagemBateria);
          if (d.impedanciaL !== undefined) setImpedanciaL(d.impedanciaL);
          if (d.impedanciaR !== undefined) setImpedanciaR(d.impedanciaR);
          if (d.marcadoresClinicosL) setMarcadoresClinicosL(d.marcadoresClinicosL);
          if (d.marcadoresClinicosR) setMarcadoresClinicosR(d.marcadoresClinicosR);
          if (d.tendenciasEstimulacao !== undefined) setTendenciasEstimulacao(d.tendenciasEstimulacao);
          if (d.dispositivoInfo) setDispositivoInfo(d.dispositivoInfo);
          if (d.enderecoSalvo !== undefined) setEnderecoSalvo(d.enderecoSalvo);
          if (d.prescricoesSalvas) setPrescricoesSalvas(d.prescricoesSalvas);
          if (d.customDocs) setCustomDocs(d.customDocs);
          if (d.editingSessionId) setEditingSessionId(d.editingSessionId);
        }
      } catch (err) {}
    };
    fetchTemp();
  }, [user, activePatient]);

  // Load structural map from Python mapper when active patient changes
  useEffect(() => {
    if (!user || !activePatient) {
      setStructuralMapL(null); setStructuralMapR(null); return;
    }
    const base = `artifacts/${appId}/users/${user.uid}/patients/${activePatient.id}/structural_map`;
    Promise.all([
      getDoc(doc(db, base, 'L')).catch(() => null),
      getDoc(doc(db, base, 'R')).catch(() => null),
    ]).then(([lDoc, rDoc]) => {
      setStructuralMapL(lDoc?.exists() ? lDoc.data() : null);
      setStructuralMapR(rDoc?.exists() ? rDoc.data() : null);
    }).catch(e => console.error('structural_map load error:', e));
  }, [user, activePatient]);


  useEffect(() => {
    if (!user || !activePatient || isInitializing || showLoginModal) return;
    const timer = setTimeout(() => {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'temp_sessions', activePatient.id), {
        tipoEletrodo, modoAmplitude, dispositivoInfo, dadosGrupos, clinica, efeitosColaterais, notasLivres, resumoSessao, transcricaoBruta, transcricaoOrganizada,
        voltagemBateria, impedanciaL, impedanciaR,
        marcadoresClinicosL, marcadoresClinicosR, tendenciasEstimulacao,
        enderecoSalvo, prescricoesSalvas, customDocs,
        editingSessionId: editingSessionId || null,
        timestamp: Date.now()
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [tipoEletrodo, dadosGrupos, clinica, efeitosColaterais, notasLivres, resumoSessao, transcricaoBruta, transcricaoOrganizada, voltagemBateria, impedanciaL, impedanciaR, marcadoresClinicosL, marcadoresClinicosR, editingSessionId, user, activePatient, isInitializing, showLoginModal]);

  const historicoReal = useMemo(() => {
    const map = new Map();
    sessions.filter(s => s.type === 'active' && s.id !== editingSessionId).forEach(sess => {
      try {
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
      } catch(e) { console.error('historicoReal error for session', sess?.id, e); }
    });
    return Array.from(map.values());
  }, [sessions, considerarAmplitude]);

  // Acumula todos os marcadores clínicos de todas as sessões ativas (igual ao historicoReal)
  const marcadoresHistoricos = useMemo(() => {
    const todos = { L: [], R: [] };
    sessions.filter(s => s.type === 'active' && s.id !== editingSessionId).forEach(sess => {
      try {
        ['L', 'R'].forEach(lado => {
          const chave = lado === 'L' ? 'marcadoresClinicosL' : 'marcadoresClinicosR';
          (sess[chave] || []).forEach(m => {
            todos[lado].push({ ...m, sessionId: sess.id, sessionTimestamp: sess.timestamp });
          });
        });
      } catch(e) { console.error('marcadoresHistoricos error', sess?.id, e); }
    });
    return todos;
  }, [sessions]);

  // ── AUTO-SAVE: debounced, only when editing existing session ──────────────
  const autoSaveTimerRef = React.useRef(null);
  React.useEffect(() => {
    if (!editingSessionId || !user || !activePatient || isInitializing) return;
    setAutoSaveStatus('saving');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const sessionData = {
          patientId: activePatient.id,
          timestamp: sessions.find(s => s.id === editingSessionId)?.timestamp || Date.now(),
          type: 'active',
          tipoEletrodo, modoAmplitude, dispositivoInfo, dadosGrupos, clinica, efeitosColaterais, notasLivres, resumoSessao, transcricaoBruta, transcricaoOrganizada,
          voltagemBateria, impedanciaL, impedanciaR,
          marcadoresClinicosL, marcadoresClinicosR, tendenciasEstimulacao
        };
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'sessions', editingSessionId), sessionData);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch(err) {
        console.error('Auto-save error:', err);
        setAutoSaveStatus('error');
      }
    }, 1500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [tipoEletrodo, dadosGrupos, clinica, efeitosColaterais, notasLivres, resumoSessao, transcricaoBruta, transcricaoOrganizada,
      voltagemBateria, impedanciaL, impedanciaR,
      marcadoresClinicosL, marcadoresClinicosR, tendenciasEstimulacao, editingSessionId]);

  const gerarTextoProntuario = (grupos, eletrodo) => {
    let text = '';
    const ordem = ORDEM_TEXTO_BAIXO_CIMA[eletrodo];
    
    ['A', 'B', 'C', 'D'].forEach(g => {
      text += `Grupo ${g}:\n`;
      ['L', 'R'].forEach(lado => {
        const progs = (grupos[g] || {})[lado] || [];
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
    const cyclingStr = (() => {
      const sides = [];
      if (Object.values(dadosGrupos).some(g => g.L?.some(p => p.cycling))) sides.push('Esquerdo');
      if (Object.values(dadosGrupos).some(g => g.R?.some(p => p.cycling))) sides.push('Direito');
      return sides.join(', ') || 'Não';
    })();
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

  // Fase 1: só lê e analisa o CSV, sem escrever nada no Firestore
  const handleParseImportCSV = async (file) => {
    if (!user || !file) return 'Erro: usuário não autenticado.';
    try {
      const text = await file.text();
      const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const linhas = clean.split('\n').map(l => l.trim()).filter(Boolean);
      if (linhas.length < 2) return 'Arquivo inválido ou vazio.';

      const primeiraLinha = linhas[0];
      const sep = (primeiraLinha.match(/;/g)||[]).length > (primeiraLinha.match(/,/g)||[]).length ? ';' : ',';
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
      const getH = (cols, nome) => {
        const idx = cabecalho.map(h => h.toLowerCase().replace(/[^a-z]/g,'')).findIndex(h => h.includes(nome));
        return idx >= 0 ? cols[idx] || '' : '';
      };
      const temColunasSessao = cabecalho.some(c => c.includes('Eletrodo') || c.includes('GrupoA'));

      const pacientesPorHc = {};
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

      return {
        temSessoes: temColunasSessao,
        pacientes: hcsUnicos.map(hc => ({
          hc,
          nome: pacientesPorHc[hc].nome,
          nSessoes: pacientesPorHc[hc].linhasIdx.length,
          linhasIdx: pacientesPorHc[hc].linhasIdx,
        })),
        _linhas: linhas,
        _sep: sep,
        _cabecalho: cabecalho,
      };
    } catch(err) {
      console.error(err);
      return 'Erro ao analisar CSV.';
    }
  };

  // Fase 2: recebe o preview aprovado e escreve no Firestore
  const handleImportFullCSV = async (preview) => {
    if (!user || !preview) return 'Erro: dados inválidos.';
    try {
      const { temSessoes, pacientes, _linhas, _sep, _cabecalho } = preview;

      const parseLine = (linha) => {
        const res = []; let cur = ''; let inQ = false;
        for (const c of linha) {
          if (c === '"') { inQ = !inQ; }
          else if (c === _sep && !inQ) { res.push(cur.trim()); cur = ''; }
          else { cur += c; }
        }
        res.push(cur.trim()); return res;
      };
      const get = (cols, nome) => { const idx = _cabecalho.indexOf(nome); return idx >= 0 ? cols[idx] || '' : ''; };

      let pacientesCriados = 0;
      let sessoesImportadas = 0;

      for (const { hc, nome, linhasIdx } of pacientes) {
        let pacienteId = patients.find(p => (p.hc || '').trim() === hc.trim())?.id;

        if (!pacienteId) {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'patients'), {
            nome, hc, createdAt: Date.now()
          });
          pacienteId = docRef.id;
          pacientesCriados++;
        }

        if (temSessoes) {
          for (const i of linhasIdx) {
            const cols = parseLine(_linhas[i]);
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
              // Apply per-program cycling from compact string
          const cyclingStr = get('Cycling') || '';
          if (cyclingStr) {
            cyclingStr.split(';').filter(Boolean).forEach(entry => {
              const [g, leadIdx] = entry.split('/');
              const side = leadIdx?.startsWith('E') ? 'L' : 'R';
              const idx = leadIdx?.length > 1 ? parseInt(leadIdx.slice(1)) - 1 : 0;
              if (dadosGruposImp[g]?.[side]?.[idx]) dadosGruposImp[g][side][idx].cycling = true;
            });
          }
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
                marcadoresClinicosL: [], marcadoresClinicosR: []
              });
              sessoesImportadas++;
            } catch(e) { console.error(e); }
          }
        }
      }

      return temSessoes
        ? `${pacientesCriados} paciente(s) criado(s), ${sessoesImportadas} sessão(ões) importada(s).`
        : `${pacientesCriados} paciente(s) importado(s).`;
      // Apply endereco from first session that has it
      const firstEndereco = reviewed.find(r => r.endereco)?.endereco || '';
      if (firstEndereco) setEnderecoSalvo(firstEndereco);
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
          'ImpedanciaE', 'ImpedanciaD',
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

  // Helper: convert extractor's parsed dadosGrupos (contatos as string "–-0+")
  // to the app's format (contatos as object {0:{state:'-',perc:100},...})


  const handleSalvarSessao = async (modoAtualizar = false) => {
    if (!user || !activePatient) return;
    
    const sessionData = {
      patientId: activePatient.id, 
      timestamp: modoAtualizar && editingSessionId ? (sessions.find(s => s.id === editingSessionId)?.timestamp || Date.now()) : Date.now(),
      type: 'active',
      tipoEletrodo, modoAmplitude, dispositivoInfo, dadosGrupos, clinica, efeitosColaterais, notasLivres, resumoSessao,
      voltagemBateria, impedanciaL, impedanciaR,
      marcadoresClinicosL, marcadoresClinicosR, tendenciasEstimulacao
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
        setEditingSessionId(docRef.id);
        showToast("Nova sessão registrada!");
      }
      
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'temp_sessions', activePatient.id)).catch(() => {});
      if (!modoAtualizar) setEditingSessionId(null);
    } catch(err) {
      console.error(err);
      showToast("Erro ao salvar sessão.");
    }
  };

  // Wrappers that check for recent session before creating
  const tryCreateSession = (mode) => {
    const ativos = sessions.filter(s => s.type === 'active');
    const lastActive = ativos[0];
    const isRecent = lastActive && !editingSessionId &&
      (Date.now() - (lastActive.timestamp || 0)) < 3 * 60 * 60 * 1000;
    if (isRecent) { setConfirmNewSession(mode); return; }
    if (mode === 'copy') handleSalvarSessao(false);
    else handleCriarSessaoVazia();
  };

  // Create a fresh empty session
  const handleCriarSessaoVazia = async () => {
    if (!user || !activePatient) return;
    const empty4ring = getContatosIniciais('4-ring');
    const makeEmpty = () => ({ contatos: empty4ring, amp: 0, pw: 60, freq: 130, efeito: 'neutro' });
    const emptyGrupos = { A:{L:[makeEmpty()],R:[makeEmpty()]}, B:{L:[makeEmpty()],R:[makeEmpty()]},
                          C:{L:[makeEmpty()],R:[makeEmpty()]}, D:{L:[makeEmpty()],R:[makeEmpty()]} };
    const sessionData = {
      patientId: activePatient.id, timestamp: Date.now(), type: 'active',
      tipoEletrodo: '4-ring', modoAmplitude: 'mA',
      dispositivoInfo: { fabricante:'', modeloIPG:'', modeloEletrodoE:'', modeloEletrodoD:'',
        alvoAnatomicoE:'', alvoAnatomicoD:'', dataImplante:'', dataTrocaIPG:'' },
      dadosGrupos: emptyGrupos,
      clinica: { tremor:0, rigidez:0, bradicinesia:0 },
      efeitosColaterais: { L:[], R:[] }, notasLivres: '', resumoSessao: '', transcricaoBruta: '', transcricaoOrganizada: '',
      voltagemBateria: '', impedanciaL: '', impedanciaR: '',
      marcadoresClinicosL: [], marcadoresClinicosR: [], tendenciasEstimulacao: ''
    };
    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), sessionData);
      // Reset UI to empty state
      setTipoEletrodo('4-ring'); setDadosGrupos(emptyGrupos);
      setClinica({ tremor:0, rigidez:0, bradicinesia:0 }); setEfeitosColaterais({ L:[], R:[] });
      setNotasLivres(''); setResumoSessao(''); setVoltagemBateria('');
      setImpedanciaL(''); setImpedanciaR(''); setCyclingL(false); setCyclingR(false);
      setMarcadoresClinicosL([]); setMarcadoresClinicosR([]); setTendenciasEstimulacao('');
      setEditingSessionId(docRef.id);
      showToast("Sessão vazia criada!");
    } catch(err) { console.error(err); showToast("Erro ao criar sessão vazia."); }
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
    try { setDadosGrupos(capPrograms(sess.dadosGrupos) || sess.dadosGrupos); }
    catch(e) { console.error('Erro ao carregar grupos:', e); showToast('Erro ao carregar programação da sessão'); }
    setClinica(sess.clinica || { tremor: 0, rigidez: 0, bradicinesia: 0 });
    setEfeitosColaterais(sess.efeitosColaterais || { L: [], R: [] });
    setNotasLivres(sess.notasLivres || "");
    setResumoSessao(sess.resumoSessao || "");
    setTranscricaoBruta(sess.transcricaoBruta || "");
    setTranscricaoOrganizada(sess.transcricaoOrganizada || "");
    setVoltagemBateria(sess.voltagemBateria || "");
    setImpedanciaL(sess.impedanciaL || "");
    setImpedanciaR(sess.impedanciaR || "");
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
      try { setDadosGrupos(capPrograms(ultimaAtiva.dadosGrupos) || ultimaAtiva.dadosGrupos); }
      catch(e) { console.error('Erro ao carregar ultima sessao:', e); }
      setClinica(ultimaAtiva.clinica || { tremor: 0, rigidez: 0, bradicinesia: 0 });
      setEfeitosColaterais(ultimaAtiva.efeitosColaterais || { L: [], R: [] });
      setNotasLivres(ultimaAtiva.notasLivres || "");
      setResumoSessao(ultimaAtiva.resumoSessao || "");
      setTranscricaoBruta(ultimaAtiva.transcricaoBruta || "");
      setTranscricaoOrganizada(ultimaAtiva.transcricaoOrganizada || "");
      setVoltagemBateria(ultimaAtiva.voltagemBateria || "");
      setImpedanciaL(ultimaAtiva.impedanciaL || "");
      setImpedanciaR(ultimaAtiva.impedanciaR || "");
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

  const showToast = (msg, tipo = 'info') => {
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

  // Sessão de referência para o bloco "Programação Anterior" e feedback de grupos.
  // Regra: sempre é a sessão imediatamente ANTERIOR à que está sendo editada.
  //   - Editando sessão mais recente → usa sessions[1] (penúltima)
  //   - Editando sessão mais antiga  → null (primeira sessão, sem anterior)
  //   - Sem editingSessionId (rascunho) → usa sessions[0] (mais recente salva)
  const sessaoReferencia = useMemo(() => {
    const ativos = sessions.filter(s => s.type === 'active').sort((a,b) => b.timestamp - a.timestamp);
    if (ativos.length === 0) return null;
    if (!editingSessionId) return ativos[0]; // rascunho → referência é a mais recente
    const idx = ativos.findIndex(s => s.id === editingSessionId);
    if (idx === -1) return ativos[0]; // não encontrada → fallback mais recente
    return ativos[idx + 1] ?? null;   // anterior cronologicamente (null = primeira)
  }, [sessions, editingSessionId]);

  // Grupos com ao menos uma sessão ativa registrada (baseado em sessaoReferencia)
  const gruposComSessao = useMemo(() => {
    if (!sessaoReferencia) return [];
    return ['A','B','C','D'].filter(g => {
      const gd = sessaoReferencia.dadosGrupos?.[g];
      if (!gd) return false;
      return (gd.L || []).some(p => (p.amp || 0) > 0) && (gd.R || []).some(p => (p.amp || 0) > 0);
    });
  }, [sessaoReferencia]);

  const handleEfeitoGrupo = async (grupo, efeito, textoEfeito) => {
    if (!user || !activePatient || !sessaoReferencia) return;
    const ultima = sessaoReferencia;

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
      (novosDadosGrupos[grupo]?.[lado] || []).forEach(prog => {
        prog.efeito = efeito;
        prog.efeitoTexto = textoEfeito; // save full label e.g. "Col. - Marcha"
      });
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
      'Data', 'Resumo', 'Tendencias', 'ModoAmplitude', 'Eletrodo', 'Bateria(V)',
      'ImpedanciaE', 'ImpedanciaD',
      'Clinica_Tremor', 'Clinica_Rigidez', 'Clinica_Bradicinesia',
      ...gruposKeys.flatMap(g => lados.flatMap(l => {
        const ladoNome = l === 'L' ? 'E' : 'D';
        return [
          `Grupo${g}_Lead${ladoNome}_Contatos`,    `Grupo${g}_Lead${ladoNome}_Amp(mA)`,
          `Grupo${g}_Lead${ladoNome}_PW(us)`,      `Grupo${g}_Lead${ladoNome}_Freq(Hz)`,
          `Grupo${g}_Lead${ladoNome}_Efeito`,
          `Grupo${g}_Lead${ladoNome}_Cycling`,
          // Interleaving program (index 1)
          `Grupo${g}_Lead${ladoNome}2_Contatos`,   `Grupo${g}_Lead${ladoNome}2_Amp(mA)`,
          `Grupo${g}_Lead${ladoNome}2_PW(us)`,     `Grupo${g}_Lead${ladoNome}2_Freq(Hz)`,
          `Grupo${g}_Lead${ladoNome}2_Efeito`,
          `Grupo${g}_Lead${ladoNome}2_Cycling`,
        ];
      })),
      'EfeitosColateraisE', 'EfeitosColateraisD',
      'MarcadoresE', 'MarcadoresD',
      'NotasLivres'
    ];

    const linhas = ativas.map(s => {
      const tipoEl = s.tipoEletrodo || '4-ring';
      const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEl];
      const contatosToCSV = (prog) => {
        if (!prog) return '';
        if (typeof prog.contatos === 'string') return prog.contatos;
        return ordem.map(c => {
          const st = prog.contatos?.[c]?.state || 'off';
          if (st === 'off') return '0';
          const perc = prog.contatos?.[c]?.perc;
          return perc && perc < 100 ? `${st}(${perc}%)` : st;
        }).join('');
      };
      const row = [
        activePatient?.nome || '',
        activePatient?.hc || '',
        formatarData(s.timestamp),
        (s.resumoSessao || '').replace(/[\n,]/g, ' '),
        (s.tendenciasEstimulacao || '').replace(/[\n,]/g, ' '),
        s.modoAmplitude || 'mA',
        tipoEl,
        s.voltagemBateria || '',
        s.impedanciaL || '', s.impedanciaR || '',
        (() => {
          const entries = [];
          Object.entries(s.dadosGrupos || {}).forEach(([g, grupo]) => {
            ['L','R'].forEach(side => {
              (grupo[side] || []).forEach((p, idx) => {
                if (p.cycling) entries.push(`${g}/${side==='L'?'E':'D'}${(grupo[side].length>1)?idx+1:''}`);
              });
            });
          });
          return entries.join(';');
        })(),
        s.clinica?.tremor ?? '', s.clinica?.rigidez ?? '', s.clinica?.bradicinesia ?? '',
      ];
      gruposKeys.forEach(g => {
        lados.forEach(l => {
          const prog0 = s.dadosGrupos?.[g]?.[l]?.[0];
          const prog1 = s.dadosGrupos?.[g]?.[l]?.[1];
          row.push(contatosToCSV(prog0), prog0?.amp ?? '', prog0?.pw ?? '', prog0?.freq ?? '', prog0?.efeito || '', prog0?.cycling ? 'Sim' : 'Não');
          row.push(contatosToCSV(prog1), prog1?.amp ?? '', prog1?.pw ?? '', prog1?.freq ?? '', prog1?.efeito || '', prog1?.cycling ? 'Sim' : 'Não');
        });
      });
      const ec = s.efeitosColaterais;
      const ecL = Array.isArray(ec) ? ec.join(';') : (ec?.L || []).join(';');
      const ecR = Array.isArray(ec) ? '' : (ec?.R || []).join(';');
      // Marcadores: serialize as compact JSON (config|tipo|amp|pw|freq)
      const mToStr = (m) => `${m.config}|${m.tipo}|${m.amp}|${m.pw || ''}|${m.freq || ''}`;
      const marcE = (s.marcadoresClinicosL || []).map(mToStr).join(';');
      const marcD = (s.marcadoresClinicosR || []).map(mToStr).join(';');
      row.push(ecL, ecR, marcE, marcD, (s.notasLivres || '').replace(/[\n,]/g, ' '));
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
      const parseContStr = (contStr, tipoEl2) => {
        const contatos2 = getContatosIniciais(tipoEl2);
        const ordem2 = ORDEM_TEXTO_BAIXO_CIMA[tipoEl2];
        if (contStr) {
          const tokens = [...contStr.matchAll(/(0|\+|-)(?:\((\d+)%\))?/g)];
          if (tokens.length === ordem2.length) {
            tokens.forEach((t, ti) => {
              if (t[1] === '-' || t[1] === '+') {
                contatos2[ordem2[ti]].state = t[1];
                contatos2[ordem2[ti]].perc = t[2] ? parseInt(t[2]) : 100;
              }
            });
          }
        }
        return contatos2;
      };
      gruposKeys.forEach(g => {
        dadosGruposImp[g] = { L: [], R: [] };
        [['L','E'], ['R','D']].forEach(([l, ladoNome]) => {
          // Program 0 (main)
          const c0 = get(`Grupo${g}_Lead${ladoNome}_Contatos`);
          const a0 = parseFloat(get(`Grupo${g}_Lead${ladoNome}_Amp(mA)`)) || 0;
          const p0 = parseInt(get(`Grupo${g}_Lead${ladoNome}_PW(us)`)) || 60;
          const f0 = parseInt(get(`Grupo${g}_Lead${ladoNome}_Freq(Hz)`)) || 130;
          const e0 = get(`Grupo${g}_Lead${ladoNome}_Efeito`) || 'neutro';
          dadosGruposImp[g][l].push({ contatos: parseContStr(c0, tipoEl), amp:a0, pw:p0, freq:f0, efeito:e0 });
          // Program 1 (interleaving — only if amp > 0)
          const a1 = parseFloat(get(`Grupo${g}_Lead${ladoNome}2_Amp(mA)`)) || 0;
          if (a1 > 0) {
            const c1 = get(`Grupo${g}_Lead${ladoNome}2_Contatos`);
            const p1 = parseInt(get(`Grupo${g}_Lead${ladoNome}2_PW(us)`)) || 60;
            const f1 = parseInt(get(`Grupo${g}_Lead${ladoNome}2_Freq(Hz)`)) || 130;
            const e1 = get(`Grupo${g}_Lead${ladoNome}2_Efeito`) || 'neutro';
            dadosGruposImp[g][l].push({ contatos: parseContStr(c1, tipoEl), amp:a1, pw:p1, freq:f1, efeito:e1 });
          }
        });
      });
      const ecLStr = get('EfeitosColateraisE');
      const ecRStr = get('EfeitosColateraisD');
      try {
        // Parse date (fix: was get(cols,'Data') — cols not needed)
        const dataStr = get('Data');
        let ts = Date.now() - (linhas.length - i) * 1000;
        if (dataStr) {
          const dm = dataStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
          if (dm) {
            const ano = dm[3].length === 2 ? '20' + dm[3] : dm[3];
            const parsed = new Date(`${ano}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`).getTime();
            if (!isNaN(parsed)) ts = parsed;
          }
        }
        // Parse marcadores from "config|tipo|amp|pw|freq" format
        const parseMarcStr = (str) => str ? str.split(';').filter(Boolean).map(s => {
          const [config,tipo,amp,pw,freq] = s.split('|');
          return { config, tipo, amp: parseFloat(amp)||0, pw: parseInt(pw)||60, freq: parseInt(freq)||130 };
        }) : [];
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), {
          patientId: activePatient.id,
          timestamp: ts,
          type: 'active',
          tipoEletrodo: tipoEl,
          modoAmplitude: get('ModoAmplitude') || 'mA',
          dadosGrupos: dadosGruposImp,
          clinica: {
            tremor:      parseInt(get('Clinica_Tremor'))      || 0,
            rigidez:     parseInt(get('Clinica_Rigidez'))     || 0,
            bradicinesia:parseInt(get('Clinica_Bradicinesia'))|| 0,
          },
          efeitosColaterais: {
            L: ecLStr ? ecLStr.split(';').filter(Boolean) : [],
            R: ecRStr ? ecRStr.split(';').filter(Boolean) : []
          },
          notasLivres:            get('NotasLivres'),
          resumoSessao:           get('Resumo'),
          tendenciasEstimulacao:  get('Tendencias'),
          voltagemBateria:        get('Bateria(V)'),
          impedanciaL:            get('ImpedanciaE'),
          impedanciaR:            get('ImpedanciaD'),

          marcadoresClinicosL:    parseMarcStr(get('MarcadoresE')),
          marcadoresClinicosR:    parseMarcStr(get('MarcadoresD')),
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
        <PatientSelector patients={patients} onSelectPatient={setActivePatient} onCreatePatient={handleCreatePatient} onDeletePatient={handleDeletePatient} onImportFullCSV={handleImportFullCSV} onParseImportCSV={handleParseImportCSV} />
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

          <div className="flex items-center bg-slate-800 rounded px-2 py-1.5 hidden md:flex">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-2">Eletrodo:</span>
            <select value={tipoEletrodo} onChange={handleMudarTipoEletrodo} className="bg-white text-slate-900 font-bold text-sm focus:outline-none cursor-pointer rounded px-1 py-0.5">
              <option value="4-ring">4 Contatos</option>
              <option value="8-ring">8 Contatos</option>
              <option value="directional">Direcional</option>
            </select>
          </div>
          
          {/* Auto-save status */}
          {editingSessionId && autoSaveStatus !== 'idle' && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              autoSaveStatus === 'saving' ? 'bg-amber-100 text-amber-700 animate-pulse' :
              autoSaveStatus === 'saved'  ? 'bg-emerald-100 text-emerald-700' :
              'bg-rose-100 text-rose-700'
            }`}>
              {autoSaveStatus === 'saving' ? '⟳ salvando...' : autoSaveStatus === 'saved' ? '✓ salvo' : '⚠ erro'}
            </span>
          )}
          {editingSessionId && <span className="text-[9px] text-slate-500 font-mono hidden lg:inline">editando</span>}
          {/* Smart save: if editing or last session <3h, show "Salvar Sessão"; otherwise "Criar nova copiando" */}
          {(() => {
            const lastActive = sessions.filter(s => s.type === 'active')[0];
            const lastIsRecent = lastActive && (Date.now() - (lastActive.timestamp || 0)) < 3 * 60 * 60 * 1000;
            const shouldSaveOver = editingSessionId || lastIsRecent;
            return shouldSaveOver ? (
              <button onClick={() => handleSalvarSessao(true)}
                className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white">
                💾 Salvar Sessão
              </button>
            ) : (
              <button onClick={() => tryCreateSession('copy')}
                className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white"
                title="Cria nova sessão com os dados atuais copiados">
                💾 Criar nova sessão copiando dados
              </button>
            );
          })()}
          <button onClick={() => tryCreateSession('empty')}
            className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-slate-600 hover:bg-slate-700 text-white"
            title="Cria sessão nova completamente vazia">
            ✦ Criar sessão vazia
          </button>
          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-800 rounded px-2 py-1.5 shrink-0" title="Se ativo, contatos com % diferentes são tratados como configurações distintas na timeline">
            <input type="checkbox" checked={considerarAmplitude} onChange={e => setConsiderarAmplitude(e.target.checked)} className="accent-indigo-400 w-3.5 h-3.5" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap">Div. Amplitude</span>
          </label>
          <button onClick={() => setShowMonopolar(true)} className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-violet-600 hover:bg-violet-700 text-white">
            🔬 Monopolar
          </button>
          <button onClick={() => setShowExtrator(true)} className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white">
            📄 Extrator
          </button>
          <button onClick={() => setShowJSONImport(true)} className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-teal-600 hover:bg-teal-700 text-white">
            📥 Importar JSON
          </button>
          <button onClick={() => setShowAISettings(true)} className="px-3 py-1.5 rounded font-bold text-sm transition-colors shadow-sm whitespace-nowrap bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${aiConfig.enabled && (aiHealth.ollama||aiHealth.transcribe) ? 'bg-emerald-300' : 'bg-rose-300'}`} />
            🤖 IA
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

      <main className="p-4 w-full flex-1 flex flex-col gap-3 overflow-y-auto">

        {/* BANNER DE SESSÃO */}
        {(() => {
          const ativos = sessions.filter(s => s.type === 'active').sort((a,b) => b.timestamp - a.timestamp);
          const sesAtual = editingSessionId ? ativos.find(s => s.id === editingSessionId) : null;
          const isMostRecent = ativos.length > 0 && ativos[0].id === editingSessionId;
          const isToday = sesAtual && new Date(sesAtual.timestamp).toDateString() === new Date().toDateString();
          const label = !editingSessionId
            ? '📝 Rascunho não salvo'
            : isMostRecent && isToday
              ? '📅 Sessão de hoje'
              : `📅 Sessão de ${formatarData(sesAtual?.timestamp || 0)}`;
          const colorCls = !editingSessionId
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : isMostRecent
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-indigo-50 border-indigo-200 text-indigo-700';
          return (
            <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-bold mb-1 ${colorCls}`}>
              <span>{label}</span>
              {sesAtual && (
                <span className="font-normal text-[10px] opacity-70">
                  {formatarData(sesAtual.timestamp)}
                  {!isMostRecent && ' — sessão anterior'}
                </span>
              )}
            </div>
          );
        })()}

        {/* TAB BAR */}
        <div className="flex gap-1 mb-3 border-b border-slate-200 pb-1">
          {[['programacao','⚡ Programação'],['calculadoras','🧮 Calculadoras e Receitas']].map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-t transition-all ${activeTab===id?'bg-white border border-b-white border-slate-200 text-slate-800 -mb-px':'text-slate-400 hover:text-slate-600'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* CALCULADORAS TAB */}
        {activeTab === 'calculadoras' && (
          <div className="flex flex-col gap-6 p-4 bg-white rounded-2xl border border-slate-200">
            <LEDCalculator notasLivres={notasLivres} />
            <hr className="border-slate-100"/>
            <TEEDCalculator dadosGrupos={dadosGrupos} impedanciaL={impedanciaL} impedanciaR={impedanciaR} modoAmplitude={modoAmplitude} />
            <hr className="border-slate-100"/>
            <ReceitasSection
              pacienteNome={activePatient?.nome}
              enderecoSalvo={enderecoSalvo}
              onEnderecoChange={v => setEnderecoSalvo(v)}
              notasLivres={notasLivres}
              prescricoesSalvas={prescricoesSalvas}
              onSalvarPrescricao={(id, text) => setPrescricoesSalvas(prev => ({...prev, [id]: text}))}
              customDocs={customDocs}
              onAddCustom={(doc) => setCustomDocs(prev => [...prev, doc])}
              onDeleteCustom={(id) => setCustomDocs(prev => prev.filter(d => d.id !== id))}
              onUpdateCustom={(id, text) => setCustomDocs(prev => prev.map(d => d.id===id ? {...d, texto:text} : d))}
              aiEnabled={aiConfig.enabled}
              aiHealthOllama={aiHealth.ollama}
              transcricaoOrganizada={transcricaoOrganizada}
            />
          </div>
        )}

        {activeTab === 'programacao' && <>

        {/* BLOCO: PRONTUÁRIO — compact evolution-first layout */}
        <BlocoColapsavel
          titulo="Evolução"
          aberto={blocosAbertos.prontuario}
          onToggle={() => toggleBloco('prontuario')}
        >
          {/* Header line: session title + battery */}
          <div className="flex items-center gap-2 mb-2">
            <input type="text" value={resumoSessao} onChange={e => setResumoSessao(e.target.value)}
              placeholder={`Resumo: Digite aqui em poucas palavras a impressão geral ou ocorrência mais importante dessa consulta`}
              className="flex-1 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium" />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-slate-400 font-bold">🔋</span>
              <input type="text" value={voltagemBateria} onChange={e => setVoltagemBateria(e.target.value)}
                placeholder="V"
                className="w-20 px-2 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-700 text-center" />
            </div>
          </div>
          {/* Auto-expanding evolution textarea */}
          <textarea
            value={notasLivres}
            onChange={(e) => {
              setNotasLivres(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px';
            }}
            onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px'; }}
            placeholder="Cole ou registre aqui a evolução do paciente..."
            rows={2}
            style={{ minHeight: '60px', height: notasLivres ? 'auto' : '60px' }}
            className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none text-slate-700 leading-relaxed overflow-hidden"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowHistoricoText(true)}
                className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-bold transition-all border border-slate-200"
                title="Ver histórico completo de programação em texto">
                📜 Histórico
              </button>
              <button onClick={() => setShowUPDRS(true)}
                className="flex items-center gap-1.5 text-xs bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-1.5 rounded-lg font-bold transition-all border border-teal-200"
                title="Abrir pontuação MDS-UPDRS Parte III">
                📊 UPDRS-III
              </button>
              <button onClick={() => setShowScales(true)}
                className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold transition-all border border-indigo-200"
                title="Escalas clínicas: BFM, SARA, PDQ, YGTSS, Exame Parkinsoniano">
                📐 Escalas
              </button>
            </div>
            <button onClick={copiarConsultaClipboard}
              className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm"
              title="Copia cabeçalho, evolução e programação atual para colar no prontuário">
              📋 Copiar Consulta
            </button>
          </div>
        </BlocoColapsavel>

        {/* BLOCO: TRANSCRIÇÃO BRUTA (Whisper) */}
        <BlocoColapsavel
          titulo="Transcrição bruta"
          aberto={blocosAbertos.transcricaoBruta}
          onToggle={() => toggleBloco('transcricaoBruta')}
          corHeader="bg-slate-100"
          headerExtra={<AIStatusLight status={aiLightStatus('transcribe')} label="Whisper" onClick={() => setShowAISettings(true)} />}
        >
          <div className="flex items-center gap-2 mb-2">
            <AudioRecorderButton onRecorded={handleAudioRecorded} disabled={!aiConfig.enabled || aiBusy} />
            {aiBusy && <span className="text-[10px] text-amber-500 animate-pulse">⟳ processando…</span>}
            {transcricaoBruta && (
              <button onClick={() => setTranscricaoBruta('')}
                className="ml-auto text-[10px] text-slate-400 hover:text-rose-500 underline">limpar</button>
            )}
          </div>
          <textarea
            value={transcricaoBruta}
            onChange={e => setTranscricaoBruta(e.target.value)}
            placeholder="Grave o áudio da consulta ou digite/cole a transcrição bruta aqui..."
            rows={3}
            className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y text-slate-700 leading-relaxed"
          />
        </BlocoColapsavel>

        {/* BLOCO: TRANSCRIÇÃO ORGANIZADA (LLM) */}
        <BlocoColapsavel
          titulo="Transcrição organizada"
          aberto={blocosAbertos.transcricaoOrganizada}
          onToggle={() => toggleBloco('transcricaoOrganizada')}
          corHeader="bg-slate-100"
          headerExtra={<AIStatusLight status={aiLightStatus('ollama')} label="Ollama" onClick={() => setShowAISettings(true)} />}
        >
          <div className="flex items-center gap-2 mb-2">
            <button onClick={handleOrganizeTranscription} disabled={!aiConfig.enabled || aiBusy || !transcricaoBruta.trim()}
              className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm disabled:opacity-40"
              title="Usa a IA para resumir e estruturar a transcrição bruta, com a evolução como contexto">
              ✨ Organizar com IA
            </button>
            {aiBusy && <span className="text-[10px] text-amber-500 animate-pulse">⟳ processando…</span>}
            {transcricaoOrganizada && (
              <button onClick={() => setTranscricaoOrganizada('')}
                className="ml-auto text-[10px] text-slate-400 hover:text-rose-500 underline">limpar</button>
            )}
          </div>
          <textarea
            value={transcricaoOrganizada}
            onChange={e => setTranscricaoOrganizada(e.target.value)}
            placeholder="O resumo estruturado gerado pela IA aparecerá aqui. Você pode editá-lo livremente."
            rows={4}
            className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y text-slate-700 leading-relaxed"
          />
        </BlocoColapsavel>

        {/* BLOCO: PROGRAMAÇÃO ANTERIOR */}
        <BlocoColapsavel
          titulo="Programação Anterior"
          aberto={blocosAbertos.progAnterior}
          onToggle={() => toggleBloco('progAnterior')}
          corHeader="bg-indigo-50"
        >
          {(!sessaoReferencia || gruposComSessao.length === 0) ? (
            <p className="text-xs text-slate-400 italic">
              {!sessaoReferencia
                ? 'Esta é a primeira sessão registrada — sem sessão anterior para referência.'
                : 'Nenhuma sessão anterior com programação ativa registrada.'}
            </p>
          ) : (() => {
            const ultima = sessaoReferencia;
            const ordem = ORDEM_TEXTO_BAIXO_CIMA[ultima?.tipoEletrodo || '4-ring'];
            const grupoA = ultima.dadosGrupos?.['A'] || {};

            // Helper: compare prog config+amp+pw+freq against group A for a given side
            const igualAoGrupoA = (grupo, lado) => {
              if (grupo === 'A') return false; // grupo A always shows buttons
              const progsA = grupoA[lado] || [];
              const progsG = ultima.dadosGrupos?.[grupo]?.[lado] || [];
              if (progsA.length !== progsG.length) return false;
              return progsG.every((p, i) => {
                const a = progsA[i];
                if (!a) return false;
                return getStringConfig(p.contatos) === getStringConfig(a.contatos)
                  && p.amp === a.amp && p.pw === a.pw && p.freq === a.freq;
              });
            };

            return (
              <div className="flex flex-col gap-3">
                {gruposComSessao.map(grupo => {
                  let linhasGrupo = [];
                  const ladosMudados = [];
                  ['L','R'].forEach(lado => {
                    const leadStr = lado === 'L' ? 'E' : 'D';
                    const igual = igualAoGrupoA(grupo, lado);
                    if (!igual) ladosMudados.push(lado);
                    (ultima.dadosGrupos?.[grupo]?.[lado] || []).forEach((prog, idx) => {
                      const progs = ultima.dadosGrupos[grupo][lado];
                      const leadName = progs.length > 1 ? `Lead ${leadStr}${idx+1}` : `Lead ${leadStr}`;
                      const contactStr = ordem.map(c => {
                        const st = prog.contatos?.[c]?.state || 'off';
                        if (st === 'off') return '0';
                        const perc = prog.contatos[c].perc;
                        return perc < 100 ? `${st}(${perc}%)` : st;
                      }).join('');
                      const label = igual ? `${leadName} ${contactStr} ${prog.amp?.toFixed(1)} mA ${prog.pw} µs ${prog.freq} Hz  [= Grupo A]`
                                          : `${leadName} ${contactStr} ${prog.amp?.toFixed(1)} mA ${prog.pw} µs ${prog.freq} Hz`;
                      linhasGrupo.push(label);
                    });
                  });
                  // Only show scoring buttons for sides with changed programming
                  const mostrarBotoes = grupo === 'A' || ladosMudados.length > 0;
                  const notaLado = ladosMudados.length === 1
                    ? ` (${ladosMudados[0] === 'L' ? 'E' : 'D'} modificado)`
                    : '';
                  return (
                    <div key={grupo} className="flex flex-col sm:flex-row sm:items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="shrink-0">
                        <span className="text-xs font-black text-slate-700 block mb-1.5">
                          Grupo {grupo}{notaLado && <span className="font-normal text-indigo-500 text-[9px] ml-1">{notaLado}</span>}
                        </span>
                        {mostrarBotoes && (
                          <div className="flex flex-wrap gap-1">
                            {[
                              ...EFEITO_OPTS.map(o => [o.val, o.label, getEfeitoCor(o.val, 'btnCls')]),
                            ].map(([efVal, label, cls]) => (
                              <button key={label} onClick={() => handleEfeitoGrupo(grupo, efVal, label)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all shadow-sm ${cls}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <pre className="text-[10px] font-mono text-slate-500 leading-relaxed whitespace-pre-wrap flex-1 pl-0 sm:pl-3 sm:border-l border-slate-200">
                        {linhasGrupo.join('\n')}
                      </pre>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </BlocoColapsavel>

        {/* BLOCO: PROGRAMAÇÃO ATUAL */}
        <BlocoColapsavel
          titulo="Programação Atual"
          aberto={blocosAbertos.progAtual}
          onToggle={() => toggleBloco('progAtual')}
          corHeader="bg-indigo-50"
        >
          {/* Tendências + toggle V/mA dentro do bloco de programação */}
          <div className="flex gap-2 items-start mb-3">
            <textarea
              value={tendenciasEstimulacao}
              onChange={e => {
                setTendenciasEstimulacao(e.target.value);
                e.target.style.height = '28px';
                e.target.style.height = (e.target.scrollHeight) + 'px';
              }}
              onFocus={e => { e.target.style.height = '28px'; e.target.style.height = (e.target.scrollHeight) + 'px'; }}
              onBlur={e => { if (!e.target.value) e.target.style.height = '28px'; }}
              placeholder="Tendências e peculiaridades de estimulação"
              rows={1}
              style={{ height: '28px', minHeight: '28px' }}
              className="flex-1 px-3 py-1.5 text-sm bg-amber-50/60 border border-amber-200/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none text-slate-700 leading-snug overflow-hidden placeholder-amber-400/80 transition-all"
            />
            <div className="flex items-center rounded overflow-hidden border border-slate-200 text-[10px] font-bold shrink-0"
              title="Corrente controlada (mA) ou voltagem controlada (V) — afeta TEED e VTA. Sessões com geradores diferentes podem ter modos diferentes.">
              {['mA','V'].map(m => (
                <button key={m} onClick={() => setModoAmplitude(m)}
                  className={`px-2.5 py-1.5 transition-all ${modoAmplitude===m?'bg-indigo-600 text-white':'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          {/* Informações do dispositivo */}
          {(() => {
            const di = dispositivoInfo;
            const setDI = (k, v) => setDispositivoInfo(prev => ({...prev, [k]: v}));
            const FABRICANTES = ['Medtronic','Boston Scientific','Abbott','PINS','Outro'];
            const ALVOS = ['STN','GPi','VIM','CM-Pf','NAc','ALIC','Outro'];
            const inp = "text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full";
            const sel = "text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full";
            const lbl = "text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5";
            return (
              <details className="mb-3 group">
                <summary className="cursor-pointer text-[10px] font-bold text-slate-500 hover:text-slate-700 select-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  🔧 Dispositivo
                  {(di.fabricante || di.modeloIPG || di.alvoAnatomicoE) && (
                    <span className="ml-2 font-normal text-slate-400 truncate">
                      {[di.fabricante, di.modeloIPG, di.alvoAnatomicoE && `Alvo:${di.alvoAnatomicoE}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </summary>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <label className={lbl}>Fabricante</label>
                    <select value={di.fabricante} onChange={e=>setDI('fabricante',e.target.value)} className={sel}>
                      <option value="">—</option>
                      {FABRICANTES.map(f=><option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Modelo IPG</label>
                    <input value={di.modeloIPG} onChange={e=>setDI('modeloIPG',e.target.value)} placeholder="ex: Percept PC" className={inp}/>
                  </div>
                  <div>
                    <label className={lbl}>Eletrodo E</label>
                    <input value={di.modeloEletrodoE} onChange={e=>setDI('modeloEletrodoE',e.target.value)} placeholder="ex: 3389" className={inp}/>
                  </div>
                  <div>
                    <label className={lbl}>Eletrodo D</label>
                    <input value={di.modeloEletrodoD} onChange={e=>setDI('modeloEletrodoD',e.target.value)} placeholder="ex: DB-2202" className={inp}/>
                  </div>
                  <div>
                    <label className={lbl}>Alvo E</label>
                    <select value={di.alvoAnatomicoE} onChange={e=>setDI('alvoAnatomicoE',e.target.value)} className={sel}>
                      <option value="">—</option>
                      {ALVOS.map(a=><option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Alvo D</label>
                    <select value={di.alvoAnatomicoD} onChange={e=>setDI('alvoAnatomicoD',e.target.value)} className={sel}>
                      <option value="">—</option>
                      {ALVOS.map(a=><option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Data implante</label>
                    <input type="date" value={di.dataImplante} onChange={e=>setDI('dataImplante',e.target.value)} className={inp}/>
                  </div>
                  <div>
                    <label className={lbl}>Data troca bateria</label>
                    <input type="date" value={di.dataTrocaIPG} onChange={e=>setDI('dataTrocaIPG',e.target.value)} className={inp}/>
                  </div>
                </div>
              </details>
            );
          })()}

          {/* ProgrammingEditor — direct structured input, always in sync with dadosGrupos */}
          <details className="mb-3 group">
            <summary className="cursor-pointer text-[10px] font-bold text-slate-500 hover:text-slate-700 select-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              🎛 Edição direta de contatos
            </summary>
            <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <ProgrammingEditor
                dadosGrupos={dadosGrupos}
                setDadosGrupos={setDadosGrupos}
                tipoEletrodo={tipoEletrodo}
                modoAmplitude={modoAmplitude}
                sessaoAnteriorGrupos={sessaoReferencia?.dadosGrupos || null}
              />
            </div>
          </details>

          {/* Controles de grupo e cópia — movidos do header */}
          <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-100">
            <div className="flex items-center bg-slate-100 rounded px-2 py-1.5 border border-slate-200">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-2">Grupo:</span>
              <select value={grupoAtivo} onChange={(e) => setGrupoAtivo(e.target.value)}
                className="bg-white text-slate-900 font-bold text-sm focus:outline-none cursor-pointer rounded px-1 py-0.5 border border-slate-200">
                {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex items-center bg-slate-100 rounded px-2 py-1.5 border border-slate-200">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-2">Copiar p/:</span>
              <select value="" onChange={(e) => copiarParaGrupo(e.target.value)}
                className="bg-white text-slate-900 font-bold text-sm focus:outline-none cursor-pointer rounded px-1 py-0.5 border border-slate-200 w-12">
                <option value="">--</option>
                {['A', 'B', 'C', 'D'].filter(g => g !== grupoAtivo).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <button
              onClick={handleCopiarUltimaSessao}
              disabled={!sessions.some(s => s.type === 'active')}
              className="px-3 py-1.5 rounded text-[10px] font-bold text-slate-900 bg-slate-200 hover:bg-slate-300 disabled:opacity-30 transition-colors shadow-sm uppercase"
            >
              Copiar Anterior
            </button>
          </div>

          {/* Eletrodos */}
          <div className="flex overflow-x-auto gap-4 pb-2 items-stretch custom-scrollbar min-h-[500px]">
            {/* HEMISFÉRIO ESQUERDO */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col shrink-0">
              <div className="flex justify-between items-center mb-3 px-2 border-b pb-2">
                <h2 className="font-bold text-slate-700">Hemisfério Esquerdo</h2>
                <button onClick={() => toggleInterleaving('L')}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ml-auto ${programasL.length > 1 ? 'bg-indigo-100 text-indigo-700 hover:bg-rose-100 hover:text-rose-700' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                  title={programasL.length > 1 ? 'Desativar interleaving — volta à visão ampliada' : 'Ativar interleaving — modo duplo programa'}>
                  {programasL.length > 1 ? '⇄ Interleaving ativo' : '+ Interleaving'}
                </button>
              </div>
              <div className="flex gap-4 flex-1">
                {programasL.map((prog, idx) => {
                  const configStr = getStringConfig(prog.contatos, !considerarAmplitude);
                  const stimTypeForHist = classifyStim(prog.contatos, tipoEletrodo);
                  const hist = stimTypeForHist === 'multi-dir'
                    ? historicoReal.filter(h => h.lado === 'L')
                    : (configStr ? historicoReal.filter(h => h.lado === 'L' && h.config === configStr) : []);
                  const isMatch = historicoReal.some(h => h.lado === 'L' && h.config === configStr && h.amp === prog.amp && h.pw === prog.pw && h.freq === prog.freq);
                  const stimType = classifyStim(prog.contatos, tipoEletrodo);
                  const currentLevel = getDirLevel(configStr);
                  const marcadoresSessaoL = (() => {
                    if (stimType === 'single-dir' && currentLevel) {
                      return marcadoresClinicosL.filter(m => getDirLevel(m.config) === currentLevel);
                    }
                    if (stimType === 'multi-dir') {
                      return marcadoresClinicosL.filter(m => getDirLevel(m.config) !== null);
                    }
                    return marcadoresClinicosL.filter(m => m.config === configStr);
                  })();
                  
                  const marcadoresHistL = (() => {
                    const seen = new Set(marcadoresClinicosL.map(mc => mc.id));
                    if (stimType === 'single-dir' && currentLevel) {
                      return marcadoresHistoricos.L.filter(m => getDirLevel(m.config) === currentLevel && !seen.has(m.id));
                    }
                    if (stimType === 'multi-dir') {
                      return marcadoresHistoricos.L.filter(m => getDirLevel(m.config) !== null && !seen.has(m.id));
                    }
                    return marcadoresHistoricos.L.filter(m => m.config === configStr && !seen.has(m.id));
                  })();
                  // ALL markers for 3D view (no contact filter) — used when user forces 3D
                  const marcadoresTodosL = [...marcadoresClinicosL,
                    ...marcadoresHistoricos.L.filter(m => !marcadoresClinicosL.some(mc => mc.id === m.id))];
                  // ALL sessions for 3D historicoRef (no config filter)
                  const historicoTodosL = historicoReal.filter(h => h.lado === 'L');
                          return (
                    <div key={`L-${idx}`} className={`${programasL.length > 1 ? "w-[340px]" : "w-[680px]"} shrink-0`}>
                      <RenderPrograma
                        lado="L" programa={prog} index={idx} isInterleaving={programasL.length > 1} tipoEletrodo={tipoEletrodo}
                        isMatchExato={isMatch} historicoRef={hist}
                        marcadores={[...marcadoresSessaoL, ...marcadoresHistL]}
                        marcadoresRing={marcadoresHistoricos.L.concat(marcadoresClinicosL)}
                        marcadoresTodosL={marcadoresTodosL}
                        historicoTodos={historicoTodosL}
                        structuralMap={structuralMapL}
                        modoAmplitude={modoAmplitude}
                        impedanciaL={impedanciaL}
                        impedanciaR={impedanciaR}
                        configStr={configStr}
                        onAdicionarMarcador={(tipo) => adicionarMarcadorClinico('L', tipo, idx)}
                        onDesfazerMarcadores={(cfg) => desfazerMarcadoresConfig('L', cfg)}
                        impedancia={impedanciaL} onImpedanciaChange={setImpedanciaL}
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
                <button onClick={() => toggleInterleaving('R')}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ml-auto ${programasR.length > 1 ? 'bg-indigo-100 text-indigo-700 hover:bg-rose-100 hover:text-rose-700' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                  title={programasR.length > 1 ? 'Desativar interleaving — volta à visão ampliada' : 'Ativar interleaving — modo duplo programa'}>
                  {programasR.length > 1 ? '⇄ Interleaving ativo' : '+ Interleaving'}
                </button>
              </div>
              <div className="flex gap-4 flex-1">
                {programasR.map((prog, idx) => {
                  const configStr = getStringConfig(prog.contatos, !considerarAmplitude);
                  const stimTypeForHistR = classifyStim(prog.contatos, tipoEletrodo);
                  const hist = stimTypeForHistR === 'multi-dir'
                    ? historicoReal.filter(h => h.lado === 'R')
                    : (configStr ? historicoReal.filter(h => h.lado === 'R' && h.config === configStr) : []);
                  const isMatch = historicoReal.some(h => h.lado === 'R' && h.config === configStr && h.amp === prog.amp && h.pw === prog.pw && h.freq === prog.freq);
                  const stimTypeR = classifyStim(prog.contatos, tipoEletrodo);
                  const currentLevelR = getDirLevel(configStr);
                  const marcadoresSessaoR = (() => {
                    if (stimTypeR === 'single-dir' && currentLevelR) {
                      return marcadoresClinicosR.filter(m => getDirLevel(m.config) === currentLevelR);
                    }
                    if (stimTypeR === 'multi-dir') {
                      return marcadoresClinicosR.filter(m => getDirLevel(m.config) !== null);
                    }
                    return marcadoresClinicosR.filter(m => m.config === configStr);
                  })();
                  const marcadoresHistR = (() => {
                    const seen = new Set(marcadoresClinicosR.map(mc => mc.id));
                    if (stimTypeR === 'single-dir' && currentLevelR) {
                      return marcadoresHistoricos.R.filter(m => getDirLevel(m.config) === currentLevelR && !seen.has(m.id));
                    }
                    if (stimTypeR === 'multi-dir') {
                      return marcadoresHistoricos.R.filter(m => getDirLevel(m.config) !== null && !seen.has(m.id));
                    }
                    return marcadoresHistoricos.R.filter(m => m.config === configStr && !seen.has(m.id));
                  })();
                  const marcadoresTodosR = [...marcadoresClinicosR,
                    ...marcadoresHistoricos.R.filter(m => !marcadoresClinicosR.some(mc => mc.id === m.id))];
                  const historicoTodosR = historicoReal.filter(h => h.lado === 'R');
                  const marcadoresRingR = marcadoresClinicosR.concat(marcadoresHistoricos.R.filter(m => !marcadoresClinicosR.some(mc2=>mc2.id===m.id)));
                  return (
                    <div key={`R-${idx}`} className={`${programasR.length > 1 ? "w-[340px]" : "w-[680px]"} shrink-0`}>
                      <RenderPrograma
                        lado="R" programa={prog} index={idx} isInterleaving={programasR.length > 1} tipoEletrodo={tipoEletrodo}
                        isMatchExato={isMatch} historicoRef={hist}
                        marcadores={[...marcadoresSessaoR, ...marcadoresHistR]}
                        marcadoresRing={marcadoresRingR}
                        marcadoresTodosL={marcadoresTodosR}
                        historicoTodos={historicoTodosR}
                        structuralMap={structuralMapR}
                        modoAmplitude={modoAmplitude}
                        impedanciaL={impedanciaL}
                        impedanciaR={impedanciaR}
                        configStr={configStr}
                        onAdicionarMarcador={(tipo) => adicionarMarcadorClinico('R', tipo, idx)}
                        onDesfazerMarcadores={(cfg) => desfazerMarcadoresConfig('R', cfg)}
                        impedancia={impedanciaR} onImpedanciaChange={setImpedanciaR}
                        onUpdateProg={atualizarPrograma} onUpdateState={atualizarContatoState} onUpdatePerc={atualizarContatoPerc}
                        ignorarPerc={!considerarAmplitude}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </BlocoColapsavel>


        {/* BLOCO: RECONSTRUÇÃO */}
        <BlocoColapsavel
          titulo="Reconstrução do Eletrodo"
          aberto={blocosAbertos.reconstrucao}
          onToggle={() => toggleBloco('reconstrucao')}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-slate-500">Imagens salvas por paciente. Serão redimensionadas para máx. 360×360 px.</p>
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
        </BlocoColapsavel>

        {/* BLOCO: IMPORTAÇÃO / EXPORTAÇÃO */}
        <BlocoColapsavel
          titulo="Importação / Exportação"
          aberto={blocosAbertos.importExport}
          onToggle={() => toggleBloco('importExport')}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-bold text-slate-700">Histórico CSV</p>
                  <p className="text-[10px] text-slate-500">Todas as sessões ativas. Uma linha por sessão.</p>
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-bold text-slate-700">Integração com Prontuário</p>
                  <p className="text-[10px] text-slate-500">Cole um texto no formato DBS para importar a programação.</p>
                </div>
                <button onClick={aplicarProntuario} className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-bold transition-all shadow-sm">
                  Ler Texto e Aplicar
                </button>
              </div>
              <textarea
                value={textoProntuario}
                onChange={(e) => setTextoProntuario(e.target.value)}
                className="w-full h-48 p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-y text-slate-700 whitespace-pre"
                spellCheck="false"
              />
            </div>
          </div>
        </BlocoColapsavel>

      </> /* end programacao tab */}

      </main>

      {/* MODAL MONOPOLAR REVIEW */}
      {showMonopolar && (() => {
        const todosL_raw = [...marcadoresHistoricos.L, ...marcadoresClinicosL];
        const todosR_raw = [...marcadoresHistoricos.R, ...marcadoresClinicosR];
        // Session filter for monopolar
        const monoSessions = (() => {
          const map = new Map();
          [...todosL_raw, ...todosR_raw].forEach(m => {
            const id = m.sessionId || String(m.sessionTimestamp || m.timestamp || '');
            if (!map.has(id)) map.set(id, { id, ts: m.sessionTimestamp || m.timestamp || 0, resumo: '' });
          });
          return [...map.values()].sort((a,b) => b.ts - a.ts);
        })();
        const filterMonoMarker = (m) => {
          const id = m.sessionId || String(m.sessionTimestamp || m.timestamp || '');
          return !hiddenMonopolarSessions.has(id);
        };
        const todosL = hiddenMonopolarSessions.size > 0 ? todosL_raw.filter(filterMonoMarker) : todosL_raw;
        const todosR = hiddenMonopolarSessions.size > 0 ? todosR_raw.filter(filterMonoMarker) : todosR_raw;
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
          const filtrados = filtradosRaw.filter((m, i) => {
            return !filtradosRaw.some((outro, j) => {
              if (i === j) return false;
              if (Math.abs((m.amp || 0) - (outro.amp || 0)) >= 0.2) return false;
              const mIsPos = ['tremor','rigidez','bradicinesia'].includes(m.tipo);
              const outroIsPos = ['tremor','rigidez','bradicinesia'].includes(outro.tipo);
              const tsM     = m.timestamp     || m.sessionTimestamp     || 0;
              const tsOutro = outro.timestamp || outro.sessionTimestamp || 0;
              const outroMaisRecente    = tsOutro > tsM;
              const outroTemPrioridade  = tsOutro === tsM && mIsPos && !outroIsPos;
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
                  {monoSessions.length > 1 && (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {monoSessions.map(sess => {
                        const visible = !hiddenMonopolarSessions.has(sess.id);
                        return (
                          <button key={sess.id} onClick={() => toggleMonopolarSession(sess.id)}
                            className={`text-[7px] font-bold px-1.5 py-0.5 rounded border transition-all ${visible ? 'bg-violet-600 border-violet-500 text-violet-100' : 'bg-violet-900/60 border-violet-700 text-violet-400 line-through'}`}>
                            {new Date(sess.ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})}
                          </button>
                        );
                      })}
                      <span className="text-[6px] text-violet-300 ml-1">clique para ocultar/mostrar</span>
                    </div>
                  )}
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


      {/* CONFIRM NEW SESSION MODAL */}
      {confirmNewSession && (() => {
        const ativos = sessions.filter(s => s.type === 'active').sort((a,b) => b.timestamp - a.timestamp);
        const recente = ativos[0];
        const minAtras = recente ? Math.round((Date.now() - recente.timestamp) / 60000) : 0;
        const abrirRecente = () => {
          if (!recente) return;
          setEditingSessionId(recente.id);
          setTipoEletrodo(recente.tipoEletrodo || '4-ring');
          setModoAmplitude(recente.modoAmplitude || 'mA');
          try { setDadosGrupos(capPrograms(normalizeGrupos(recente.dadosGrupos, recente.tipoEletrodo||'4-ring')) || recente.dadosGrupos); } catch(e){}
          setClinica(recente.clinica || { tremor:0, rigidez:0, bradicinesia:0 });
          setEfeitosColaterais(recente.efeitosColaterais || { L:[], R:[] });
          setNotasLivres(recente.notasLivres || '');
          setResumoSessao(recente.resumoSessao || '');
          setTendenciasEstimulacao(recente.tendenciasEstimulacao || '');
          setVoltagemBateria(recente.voltagemBateria || '');
          setImpedanciaL(recente.impedanciaL || '');
          setImpedanciaR(recente.impedanciaR || '');
          setMarcadoresClinicosL(recente.marcadoresClinicosL || []);
          setMarcadoresClinicosR(recente.marcadoresClinicosR || []);
          setConfirmNewSession(null);
        };
        const prosseguir = () => {
          setConfirmNewSession(null);
          if (confirmNewSession === 'copy') handleSalvarSessao(false);
          else handleCriarSessaoVazia();
        };
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <h3 className="font-bold text-slate-800 text-base mb-1">Sessão recente detectada</h3>
              <p className="text-sm text-slate-500 mb-5">
                Já existe uma sessão salva há <strong>{minAtras} min</strong> ({formatarData(recente?.timestamp || 0)}).
                Deseja abrir essa sessão ou criar uma nova?
              </p>
              <div className="flex flex-col gap-2">
                <button onClick={abrirRecente}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                  📂 Abrir sessão recente
                </button>
                <button onClick={prosseguir}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                  {confirmNewSession === 'copy' ? '📋 Criar nova copiando dados' : '✦ Criar nova sessão vazia'}
                </button>
                <button onClick={() => setConfirmNewSession(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 underline mt-1 self-center">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: HISTÓRICO COMPLETO DE PROGRAMAÇÃO */}
      {showHistoricoText && (() => {
        const sessionsAtivas = sessions.filter(s => s.type === 'active')
          .sort((a, b) => b.timestamp - a.timestamp);
        const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEletrodo];
        const linhas = sessionsAtivas.map(sess => {
          const data = formatarData(sess.timestamp);
          const grupos = sess.dadosGrupos || {};
          const ord = ORDEM_TEXTO_BAIXO_CIMA[sess.tipoEletrodo || '4-ring'];

          // Header line: date + resumo
          let txt = `${'─'.repeat(50)}\n📅 ${data}`;
          if (sess.resumoSessao) txt += ` — ${sess.resumoSessao}`;
          txt += '\n';

          // Groups with programming + efeito annotation
          ['A','B','C','D'].forEach(g => {
            const grupo = grupos[g];
            if (!grupo) return;
            const hasData = ['L','R'].some(l => (grupo[l]||[]).length > 0);
            if (!hasData) return;
            // Get efeito from prog.efeito (stored per-prog) or session-level efeitosGrupos
            const progL0 = (grupo['L'] || [])[0];
            const efeito = progL0?.efeito || sess.efeitosGrupos?.[g];
            const efeitoTexto = progL0?.efeitoTexto;
            const efeitoLabel = efeito && efeito !== 'neutro'
              ? ` [${efeito === 'bom' ? '★ melhor'
                  : efeito === 'pouco' ? '△ pouco'
                  : efeitoTexto ? `✗ ${efeitoTexto}` : '✗ ruim'}]`
              : '';
            txt += `Grupo ${g}${efeitoLabel}:\n`;
            ['L','R'].forEach(lado => {
              const leadStr = lado === 'L' ? 'E' : 'D';
              (grupo[lado] || []).forEach((prog, idx) => {
                const progs = grupo[lado];
                const leadName = progs.length > 1 ? `  Lead ${leadStr}${idx+1}` : `  Lead ${leadStr}`;
                const contactStr = ord.map(c => {
                  const st = prog.contatos?.[c]?.state || 'off';
                  if (st === 'off') return '0';
                  const perc = prog.contatos[c]?.perc;
                  return perc < 100 ? `${st}(${perc}%)` : st;
                }).join('');
                txt += `${leadName}: ${contactStr}  ${prog.amp?.toFixed(1)}mA  ${prog.pw}µs  ${prog.freq}Hz\n`;
              });
            });
          });

          // Battery and impedance
          const extras = [];
          if (sess.voltagemBateria) extras.push(`🔋 ${sess.voltagemBateria}V`);
          if (sess.impedanciaL)     extras.push(`Imp E: ${sess.impedanciaL}Ω`);
          if (sess.impedanciaR)     extras.push(`Imp D: ${sess.impedanciaR}Ω`);
          if (extras.length) txt += extras.join('  ') + '\n';

          return txt;
        }).join('\n');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowHistoricoText(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-800 text-white rounded-t-2xl">
                <div>
                  <h2 className="font-bold text-sm">Histórico Completo de Programação</h2>
                  <p className="text-[10px] text-slate-400">{activePatient?.nome} — {sessionsAtivas.length} sessão(ões), mais recente primeiro</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(linhas); }}
                    className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-all">
                    📋 Copiar
                  </button>
                  <button onClick={() => setShowHistoricoText(false)}
                    className="text-white hover:text-slate-300 font-bold text-lg leading-none ml-2">×</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* Battery chart */}
                {(() => {
                  const batData = sessionsAtivas
                    .map(s => ({ ts: s.timestamp, v: parseFloat(String(s.voltagemBateria||'').replace(',','.')) }))
                    .filter(d => !isNaN(d.v) && d.v > 0)
                    .reverse(); // oldest first for chart
                  if (batData.length < 2) return null;
                  const W = 560, H = 80, pad = { l: 32, r: 10, t: 8, b: 20 };
                  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
                  const minV = Math.min(...batData.map(d => d.v)) - 0.1;
                  const maxV = Math.max(...batData.map(d => d.v)) + 0.1;
                  const minTs = batData[0].ts, maxTs = batData[batData.length-1].ts;
                  const tsRange = maxTs - minTs || 1;
                  const toX = ts => pad.l + ((ts - minTs) / tsRange) * iW;
                  const toY = v => pad.t + iH - ((v - minV) / (maxV - minV)) * iH;
                  const pts = batData.map(d => `${toX(d.ts)},${toY(d.v)}`).join(' ');
                  return (
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bateria (V) ao longo do tempo</p>
                      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="bg-white border border-slate-200 rounded-lg">
                        {/* Y gridlines */}
                        {[0,0.25,0.5,0.75,1].map(f => {
                          const v = minV + f*(maxV-minV);
                          const y = toY(v);
                          return <g key={f}>
                            <line x1={pad.l} y1={y} x2={W-pad.r} y2={y} stroke="#f1f5f9" strokeWidth={1}/>
                            <text x={pad.l-3} y={y+3} textAnchor="end" fontSize={7} fill="#94a3b8">{v.toFixed(1)}</text>
                          </g>;
                        })}
                        {/* Line */}
                        <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round"/>
                        {/* Points */}
                        {batData.map((d,i) => (
                          <circle key={i} cx={toX(d.ts)} cy={toY(d.v)} r={3} fill="#f59e0b">
                            <title>{new Date(d.ts).toLocaleDateString('pt-BR')} — {d.v}V</title>
                          </circle>
                        ))}
                      </svg>
                    </div>
                  );
                })()}
                <pre className="text-[11px] font-mono text-slate-700 leading-relaxed whitespace-pre-wrap">{linhas}</pre>
              </div>
            </div>
          </div>
        );
      })()}

      {/* UPDRS MODAL */}
      {showUPDRS && (
        <UPDRSModal
          onClose={() => setShowUPDRS(false)}
          onInserir={(text) => {
            setNotasLivres(prev => (prev ? prev + '\n\n' : '') + text);
          }}
        />
      )}

      {/* SCALES MODAL */}
      {showScales && (
        <ScalesModal
          onClose={() => setShowScales(false)}
          onInserir={(text) => {
            setNotasLivres(prev => (prev ? prev + '\n\n' : '') + text);
          }}
        />
      )}

      {/* EXTRATOR DE PRONTUÁRIOS */}
      {showAISettings && (
        <AISettingsModal
          onClose={() => setShowAISettings(false)}
          onSaved={(cfg) => setAiConfig(cfg)}
        />
      )}
      {showJSONImport && (
        <JSONImportModal
          onClose={() => setShowJSONImport(false)}
          user={user}
          patients={patients}
          onPatientCreated={(p) => {
            setPatients(prev => [p, ...prev]);
            setActivePatient(p);
          }}
          onImportDone={() => {
            setShowJSONImport(false);
            showToast('Importação JSON concluída!');
          }}
        />
      )}
      {showExtrator && (
        <ExtractorModal
          onClose={() => setShowExtrator(false)}
          pacienteInicial={activePatient}
          onImportarPaciente={async (nome, hc, reviewed) => {
            // Encontrar ou criar paciente
            let paciente = patients.find(p => (p.hc || '').trim() === (hc || '').trim());
            if (!paciente) {
              const ref = await addDoc(
                collection(db, `artifacts/${appId}/users/${user.uid}/patients`),
                { nome, hc, criadoEm: Date.now() }
              );
              paciente = { id: ref.id, nome, hc };
            }
            // Importar cada sessão revisada
            let importadas = 0;
            for (const row of reviewed) {
              if (!row.parsed || Object.keys(row.parsed).length === 0) continue;
              try {
              // Converter data dd/mm/yyyy para timestamp
              let ts = Date.now();
              if (row.date) {
                const parts = row.date.split('/');
                if (parts.length === 3) {
                  const d = parseInt(parts[0]), mo = parseInt(parts[1]), y = parseInt(parts[2]);
                  const parsed = new Date(y, mo - 1, d);
                  if (!isNaN(parsed.getTime())) ts = parsed.getTime();
                }
              }
              await addDoc(
                collection(db, `artifacts/${appId}/users/${user.uid}/sessions`),
                {
                  patientId: paciente.id,
                  timestamp: ts,
                  dadosGrupos: convertParsedGrupos(row.parsed, row.tipoEletrodo),
                  tipoEletrodo: row.tipoEletrodo || '4-ring',
                  resumoSessao: row.evolution || '',
                  notasLivres: '',
                  tendenciasEstimulacao: row.tendencias || '',
                  clinica: '',
                  type: 'active',
                  importadoViaExtrator: true,
                  voltagemBateria: row.voltagemBateria || '',
                  impedanciaL: row.impedanciaL || '',
                  impedanciaR: row.impedanciaR || '',
                  marcadoresClinicosL: row.marcadoresClinicosL || [],
                  marcadoresClinicosR: row.marcadoresClinicosR || [],
                  efeitosColaterais: { L: [], R: [] },
                }
              );
                importadas++;
              } catch(rowErr) {
                console.error('Erro ao importar sessão:', row.date, rowErr);
                showToast(`⚠ Erro ao importar sessão ${row.date || '?'}: ${rowErr.message}`);
              }
            }
            setShowExtrator(false);
            alert(`✓ ${importadas} sessão(ões) importadas para ${nome} (HC ${hc})`);
          }}
        />
      )}

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
        Feito por Rafael Carra. Grupo de neuroengenharia HCFMUSP. Comentários e sugestões envie para rafael.carra@hc.fm.usp.br.
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
