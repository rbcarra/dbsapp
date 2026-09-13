// ─── MDS-UPDRS PARTES I, II, IV — Tradução Oficial MDS (Português) ───────────
// Copyright © 2016 International Parkinson and Movement Disorder Society.
// Textos das âncoras conforme "Official MDS Portuguese Translation" (2021).

const OPTS5 = ["Normal", "Discreto", "Ligeiro", "Moderado", "Grave"];

// ── PARTE I: Aspectos Não Motores das Experiências da Vida Diária ────────────
export const MDS_UPDRS_I = [
  { id: "1.1", name: "Disfunção cognitiva", opts: OPTS5, desc: [
    "0: Sem disfunção cognitiva.",
    "1: Disfunção cognitiva identificada pelo paciente ou cuidador, sem interferência concreta na capacidade do paciente desempenhar as suas atividades e interações sociais normais.",
    "2: Disfunção cognitiva clinicamente evidente, mas apenas com interferência mínima na capacidade do paciente desempenhar as suas atividades e interações sociais normais.",
    "3: As disfunções cognitivas interferem, mas não impedem, que o paciente desempenhe as suas atividades e interações sociais normais.",
    "4: A disfunção cognitiva impede que o paciente desempenhe as suas atividades e interações sociais normais.",
  ]},
  { id: "1.2", name: "Alucinações e psicose", opts: OPTS5, desc: [
    "0: Sem alucinações ou comportamento psicótico.",
    "1: Ilusões ou alucinações não formadas, mas o paciente reconhece-as sem perda de noção da realidade.",
    "2: Alucinações formadas, independentes de estímulos ambientais. Sem perda de noção da realidade.",
    "3: Alucinações formadas com perda de noção da realidade.",
    "4: O paciente tem delírios ou paranóia.",
  ]},
  { id: "1.3", name: "Humor depressivo", opts: OPTS5, desc: [
    "0: Sem humor depressivo.",
    "1: Episódios de humor depressivo que não se prolongam por mais de um dia de cada vez. Sem interferência nas atividades e interações sociais habituais.",
    "2: Humor depressivo mantido por vários dias, mas sem interferência nas atividades e interações sociais habituais.",
    "3: Humor depressivo que interfere mas não impede o paciente de desempenhar as suas atividades e interações sociais habituais.",
    "4: Humor depressivo que impede o paciente de desempenhar as suas atividades e interações sociais habituais.",
  ]},
  { id: "1.4", name: "Ansiedade", opts: OPTS5, desc: [
    "0: Sem ansiedade.",
    "1: Sentimento de ansiedade presente mas não mantido por mais de um dia de cada vez. Sem interferência nas atividades e interações sociais habituais.",
    "2: Sentimento de ansiedade presente e mantido por mais de um dia de cada vez. Sem interferência nas atividades e interações sociais habituais.",
    "3: O sentimento de ansiedade interfere mas não impede o paciente de desempenhar as suas atividades e interações sociais habituais.",
    "4: O sentimento de ansiedade impede o paciente de desempenhar as suas atividades e interações sociais habituais.",
  ]},
  { id: "1.5", name: "Apatia", opts: OPTS5, desc: [
    "0: Sem apatia.",
    "1: Apatia referida pelo paciente e/ou cuidador, mas sem interferência na realização das suas atividades e interações sociais habituais.",
    "2: Apatia que interfere com atividades e interações sociais esporádicas.",
    "3: Apatia que interfere com a maioria das atividades e interações sociais.",
    "4: Passivo e com completa perda de iniciativa.",
  ]},
  { id: "1.6", name: "Síndrome de desregulação dopaminérgica", opts: OPTS5, desc: [
    "0: Ausência de problemas.",
    "1: Os problemas estão presentes mas geralmente não causam dificuldades ao paciente ou família/cuidador.",
    "2: Os problemas estão presentes e geralmente causam algumas dificuldades na vida pessoal e familiar do paciente.",
    "3: Os problemas estão presentes e geralmente causam muitas dificuldades na vida pessoal e familiar do paciente.",
    "4: Os problemas impedem o paciente de desempenhar as atividades habituais e interações sociais ou impedem a manutenção dos padrões anteriores na vida pessoal e familiar.",
  ]},
  { id: "1.7", name: "Problemas do sono", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Os problemas do sono existem, mas habitualmente não impedem uma noite de sono completa.",
    "2: Os problemas do sono causam habitualmente alguma dificuldade em ter uma noite de sono completa.",
    "3: Os problemas do sono causam muitas dificuldades, mas habitualmente ainda dorme mais de metade da noite.",
    "4: Habitualmente não consegue dormir durante a maior parte da noite.",
  ]},
  { id: "1.8", name: "Sonolência diurna", opts: OPTS5, desc: [
    "0: Sem sonolência durante o dia.",
    "1: Tem sonolência durante o dia, mas consegue resistir e permanece acordado.",
    "2: Por vezes adormece quando está sozinho e relaxado (ex: lendo ou vendo TV).",
    "3: Por vezes adormece quando não deveria (ex: comendo ou conversando).",
    "4: Adormece frequentemente quando não deveria (ex: comendo ou conversando).",
  ]},
  { id: "1.9", name: "Dor e outras sensações", opts: OPTS5, desc: [
    "0: Não tem estas sensações desconfortáveis.",
    "1: Tem estas sensações, mas consegue fazer coisas e estar com outras pessoas sem dificuldade.",
    "2: Estas sensações causam alguns problemas ao fazer coisas ou estar com outras pessoas.",
    "3: Estas sensações causam muitos problemas, mas não impedem de fazer coisas ou estar com pessoas.",
    "4: Estas sensações impedem de fazer coisas ou de estar com outras pessoas.",
  ]},
  { id: "1.10", name: "Problemas urinários", opts: OPTS5, desc: [
    "0: Sem problemas em reter a urina.",
    "1: Precisa urinar frequentemente ou tem urgência, mas sem dificuldades nas atividades diárias.",
    "2: Os problemas causam algumas dificuldades diárias, mas sem perdas acidentais de urina.",
    "3: Causam muitas dificuldades nas atividades diárias, incluindo perdas acidentais.",
    "4: Não consegue reter a urina e usa fralda ou sonda urinária.",
  ]},
  { id: "1.11", name: "Obstipação intestinal", opts: OPTS5, desc: [
    "0: Sem obstipação.",
    "1: Faz esforço extra para evacuar, mas o problema não perturba atividades ou conforto.",
    "2: A obstipação causa alguma dificuldade em fazer coisas ou estar confortável.",
    "3: Causa muita dificuldade, mas não impede de fazer o que quer que seja.",
    "4: Habitualmente precisa da ajuda física de outra pessoa para evacuar.",
  ]},
  { id: "1.12", name: "Tonturas ao se levantar", opts: OPTS5, desc: [
    "0: Sem sensação de cabeça vazia ou tonturas.",
    "1: Tem tonturas, mas não causam dificuldade em fazer coisas.",
    "2: As tonturas fazem com que tenha de se segurar a algo, mas sem precisar sentar/deitar.",
    "3: As tonturas fazem com que tenha de sentar ou deitar para evitar desmaiar ou cair.",
    "4: As tonturas fazem com que caia ou desmaie.",
  ]},
  { id: "1.13", name: "Fadiga", opts: OPTS5, desc: [
    "0: Sem fadiga.",
    "1: Sente fadiga, mas não causa dificuldade em fazer coisas ou estar com pessoas.",
    "2: A fadiga causa alguma dificuldade em fazer coisas ou estar com pessoas.",
    "3: Causa muita dificuldade, mas não impede de fazer nada.",
    "4: A fadiga impede de fazer coisas ou de estar com pessoas.",
  ]},
];

// ── PARTE II: Aspectos Motores das Experiências da Vida Diária ───────────────
export const MDS_UPDRS_II = [
  { id: "2.1", name: "Fala", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Voz baixa, arrastada ou irregular, mas os outros não pedem para repetir.",
    "2: Ocasionalmente pedem para repetir, mas não todos os dias.",
    "3: Pedem para repetir todos os dias, apesar da maioria da fala ser compreendida.",
    "4: A maioria ou toda a fala não é compreendida.",
  ]},
  { id: "2.2", name: "Saliva e baba", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Saliva em excesso, mas não baba.",
    "2: Baba um pouco durante o sono, mas não acordado.",
    "3: Baba um pouco acordado, mas habitualmente não precisa de lenço.",
    "4: Baba tanto que precisa habitualmente de lenços para proteger as roupas.",
  ]},
  { id: "2.3", name: "Mastigação e deglutição", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Consciente da lentidão ao mastigar/engolir, mas não se engasga nem precisa de comida especial.",
    "2: Precisa de comprimidos partidos ou comida especialmente preparada, mas não se engasgou na última semana.",
    "3: Engasgou-se pelo menos uma vez na última semana.",
    "4: Precisa de ser alimentado por sonda.",
  ]},
  { id: "2.4", name: "Tarefas para comer", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Lento, mas não precisa de ajuda e não entorna alimentos.",
    "2: Lento e ocasionalmente entorna; pode precisar de ajuda em tarefas como cortar carne.",
    "3: Precisa de ajuda em muitas tarefas, mas consegue algumas sozinho.",
    "4: Precisa de ajuda na maioria ou em todas as tarefas.",
  ]},
  { id: "2.5", name: "Vestir", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Lento, mas não precisa de ajuda.",
    "2: Lento e precisa de ajuda para algumas tarefas (botões, braceletes).",
    "3: Precisa de ajuda em várias tarefas relacionadas com o vestir.",
    "4: Precisa de ajuda na maioria ou em todas as tarefas.",
  ]},
  { id: "2.6", name: "Higiene", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Lento, mas não precisa de ajuda para nenhuma tarefa.",
    "2: Precisa de ajuda para algumas tarefas de higiene.",
    "3: Precisa de ajuda para várias tarefas de higiene.",
    "4: Precisa de ajuda para a maioria ou todas as tarefas.",
  ]},
  { id: "2.7", name: "Escrita", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Escrita lenta, desajeitada ou irregular, mas todas as palavras são claras.",
    "2: Algumas palavras são pouco claras e difíceis de ler.",
    "3: Muitas palavras são pouco claras e difíceis de ler.",
    "4: A maioria ou todas as palavras são ilegíveis.",
  ]},
  { id: "2.8", name: "Passatempos e outras atividades", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Um pouco lento, mas faz estas atividades facilmente.",
    "2: Alguma dificuldade em fazer estas atividades.",
    "3: Grandes problemas, mas ainda faz a maior parte delas.",
    "4: Incapaz de fazer a maioria ou todas estas atividades.",
  ]},
  { id: "2.9", name: "Virar-se na cama", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Alguma dificuldade, mas não precisa de ajuda.",
    "2: Muita dificuldade em virar-se, ocasionalmente precisa de ajuda.",
    "3: Precisa frequentemente de ajuda para se virar.",
    "4: Incapaz de se virar sem ajuda de outra pessoa.",
  ]},
  { id: "2.10", name: "Tremor", opts: OPTS5, desc: [
    "0: Sem tremor.",
    "1: O tremor ocorre, mas não causa problemas em nenhuma atividade.",
    "2: Causa problemas apenas em poucas atividades.",
    "3: Causa problemas em muitas atividades diárias.",
    "4: Causa problemas na maioria ou em todas as atividades.",
  ]},
  { id: "2.11", name: "Sair da cama, carro ou cadeira baixa", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Lento ou desajeitado, mas consegue normalmente na primeira tentativa.",
    "2: Precisa de mais de uma tentativa, ou ocasionalmente de ajuda.",
    "3: Por vezes precisa de ajuda, mas na maioria consegue sozinho.",
    "4: Precisa de ajuda a maior parte ou todo o tempo.",
  ]},
  { id: "2.12", name: "Marcha e equilíbrio", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Discretamente lento ou arrasta uma perna. Nunca usa auxílio para andar.",
    "2: Ocasionalmente usa auxílio (bengala, muleta, andador), mas não precisa de outra pessoa.",
    "3: Habitualmente usa auxílio para andar com segurança, mas geralmente sem apoio de pessoa.",
    "4: Habitualmente usa o apoio de outra pessoa para andar de forma segura.",
  ]},
  { id: "2.13", name: "Bloqueios na marcha", opts: OPTS5, desc: [
    "0: Sem problemas.",
    "1: Bloqueios breves, retoma facilmente. Não precisa de ajuda ou auxílio por causa dos bloqueios.",
    "2: Bloqueia e tem problemas ao retomar, mas não precisa de ajuda ou auxílio por causa dos bloqueios.",
    "3: Muita dificuldade ao retomar; por vezes precisa de auxílio ou ajuda de pessoa por causa dos bloqueios.",
    "4: Na maior parte do tempo precisa de auxílio ou ajuda de pessoa por causa dos bloqueios.",
  ]},
];

// ── PARTE IV: Complicações Motoras ───────────────────────────────────────────
export const MDS_UPDRS_IV = [
  { id: "4.1", name: "Tempo com discinesias", opts: OPTS5, desc: [
    "0: Sem discinesias.",
    "1: ≤ 25% do período acordado.",
    "2: 26–50% do período acordado.",
    "3: 51–75% do período acordado.",
    "4: > 75% do período acordado.",
  ]},
  { id: "4.2", name: "Impacto funcional das discinesias", opts: OPTS5, desc: [
    "0: Sem discinesias ou sem impacto nas atividades/interações sociais.",
    "1: Impacto em algumas atividades, mas realiza todas as atividades e interações durante a discinesia.",
    "2: Impacto em muitas atividades, mas ainda realiza todas as atividades e interações durante a discinesia.",
    "3: Impacto ao ponto de não realizar algumas atividades ou interações durante a discinesia.",
    "4: Impacto ao ponto de não realizar a maioria das atividades ou interações durante a discinesia.",
  ]},
  { id: "4.3", name: "Tempo em OFF", opts: OPTS5, desc: [
    "0: Sem período OFF.",
    "1: ≤ 25% do período acordado.",
    "2: 26–50% do período acordado.",
    "3: 51–75% do período acordado.",
    "4: > 75% do período acordado.",
  ]},
  { id: "4.4", name: "Impacto funcional das flutuações", opts: OPTS5, desc: [
    "0: Sem flutuações ou sem impacto nas atividades/interações sociais.",
    "1: Impacto em algumas atividades, mas durante o OFF realiza todas as atividades/interações do ON.",
    "2: Impacto em muitas atividades, mas durante o OFF ainda realiza todas as atividades/interações do ON.",
    "3: Impacto ao ponto de não realizar algumas atividades/interações do ON durante o OFF.",
    "4: Impacto ao ponto de não realizar a maioria das atividades/interações do ON durante o OFF.",
  ]},
  { id: "4.5", name: "Complexidade das flutuações motoras", opts: OPTS5, desc: [
    "0: Sem flutuações motoras.",
    "1: Períodos OFF previsíveis em todo ou quase todo o tempo (> 75%).",
    "2: Períodos OFF previsíveis a maior parte do tempo (51–75%).",
    "3: Períodos OFF previsíveis alguma parte do tempo (26–50%).",
    "4: Episódios OFF raramente previsíveis (< 25%).",
  ]},
  { id: "4.6", name: "Distonia dolorosa do período OFF", opts: OPTS5, desc: [
    "0: Sem distonia OU sem período OFF.",
    "1: ≤ 25% do tempo do período OFF.",
    "2: 26–50% do tempo do período OFF.",
    "3: 51–75% do tempo do período OFF.",
    "4: > 75% do tempo do período OFF.",
  ]},
];

export const MDS_PART_META = {
  I:  { titulo: "MDS-UPDRS Parte I", subtitulo: "Aspectos não motores da vida diária", items: MDS_UPDRS_I,  max: 52, prefix: "MDS-UPDRS I" },
  II: { titulo: "MDS-UPDRS Parte II", subtitulo: "Aspectos motores da vida diária",   items: MDS_UPDRS_II, max: 52, prefix: "MDS-UPDRS II" },
  IV: { titulo: "MDS-UPDRS Parte IV", subtitulo: "Complicações motoras",              items: MDS_UPDRS_IV, max: 24, prefix: "MDS-UPDRS IV" },
};
