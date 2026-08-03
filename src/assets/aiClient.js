// ─── AI CLIENT ────────────────────────────────────────────────────────────────
// Conexão com o PC local que roda o servidor.py (transcrição + Ollama via proxy).
// Agora é UM PACOTE SÓ: uma URL base única, um só certificado HTTPS.
// Config em localStorage. Requests em HTTPS (o PC expõe certificado).

const LS_KEY = 'dbs_ai_config';

const DEFAULT_CONFIG = {
  serverUrl: '',        // ex: https://meu-pc.local:8765  (servidor.py com extensão de IA)
  apiToken: '',         // token compartilhado (deve bater com API_TOKEN do servidor)
  ollamaModel: 'llama3.1',
  enabled: false,
};

export const getAIConfig = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    // Migração: se tiver config antiga com ollamaUrl/transcribeUrl, usa a primeira como serverUrl
    if (!parsed.serverUrl && (parsed.ollamaUrl || parsed.transcribeUrl)) {
      parsed.serverUrl = parsed.ollamaUrl || parsed.transcribeUrl;
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
};

export const saveAIConfig = (config) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
};

const base = (cfg) => (cfg.serverUrl || '').replace(/\/$/, '');

// Cabeçalho de autorização (token compartilhado). Vazio se não configurado.
const authHeaders = (cfg) => cfg.apiToken ? { 'Authorization': `Bearer ${cfg.apiToken}` } : {};

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
// Um único /health consolidado retorna o estado de Whisper + Ollama + fila.
export const checkHealth = async (config) => {
  const cfg = config || getAIConfig();
  const result = { ollama: false, transcribe: false, fila: null, modelos: [] };
  if (!cfg.serverUrl) return result;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(base(cfg) + '/api/health', { method: 'GET', signal: ctrl.signal, headers: { ...authHeaders(cfg) } });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      result.ollama = !!data.ollama;
      result.transcribe = !!data.whisper;
      result.fila = data.fila || null;
      result.modelos = data.modelos_disponiveis || [];
    }
  } catch {
    // servidor offline → tudo false
  }
  return result;
};

// ─── OLLAMA GENERATE (via proxy) ──────────────────────────────────────────────
export const ollamaGenerate = async ({ prompt, system, config, model }) => {
  const cfg = config || getAIConfig();
  if (!cfg.serverUrl) throw new Error('URL do servidor não configurada.');
  const body = { model: model || cfg.ollamaModel || 'llama3.1', prompt, stream: false };
  if (system) body.system = system;
  const res = await fetch(base(cfg) + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Servidor respondeu ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.response ?? '';
};

// ─── GLOSSÁRIO MÉDICO (initial_prompt do Whisper) ─────────────────────────────
export const MEDICAL_GLOSSARY = [
  'DBS', 'estimulação cerebral profunda', 'STN', 'núcleo subtalâmico', 'GPi', 'globo pálido interno',
  'VIM', 'tálamo', 'IPG', 'gerador de pulsos', 'eletrodo', 'contato', 'catodo', 'anodo',
  'monopolar', 'bipolar', 'interleaving', 'cycling', 'impedância', 'amplitude', 'frequência',
  'largura de pulso', 'microlesão',
  'levodopa', 'Prolopa', 'carbidopa', 'benserazida', 'pramipexol', 'Sifrol', 'rasagilina', 'Azilect',
  'amantadina', 'entacapona', 'Comtan', 'opicapona', 'Ongentys', 'safinamida', 'apomorfina',
  'foslevodopa', 'foscarbidopa', 'clonazepam', 'escitalopram',
  'bradicinesia', 'rigidez', 'tremor', 'discinesia', 'distonia', 'freezing', 'congelamento',
  'festinação', 'hipofonia', 'disartria', 'parestesia', 'flutuação motora', 'wearing-off',
  'on', 'off', 'período on', 'período off',
  'travado', 'travar', 'em off', 'deu cápsula', 'formigou', 'formigamento', 'endureceu',
  'perna dura', 'mão tremendo', 'lentidão', 'não desliga', 'melhorou', 'piorou',
].join(', ');

// ─── WHISPER TRANSCRIBE ───────────────────────────────────────────────────────
export const transcribeAudio = async ({ audioBlob, config, initialPrompt }) => {
  const cfg = config || getAIConfig();
  if (!cfg.serverUrl) throw new Error('URL do servidor não configurada.');
  const form = new FormData();
  form.append('audio', audioBlob, 'consulta.webm');
  form.append('initial_prompt', initialPrompt || MEDICAL_GLOSSARY);
  form.append('language', 'pt');
  const res = await fetch(base(cfg) + '/api/transcribe', { method: 'POST', headers: { ...authHeaders(cfg) }, body: form });
  if (!res.ok) throw new Error(`Servidor de transcrição respondeu ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.erro) throw new Error(data.erro);
  return data.text ?? '';
};

// ─── ORGANIZAR TRANSCRIÇÃO ────────────────────────────────────────────────────
export const organizarTranscricao = async ({ transcricao, contexto, config, model }) => {
  const cfg = config || getAIConfig();
  if (!cfg.serverUrl) throw new Error('URL do servidor não configurada.');
  const res = await fetch(base(cfg) + '/api/organizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify({ transcricao, contexto, model: model || cfg.ollamaModel }),
  });
  if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
  const data = await res.json();
  if (data.erro) throw new Error(data.erro);
  return data.texto ?? '';
};

// ─── EXTRAIR PRONTUÁRIO (Parte B) ─────────────────────────────────────────────
export const extrairProntuario = async ({ prontuario, config, model }) => {
  const cfg = config || getAIConfig();
  if (!cfg.serverUrl) throw new Error('URL do servidor não configurada.');
  const res = await fetch(base(cfg) + '/api/extrair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify({ prontuario, model: model || cfg.ollamaModel }),
  });
  if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
  const data = await res.json();
  if (data.erro) throw new Error(data.erro);
  return data; // { dados, bruto, aviso? }
};

// ─── GERAR RELATÓRIO / RECEITA (Parte B) ──────────────────────────────────────
export const gerarRelatorio = async ({ solicitacao, contexto, config, model }) => {
  const cfg = config || getAIConfig();
  if (!cfg.serverUrl) throw new Error('URL do servidor não configurada.');
  const res = await fetch(base(cfg) + '/api/relatorio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify({ solicitacao, contexto, model: model || cfg.ollamaModel }),
  });
  if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
  const data = await res.json();
  if (data.erro) throw new Error(data.erro);
  return data.texto ?? '';
};

// ─── PROMPT DIRETO (Parte B) ──────────────────────────────────────────────────
export const promptDireto = async ({ prompt, system, config, model }) => {
  const cfg = config || getAIConfig();
  if (!cfg.serverUrl) throw new Error('URL do servidor não configurada.');
  const res = await fetch(base(cfg) + '/api/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
    body: JSON.stringify({ prompt, system, model: model || cfg.ollamaModel }),
  });
  if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
  const data = await res.json();
  if (data.erro) throw new Error(data.erro);
  return data.resposta ?? '';
};

// ─── PROMPT: organize raw transcription (mantido p/ compat com Parte A) ────────
export const buildOrganizePrompt = (rawTranscription, evolutionContext) => {
  return `Você é um assistente médico de um ambulatório de neurologia (DBS/Parkinson).
Organize a TRANSCRIÇÃO BRUTA em um resumo clínico estruturado e conciso, em português,
corrigindo termos médicos mal transcritos. NÃO invente informações ausentes.

=== CONTEXTO (evolução) ===
${evolutionContext || '(sem contexto adicional)'}

=== TRANSCRIÇÃO BRUTA ===
${rawTranscription}

=== RESUMO CLÍNICO ORGANIZADO ===`;
};
