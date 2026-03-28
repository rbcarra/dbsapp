import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const BlocoColapsavel = ({ titulo, aberto, onToggle, children, corHeader = 'bg-slate-50' }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-4 py-2.5 ${corHeader} border-b border-slate-200 hover:bg-slate-100 transition-colors`}
    >
      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{titulo}</span>
      <span className="text-slate-400 text-sm">{aberto ? '▲' : '▼'}</span>
    </button>
    {aberto && <div className="p-4">{children}</div>}
  </div>
);

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
const PatientSelector = ({ patients, onSelectPatient, onCreatePatient, onDeletePatient, onImportFullCSV, onParseImportCSV }) => {
  const [importFeedback, setImportFeedback] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newName, setNewName] = useState('');
  const [newHc, setNewHc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

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
    setImportFeedback('Analisando arquivo...');
    const preview = await onParseImportCSV(file);
    setImportFeedback('');
    if (typeof preview === 'string') {
      setImportFeedback(preview);
      setTimeout(() => setImportFeedback(''), 5000);
    } else {
      setImportPreview(preview);
    }
  };

  const handleConfirmarImport = async () => {
    const previewParaImportar = importPreview;
    setImportPreview(null);
    setImportFeedback('Importando...');
    const resultado = await onImportFullCSV(previewParaImportar);
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
{importPreview && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 flex flex-col max-h-[80vh]">
      <h3 className="text-sm font-bold text-slate-800 mb-1">Confirmar Importação</h3>
      <p className="text-xs text-slate-500 mb-3">
        {importPreview.temSessoes
          ? `${importPreview.pacientes.length} paciente(s) reconhecido(s) com as seguintes sessões:`
          : `${importPreview.pacientes.length} paciente(s) reconhecido(s) (sem colunas de sessão).`}
      </p>
      <div className="overflow-y-auto flex-1 mb-4 border border-slate-100 rounded-lg divide-y divide-slate-100">
        {importPreview.pacientes.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
            <div>
              <span className="text-xs font-bold text-slate-700">{p.nome}</span>
              <span className="text-[10px] text-slate-400 ml-2">HC: {p.hc}</span>
              {patients.some(ex => (ex.hc||'').trim() === p.hc.trim()) && (
                <span className="text-[9px] text-amber-600 font-bold ml-2 bg-amber-50 px-1.5 py-0.5 rounded">já cadastrado</span>
              )}
            </div>
            {importPreview.temSessoes && (
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {p.nSessoes} sessão(ões)
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 shrink-0">
        <button onClick={() => setImportPreview(null)}
          className="px-4 py-1.5 rounded text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">
          Cancelar
        </button>
        <button onClick={handleConfirmarImport}
          className="px-4 py-1.5 rounded text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700">
          Confirmar Importação
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


export { BlocoColapsavel, LoginModal, PatientSelector, ConfirmDialog };
