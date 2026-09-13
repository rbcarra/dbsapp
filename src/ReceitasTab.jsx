import React, { useState, useMemo, useEffect } from 'react';
import { gerarRelatorio, getAIConfig } from './aiClient';

// Logos HC-FMUSP (base64) para o papel timbrado
const LOGO_HC = "data:image/png;base64,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";
const LOGO_IC = "data:image/png;base64,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ii2nn3bRWWf+y6kn//ifzvtdoc+PbCjASikistxjnUEiJKeUQooAejq7Wv/7utsrYZ505NgSMZEJXbfSojSKOEXqgfuWfuPcKweL+R/MDktPj9fZ47O4N1a3trXaJ5547tUVrQJa+eq1tc333Lf0lVc44TW8trb58ssfXP7CprLp+fznvzR77j73//6la65a+vobrT2FcMWLzVFUMSZc+dKmfL5822+evfEXL2ze3Op5qlDUjz6xYvnzmxSliUCcKKBCKfru+Vdla7I///XFiy446977Hl+85JmEn2xp7/nDw0+uXd9CynblO9au62lpzy9+5IU1G1qB4K67l13zH8s2bMp3dIcbN5RfemXzcy+95nm5F1/e+NADj29cawCo0Ke3tjtUSDgI2rDB2uckAKAomU7WVAx/+5tX1o1pRL9zxXO9v7jxwlLZ/ujiW/c7cMq//58l3/juwVGIzFPvf/CVBQvH/O6uRyF5xEsvvIzg3X3Xg9YuvPA7P7vz/h+zyN+e89NLLvvqujfaSiV76213/M3Z3/jWuVcVTWuxyy44/IAfXHYmi1F+sHbVlub15Z9e/sXpM7JTZ9TMnf9PDY3eqlc3n/+dnzeO0p2tT5z3/dOnzWz46y9dNWNOtrur0NFWuubn5y9b1hKGI+6464n5+86+4pLbcrXhEUfOe2rJprvv/OOsWVNfeeXRW25blMvmtMLBah8OmmwXwAhTFLnA9wq9dMAB+998wxW1NWNfXbll46a1a99omTRx4tf//si95088+piDMnU9XznnL/acMaWjvejpxF+eekyuNvm9C/42kQzCKIgsOcZCIT2yafQRC+c0ja256MK/+/l1DxX79P/cefmV//GPd9z++LKnV/qBBjCVsk0Edb7PxrrI8B5Tm0bkGm6/6aVKIfu973999KhRV/30BqWoVC6cePIh1990cWdnz7Zt2077whHZusp5//hFP2l6C9su+eG5/3jB2QcdPPu887+64Pj9Wzq7N27c5vu+OL09wR8aFs0AZSRUGgHAU6mpE0cgmDF1YyvdctbXD+ttoUceeL51W/eJp0w55xunayjW1yiFqQSkCAi10xprR/gIoBM6mfOdqwihDkQrrTGptXpzy8ZZe87KJv1Ze9U1Nozv6akAlAC8XK6mXCl1dlb2nJWxkVx66S9POvmwyPQRJO5/4I8TJmf2PejQ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";

// ─── IMPRESSÃO COM PAPEL TIMBRADO HC-FMUSP ────────────────────────────────────
// Envolve o texto do documento no cabeçalho e rodapé do Hospital das Clínicas.
const imprimirComTimbre = (titulo, texto) => {
  const corpo = (texto || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>${titulo || 'Documento'}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; }
      .folha { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 20mm 0; display: flex; flex-direction: column; }
      /* Cabeçalho */
      .cab { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 14mm; }
      .cab .logo-hc { height: 46px; width: auto; }
      .cab .logo-ic { height: 52px; width: auto; }
      .cab .titulo { flex: 1; text-align: center; font-weight: 700; font-size: 14px; line-height: 1.35; }
      /* Corpo */
      .corpo { flex: 1; font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
      /* Rodapé com as três caixas */
      .rodape { display: flex; gap: 8px; margin-top: 14mm; padding-bottom: 14mm; }
      .caixa { flex: 1; border: 1px solid #000; padding: 8px 10px; font-size: 8.5px; line-height: 1.9; min-height: 130px; }
      .caixa .th { text-align: center; font-weight: 700; margin-bottom: 8px; letter-spacing: .3px; }
      .caixa .ln { border-bottom: 1px solid #333; display: inline-block; min-width: 60%; }
      .emit { text-align: center; line-height: 1.7; }
    </style></head>
    <body onload="window.print()">
      <div class="folha">
        <div class="cab">
          <img class="logo-hc" src="${LOGO_HC}" alt="HC-FMUSP"/>
          <div class="titulo">Instituto Central do Hospital das Clínicas<br/>da Faculdade de Medicina<br/>da Universidade de São Paulo</div>
          <img class="logo-ic" src="${LOGO_IC}" alt="Instituto Central HCFMUSP"/>
        </div>
        <div class="corpo">${corpo}</div>
        <div class="rodape">
          <div class="caixa emit">
            <div class="th">IDENTIFICAÇÃO DO EMITENTE</div>
            HOSPITAL DAS CLÍNICAS<br/>DA<br/>FACULDADE DE MEDICINA DA UNIVERSIDADE DE SÃO PAULO<br/><br/>
            Av.: Dr. Enéas de Carvalho Aguiar, 255<br/>CEP: 05403-000 – São Paulo – SP<br/>Fone: (011) 2661-6000
          </div>
          <div class="caixa">
            <div class="th">IDENTIFICAÇÃO DO COMPRADOR</div>
            NOME: <span class="ln"></span><br/><br/>
            IDENT.: <span class="ln" style="min-width:35%"></span> ORG. EMISSOR ___<br/><br/>
            END.: <span class="ln"></span><br/><br/>
            CIDADE: <span class="ln" style="min-width:40%"></span> UF ___<br/><br/>
            FONE: ( ) <span class="ln"></span>
          </div>
          <div class="caixa">
            <div class="th">IDENTIFICAÇÃO DO FORNECEDOR</div>
            <br/><br/><br/><br/>
            <span class="ln" style="min-width:80%"></span> ___/___/___<br/>
            ASSINATURA DO FARMACÊUTICO &nbsp;&nbsp; DATA<br/><br/><br/>
            Fone: (011) 2661-6000
          </div>
        </div>
      </div>
    </body></html>`);
  w.document.close();
};



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
  bromoprida:  /bromoprida|bromopride/i,
  escitalopram:/escitalopram|citalopram|lexapro|cipralex/i,
  fluoxetina:  /fluoxetina|prozac/i,
  sertralina:  /sertralina|zoloft/i,
  bupropiona:  /bupropiona|wellbutrin|zyban/i,
  baclofeno:   /baclofeno|lioresal/i,
  gabapentina: /gabapentina|neurontin/i,
  pregabalina: /pregabalina|lyrica/i,
};

const _extractDailyDose = (line) => {
  let unit = 0;
  const dm = line.match(/(\d+(?:[.,]\d+)?)(?:\/\d+)?\s*(?:mg|mcg)/i);
  if (dm) unit = parseFloat(dm[1].replace(',','.'));

  // X-Y-Z posology (morning-afternoon-night)
  const xyz = line.match(/(\d+)\s*[-\u2013]\s*(\d+)\s*[-\u2013]\s*(\d+)/);
  if (xyz) { const n=(+xyz[1])+(+xyz[2])+(+xyz[3]); return { dose: unit * n, n }; }

  // Fraction + cp/cps pattern (e.g. "¾ cp", "3cps")
  const fracs = [...line.matchAll(/([\u00bc\u00bd\u00be]|\d+(?:[.,]\d+)?)\s*cps?\b/gi)];
  const FRAC = { '\u00bc': 0.25, '\u00bd': 0.5, '\u00be': 0.75 };
  if (fracs.length > 0) {
    const cpsPerDose = fracs.reduce((s,m) => s + ((FRAC[m[1]] !== undefined ? FRAC[m[1]] : (parseFloat((m[1]||'0').replace(',','.')) || 0))), 0);
    // Check for "Nx/dia" or "Nx ao dia" multiplier on same line
    const mult = line.match(/(\d+)\s*[xX\u00d7]\s*(?:ao\s*)?(?:dia|d\b|\/d\b)/i);
    const n = mult ? cpsPerDose * +mult[1] : cpsPerDose;
    return { dose: unit * n, n };
  }

  // "Nx ao dia", "Nx dia", "Nx/dia", "N vezes ao dia", "1x/d"
  const nx = line.match(/(\d+)\s*[xX\u00d7]\s*(?:ao\s*)?(?:dia|d\b|\/d\b)/i)
           || line.match(/(\d+)\s*vez(?:es)?\s*(?:ao\s*)?dia/i)
           || line.match(/(\d+)\s*[xX]\s*\/\s*dia/i);
  if (nx) return { dose: unit * +nx[1], n: +nx[1] };

  // "8xd" shorthand
  const xd = line.match(/(\d+)\s*[xX]d\b/i);
  if (xd) return { dose: unit * +xd[1], n: +xd[1] };

  // Count time-of-day tokens as proxy for n_per_day ("7h30, 9h30, 11h30")
  const times = line.match(/\b\d{1,2}h(?:\d{2})?\b/g);
  if (times && times.length >= 2) return { dose: unit * times.length, n: times.length };

  return { dose: unit, n: 1 };
};;
;

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

  const print = () => imprimirComTimbre(template.titulo, text);

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
  aiEnabled = false, aiHealthOllama = false, transcricaoOrganizada = '',
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
            🔍 Medicamentos detectados na evolução: {Object.keys(meds).map(id => ({
              levodopa:'Prolopa/Levodopa', levodopa_hbs:'Prolopa HBS', levodopa_disp:'Prolopa Dispersível',
              amantadina:'Amantadina', pramipexol:'Pramipexol', ropinirol:'Ropinirol',
              rotigotina:'Rotigotina', rasagilina:'Rasagilina', safinamida:'Safinamida',
              selegilina:'Selegilina', entacapona:'Entacapona', opicapona:'Opicapona',
              melatonina:'Melatonina', domperidona:'Domperidona', lactulose:'Lactulose',
              clonazepam:'Clonazepam', quetiapina:'Quetiapina', rivastigmina:'Rivastigmina',
              donepezila:'Donepezila', venlafaxina:'Venlafaxina', mirtazapina:'Mirtazapina',
              levotiroxina:'Levotiroxina', propantelina:'Propantelina', omeprazol:'Omeprazol',
              citalopram:'Escitalopram/Citalopram', sertralina:'Sertralina',
              bromoprida:'Bromoprida', escitalopram:'Escitalopram', fluoxetina:'Fluoxetina',
              bupropiona:'Bupropiona', baclofeno:'Baclofeno', gabapentina:'Gabapentina',
              pregabalina:'Pregabalina',
            }[id] || id)).join(', ')}
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
                    <button onClick={() => imprimirComTimbre(doc.titulo || 'Documento', doc.texto)}
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

      {/* AI report/prescription generator */}
      <AIReportBlock
        aiEnabled={aiEnabled}
        aiHealthOllama={aiHealthOllama}
        contexto={[notasLivres, transcricaoOrganizada].filter(Boolean).join('\n\n')}
        onCreate={onAddCustom}
      />
    </div>
  );
};

// ─── AI REPORT/PRESCRIPTION GENERATOR ────────────────────────────────────────
const AIReportBlock = ({ aiEnabled, aiHealthOllama, contexto, onCreate }) => {
  const [solicitacao, setSolicitacao] = useState('');
  const [resultado, setResultado] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const gerar = async () => {
    if (!solicitacao.trim()) return;
    setBusy(true); setErro(''); setResultado('');
    try {
      const texto = await gerarRelatorio({ solicitacao, contexto, config: getAIConfig() });
      setResultado(texto);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };

  const status = !aiEnabled ? 'off' : aiHealthOllama ? 'ok' : 'off';
  const dot = status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500';

  const exemplos = [
    'Relatório para perícia do INSS descrevendo o quadro de Parkinson e limitações',
    'Carta de encaminhamento para fisioterapia motora',
    'Atestado de comparecimento à consulta hoje',
    'Relatório de indicação de DBS com histórico de tratamento',
  ];

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-violet-50 border-b border-violet-100">
        <span className="text-xs font-bold text-violet-700 uppercase tracking-wider flex items-center gap-2">
          ✨ Gerar receita/relatório com IA
        </span>
        <span className={`w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white shadow`}
          title={status === 'ok' ? 'IA conectada' : 'IA desconectada'} />
      </div>
      <div className="p-4 flex flex-col gap-2">
        <p className="text-[10px] text-slate-500">
          Descreva o documento desejado. A IA usa a evolução e a transcrição organizada como contexto.
        </p>
        <div className="flex flex-wrap gap-1">
          {exemplos.map((ex, i) => (
            <button key={i} onClick={() => setSolicitacao(ex)}
              className="text-[9px] bg-white border border-violet-200 hover:border-violet-400 text-violet-600 rounded-full px-2 py-0.5 transition-all">
              {ex.length > 40 ? ex.slice(0, 40) + '…' : ex}
            </button>
          ))}
        </div>
        <textarea
          value={solicitacao}
          onChange={e => setSolicitacao(e.target.value)}
          placeholder="Ex: Relatório médico para perícia descrevendo o quadro atual e resposta ao DBS..."
          rows={2}
          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-y text-slate-700"
        />
        <button onClick={gerar} disabled={!aiEnabled || busy || !solicitacao.trim()}
          className="self-start text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-lg transition-all disabled:opacity-40">
          {busy ? '⟳ Gerando…' : '✨ Gerar documento'}
        </button>
        {erro && <div className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">⚠ {erro}</div>}
        {resultado && (
          <div className="mt-1">
            <textarea
              value={resultado}
              onChange={e => setResultado(e.target.value)}
              rows={8}
              className="w-full text-[11px] font-mono text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-y leading-relaxed"
            />
            <div className="flex gap-2 mt-1">
              <button onClick={() => onCreate?.({ id: Date.now().toString(), titulo: 'Documento IA', texto: resultado })}
                className="text-[10px] font-bold bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg">
                ＋ Salvar como documento
              </button>
              <button onClick={() => imprimirComTimbre('Documento IA', resultado)}
                className="text-[10px] font-bold bg-white border border-slate-200 hover:border-slate-400 text-slate-600 px-3 py-1.5 rounded-lg">🖨 Imprimir</button>
              <button onClick={() => navigator.clipboard.writeText(resultado)}
                className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1.5">📋 Copiar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
