import React, { useState, useMemo, useEffect } from 'react';

// ─── COMPREHENSIVE MEDICATION PARSER ──────────────────────────────────────────
// Handles: "Med Xmg X-Y-Z", "Med Xmg: ¾cp às Xh, ...", "Med Xmg Nx ao dia"

const FRAC_MAP = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
const parseFrac = (s) => FRAC_MAP[s] ?? parseFloat((s||'').replace(',','.')) ?? 0;

const MED_PATTERNS = {
  levodopa:    /prolopa(?:\s*bd)?|levodopa|sinemet|stalevo|rytary/i,
  levodopa_hbs:/prolopa\s*hbs/i,
  levodopa_disp:/prolopa\s*dispers[ií]vel/i,
  amantadina:  /amantadina|mantadan|symmetrel/i,
  pramipexol:  /pramipexol|sifrol|mirapexin/i,
  ropinirol:   /ropinirol|requip/i,
  rotigotina:  /rotigotina|neupro/i,
  rasagilina:  /rasagilina|azilect/i,
  safinamida:  /safinamida|xadago/i,
  selegilina:  /selegilina|eldepryl|jumexal/i,
  entacapona:  /entacapona|comtan/i,
  opicapona:   /opicapona|ongentys/i,
  melatonina:  /melatonina/i,
  domperidona: /domperidona|motilium/i,
  lactulose:   /lactulose|lactulona/i,
  clonazepam:  /clonazepam|rivotril/i,
  quetiapina:  /quetiapina|seroquel/i,
  rivastigmina:/rivastigmina|exelon/i,
  donepezila:  /donepezila|aricept/i,
  venlafaxina: /venlafaxina|effexor|efexor/i,
  mirtazapina: /mirtazapina|remeron|mirtzagen/i,
  levotiroxina:/levotiroxina|puran|euthyrox|synthroid/i,
  propantelina:/propantelina/i,
  omeprazol:   /omeprazol|pantoprazol|lansoprazol|esomeprazol/i,
  citalopram:  /citalopram|escitalopram|lexapro|cipralex/i,
  sertralina:  /sertralina|zoloft/i,
};

const _extractDailyDose = (line) => {
  let unit = 0;
  const dm = line.match(/(\d+(?:[.,]\d+)?)(?:\/\d+)?\s*(?:mg|mcg)/i);
  if (dm) unit = parseFloat(dm[1].replace(',','.'));
  const xyz = line.match(/(\d+)\s*[-\u2013]\s*(\d+)\s*[-\u2013]\s*(\d+)/);
  if (xyz) { const n=(+xyz[1])+(+xyz[2])+(+xyz[3]); return { dose: unit * n, n }; }
  const fracs = [...line.matchAll(/([\u00bc\u00bd\u00be]|\d+(?:[.,]\d+)?)\s*cp/gi)];
  if (fracs.length > 0) {
    const FRAC = { '\u00bc': 0.25, '\u00bd': 0.5, '\u00be': 0.75 };
    const total = fracs.reduce((s,m) => s + (FRAC[m[1]] ?? parseFloat((m[1]||'0').replace(',','.')) ?? 0), 0);
    return { dose: unit * total, n: total };
  }
  const nx = line.match(/(\d+)\s*[xX\u00d7]\s*ao\s*dia/i);
  if (nx) return { dose: unit * +nx[1], n: +nx[1] };
  const vezes = line.match(/(\d+)\s*vez(?:es)?\s*ao\s*dia/i);
  if (vezes) return { dose: unit * +vezes[1], n: +vezes[1] };
  return { dose: unit, n: 1 };
};;

const parseMedsFromText = (text) => {
  if (!text) return {};
  const found = {};
  for (const line of text.split(/\n/)) {
    for (const [id, pattern] of Object.entries(MED_PATTERNS)) {
      if (!(id in found) && pattern.test(line)) {
        const { dose } = _extractDailyDose(line);
        found[id] = dose;
      }
    }
  }
  return found;
};


// ─── PRESCRIPTION TEMPLATE DEFINITIONS ────────────────────────────────────────
const buildTemplates = (paciente, endereco, meds, dataHoje) => {
  const header = (titulo) =>
    `Paciente: ${paciente || 'XXXXXXX'}\nEndereço: ${endereco || 'YYYYYYY'}\n\nUso Oral\n\n— ${titulo} —\n`;

  const footer = ``;  // Assinatura e data ficam a cargo do médico

  // ── Levodopa family ──────────────────────────────────────────────────────
  const levodopa_lines = [];
  if (meds['levodopa'] || true) {
    levodopa_lines.push(
      'Prolopa BD (levodopa + Benserazida) 100/25 mg ——————————————— uso contínuo',
      'Tomar conforme esquema posológico prescrito'
    );
  }
  if (meds['levodopa_hbs']) {
    levodopa_lines.push(
      '',
      'Prolopa HBS (levodopa + Benserazida) 100/25 mg ——————————————— uso contínuo',
      'Tomar um comprimido à noite'
    );
  }
  if (meds['levodopa_disp']) {
    levodopa_lines.push(
      '',
      'Prolopa Dispersível (levodopa + Benserazida) 100/25 mg ————— uso contínuo',
      'Tomar conforme orientação'
    );
  }

  const templates = [
    {
      id: 'levodopa',
      titulo: 'Receita — Levodopa',
      visible: true,
      default: header('Levodopa / Benserazida') + levodopa_lines.join('\n') + footer,
    },
    {
      id: 'melatonina',
      titulo: 'Receita — Melatonina',
      visible: !!meds['melatonina'],
      default: header('Melatonina') +
        `Melatonina ${meds['melatonina'] || 1} mg ——————————————— uso contínuo\nTomar um comprimido 30 minutos antes de dormir` +
        footer,
    },
    {
      id: 'domperidona',
      titulo: 'Receita — Domperidona',
      visible: !!meds['domperidona'],
      default: header('Domperidona') +
        `Domperidona ${meds['domperidona'] || 10} mg ——————————————— uso contínuo\nTomar um comprimido 3 vezes ao dia, 15 minutos antes das refeições` +
        footer,
    },
    {
      id: 'lactulose',
      titulo: 'Receita — Lactulose',
      visible: !!meds['lactulose'],
      default: header('Lactulose') +
        `Lactulose ${meds['lactulose'] || 667} mg/mL solução oral ——————————— uso contínuo\nTomar 15 a 30 mL uma a duas vezes ao dia` +
        footer,
    },
    {
      id: 'pramipexol',
      titulo: 'Receita — Pramipexol',
      visible: !!meds['pramipexol'],
      default: header('Pramipexol') +
        `Pramipexol ${meds['pramipexol'] || 0.25} mg ——————————————— uso contínuo\nTomar conforme prescrição` +
        footer,
    },
    {
      id: 'amantadina',
      titulo: 'Receita — Amantadina',
      visible: !!meds['amantadina'],
      default: header('Amantadina') +
        `Amantadina ${meds['amantadina'] || 100} mg ——————————————— uso contínuo\nTomar um comprimido duas vezes ao dia` +
        footer,
    },
    {
      id: 'rasagilina',
      titulo: 'Receita — Rasagilina',
      visible: !!meds['rasagilina'],
      default: header('Rasagilina') +
        `Rasagilina ${meds['rasagilina'] || 1} mg ——————————————— uso contínuo\nTomar um comprimido pela manhã` +
        footer,
    },
    {
      id: 'safinamida',
      titulo: 'Receita — Safinamida',
      visible: !!meds['safinamida'],
      default: header('Safinamida') +
        `Safinamida ${meds['safinamida'] || 50} mg ——————————————— uso contínuo\nTomar um comprimido pela manhã junto com a primeira tomada de levodopa` +
        footer,
    },
    {
      id: 'selegilina',
      titulo: 'Receita — Selegilina',
      visible: !!meds['selegilina'],
      default: header('Selegilina') +
        `Selegilina ${meds['selegilina'] || 5} mg ——————————————— uso contínuo\nTomar um comprimido pela manhã` +
        footer,
    },
    {
      id: 'ropinirol',
      titulo: 'Receita — Ropinirol',
      visible: !!meds['ropinirol'],
      default: header('Ropinirol') +
        `Ropinirol ${meds['ropinirol'] || 1} mg ——————————————— uso contínuo\nTomar conforme prescrição` +
        footer,
    },
    {
      id: 'rotigotina',
      titulo: 'Receita — Rotigotina',
      visible: !!meds['rotigotina'],
      default: header('Rotigotina patch') +
        `Rotigotina ${meds['rotigotina'] || 2} mg/24h — adesivo transdérmico ——— uso contínuo\nAplicar um adesivo por dia, trocando o local de aplicação diariamente` +
        footer,
    },
    {
      id: 'entacapona',
      titulo: 'Receita — Entacapona',
      visible: !!meds['entacapona'],
      default: header('Entacapona') +
        `Entacapona ${meds['entacapona'] || 200} mg ——————————————— uso contínuo\nTomar um comprimido junto com cada tomada de levodopa` +
        footer,
    },
    {
      id: 'clonazepam',
      titulo: 'Receita — Clonazepam (C5)',
      visible: !!meds['clonazepam'],
      default: header('Clonazepam') +
        `Clonazepam ${meds['clonazepam'] || 0.5} mg ——————————————— uso contínuo\nTomar conforme prescrição à noite` +
        footer,
    },
    {
      id: 'quetiapina',
      titulo: 'Receita — Quetiapina',
      visible: !!meds['quetiapina'],
      default: header('Quetiapina') +
        `Quetiapina ${meds['quetiapina'] || 25} mg ——————————————— uso contínuo\nTomar conforme prescrição` +
        footer,
    },
    {
      id: 'rivastigmina',
      titulo: 'Receita — Rivastigmina',
      visible: !!meds['rivastigmina'],
      default: header('Rivastigmina') +
        `Rivastigmina ${meds['rivastigmina'] || 4.6} mg/24h — adesivo ——————— uso contínuo\nAplicar um adesivo por dia` +
        footer,
    },
  ];

  // ── Reports ────────────────────────────────────────────────────────────────
  const relHeader = (tipo) =>
    `Paciente: ${paciente || 'XXXXXXX'}\nEndereço: ${endereco || 'YYYYYYY'}\n\n— ${tipo} —\n\n`;

  templates.push(
    {
      id: 'relatorio_geral',
      titulo: 'Relatório Geral',
      visible: true,
      isRelatorio: true,
      default: relHeader('Relatório Médico') +
        `${paciente || 'O paciente'} é acompanhado pela equipe de Neurologia — Grupo de Distúrbios do Movimento do Hospital das Clínicas da Faculdade de Medicina da USP por conta de Doença de Parkinson de início precoce / tardio, com quadro predominantemente rígido-acinético / tremorigênico, com X anos de evolução.\n\nAtualmente em uso de terapia antiparkinsoniana otimizada, encontrando-se com bom controle motor em período "on", porém com flutuações motoras e períodos "off" relevantes.\n\n`,
    },
    {
      id: 'encaminhamento_fisio',
      titulo: 'Encaminhamento — Fisioterapia',
      visible: true,
      isRelatorio: true,
      default: relHeader('Encaminhamento — Fisioterapia') +
        `Encaminho ${paciente || 'o paciente'} para avaliação e acompanhamento em fisioterapia neurológica.\n\n${paciente || 'O paciente'} apresenta Doença de Parkinson com comprometimento significativo de marcha e equilíbrio postural, incluindo tendência à festinação, freezing de marcha e instabilidade postural com risco de quedas. Beneficiaria de programa de reabilitação neurológica com foco em marcha, equilíbrio, coordenação motora e prevenção de quedas.\n\n`,
    },
    {
      id: 'encaminhamento_fono',
      titulo: 'Encaminhamento — Fonoaudiologia',
      visible: true,
      isRelatorio: true,
      default: relHeader('Encaminhamento — Fonoaudiologia') +
        `Encaminho ${paciente || 'o paciente'} para avaliação e acompanhamento fonoaudiológico.\n\n${paciente || 'O paciente'} apresenta Doença de Parkinson com comprometimento da fala (disartria hipocinética), incluindo hipofonia, monopitch e articulação imprecisa, com impacto na comunicação. Apresenta também disfagia leve referida. Solicito avaliação e tratamento focado em disfagia e comunicação.\n\n`,
    },
    {
      id: 'encaminhamento_psico',
      titulo: 'Encaminhamento — Psicologia',
      visible: true,
      isRelatorio: true,
      default: relHeader('Encaminhamento — Psicologia') +
        `Encaminho ${paciente || 'o paciente'} para avaliação e acompanhamento psicológico.\n\n${paciente || 'O paciente'} apresenta Doença de Parkinson com sintomas neuropsiquiátricos associados, incluindo ansiedade, sintomas depressivos e dificuldades de adaptação à condição crônica. Solicito avaliação e suporte psicológico individualizado.\n\n`,
    },
  );

  return templates;
};

// ─── SINGLE PRESCRIPTION CARD ─────────────────────────────────────────────────
const PrescricaoCard = ({ template, savedText, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(savedText || template.default);
  const [expanded, setExpanded] = useState(false);

  // If saved text changes externally (patient changes), reset
  useEffect(() => {
    if (savedText !== undefined) setText(savedText);
    else setText(template.default);
  }, [savedText, template.default]);

  const handleSave = () => { onSave(text); setEditing(false); };

  const print = () => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${template.titulo}</title>
      <style>body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;font-size:13px;line-height:1.6;white-space:pre-wrap;}</style>
      </head><body>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</body></html>`);
    w.document.close();
    w.print();
  };

  const display = savedText || template.default;

  return (
    <div className={`border rounded-xl overflow-hidden ${template.isRelatorio ? 'border-indigo-200 bg-indigo-50/30' : 'border-emerald-200 bg-emerald-50/20'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${template.isRelatorio ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-700'}`}>
            {template.isRelatorio ? '📄' : '💊'}
          </span>
          <span className="text-xs font-bold text-slate-700">{template.titulo}</span>
        </div>
        <span className="text-[9px] text-slate-400">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-100">
          {editing ? (
            <>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={12}
                className="w-full mt-2 text-[11px] font-mono text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y leading-relaxed"
              />
              <div className="flex gap-2 mt-1.5">
                <button onClick={handleSave}
                  className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg">✓ Salvar</button>
                <button onClick={() => { setText(savedText || template.default); setEditing(false); }}
                  className="text-[10px] text-slate-500 hover:text-slate-700 px-2 py-1.5">Cancelar</button>
                <button onClick={() => setText(template.default)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1.5 underline ml-auto">↺ Restaurar padrão</button>
              </div>
            </>
          ) : (
            <>
              <pre className="mt-2 text-[10px] font-mono text-slate-600 whitespace-pre-wrap leading-relaxed bg-white border border-slate-100 rounded-lg p-2.5 max-h-48 overflow-y-auto">
                {display}
              </pre>
              <div className="flex gap-2 mt-1.5">
                <button onClick={() => setEditing(true)}
                  className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg">✏ Editar</button>
                <button onClick={print}
                  className="text-[10px] font-bold bg-white border border-slate-200 hover:border-slate-400 text-slate-600 px-3 py-1.5 rounded-lg">🖨 Imprimir</button>
                <button onClick={() => navigator.clipboard.writeText(display)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1.5">📋 Copiar</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
const NewDocForm = ({ pacienteNome, enderecoSalvo, onCreate }) => {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState('receita');
  const [titulo, setTitulo] = useState('');
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  const TEMPLATES = {
    receita: `Paciente: ${pacienteNome||'XXXXXXX'}\nEndereço: ${enderecoSalvo||'YYYYYYY'}\n\nUso Oral\n\n— \n\n\n\n\n`,
    relatorio: `Paciente: ${pacienteNome||'XXXXXXX'}\nEndereço: ${enderecoSalvo||'YYYYYYY'}\n\n— Relatório —\n\n\n\n`,
    encaminhamento: `Paciente: ${pacienteNome||'XXXXXXX'}\nEndereço: ${enderecoSalvo||'YYYYYYY'}\n\n— Encaminhamento —\n\nEncaminho o paciente para:\n\n\n\n`,
    livre: '',
  };
  const [texto, setTitulo2] = useState('');
  const [textoDoc, setTextoDoc] = useState('');

  const handleCreate = () => {
    if (!titulo.trim()) return;
    onCreate({ id: Date.now().toString(), titulo: titulo.trim(), texto: textoDoc || TEMPLATES[tipo] });
    setTitulo(''); setTextoDoc(''); setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-all self-start">
      + Novo documento personalizado
    </button>
  );

  return (
    <div className="border-2 border-indigo-200 rounded-xl p-3 bg-indigo-50/30">
      <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-2">Novo documento</p>
      <div className="flex gap-2 mb-2">
        {[['receita','💊 Receita'],['relatorio','📄 Relatório'],['encaminhamento','↗ Encaminhamento'],['livre','📝 Livre']].map(([id,label]) => (
          <button key={id} onClick={() => setTipo(id)}
            className={`text-[9px] font-bold px-2 py-1 rounded border transition-all ${tipo===id?'bg-indigo-600 text-white border-indigo-400':'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
            {label}
          </button>
        ))}
      </div>
      <input value={titulo} onChange={e => setTitulo(e.target.value)}
        placeholder="Título do documento"
        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"/>
      <textarea value={textoDoc || TEMPLATES[tipo]}
        onChange={e => setTextoDoc(e.target.value)}
        rows={8}
        className="w-full text-[11px] font-mono text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y leading-relaxed mb-2"/>
      <div className="flex gap-2">
        <button onClick={handleCreate}
          className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">✓ Criar</button>
        <button onClick={() => { setOpen(false); setTitulo(''); setTextoDoc(''); }}
          className="text-[10px] text-slate-500 hover:text-slate-700 px-2 py-1.5">Cancelar</button>
      </div>
    </div>
  );
};

export const ReceitasSection = ({
  pacienteNome, enderecoSalvo, onEnderecoChange,
  notasLivres, prescricoesSalvas, onSalvarPrescricao,
  customDocs = [], onAddCustom, onDeleteCustom, onUpdateCustom,
}) => {
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  const meds = useMemo(() => parseMedsFromText(notasLivres), [notasLivres]);
  const templates = useMemo(
    () => buildTemplates(pacienteNome, enderecoSalvo, meds, dataHoje),
    [pacienteNome, enderecoSalvo, meds, dataHoje]
  );

  const receitas = templates.filter(t => !t.isRelatorio);
  const relatorios = templates.filter(t => t.isRelatorio);
  const visiveisDefault = templates.filter(t => t.visible || prescricoesSalvas?.[t.id]);

  const [showAll, setShowAll] = useState(false);

  const displayList = showAll ? templates : visiveisDefault;
  const displayReceitas = displayList.filter(t => !t.isRelatorio);
  const displayRelatorios = displayList.filter(t => t.isRelatorio);

  return (
    <div className="flex flex-col gap-4">
      {/* Address field */}
      <div>
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Endereço do paciente (aparece nas receitas e relatórios)
        </label>
        <input type="text"
          value={enderecoSalvo || ''}
          onChange={e => onEnderecoChange(e.target.value)}
          placeholder="Rua, número, bairro, cidade, CEP"
          className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
        />
        {Object.keys(meds).length > 0 && (
          <p className="text-[8px] text-emerald-600 mt-1">
            🔍 Medicamentos detectados na evolução: {Object.keys(meds).join(', ')}
          </p>
        )}
      </div>

      {/* Receitas */}
      <div>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">💊 Receitas</p>
        <div className="flex flex-col gap-2">
          {displayReceitas.map(t => (
            <PrescricaoCard key={t.id} template={t}
              savedText={prescricoesSalvas?.[t.id]}
              onSave={(text) => onSalvarPrescricao(t.id, text)}/>
          ))}
        </div>
      </div>

      {/* Relatórios */}
      <div>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">📄 Relatórios e encaminhamentos</p>
        <div className="flex flex-col gap-2">
          {displayRelatorios.map(t => (
            <PrescricaoCard key={t.id} template={t}
              savedText={prescricoesSalvas?.[t.id]}
              onSave={(text) => onSalvarPrescricao(t.id, text)}/>
          ))}
        </div>
      </div>

      <button onClick={() => setShowAll(v => !v)}
        className="text-[9px] text-slate-400 hover:text-slate-600 underline self-start">
        {showAll ? 'Mostrar apenas relevantes' : `Mostrar todas (${templates.length} documentos)`}
      </button>

      {/* Custom documents */}
      {customDocs.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">📝 Documentos personalizados</p>
          <div className="flex flex-col gap-2">
            {customDocs.map((doc, i) => (
              <div key={doc.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50">
                  <span className="text-xs font-bold text-slate-700">{doc.titulo}</span>
                  <button onClick={() => onDeleteCustom(doc.id)}
                    className="text-[9px] text-rose-400 hover:text-rose-600">✕ Excluir</button>
                </div>
                <div className="px-3 pb-3">
                  <textarea value={doc.texto}
                    onChange={e => onUpdateCustom(doc.id, e.target.value)}
                    rows={6}
                    className="w-full mt-2 text-[11px] font-mono text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y leading-relaxed"/>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => { const w=window.open('','_blank'); w.document.write(`<html><body style="font-family:Arial;max-width:600px;margin:40px auto;font-size:13px;white-space:pre-wrap">${doc.texto.replace(/</g,'&lt;')}</body></html>`); w.print(); }}
                      className="text-[10px] font-bold bg-white border border-slate-200 hover:border-slate-400 text-slate-600 px-3 py-1.5 rounded-lg">🖨 Imprimir</button>
                    <button onClick={() => navigator.clipboard.writeText(doc.texto)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1.5">📋 Copiar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New custom document creator */}
      <NewDocForm pacienteNome={pacienteNome} enderecoSalvo={enderecoSalvo} onCreate={onAddCustom}/>
    </div>
  );
};
