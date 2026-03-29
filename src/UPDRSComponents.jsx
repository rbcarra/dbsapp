import React, { useState } from 'react';

// ─── MDS-UPDRS PARTE III DATA ─────────────────────────────────────────────
const items = [
            { id: "3.1", name: "Fala", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0: Normal.",
                  "1: Perda de modulação, dicção ou volume, mas todas as palavras são facilmente compreensíveis.",
                  "2:  Perda de modulação, dicção ou volume, com algumas palavras não claras, mas a frase como um todo é fácil de compreender.",
                  "3: A fala é difícil de compreender ao ponto de algumas, mas não a maioria das frases, serem difíceis de compreender.",
                  "4: A maioria da fala é difícil de compreender ou ininteligível."
              ]},
            { id: "3.2", name: "Expressão Facial", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0: Normal.",
                  "1: Mínima fácies inexpressiva manifestada apenas pela diminuição na frequência do piscar de olhos.",
                  "2: Além da diminuição da frequência do piscar de olhos, presença de fácies inexpressiva na parte inferior da face, particularmente nos movimentos da boca, tal como menos sorriso espontâneo, mas sem afastamento dos lábios. ",
                  "3: Fácies inexpressiva com afastamento dos lábios por algum tempo quando a boca está em repouso. ",
                  "4: Fácies inexpressiva com afastamento dos lábios na maior parte do tempo quando a boca está em repouso."
              ]},
            { id: "3.3a", name: "Rigidez (Pescoço)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0: Ausente.",
                  "1: Rigidez apenas detectada com uma manobra de ativação.",
                  "2: Rigidez detectada sem a manobra de ativação, mas a amplitude total de movimento é facilmente alcançada.",
                  "3: Rigidez  detectada sem a manobra de ativação; amplitude total alcançada com esforço. ",
                  "4: Rigidez  detectada sem a manobra de ativação e amplitude total de movimento não alcançada."
              ]},
            { id: "3.3b", name: "Rigidez (MSD)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0: Ausente.",
                  "1: Rigidez apenas detectada com uma manobra de ativação.",
                  "2: Rigidez detectada sem a manobra de ativação, mas a amplitude total de movimento é facilmente alcançada.",
                  "3: Rigidez  detectada sem a manobra de ativação; amplitude total alcançada com esforço. ",
                  "4: Rigidez  detectada sem a manobra de ativação e amplitude total de movimento não alcançada."
              ]},
            { id: "3.3c", name: "Rigidez (MSE)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0: Ausente.",
                  "1: Rigidez apenas detectada com uma manobra de ativação.",
                  "2: Rigidez detectada sem a manobra de ativação, mas a amplitude total de movimento é facilmente alcançada.",
                  "3: Rigidez  detectada sem a manobra de ativação; amplitude total alcançada com esforço. ",
                  "4: Rigidez  detectada sem a manobra de ativação e amplitude total de movimento não alcançada."
              ]},
            { id: "3.3d", name: "Rigidez (MID)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0: Ausente.",
                  "1: Rigidez apenas detectada com uma manobra de ativação.",
                  "2: Rigidez detectada sem a manobra de ativação, mas a amplitude total de movimento é facilmente alcançada.",
                  "3: Rigidez  detectada sem a manobra de ativação; amplitude total alcançada com esforço. ",
                  "4: Rigidez  detectada sem a manobra de ativação e amplitude total de movimento não alcançada."
              ]},
            { id: "3.3e", name: "Rigidez (MIE)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0: Ausente.",
                  "1: Rigidez apenas detectada com uma manobra de ativação.",
                  "2: Rigidez detectada sem a manobra de ativação, mas a amplitude total de movimento é facilmente alcançada.",
                  "3: Rigidez  detectada sem a manobra de ativação; amplitude total alcançada com esforço. ",
                  "4: Rigidez  detectada sem a manobra de ativação e amplitude total de movimento não alcançada."
              ]},
            { id: "3.4a", name: "Batida de dedos (D)",
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: ["0:Sem problemas", "1: Um dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações nos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim das 10 repetições. ", "2: Qualquer um dos seguintes: a) 3 a 5 interrupções durante os movimentos; b) lentidão ligeira; c) a amplitude diminui no meio da sequência das 10 repetições", "3: Qualquer um dos seguintes: a) mais de 5 interrupções durante os movimentos ou pelo menos uma pausa mais longa (bloqueio); b) lentidão moderada; c) a amplitude diminui após o primeiro movimento", "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos."] },
            { id: "3.4b", name: "Batida de dedos (E)",
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: ["0:Sem problemas", "1: Um dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações nos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim das 10 repetições. ", "2: Qualquer um dos seguintes: a) 3 a 5 interrupções durante os movimentos; b) lentidão ligeira; c) a amplitude diminui no meio da sequência das 10 repetições", "3: Qualquer um dos seguintes: a) mais de 5 interrupções durante os movimentos ou pelo menos uma pausa mais longa (bloqueio); b) lentidão moderada; c) a amplitude diminui após o primeiro movimento", "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos."] },
            { id: "3.5a", name: "Movimento das mãos (D)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Qualquer dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações dos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim da tarefa.",
                  "2: Qualquer dos seguintes: a) 3 a 5 interrupções durante o movimento; b) lentidão  ligeira; c) a amplitude diminui no meio da tarefa. ",
                  "3: Qualquer dos seguintes: a) mais de 5 interrupções durante o movimento ou pelo menos uma pausa mais prolongada (bloqueio); b) lentidão moderada; c) a amplitude diminui após a primeira sequência de abrir e fechar.",
                  "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos. "
                  ]},
            { id: "3.5b", name: "Movimento das mãos (E)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Qualquer dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações dos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim da tarefa.",
                  "2: Qualquer dos seguintes: a) 3 a 5 interrupções durante o movimento; b) lentidão  ligeira; c) a amplitude diminui no meio da tarefa. ",
                  "3: Qualquer dos seguintes: a) mais de 5 interrupções durante o movimento ou pelo menos uma pausa mais prolongada (bloqueio); b) lentidão moderada; c) a amplitude diminui após a primeira sequência de abrir e fechar.",
                  "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos. "
                  ]},
            { id: "3.6a", name: "Pronação-Supinação das mãos (D)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Qualquer dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações dos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim da tarefa.",
                  "2: Qualquer dos seguintes: a) 3 a 5 interrupções durante o movimento; b) lentidão  ligeira; c) a amplitude diminui no meio da tarefa. ",
                  "3: Qualquer dos seguintes: a) mais de 5 interrupções durante o movimento ou pelo menos uma pausa mais prolongada (bloqueio); b) lentidão moderada; c) a amplitude diminui após a primeira sequência de abrir e fechar.",
                  "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos. "
                  ]},  
            { id: "3.6b", name: "Pronação-Supinação das mãos (E)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Qualquer dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações dos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim da tarefa.",
                  "2: Qualquer dos seguintes: a) 3 a 5 interrupções durante o movimento; b) lentidão  ligeira; c) a amplitude diminui no meio da tarefa. ",
                  "3: Qualquer dos seguintes: a) mais de 5 interrupções durante o movimento ou pelo menos uma pausa mais prolongada (bloqueio); b) lentidão moderada; c) a amplitude diminui após a primeira sequência de abrir e fechar.",
                  "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos. "
                  ]},            
                  { id: "3.7a", name: "Bater dos dedos dos pés (D)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Qualquer dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações dos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim das 10 repetições..",
                  "2: Qualquer dos seguintes: a) 3 a 5 interrupções durante o movimento; b) lentidão  ligeira; c) a amplitude diminui no meio da tarefa. ",
                  "3: Qualquer dos seguintes: a) mais de 5 interrupções durante o movimento ou pelo menos uma pausa mais prolongada (bloqueio); b) lentidão moderada; c) a amplitude diminui após a primeira sequência de abrir e fechar.",
                  "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos. "
                  ]},
            { id: "3.7b", name: "Bater dos dedos dos pés (E)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Qualquer dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações dos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim das 10 repetições..",
                  "2: Qualquer dos seguintes: a) 3 a 5 interrupções durante o movimento; b) lentidão  ligeira; c) a amplitude diminui no meio da tarefa. ",
                  "3: Qualquer dos seguintes: a) mais de 5 interrupções durante o movimento ou pelo menos uma pausa mais prolongada (bloqueio); b) lentidão moderada; c) a amplitude diminui após a primeira sequência de abrir e fechar.",
                  "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos. "
                  ]},
            { id: "3.8a", name: "Agilidade das pernas (D)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Qualquer dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações dos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim da tarefa.",
                  "2: Qualquer dos seguintes: a) 3 a 5 interrupções durante o movimento; b) lentidão  ligeira; c) a amplitude diminui no meio da tarefa. ",
                  "3: Qualquer dos seguintes: a) mais de 5 interrupções durante o movimento ou pelo menos uma pausa mais prolongada (bloqueio); b) lentidão moderada; c) a amplitude diminui após a primeira sequência de abrir e fechar.",
                  "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos. "
                  ]},  
            { id: "3.8b", name: "Agilidade das pernas (E)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Qualquer dos seguintes: a) o ritmo regular é interrompido com uma ou duas interrupções ou hesitações dos movimentos; b) lentidão mínima; c) a amplitude diminui perto do fim da tarefa.",
                  "2: Qualquer dos seguintes: a) 3 a 5 interrupções durante o movimento; b) lentidão  ligeira; c) a amplitude diminui no meio da tarefa. ",
                  "3: Qualquer dos seguintes: a) mais de 5 interrupções durante o movimento ou pelo menos uma pausa mais prolongada (bloqueio); b) lentidão moderada; c) a amplitude diminui após a primeira sequência de abrir e fechar.",
                  "4: Não consegue ou quase não consegue executar a tarefa devido à lentidão, interrupções ou decrementos. "
                  ]},   
            { id: "3.9", name: "Levantar da cadeira", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas. Capaz de se levantar rapidamente sem hesitações",
                  "1:   O levantar é mais lento que o normal; ou pode ser necessária mais que uma tentativa; ou pode ser necessário mover-se à frente na cadeira para se levantar. Sem necessidade de usar os braços da cadeira. ",
                  "2: Empurra-se para cima usando os braços da cadeira sem dificuldade. ",
                  "3: Necessita de se empurrar, mas tende a cair para trás; ou pode ter de tentar mais do que uma vez utilizando os braços da cadeira, mas consegue levantar-se sem ajuda.  ",
                  "4: Incapaz de se levantar sem ajuda.  "
                  ]},   
            { id: "3.10", name: "Marcha", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1: Marcha independente com mínima alteração. ",
                  "2: Marcha independente mas com alteração substancial.   ",
                  "3: Precisa de um auxílio de marcha (bengala, muleta, andador) para andar em segurança, mas não de outra pessoa.  ",
                  "4: Incapaz de caminhar ou consegue apenas com ajuda de outra pessoa.   "
                  ]},   
            { id: "3.11", name: "Freezing/Bloqueio na marcha", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem bloqueio na marcha (freezing). ",
                  "1:  Bloqueio ao iniciar a marcha, ao se virar ou ao atravessar portas com apenas uma interrupção durante qualquer um destes eventos, mas depois continua sem bloqueios durante a marcha em linha reta.  ",
                  "2: Bloqueio no início, nas voltas ou ao atravessar portas com mais de uma interrupção durante qualquer uma destas atividades, mas depois continua sem bloqueios durante a marcha em linha reta.  ",
                  "3: Bloqueia uma vez durante a marcha em linha reta.   ",
                  "4: Bloqueia várias vezes durante a marcha em linha reta. "
                  ]},   
            { id: "3.12", name: "Estabilidade Postural", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas. Recupera com um ou dois passos.",
                  "1:   3 a 5 passos, mas o paciente recupera sem ajuda. ",
                  "2: Mais de 5 passos, mas o paciente recupera sem ajuda.",
                  "3: Mantém-se de pé em segurança, mas com ausência de resposta postural; cai se não for aparado pelo avaliador.  ",
                  "4: Muito instável, tende a perder o equilíbrio espontaneamente ou com um ligeiro puxão nos ombros.  "
                  ]}, 
            { id: "3.13", name: "Postura", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  O paciente não está completamente ereto, mas a postura pode ser normal para uma pessoa mais idosa.   ",
                  "2:  Evidente flexão, escoliose ou inclinação lateral, mas o paciente consegue corrigir e adotar uma postura normal quando solicitado. ",
                  "3: Postura encurvada, escoliose ou inclinação lateral, que não pode ser voluntariamente corrigida pelo paciente até uma postura normal.  ",
                  "4: Flexão, escoliose ou inclinação com postura extremamente anormal.  "
                  ]}, 
            { id: "3.14", name: "Espontaneidade global de movimento", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem problemas.",
                  "1:  Lentidão global e pobreza de movimentos espontâneos discreta. ",
                  "2:  Lentidão global e pobreza de movimentos espontâneos discreta. ",
                  "3:  Lentidão global e pobreza de movimentos espontâneos moderada. ",
                  "4: Lentidão global e pobreza de movimentos espontâneos grave..  "
                  ]},
             { id: "3.15a", name: "Tremor postural das mãos (D)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 3 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 3 cm, mas menos de 10 cm de amplitude. ",
                  "4: O tremor tem pelo menos 10 cm de amplitude. "
                  ]},            
             { id: "3.15b", name: "Tremor postural das mãos (E)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 3 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 3 cm, mas menos de 10 cm de amplitude. ",
                  "4: O tremor tem pelo menos 10 cm de amplitude. "
                  ]},          
             { id: "3.16a", name: "Tremor cinético das mãos (D)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 3 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 3 cm, mas menos de 10 cm de amplitude. ",
                  "4: O tremor tem pelo menos 10 cm de amplitude. "
                  ]},            
             { id: "3.16b", name: "Tremor cinético das mãos (E)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 3 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 3 cm, mas menos de 10 cm de amplitude. ",
                  "4: O tremor tem pelo menos 10 cm de amplitude. "
                  ]},
             { id: "3.17a", name: "Amplitude do tremor de repouso (MSD)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 3 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 3 cm, mas menos de 10 cm de amplitude. ",
                  "4: O tremor tem pelo menos 10 cm de amplitude. "
                  ]},
             { id: "3.17b", name: "Amplitude do tremor de repouso (MSE)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 3 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 3 cm, mas menos de 10 cm de amplitude. ",
                  "4: O tremor tem pelo menos 10 cm de amplitude. "
                  ]},
             { id: "3.17c", name: "Amplitude do tremor de repouso (MID)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 3 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 3 cm, mas menos de 10 cm de amplitude. ",
                  "4: O tremor tem pelo menos 10 cm de amplitude. "
                  ]},
             { id: "3.17d", name: "Amplitude do tremor de repouso (MIE)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 3 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 3 cm, mas menos de 10 cm de amplitude. ",
                  "4: O tremor tem pelo menos 10 cm de amplitude. "
                  ]},
             { id: "3.17e", name: "Amplitude do tremor de repouso (Mento)", 
              opts: ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"],
              desc: [
                  "0:  Sem tremor.",
                  "1:  O tremor está presente mas tem menos de 1 cm de amplitude.",
                  "2:  O tremor tem pelo menos 1 cm mas menos de 2 cm de amplitude.   ",
                  "3:  O tremor tem pelo menos 2 cm, mas menos de 3 cm de amplitude. ",
                  "4: O tremor tem pelo menos 3 cm de amplitude. "
                  ]},
             { id: "3.18", name: "Persistência do tremor de repouso", 
              opts: ["sem tremor", "<25%", "26-50% ", "51-75%", ">75%"],
              desc: ["sem tremor", "<25% do tempo", "26-50% do tempo ", "51-75% do tempo", ">75% do tempo"
                  ]},
        ];

const UPDRSModal = ({ onClose, onInserir }) => {
  const [scores, setScores] = useState(() => {
    const s = {};
    items.forEach(it => { s[it.id] = 0; });
    return s;
  });

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const details = items.map(it => `${it.id}:${scores[it.id]}`).join(' ');
  const resultText = `MDS-UPDRS III total: ${total} | ${details}`;

  // Group items with letters under the same subscore-group
  const groups = [];
  let currentGroup = null;
  let lastBase = '';
  items.forEach(item => {
    const hasLetter = /[a-z]/.test(item.id);
    const base = item.id.replace(/[a-z]$/, '');
    if (hasLetter) {
      if (base !== lastBase) {
        currentGroup = { base, items: [] };
        groups.push({ type: 'subgroup', group: currentGroup });
        lastBase = base;
      }
      currentGroup.items.push(item);
    } else {
      groups.push({ type: 'single', item });
      currentGroup = null;
      lastBase = '';
    }
  });

  const renderItem = (item) => (
    <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-2 mb-1">
      <div className="text-xs font-bold text-slate-700 mb-1.5">{item.id}. {item.name}</div>
      <div className="flex flex-wrap gap-1">
        {item.opts.map((label, idx) => (
          <button key={idx}
            onClick={() => setScores(s => ({ ...s, [item.id]: idx }))}
            title={item.desc?.[idx] || ''}
            className={`flex-1 min-w-[70px] px-2 py-1.5 rounded text-[10px] border transition-all ${
              scores[item.id] === idx
                ? 'bg-teal-500 text-white border-teal-500 font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400'
            }`}>
            <span className="block font-bold text-[11px]">{idx}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-teal-700 text-white rounded-t-2xl shrink-0">
          <div>
            <h2 className="font-bold text-sm">MDS-UPDRS Parte III</h2>
            <p className="text-[10px] text-teal-200">Passe o mouse sobre as opções para ver os critérios</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-black bg-teal-600 px-3 py-1 rounded-lg">{total}</span>
            <button onClick={onClose} className="text-white hover:text-teal-200 text-xl font-bold leading-none">×</button>
          </div>
        </div>

        {/* Scrollable items */}
        <div className="flex-1 overflow-y-auto p-4">
          {groups.map((g, gi) => {
            if (g.type === 'single') return renderItem(g.item);
            return (
              <div key={gi} className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 mb-2">
                {g.group.items.map(renderItem)}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t bg-white px-4 py-3 flex items-center gap-3">
          <div className="flex-1 font-mono text-[10px] text-slate-600 bg-slate-100 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
            {resultText}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(resultText); }}
            className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg">
            📋 Copiar
          </button>
          <button
            onClick={() => { onInserir(resultText); onClose(); }}
            className="text-[10px] font-bold bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg">
            ✓ Inserir na evolução
          </button>
        </div>
      </div>
    </div>
  );
};

export { UPDRSModal };
