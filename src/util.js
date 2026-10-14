const crypto = require('crypto');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const kmFmt = (n) => Number(n || 0).toLocaleString('pt-BR') + ' km';

const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Normaliza telefone BR para o formato 55DDDNUMERO
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}
const isValidBrPhone = (d) => /^55\d{10,11}$/.test(d);

const phoneDisplay = (d) => {
  const m = String(d || '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
};

const sha256 = (s) => crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');

const carTitle = (c) => `${c.marca} ${c.modelo}`.trim();
const carLabel = (c) => `${c.marca} ${c.modelo} ${c.versao || ''} ${c.ano_fab || ''}/${c.ano_modelo || ''}`.replace(/\s+/g, ' ').trim();

const PAGAMENTO = { avista: 'À vista', financiamento: 'Financiamento', misto: 'Troca + financiamento' };
const PRAZO = { semana: 'Esta semana', mes: 'Este mês', pesquisando: 'Só pesquisando' };
const STATUS_LEAD = {
  novo: 'Novo',
  qualificado: 'Qualificado',
  desqualificado: 'Desqualificado',
  visitou: 'Visitou',
  vendeu: 'Vendeu'
};
const STATUS_CAR = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido', oculto: 'Oculto' };

// Converte "R$ 15.000" / "15000" em número inteiro
const parseMoney = (v) => {
  const n = parseInt(String(v || '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

module.exports = {
  esc, brl, kmFmt, slugify, normalizePhone, isValidBrPhone, phoneDisplay, sha256,
  carTitle, carLabel, PAGAMENTO, PRAZO, STATUS_LEAD, STATUS_CAR, parseMoney
};
