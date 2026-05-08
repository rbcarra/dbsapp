import React, { useState, useCallback, useMemo } from 'react';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { getContatosIniciais, ORDEM_TEXTO_BAIXO_CIMA } from './constants';
import { db, appId } from './firebase';

// ─── CONTACT MAPPER ──────────────────────────────────────────────────────────
// Maps JSON contato_catodo / contato_anodo strings to our internal contact object.
// The dicionário uses 1-indexed contact numbers (contact "1" = index 0 in 4-ring).
// For directional contacts like "2A", "1B+2B", we map to the ring level.
const mapContacts = (catodo, anodo, tipoEletrodo = '4-ring') => {
  const contacts = getContatosIniciais(tipoEletrodo);
  const ordem = ORDEM_TEXTO_BAIXO_CIMA[tipoEletrodo]; // e.g. ['0','1','2','3']
  const n = ordem.length;

  const parseRef = (ref) => {
    if (!ref || /^case$/i.test(ref.trim())) return [];
    return ref.split(/[,+;&/]/).map(s => s.trim()).filter(Boolean);
  };

  const applyContact = (ref, state) => {
    for (const token of parseRef(ref)) {
      // Extract base number, stripping directional letters (A, B, C)
      const numMatch = token.match(/(\d+)/);
      if (!numMatch) continue;
      const num = parseInt(numMatch[1]);
      // Try 0-indexed first if num < n, else 1-indexed
      const idx = num < n ? num : num - 1;
      const key = ordem[idx];
      if (key !== undefined) {
        contacts[key] = { state, perc: 100 };
      }
    }
  };

  applyContact(catodo, '-');
  applyContact(anodo, '+');
  return contacts;
};

// ─── JSON PARSER ─────────────────────────────────────────────────────────────
// Tolerant parser: accepts the full dicionário format OR simplified sub-objects.
// Returns { paciente, dispositivos, eletrodos, programacoes, avaliacoes, medicacoes }
const parseJSON = (raw) => {
  let data;
  try { data = JSON.parse(raw); } catch (e) { throw new Error(`JSON inválido: ${e.message}`); }

  // Support both wrapped { paciente: {...}, programacoes: [...] }
  // and array of sessions [ { programacao_id, ... } ]
  if (Array.isArray(data)) {
    // Plain array of programações
    return { paciente: null, dispositivos: [], eletrodos: [], programacoes: data, avaliacoes: [], medicacoes: [], cirurgias: [] };
  }

  return {
    paciente:    data.paciente    || data.patient     || null,
    dispositivos: Array.isArray(data.dispositivos)  ? data.dispositivos
                : data.dispositivo ? [data.dispositivo] : [],
    eletrodos:   Array.isArray(data.eletrodos)      ? data.eletrodos
                : data.eletrodo   ? [data.eletrodo]   : [],
    programacoes: Array.isArray(data.programacoes)  ? data.programacoes
                 : Array.isArray(data.sessions)      ? data.sessions
                 : data.programacao ? [data.programacao] : [],
    avaliacoes:  Array.isArray(data.avaliacoes)     ? data.avaliacoes   : [],
    medicacoes:  Array.isArray(data.medicacoes)     ? data.medicacoes   : [],
    cirurgias:   Array.isArray(data.cirurgias)      ? data.cirurgias    : [],
  };
};

// ─── SESSION BUILDER ─────────────────────────────────────────────────────────
// Converts a JSON programação record to our internal session format.
const buildSession = (prog, dispositivo, eletrodo, avaliacoes, medicacoes) => {
  const ts = prog.data_programacao
    ? new Date(prog.data_programacao).getTime() || Date.now()
    : Date.now();

  const modoAmplitude = (prog.modo_estimulacao || '').toLowerCase().includes('voltage')
    || (prog.modo_estimulacao || '').toLowerCase().includes('voltage')
    || (prog.modo_estimulacao || '') === 'cVoltage' ? 'V' : 'mA';

  // Device info
  const dispositivoInfo = {
    fabricante:      dispositivo?.fabricante      || '',
    modeloIPG:       dispositivo?.modelo_ipg      || '',
    modeloEletrodoE: dispositivo?.modelo_eletrodo_e || '',
    modeloEletrodoD: dispositivo?.modelo_eletrodo_d || '',
    alvoAnatomicоE:  eletrodo?.alvo_anatomico_e   || '',
    alvoAnatomicоD:  eletrodo?.alvo_anatomico_d   || '',
    dataImplante:    dispositivo?.data_implante_ipg || '',
    dataTrocaIPG:    dispositivo?.data_troca_ipg   || '',
  };

  // Electrode type: infer from num_contatos or tipo_contato
  const numContacts = dispositivo?.num_contatos_e || dispositivo?.num_contatos_d || 4;
  const tipoEletrodo = numContacts >= 8 ? '8-ring'
    : (dispositivo?.tipo_contato || '').toLowerCase().includes('direcional') ? '4-dir' : '4-ring';

  // Build dadosGrupos from parametros array
  const makeEmpty = () => ({
    contatos: getContatosIniciais(tipoEletrodo), amp: 0, pw: 60, freq: 130, efeito: 'neutro'
  });
  const grupos = {
    A: { L: [makeEmpty()], R: [makeEmpty()] },
    B: { L: [makeEmpty()], R: [makeEmpty()] },
    C: { L: [makeEmpty()], R: [makeEmpty()] },
    D: { L: [makeEmpty()], R: [makeEmpty()] },
  };

  const params = Array.isArray(prog.parametros) ? prog.parametros
    : Array.isArray(prog.params)    ? prog.params
    : Array.isArray(prog.contatos_params) ? prog.contatos_params : [];

  params.forEach(p => {
    const grupoMap = { 1:'A', 2:'B', 3:'C', 4:'D' };
    const g = grupoMap[p.programa_num] || grupoMap[parseInt(p.programa_num)] || 'A';
    const side = (p.lado || '').toUpperCase() === 'E' ? 'L' : 'R';
    const idx = (p.polo_idx ?? 0); // interleaving index within same group/side

    const contatos = mapContacts(p.contato_catodo, p.contato_anodo, tipoEletrodo);
    const prog_entry = {
      contatos,
      amp:   parseFloat(p.amplitude)     || 0,
      pw:    parseFloat(p.largura_pulso_us) || parseFloat(p.pw_us) || 60,
      freq:  parseFloat(p.frequencia_hz)  || parseFloat(p.freq_hz) || 130,
      efeito: 'neutro',
    };

    if (!grupos[g]) grupos[g] = { L: [makeEmpty()], R: [makeEmpty()] };
    if (!grupos[g][side]) grupos[g][side] = [makeEmpty()];
    if (idx === 0) {
      grupos[g][side][0] = prog_entry;
    } else if (grupos[g][side].length < 2) {
      grupos[g][side].push(prog_entry);
    }
  });

  // Clinical scales
  const avaliacao = avaliacoes.find(a =>
    a.programacao_id === prog.programacao_id || !a.programacao_id
  ) || null;

  // Build notasLivres from all non-programming data
  const notasLivresParts = [];

  if (prog.notas_programacao) {
    notasLivresParts.push(`=== Notas da sessão ===\n${prog.notas_programacao}`);
  }

  if (avaliacao) {
    const scaleLines = [];
    const scaleMap = {
      updrs_iii:    'UPDRS-III', updrs_i: 'UPDRS-I', updrs_ii: 'UPDRS-II', updrs_iv: 'UPDRS-IV',
      hoehn_yahr:   'Hoehn & Yahr', schwab_england: 'Schwab & England',
      bfm_movement: 'BFM Movimento', bfm_disability: 'BFM Incapacidade',
      twstrs_total: 'TWSTRS', tremor_fahn: 'Fahn-Tolosa-Marín',
      bdi_ii: 'BDI-II', mmse: 'MMSE', moca: 'MoCA',
      pdq39_total: 'PDQ-39', sf36_pcs: 'SF-36 PCS', sf36_mcs: 'SF-36 MCS',
      eq5d_index: 'EQ-5D', nms_quest: 'NMS-Quest', ess_total: 'ESS',
      falls_3m: 'Quedas 3m', freezing_gait_quest: 'FOG-Q', tug_s: 'TUG (s)',
    };
    Object.entries(scaleMap).forEach(([k, label]) => {
      if (avaliacao[k] !== null && avaliacao[k] !== undefined && avaliacao[k] !== '') {
        scaleLines.push(`${label}: ${avaliacao[k]}`);
      }
    });
    if (avaliacao.condicao_teste) scaleLines.unshift(`Condição: ${avaliacao.condicao_teste}`);
    if (scaleLines.length) notasLivresParts.push(`=== Avaliação clínica ===\n${scaleLines.join('\n')}`);
    if (avaliacao.notas_avaliacao) notasLivresParts.push(`Obs: ${avaliacao.notas_avaliacao}`);
  }

  if (medicacoes.length > 0) {
    const medLines = medicacoes.map(m => {
      const dose = m.dose_total_diaria_mg ? `${m.dose_total_diaria_mg}mg/dia` : '';
      return `- ${m.principio_ativo || m.nome_comercial || '?'} ${dose}`.trim();
    });
    notasLivresParts.push(`=== Medicações ===\n${medLines.join('\n')}`);
  }

  // Cycling
  const cyclingL = !!(prog.cycling);
  const cyclingR = !!(prog.cycling);

  return {
    timestamp: ts,
    type: 'active',
    tipoEletrodo,
    modoAmplitude,
    dispositivoInfo,
    dadosGrupos: grupos,
    clinica: { tremor: 0, rigidez: 0, bradicinesia: 0 },
    efeitosColaterais: { L: [], R: [] },
    notasLivres: notasLivresParts.join('\n\n'),
    resumoSessao: prog.notas_programacao || '',
    tendenciasEstimulacao: '',
    voltagemBateria: dispositivo?.voltagem_bateria ? String(dispositivo.voltagem_bateria) : '',
    impedanciaL: '', impedanciaR: '',
    cyclingL, cyclingR,
    marcadoresClinicosL: [], marcadoresClinicosR: [],
    _sourceId: prog.programacao_id || null,
    _tipoSessao: prog.tipo_sessao || '',
    _programador: prog.programador || '',
  };
};

// ─── STEP COMPONENTS ─────────────────────────────────────────────────────────

const StepUpload = ({ onParsed }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target.result);
    reader.readAsText(file, 'utf-8');
  };

  const handleParse = () => {
    setError('');
    try {
      const parsed = parseJSON(text.trim());
      if (!parsed.programacoes.length) throw new Error('Nenhuma sessão de programação encontrada no JSON.');
      onParsed(parsed, text.trim());
    } catch(e) { setError(e.message); }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Carregue um arquivo JSON exportado no formato do dicionário de dados, ou cole o conteúdo abaixo.
      </p>

      <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-xl p-6 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all gap-2">
        <span className="text-2xl">📂</span>
        <span className="text-sm font-bold text-indigo-600">Clique para carregar arquivo .json</span>
        <span className="text-[10px] text-slate-400">ou arraste o arquivo aqui</span>
        <input type="file" accept=".json,application/json" onChange={handleFile} className="hidden"/>
      </label>

      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={8}
          placeholder={'Cole o JSON aqui ou carregue o arquivo acima...\n\nFormatos aceitos:\n• Objeto com paciente + programacoes\n• Array direto de programacoes\n• Objeto único de programação'}
          className="w-full text-[10px] font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y text-slate-700 placeholder-slate-300"
        />
        {text && (
          <button onClick={() => setText('')}
            className="absolute top-2 right-2 text-[10px] text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5">
            limpar
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 text-xs text-rose-700">
          ⚠ {error}
        </div>
      )}

      <button onClick={handleParse} disabled={!text.trim()}
        className="w-full py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">
        Analisar JSON →
      </button>
    </div>
  );
};

const StepPreview = ({ parsed, patients, onConfirm, onBack }) => {
  const [matchedPatientId, setMatchedPatientId] = useState('');
  const [nomePaciente, setNomePaciente] = useState(parsed.paciente?.nome || '');
  const [hcPaciente, setHcPaciente] = useState(parsed.paciente?.hc || parsed.paciente?.registro_hc || '');
  const [selectedSessions, setSelectedSessions] = useState(() =>
    new Set(parsed.programacoes.map((_, i) => i))
  );

  const pac = parsed.paciente;
  const disp = parsed.dispositivos[0] || null;
  const elec = parsed.eletrodos[0] || null;

  const toggleSession = (i) => setSelectedSessions(prev => {
    const s = new Set(prev);
    s.has(i) ? s.delete(i) : s.add(i);
    return s;
  });

  // Try to auto-match patient by HC or name
  React.useEffect(() => {
    if (!patients.length) return;
    const hc = hcPaciente.trim();
    const nome = nomePaciente.trim().toLowerCase();
    if (hc) {
      const m = patients.find(p => (p.hc || '').trim() === hc);
      if (m) { setMatchedPatientId(m.id); return; }
    }
    if (nome) {
      const m = patients.find(p => (p.nome || '').toLowerCase().includes(nome) || nome.includes((p.nome||'').toLowerCase()));
      if (m) setMatchedPatientId(m.id);
    }
  }, []);

  const canConfirm = selectedSessions.size > 0 && (matchedPatientId || (nomePaciente.trim()));

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs text-slate-600 flex flex-col gap-1">
        <div className="flex justify-between">
          <span className="font-bold text-slate-700">Sessões encontradas</span>
          <span className="font-mono font-bold text-indigo-600">{parsed.programacoes.length}</span>
        </div>
        {disp && <div className="flex justify-between">
          <span>Dispositivo</span>
          <span>{[disp.fabricante, disp.modelo_ipg].filter(Boolean).join(' ')}</span>
        </div>}
        {elec && <div className="flex justify-between">
          <span>Alvo</span>
          <span>{[elec.alvo_anatomico_e, elec.alvo_anatomico_d].filter(Boolean).join(' / ')}</span>
        </div>}
        {parsed.avaliacoes.length > 0 && <div className="flex justify-between">
          <span>Avaliações</span><span>{parsed.avaliacoes.length}</span>
        </div>}
        {parsed.medicacoes.length > 0 && <div className="flex justify-between">
          <span>Registros de medicação</span><span>{parsed.medicacoes.length}</span>
        </div>}
      </div>

      {/* Patient matching */}
      <div>
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
          Vincular ao paciente
        </label>
        <div className="flex flex-col gap-2">
          <select value={matchedPatientId} onChange={e => setMatchedPatientId(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400">
            <option value="">— Selecionar paciente existente —</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.nome} {p.hc ? `(HC: ${p.hc})` : ''}</option>
            ))}
          </select>
          {!matchedPatientId && (
            <div className="text-[9px] text-slate-400 text-center">— ou criar novo paciente —</div>
          )}
          {!matchedPatientId && (
            <div className="flex gap-2">
              <input value={nomePaciente} onChange={e => setNomePaciente(e.target.value)}
                placeholder="Nome do paciente"
                className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"/>
              <input value={hcPaciente} onChange={e => setHcPaciente(e.target.value)}
                placeholder="HC / Registro"
                className="w-28 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"/>
            </div>
          )}
        </div>
      </div>

      {/* Session list */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
            Sessões a importar ({selectedSessions.size}/{parsed.programacoes.length})
          </label>
          <div className="flex gap-2">
            <button onClick={() => setSelectedSessions(new Set(parsed.programacoes.map((_,i)=>i)))}
              className="text-[8px] text-slate-400 hover:text-slate-700 underline">todas</button>
            <button onClick={() => setSelectedSessions(new Set())}
              className="text-[8px] text-slate-400 hover:text-slate-700 underline">nenhuma</button>
          </div>
        </div>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {parsed.programacoes.map((prog, i) => {
            const date = prog.data_programacao
              ? new Date(prog.data_programacao).toLocaleDateString('pt-BR')
              : `Sessão ${i+1}`;
            const nParams = (prog.parametros || prog.params || []).length;
            const tipo = prog.tipo_sessao || '';
            return (
              <label key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selectedSessions.has(i)} onChange={() => toggleSession(i)}
                  className="accent-indigo-500 w-3.5 h-3.5"/>
                <span className="text-xs font-mono text-slate-700 flex-1">{date}</span>
                {tipo && <span className="text-[8px] text-indigo-500 font-bold">{tipo}</span>}
                <span className="text-[8px] text-slate-400">{nParams} parâmetro(s)</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onBack}
          className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">
          ← Voltar
        </button>
        <button
          onClick={() => onConfirm({
            matchedPatientId, nomePaciente, hcPaciente,
            selectedIndices: [...selectedSessions],
          })}
          disabled={!canConfirm}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">
          Importar {selectedSessions.size} sessão(ões) →
        </button>
      </div>
    </div>
  );
};

const StepProgress = ({ log }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-bold text-slate-600 mb-1">Importando...</p>
    <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
      {log.map((entry, i) => (
        <div key={i} className={`flex items-start gap-2 text-[10px] font-mono ${
          entry.type === 'ok'   ? 'text-emerald-700' :
          entry.type === 'err'  ? 'text-rose-600' : 'text-slate-500'}`}>
          <span className="shrink-0 mt-0.5">
            {entry.type === 'ok' ? '✓' : entry.type === 'err' ? '✗' : '…'}
          </span>
          <span>{entry.msg}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────
export const JSONImportModal = ({ onClose, user, patients, onPatientCreated, onImportDone }) => {
  const [step, setStep] = useState('upload'); // upload | preview | progress | done
  const [parsed, setParsed] = useState(null);
  const [rawText, setRawText] = useState('');
  const [log, setLog] = useState([]);
  const [importedCount, setImportedCount] = useState(0);

  const addLog = (msg, type = 'info') => setLog(prev => [...prev, { msg, type }]);

  const handleParsed = (data, raw) => {
    setParsed(data);
    setRawText(raw);
    setStep('preview');
  };

  const handleConfirm = async ({ matchedPatientId, nomePaciente, hcPaciente, selectedIndices }) => {
    setStep('progress');
    setLog([]);
    let count = 0;

    try {
      // ── Resolve patient ────────────────────────────────────────────────────
      let patientId = matchedPatientId;
      if (!patientId) {
        addLog(`Criando paciente "${nomePaciente}"…`);
        const ref = await addDoc(
          collection(db, 'artifacts', appId, 'users', user.uid, 'patients'),
          { nome: nomePaciente.trim(), hc: hcPaciente.trim(), createdAt: Date.now() }
        );
        patientId = ref.id;
        onPatientCreated?.({ id: patientId, nome: nomePaciente.trim(), hc: hcPaciente.trim() });
        addLog(`Paciente criado (id: ${patientId.slice(0,8)}…)`, 'ok');
      } else {
        const p = patients.find(x => x.id === patientId);
        addLog(`Vinculando a ${p?.nome || patientId}…`, 'ok');
      }

      // ── Import selected sessions ───────────────────────────────────────────
      const disp = parsed.dispositivos[0] || null;
      const elec = parsed.eletrodos[0]    || null;

      for (const idx of selectedIndices) {
        const prog = parsed.programacoes[idx];
        const dateLabel = prog.data_programacao
          ? new Date(prog.data_programacao).toLocaleDateString('pt-BR')
          : `Sessão ${idx + 1}`;
        addLog(`Importando ${dateLabel}…`);

        try {
          const sessionData = buildSession(prog, disp, elec, parsed.avaliacoes, parsed.medicacoes);
          const { _sourceId, _tipoSessao, _programador, ...cleanData } = sessionData;

          await addDoc(
            collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'),
            { ...cleanData, patientId, importadoViaJSON: true, jsonSourceId: _sourceId }
          );
          count++;
          addLog(`${dateLabel} — ok (${(cleanData.dadosGrupos ? Object.values(cleanData.dadosGrupos).filter(g=>g.L?.[0]?.amp>0||g.R?.[0]?.amp>0).length : 0)} grupo(s) com estimulação)`, 'ok');
        } catch(e) {
          addLog(`${dateLabel} — erro: ${e.message}`, 'err');
        }
      }

      setImportedCount(count);
      addLog(`\nConcluído: ${count} sessão(ões) importada(s).`, count > 0 ? 'ok' : 'err');
      setStep('done');
      onImportDone?.();
    } catch(e) {
      addLog(`Erro crítico: ${e.message}`, 'err');
      setStep('done');
    }
  };

  const titles = {
    upload: 'Importar JSON',
    preview: 'Revisar importação',
    progress: 'Importando…',
    done: 'Importação concluída',
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={step === 'upload' ? onClose : undefined}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-indigo-50">
          <div>
            <h2 className="font-bold text-slate-800 text-sm">{titles[step]}</h2>
            <p className="text-[10px] text-slate-400">
              {step === 'upload' ? 'Formato: dicionário de dados DBS v1.0'
              : step === 'preview' ? `${parsed?.programacoes.length} sessão(ões) detectada(s)`
              : step === 'done' ? `${importedCount} sessão(ões) importada(s) com sucesso`
              : 'Aguarde…'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'upload'   && <StepUpload onParsed={handleParsed}/>}
          {step === 'preview'  && (
            <StepPreview
              parsed={parsed}
              patients={patients}
              onConfirm={handleConfirm}
              onBack={() => setStep('upload')}
            />
          )}
          {(step === 'progress' || step === 'done') && <StepProgress log={log}/>}
        </div>

        {/* Footer for done state */}
        {step === 'done' && (
          <div className="px-5 pb-4">
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
