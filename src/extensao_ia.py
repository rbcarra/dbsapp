"""
extensao_ia.py — Extensão do servidor.py existente com endpoints de IA.

Adiciona ao servidor de transcrição já existente:
  - POST /transcribe       : transcrição de um arquivo de áudio (upload único, não-streaming)
  - GET  /health           : health-check consolidado (usado pelas luzes do app)
  - POST /api/generate     : proxy do Ollama (o app fala só com este servidor)
  - POST /extrair          : extração estruturada de prontuário + programação
  - POST /relatorio        : geração de receita/relatório com prompt livre
  - POST /prompt           : prompt direto à LLM (uso livre)

TODOS os endpoints de GPU (Whisper + Ollama) passam por uma FILA SERIAL com
semáforo, permitindo que 4-6 sessões simultâneas façam pedidos sem travar:
os pedidos entram na fila e são processados um a um. Ninguém recebe erro de
concorrência; no máximo espera alguns segundos.

COMO USAR no seu servidor.py existente:

    # no topo do servidor.py, após criar o `app`:
    from extensao_ia import montar_extensao_ia
    montar_extensao_ia(
        app,
        get_modelo_whisper=lambda: modelo_whisper,   # sua variável global do Whisper
        vocab_medico=VOCAB_MEDICO,                    # seu glossário já existente
        transcrever_audio_bytes=transcrever_bytes,    # sua função de transcrição (ver nota)
    )

Se você ainda não tem uma função que transcreve bytes de áudio isolados,
este módulo traz uma implementação padrão (`_transcrever_padrao`) que usa
ffmpeg + faster-whisper e aplica o mesmo pipeline anti-alucinação.

Dependências (já devem estar instaladas):
    pip install fastapi uvicorn python-multipart requests numpy
"""

import os
import io
import json
import time
import asyncio
import tempfile
import subprocess
import logging
from typing import Optional, Callable

import numpy as np
import requests as http_requests
from fastapi import UploadFile, File, Form, Request
from fastapi.responses import JSONResponse

log = logging.getLogger("extensao_ia")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURAÇÃO
# ─────────────────────────────────────────────────────────────────────────────
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL_PADRAO = os.environ.get("OLLAMA_MODEL", "llama3.1")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "180"))  # segundos

# ─────────────────────────────────────────────────────────────────────────────
# FILA DE CONCORRÊNCIA
# ─────────────────────────────────────────────────────────────────────────────
# Uma GPU processa um trabalho pesado por vez. O semáforo serializa o acesso.
# Requests aguardam sua vez de forma assíncrona (sem bloquear o event loop).
# Whisper e Ollama compartilham a MESMA GPU, então usam o mesmo lock.
_gpu_lock = asyncio.Semaphore(1)

# Estatísticas simples para monitorar a fila (visível em /health)
_stats = {"na_fila": 0, "processando": 0, "total_processado": 0, "ultimo_erro": None}


class _FilaGPU:
    """Context manager assíncrono que serializa o acesso à GPU e conta a fila."""
    async def __aenter__(self):
        _stats["na_fila"] += 1
        await _gpu_lock.acquire()
        _stats["na_fila"] -= 1
        _stats["processando"] += 1
        return self

    async def __aexit__(self, *exc):
        _stats["processando"] -= 1
        _stats["total_processado"] += 1
        _gpu_lock.release()


# ─────────────────────────────────────────────────────────────────────────────
# PROMPTS CLÍNICOS
# ─────────────────────────────────────────────────────────────────────────────
PROMPT_ORGANIZAR = """Você é um assistente médico de um ambulatório de neurologia (DBS/Parkinson).
Organize a TRANSCRIÇÃO BRUTA em um resumo clínico estruturado e conciso, em português,
corrigindo termos médicos mal transcritos. NÃO invente informações ausentes na transcrição.

Estruture quando aplicável:
- Evolução desde a última consulta
- Sintomas motores (tremor, rigidez, bradicinesia, discinesia, flutuações on/off)
- Sintomas não-motores
- Medicações e ajustes
- Conduta/plano

=== CONTEXTO (evolução anterior) ===
{contexto}

=== TRANSCRIÇÃO BRUTA ===
{transcricao}

=== RESUMO CLÍNICO ORGANIZADO ==="""

PROMPT_EXTRAIR = """Você é um assistente que extrai parâmetros estruturados de prontuários de DBS (estimulação cerebral profunda).
Leia o PRONTUÁRIO abaixo e extraia as informações em JSON válido, seguindo EXATAMENTE este formato.
Se um dado não estiver presente, use null. NÃO invente valores.

Formato de contatos: cada grupo (A/B/C/D) tem lado E (esquerdo) e D (direito).
Contato catodo = negativo (-), anodo = positivo (+). Amplitude em mA ou V, largura de pulso em µs, frequência em Hz.

{{
  "paciente": {{"nome": null, "hc": null}},
  "dispositivo": {{"fabricante": null, "modelo_ipg": null, "alvo_e": null, "alvo_d": null}},
  "grupos": [
    {{"grupo": "A", "lado": "E", "catodo": "2", "anodo": "case", "amplitude": 2.5, "pw": 60, "freq": 130}},
    {{"grupo": "A", "lado": "D", "catodo": "10", "anodo": "case", "amplitude": 2.0, "pw": 60, "freq": 130}}
  ],
  "medicacoes": [{{"nome": null, "dose_diaria_mg": null}}],
  "evolucao_resumo": null
}}

Exemplos de formatos de contato que você pode encontrar (baseados no parser do app):
- "Lead E 0+-0" significa contato 1 anodo, contato 2 catodo (formato posicional 4-ring)
- "L4 100% 2,0mA" significa contato 4 catodo a 100%, amplitude 2.0 mA
- "L3(70%)L4(30%)" significa MICC: contato 3 a 70% e contato 4 a 30%, ambos catodos
- "00-(30%)-(70%)" significa distribuição de corrente entre contatos

Responda APENAS com o JSON, sem texto antes ou depois.

=== PRONTUÁRIO ===
{prontuario}

=== JSON ==="""

PROMPT_RELATORIO = """Você é um assistente médico de um ambulatório de neurologia (DBS/Parkinson).
Gere o documento solicitado em português, formal e conciso, adequado para uso clínico.
Baseie-se apenas nas informações fornecidas. NÃO invente dados clínicos.

=== CONTEXTO DO PACIENTE ===
{contexto}

=== SOLICITAÇÃO ===
{solicitacao}

=== DOCUMENTO ==="""


# ─────────────────────────────────────────────────────────────────────────────
# TRANSCRIÇÃO PADRÃO (usada se você não passar sua própria função)
# ─────────────────────────────────────────────────────────────────────────────
def _limpar_alucinacoes(texto: str) -> str:
    """Colapsa repetições n-gram e remove segmentos degenerados (mesmo pipeline do servidor)."""
    if not texto:
        return texto
    palavras = texto.split()
    if not palavras:
        return texto
    # Colapsa repetições de padrões de 2-8 palavras repetidos 3+ vezes
    for tam in range(8, 1, -1):
        i = 0
        saida = []
        while i < len(palavras):
            padrao = palavras[i:i+tam]
            repeticoes = 1
            j = i + tam
            while j + tam <= len(palavras) and palavras[j:j+tam] == padrao:
                repeticoes += 1
                j += tam
            saida.extend(padrao)
            if repeticoes >= 3:
                i = j  # pula as repetições extras
            else:
                i += tam
        palavras = saida
    return " ".join(palavras)


def _transcrever_padrao(audio_bytes: bytes, modelo, vocab: str, idioma: str = "pt") -> str:
    """Converte áudio (qualquer formato) via ffmpeg → WAV 16k → faster-whisper."""
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f_in:
        f_in.write(audio_bytes)
        caminho_in = f_in.name
    caminho_wav = caminho_in + ".wav"
    try:
        # ffmpeg: converte para WAV mono 16kHz (formato ideal do Whisper)
        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", caminho_in, "-ar", "16000", "-ac", "1",
             "-f", "wav", caminho_wav],
            capture_output=True, timeout=60,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg falhou: {proc.stderr.decode()[:300]}")

        # Pré-filtro de silêncio (evita alucinação em áudio quase vazio)
        audio = np.memmap(caminho_wav, dtype=np.int16, mode="r", offset=44)
        rms = float(np.sqrt(np.mean((audio.astype(np.float32) / 32768.0) ** 2)))
        if rms < 0.005:
            return ""

        segmentos, _ = modelo.transcribe(
            caminho_wav,
            language=idioma,
            initial_prompt=vocab,
            temperature=0.0,
            no_speech_threshold=0.4,
            log_prob_threshold=-0.5,
            compression_ratio_threshold=1.8,
            condition_on_previous_text=False,
        )
        texto = " ".join(seg.text.strip() for seg in segmentos).strip()
        return _limpar_alucinacoes(texto)
    finally:
        for c in (caminho_in, caminho_wav):
            try:
                os.remove(c)
            except OSError:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# CHAMADA AO OLLAMA
# ─────────────────────────────────────────────────────────────────────────────
def _ollama_generate(prompt: str, model: str = None, system: str = None) -> str:
    """Chamada síncrona ao Ollama (rodada dentro do executor para não travar o loop)."""
    body = {
        "model": model or OLLAMA_MODEL_PADRAO,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        body["system"] = system
    resp = http_requests.post(
        f"{OLLAMA_URL}/api/generate", json=body, timeout=OLLAMA_TIMEOUT
    )
    resp.raise_for_status()
    return resp.json().get("response", "")


# ─────────────────────────────────────────────────────────────────────────────
# MONTAGEM DOS ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
def montar_extensao_ia(
    app,
    get_modelo_whisper: Callable,
    vocab_medico: str,
    transcrever_audio_bytes: Optional[Callable] = None,
):
    """
    Monta os endpoints de IA no `app` FastAPI já existente.

    app                    : instância FastAPI do servidor.py
    get_modelo_whisper     : função sem args que retorna o modelo Whisper carregado
    vocab_medico           : string do glossário (VOCAB_MEDICO)
    transcrever_audio_bytes: (opcional) função (bytes, modelo, vocab, idioma) -> str.
                             Se None, usa a implementação padrão deste módulo.
    """
    transcrever = transcrever_audio_bytes or _transcrever_padrao
    loop = asyncio.get_event_loop() if False else None  # placeholder; usamos run_in_executor

    # ── HEALTH ────────────────────────────────────────────────────────────────
    @app.get("/health")
    async def health():
        ollama_ok = False
        modelos_ollama = []
        try:
            r = http_requests.get(f"{OLLAMA_URL}/api/tags", timeout=4)
            ollama_ok = r.ok
            if r.ok:
                modelos_ollama = [m["name"] for m in r.json().get("models", [])]
        except Exception:
            ollama_ok = False
        whisper_ok = get_modelo_whisper() is not None
        return {
            "status": "ok",
            "whisper": whisper_ok,
            "ollama": ollama_ok,
            "modelos_disponiveis": modelos_ollama,
            "modelo_padrao": OLLAMA_MODEL_PADRAO,
            "fila": {
                "na_fila": _stats["na_fila"],
                "processando": _stats["processando"],
                "total_processado": _stats["total_processado"],
            },
        }

    # ── TRANSCRIBE (upload único) ─────────────────────────────────────────────
    @app.post("/transcribe")
    async def transcribe(
        audio: UploadFile = File(...),
        initial_prompt: str = Form(None),
        language: str = Form("pt"),
    ):
        audio_bytes = await audio.read()
        vocab = initial_prompt or vocab_medico
        modelo = get_modelo_whisper()
        if modelo is None:
            return JSONResponse({"erro": "Modelo Whisper não carregado."}, status_code=503)

        async with _FilaGPU():
            try:
                # roda a transcrição (bloqueante) num thread para não travar o event loop
                texto = await asyncio.get_event_loop().run_in_executor(
                    None, transcrever, audio_bytes, modelo, vocab, language
                )
                return {"text": texto}
            except Exception as e:
                _stats["ultimo_erro"] = str(e)
                log.exception("Erro na transcrição")
                return JSONResponse({"erro": str(e)}, status_code=500)

    # ── OLLAMA PROXY (/api/generate) ──────────────────────────────────────────
    @app.post("/api/generate")
    async def api_generate(request: Request):
        body = await request.json()
        prompt = body.get("prompt", "")
        model = body.get("model")
        system = body.get("system")
        async with _FilaGPU():
            try:
                resposta = await asyncio.get_event_loop().run_in_executor(
                    None, _ollama_generate, prompt, model, system
                )
                return {"response": resposta, "model": model or OLLAMA_MODEL_PADRAO}
            except Exception as e:
                _stats["ultimo_erro"] = str(e)
                log.exception("Erro no Ollama")
                return JSONResponse({"erro": str(e)}, status_code=500)

    # ── EXTRAIR PRONTUÁRIO ────────────────────────────────────────────────────
    @app.post("/extrair")
    async def extrair(request: Request):
        body = await request.json()
        prontuario = body.get("prontuario", "")
        model = body.get("model")
        if not prontuario.strip():
            return JSONResponse({"erro": "Prontuário vazio."}, status_code=400)
        prompt = PROMPT_EXTRAIR.format(prontuario=prontuario)
        async with _FilaGPU():
            try:
                bruto = await asyncio.get_event_loop().run_in_executor(
                    None, _ollama_generate, prompt, model, None
                )
                # tenta parsear o JSON retornado
                json_str = bruto.strip()
                # remove cercas markdown se houver
                if json_str.startswith("```"):
                    json_str = json_str.split("```")[1]
                    if json_str.startswith("json"):
                        json_str = json_str[4:]
                try:
                    dados = json.loads(json_str)
                    return {"dados": dados, "bruto": bruto}
                except json.JSONDecodeError:
                    return {"dados": None, "bruto": bruto,
                            "aviso": "LLM não retornou JSON válido; use o texto bruto."}
            except Exception as e:
                _stats["ultimo_erro"] = str(e)
                log.exception("Erro na extração")
                return JSONResponse({"erro": str(e)}, status_code=500)

    # ── RELATÓRIO / RECEITA ───────────────────────────────────────────────────
    @app.post("/relatorio")
    async def relatorio(request: Request):
        body = await request.json()
        solicitacao = body.get("solicitacao", "")
        contexto = body.get("contexto", "")
        model = body.get("model")
        if not solicitacao.strip():
            return JSONResponse({"erro": "Solicitação vazia."}, status_code=400)
        prompt = PROMPT_RELATORIO.format(contexto=contexto or "(sem contexto)",
                                         solicitacao=solicitacao)
        async with _FilaGPU():
            try:
                texto = await asyncio.get_event_loop().run_in_executor(
                    None, _ollama_generate, prompt, model, None
                )
                return {"texto": texto.strip()}
            except Exception as e:
                _stats["ultimo_erro"] = str(e)
                log.exception("Erro no relatório")
                return JSONResponse({"erro": str(e)}, status_code=500)

    # ── ORGANIZAR TRANSCRIÇÃO ─────────────────────────────────────────────────
    @app.post("/organizar")
    async def organizar(request: Request):
        body = await request.json()
        transcricao = body.get("transcricao", "")
        contexto = body.get("contexto", "")
        model = body.get("model")
        if not transcricao.strip():
            return JSONResponse({"erro": "Transcrição vazia."}, status_code=400)
        prompt = PROMPT_ORGANIZAR.format(contexto=contexto or "(sem contexto)",
                                         transcricao=transcricao)
        async with _FilaGPU():
            try:
                texto = await asyncio.get_event_loop().run_in_executor(
                    None, _ollama_generate, prompt, model, None
                )
                return {"texto": texto.strip()}
            except Exception as e:
                _stats["ultimo_erro"] = str(e)
                log.exception("Erro ao organizar")
                return JSONResponse({"erro": str(e)}, status_code=500)

    # ── PROMPT DIRETO ─────────────────────────────────────────────────────────
    @app.post("/prompt")
    async def prompt_direto(request: Request):
        body = await request.json()
        texto_prompt = body.get("prompt", "")
        model = body.get("model")
        system = body.get("system")
        if not texto_prompt.strip():
            return JSONResponse({"erro": "Prompt vazio."}, status_code=400)
        async with _FilaGPU():
            try:
                resposta = await asyncio.get_event_loop().run_in_executor(
                    None, _ollama_generate, texto_prompt, model, system
                )
                return {"resposta": resposta.strip()}
            except Exception as e:
                _stats["ultimo_erro"] = str(e)
                log.exception("Erro no prompt")
                return JSONResponse({"erro": str(e)}, status_code=500)

    log.info("Extensão de IA montada: /transcribe /health /api/generate /extrair /relatorio /organizar /prompt")
    return app
