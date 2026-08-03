// ─── AI CLIENT ────────────────────────────────────────────────────────────────
// Handles connection to the user's local PC running Ollama (LLM) + Whisper (STT).
// Config is stored in localStorage. All requests go over HTTPS (PC exposes a cert).
// PC-side server is separate future work — this is app-side only.

const LS_KEY = 'dbs_ai_config';

// Default config shape
const DEFAULT_CONFIG = {
  ollamaUrl: '',        // e.g. https://meu-pc.local:11434
  transcribeUrl: '',    // e.g. https://meu-pc.local:9000  (may be same host, different port)
  ollamaModel: 'llama3.1',
  enabled: false,
};

export const getAIConfig = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
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

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
// Pings Ollama's /api/tags (lists models) with a short timeout.
// Returns { ollama: bool, transcribe: bool }.
export const checkHealth = async (config) => {
  const cfg = config || getAIConfig();
  const result = { ollama: false, transcribe: false };

  const ping = async (url, path) => {
    if (!url) return false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url.replace(/\/$/, '') + path, {
        method: 'GET',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  };

  result.ollama = await ping(cfg.ollamaUrl, '/api/tags');
  // Transcription server expected to expose /health (user builds this PC-side)
  result.transcribe = await ping(cfg.transcribeUrl, '/health');
  return result;
};

// ─── OLLAMA GENERATE ──────────────────────────────────────────────────────────
// Sends a prompt to Ollama's /api/generate. Returns the generated text.
export const ollamaGenerate = async ({ prompt, system, config, model }) => {
  const cfg = config || getAIConfig();
  if (!cfg.ollamaUrl) throw new Error('URL do Ollama não configurada.');

  const body = {
    model: model || cfg.ollamaModel || 'llama3.1',
    prompt,
    stream: false,
  };
  if (system) body.system = system;

  const res = await fetch(cfg.ollamaUrl.replace(/\/$/, '') + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Ollama respondeu ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.response ?? '';
};

// ─── WHISPER TRANSCRIBE ───────────────────────────────────────────────────────
// Sends an audio blob to the PC's transcription server as multipart/form-data.
// Expects a JSON response { text: "..." }.
// The initial_prompt (medical glossary) is sent so Whisper recognizes jargon.
export const MEDICAL_GLOSSARY = [
  // Neurologia / DBS técnico
  'DBS', 'estimulação cerebral profunda', 'STN', 'núcleo subtalâmico', 'GPi', 'globo pálido interno',
  'VIM', 'tálamo', 'IPG', 'gerador de pulsos', 'eletrodo', 'contato', 'catodo', 'anodo',
  'monopolar', 'bipolar', 'interleaving', 'cycling', 'impedância', 'amplitude', 'frequência',
  'largura de pulso', 'microlesão',
  // Medicações
  'levodopa', 'Prolopa', 'carbidopa', 'benserazida', 'pramipexol', 'Sifrol', 'rasagilina', 'Azilect',
  'amantadina', 'entacapona', 'Comtan', 'opicapona', 'Ongentys', 'safinamida', 'apomorfina',
  'foslevodopa', 'foscarbidopa', 'clonazepam', 'escitalopram',
  // Sintomas / exame
  'bradicinesia', 'rigidez', 'tremor', 'discinesia', 'distonia', 'freezing', 'congelamento',
  'festinação', 'hipofonia', 'disartria', 'parestesia', 'flutuação motora', 'wearing-off',
  'on', 'off', 'período on', 'período off',
  // Termos leigos de consulta
  'travado', 'travar', 'em off', 'deu cápsula', 'formigou', 'formigamento', 'endureceu',
  'perna dura', 'mão tremendo', 'lentidão', 'não desliga', 'melhorou', 'piorou',
].join(', ');

export const transcribeAudio = async ({ audioBlob, config, initialPrompt }) => {
  const cfg = config || getAIConfig();
  if (!cfg.transcribeUrl) throw new Error('URL de transcrição não configurada.');

  const form = new FormData();
  form.append('audio', audioBlob, 'consulta.webm');
  form.append('initial_prompt', initialPrompt || MEDICAL_GLOSSARY);
  form.append('language', 'pt');

  const res = await fetch(cfg.transcribeUrl.replace(/\/$/, '') + '/transcribe', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`Servidor de transcrição respondeu ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.text ?? '';
};

// ─── PROMPT: organize raw transcription ───────────────────────────────────────
export const buildOrganizePrompt = (rawTranscription, evolutionContext) => {
  return `Você é um assistente médico de um ambulatório de neurologia (DBS/Parkinson).
Abaixo está a TRANSCRIÇÃO BRUTA de uma consulta e o CONTEXTO da evolução clínica.
Organize a transcrição em um resumo clínico estruturado e conciso, em português,
corrigindo termos médicos mal transcritos. NÃO invente informações que não estejam na transcrição.

Estruture assim quando aplicável:
- Queixa/evolução desde última consulta
- Sintomas motores (tremor, rigidez, bradicinesia, discinesia, flutuações)
- Sintomas não-motores
- Medicações mencionadas e ajustes
- Conduta/plano

=== CONTEXTO (evolução) ===
${evolutionContext || '(sem contexto adicional)'}

=== TRANSCRIÇÃO BRUTA ===
${rawTranscription}

=== RESUMO CLÍNICO ORGANIZADO ===`;
};
