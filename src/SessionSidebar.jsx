import React from 'react';
import { formatarData } from './constants';

// ─── SESSION SIDEBAR ──────────────────────────────────────────────────────────
// Barra lateral fixa à direita: histórico de sessões + ações de salvar/criar.
// A sessão em edição brilha em verde-claro; rascunho não salvo destacado em âmbar.
export const SessionSidebar = ({
  sessions,
  editingSessionId,
  editandoSessaoAntiga,
  autoSaveStatus,
  onOpenSession,       // (sess) => void  — abre sessão preservando rascunho
  onSalvar,            // (modoAtualizar) => void  — via guarda
  onCriarCopiando,     // () => void
  onCriarVazia,        // () => void
  onVoltarRascunho,    // () => void
  aberto,
  onToggle,
}) => {
  const ativos = React.useMemo(
    () => sessions.filter(s => s.type === 'active').sort((a, b) => b.timestamp - a.timestamp),
    [sessions]
  );
  const maisRecente = ativos[0];
  const lastIsRecent = maisRecente && (Date.now() - (maisRecente.timestamp || 0)) < 3 * 60 * 60 * 1000;
  const emRascunho = !editingSessionId;

  // Colapsada: só uma faixa fina com o botão de abrir
  if (!aberto) {
    return (
      <div className="shrink-0 w-8 border-l border-slate-200 bg-slate-50 flex flex-col items-center pt-3">
        <button onClick={onToggle} title="Mostrar sessões"
          className="text-slate-400 hover:text-slate-700 text-lg">‹</button>
        <span className="text-[9px] text-slate-400 font-bold tracking-wider mt-2"
          style={{ writingMode: 'vertical-rl' }}>SESSÕES</span>
      </div>
    );
  }

  return (
    <div className="shrink-0 w-64 border-l border-slate-200 bg-slate-50 flex flex-col min-h-0">
      {/* Header + ações */}
      <div className="px-3 py-3 border-b border-slate-200 flex flex-col gap-2 bg-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Sessões</span>
          <button onClick={onToggle} title="Recolher" className="text-slate-400 hover:text-slate-700 text-lg">›</button>
        </div>

        {/* Status do rascunho / edição */}
        <div className={`text-[10px] font-bold px-2 py-1 rounded-lg text-center ${
          emRascunho
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : editandoSessaoAntiga
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {emRascunho
            ? '📝 Rascunho não salvo'
            : editandoSessaoAntiga
              ? '📅 Editando sessão anterior'
              : autoSaveStatus === 'saving' ? '⟳ Salvando…'
              : autoSaveStatus === 'saved' ? '✓ Sessão de hoje (salva)'
              : '📅 Sessão de hoje'}
        </div>

        {/* Botão salvar */}
        {(editingSessionId || lastIsRecent) ? (
          <button onClick={() => onSalvar(true)}
            className="w-full py-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm">
            💾 Salvar Sessão
          </button>
        ) : (
          <button onClick={onCriarCopiando}
            className="w-full py-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
            title="Cria nova sessão com os dados atuais copiados">
            💾 Salvar como nova sessão
          </button>
        )}

        {/* Criar nova */}
        <div className="flex gap-1.5">
          <button onClick={onCriarCopiando}
            className="flex-1 py-1.5 rounded-lg font-bold text-[10px] bg-slate-600 hover:bg-slate-700 text-white transition-colors"
            title="Duplica a última sessão">
            📋 Duplicar
          </button>
          <button onClick={onCriarVazia}
            className="flex-1 py-1.5 rounded-lg font-bold text-[10px] bg-slate-500 hover:bg-slate-600 text-white transition-colors"
            title="Cria sessão nova vazia">
            ✦ Em branco
          </button>
        </div>

        {/* Voltar ao rascunho (só aparece editando sessão antiga) */}
        {editandoSessaoAntiga && (
          <button onClick={onVoltarRascunho}
            className="w-full py-1.5 rounded-lg font-bold text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 transition-colors">
            ↩ Voltar ao rascunho
          </button>
        )}
      </div>

      {/* Lista de sessões */}
      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
        {/* Rascunho no topo, se ativo */}
        {emRascunho && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-2.5 py-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">📝 Rascunho atual</span>
              <span className="text-[8px] text-amber-500">não salvo</span>
            </div>
            <p className="text-[9px] text-amber-600 mt-0.5">Em edição — ainda não gravado</p>
          </div>
        )}

        {ativos.length === 0 && !emRascunho && (
          <p className="text-[10px] text-slate-400 italic text-center py-4">Nenhuma sessão registrada.</p>
        )}

        {ativos.map((sess) => {
          const isAtual = sess.id === editingSessionId;
          const isHoje = new Date(sess.timestamp).toDateString() === new Date().toDateString();
          return (
            <button key={sess.id} onClick={() => onOpenSession(sess)}
              className={`text-left rounded-lg px-2.5 py-2 border transition-all ${
                isAtual
                  ? 'border-emerald-400 bg-emerald-100 shadow-md ring-1 ring-emerald-300'
                  : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm'
              }`}>
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[11px] font-mono font-bold ${isAtual ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {formatarData(sess.timestamp)}
                </span>
                {isAtual && <span className="text-[8px] font-black text-emerald-600 shrink-0">● ATUAL</span>}
                {!isAtual && isHoje && <span className="text-[8px] text-emerald-500 shrink-0">hoje</span>}
              </div>
              {sess.resumoSessao && (
                <p className={`text-[10px] mt-0.5 line-clamp-2 leading-snug ${isAtual ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {sess.resumoSessao}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
