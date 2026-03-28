// Constantes e helpers globais do DBS Log
// Criado por Rafael Bernhart Carra — HCFMUSP 2026

const TIPOS_ELETRODO = {
  '4-ring': [['3'], ['2'], ['1'], ['0']],
  '8-ring': [['7'], ['6'], ['5'], ['4'], ['3'], ['2'], ['1'], ['0']],
  'directional': [['3'], ['2A', '2B', '2C'], ['1A', '1B', '1C'], ['0']]
};

const ORDEM_TEXTO_BAIXO_CIMA = {
  '4-ring': ['0', '1', '2', '3'],
  '8-ring': ['0', '1', '2', '3', '4', '5', '6', '7'],
  'directional': ['0', '1A', '1B', '1C', '2A', '2B', '2C', '3']
};

const MARCADOR_LETRAS = {
  // Colaterais — vermelho
  'Parestesia': { letra: 'P', cor: 'text-rose-700' },
  'Cápsula': { letra: 'C', cor: 'text-rose-700' },
  'Disartria': { letra: 'D', cor: 'text-rose-700' },
  'Outros': { letra: 'O', cor: 'text-rose-700' },
  // Positivos — verde
  'tremor': { letra: 'T', cor: 'text-emerald-700' },
  'rigidez': { letra: 'R', cor: 'text-emerald-700' },
  'bradicinesia': { letra: 'B', cor: 'text-emerald-700' },
};

const opacidadeMarcador = (timestampMarcador, timestampSessaoAtual) => {
  const meses = (timestampSessaoAtual - timestampMarcador) / (1000 * 60 * 60 * 24 * 30.44);
  const reducao = Math.min(Math.floor(meses / 6) * 0.06, 0.60);
  return Math.max(1 - reducao, 0.40);
};

const getContatosIniciais = (tipo) => {
  const contatos = {};
  TIPOS_ELETRODO[tipo].flat().forEach(k => contatos[k] = { state: 'off', perc: 100 });
  return contatos;
};

const getStringConfig = (contatos, ignorarPerc = false) => {
  return Object.entries(contatos)
    .filter(([_, v]) => v.state !== 'off')
    .sort(([k1], [k2]) => k1.localeCompare(k2))
    .map(([k, v]) => `${k}${v.state}${ignorarPerc ? '' : v.perc}`)
    .join(',');
};

const formatarData = (timestamp) => {
  return new Date(timestamp).toLocaleString('pt-PT', { 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute:'2-digit' 
  });
};




export { TIPOS_ELETRODO, ORDEM_TEXTO_BAIXO_CIMA, MARCADOR_LETRAS,
  opacidadeMarcador, getContatosIniciais, getStringConfig, formatarData };
