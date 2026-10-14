// Notificação imediata de leads: WhatsApp (Evolution API) com e-mail de reserva
const nodemailer = require('nodemailer');
const { db, getSetting } = require('./db');
const { brl, phoneDisplay, PAGAMENTO, PRAZO } = require('./util');

function evoConfig() {
  return {
    url: (() => { let u = (getSetting('evo_url', process.env.EVOLUTION_URL || '')).trim().replace(/\/+$/, ''); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u; return u; })(),
    key: getSetting('evo_key', process.env.EVOLUTION_API_KEY || ''),
    instance: getSetting('evo_instance', 'greencar-leads'),
    to: getSetting('notify_number', '')
  };
}

async function evoRequest(method, pathname, body) {
  const cfg = evoConfig();
  if (!cfg.url || !cfg.key) throw new Error('Evolution API não configurada (URL e chave)');
  const r = await fetch(cfg.url + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: cfg.key },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }
  if (!r.ok) {
    const err = new Error(`Evolution ${r.status}: ${text.slice(0, 300)}`);
    err.status = r.status;
    err.body = json;
    throw err;
  }
  return json;
}

// Estado da conexão do número de notificação
async function waState() {
  const { instance } = evoConfig();
  try {
    const j = await evoRequest('GET', `/instance/connectionState/${encodeURIComponent(instance)}`);
    return (j.instance && j.instance.state) || j.state || 'desconhecido';
  } catch (e) {
    if (e.status === 404) return 'inexistente';
    throw e;
  }
}

// Cria a instância (se preciso) e devolve o QR code em base64
async function waConnect() {
  const { instance } = evoConfig();
  let state;
  try { state = await waState(); } catch (e) { state = 'erro'; }
  if (state === 'open') return { state };
  if (state === 'inexistente') {
    const created = await evoRequest('POST', '/instance/create', {
      instanceName: instance, qrcode: true, integration: 'WHATSAPP-BAILEYS'
    });
    const qr = created.qrcode && (created.qrcode.base64 || created.qrcode);
    if (qr && typeof qr === 'string') return { state: 'connecting', qr };
  }
  const j = await evoRequest('GET', `/instance/connect/${encodeURIComponent(instance)}`);
  return { state: 'connecting', qr: j.base64 || null, pairingCode: j.pairingCode || null };
}

async function waLogout() {
  const { instance } = evoConfig();
  return evoRequest('DELETE', `/instance/logout/${encodeURIComponent(instance)}`);
}

async function sendWhatsApp(text, toOverride) {
  const cfg = evoConfig();
  const to = (toOverride || cfg.to || '').replace(/\D/g, '');
  if (!to) throw new Error('Número para receber notificações não configurado');
  return evoRequest('POST', `/message/sendText/${encodeURIComponent(cfg.instance)}`, { number: to, text });
}

function mailConfig() {
  return {
    host: getSetting('smtp_host', ''),
    port: Number(getSetting('smtp_port', '587')),
    user: getSetting('smtp_user', ''),
    pass: getSetting('smtp_pass', ''),
    to: getSetting('notify_email', '')
  };
}

async function sendEmail(subject, text) {
  const c = mailConfig();
  if (!c.host || !c.user || !c.pass || !c.to) throw new Error('E-mail de reserva não configurado');
  const t = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass } });
  await t.sendMail({ from: `GreenCar Leads <${c.user}>`, to: c.to, subject, text });
}

function leadMessage(lead, siteUrl) {
  const linhas = [
    '🚗 *NOVO LEAD GREENCAR*',
    '',
    `*Carro:* ${lead.car_label || 'Não informado'}${lead.car_preco ? ' | ' + brl(lead.car_preco) : ''}`,
    `*Nome:* ${lead.nome}`,
    `*WhatsApp:* ${phoneDisplay(lead.whatsapp)}`,
    `*Pagamento:* ${PAGAMENTO[lead.pagamento] || lead.pagamento || '-'}`
  ];
  if (lead.entrada) linhas.push(`*Entrada:* ${lead.entrada}`);
  linhas.push(`*Troca:* ${lead.tem_troca ? `Sim | ${[lead.troca_modelo, lead.troca_ano, lead.troca_km ? lead.troca_km + ' km' : ''].filter(Boolean).join(' | ')}` : 'Não'}`);
  linhas.push(`*Prazo:* ${PRAZO[lead.prazo] || lead.prazo || '-'}`);
  if (lead.utm_content || lead.utm_campaign) linhas.push(`*Anúncio:* ${[lead.utm_campaign, lead.utm_content].filter(Boolean).join(' / ')}`);
  linhas.push('', `👉 Chamar agora: https://wa.me/${lead.whatsapp}`);
  if (siteUrl) linhas.push(`📋 Painel: ${siteUrl}/painel/leads/${lead.id}`);
  return linhas.join('\n');
}

// Tenta WhatsApp, cai para e-mail. Nunca lança erro para quem chamou.
async function notifyLead(lead, siteUrl) {
  const text = leadMessage(lead, siteUrl);
  const result = [];
  try {
    await sendWhatsApp(text);
    result.push('whatsapp');
  } catch (e) {
    console.warn('[notify] WhatsApp falhou:', e.message);
    try {
      await sendEmail(`Novo lead: ${lead.nome} | ${lead.car_label || ''}`, text.replace(/\*/g, ''));
      result.push('email');
    } catch (e2) {
      console.warn('[notify] E-mail falhou:', e2.message);
      result.push('falhou');
    }
  }
  db.prepare('UPDATE leads SET notificado = ? WHERE id = ?').run(result.join(','), lead.id);
  return result;
}

module.exports = { evoConfig, waState, waConnect, waLogout, sendWhatsApp, sendEmail, notifyLead, leadMessage };
