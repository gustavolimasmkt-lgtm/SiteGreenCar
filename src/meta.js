// Envio de eventos para a API de Conversões do Meta
const { db, getSetting } = require('./db');
const { sha256 } = require('./util');

const DEFAULT_API_VERSION = 'v23.0';

function metaConfig() {
  return {
    pixelId: getSetting('pixel_id', process.env.META_PIXEL_ID || ''),
    token: getSetting('capi_token', process.env.META_CAPI_TOKEN || ''),
    testCode: getSetting('test_event_code', ''),
    apiVersion: getSetting('graph_version', DEFAULT_API_VERSION)
  };
}

function buildUserData(lead, reqInfo = {}) {
  const ud = {};
  const phone = lead && lead.whatsapp;
  if (phone) ud.ph = [sha256(phone.replace(/\D/g, ''))];
  if (lead && lead.nome) {
    const parts = lead.nome.trim().split(/\s+/);
    ud.fn = [sha256(parts[0])];
    if (parts.length > 1) ud.ln = [sha256(parts[parts.length - 1])];
  }
  if (phone) ud.external_id = [sha256(phone.replace(/\D/g, ''))];
  ud.country = [sha256('br')];
  const ip = reqInfo.ip || (lead && lead.ip);
  const ua = reqInfo.ua || (lead && lead.user_agent);
  const fbp = reqInfo.fbp || (lead && lead.fbp);
  const fbc = reqInfo.fbc || (lead && lead.fbc);
  if (ip) ud.client_ip_address = ip;
  if (ua) ud.client_user_agent = ua;
  if (fbp) ud.fbp = fbp;
  if (fbc) ud.fbc = fbc;
  return ud;
}

async function sendEvent({ eventName, eventId, sourceUrl, userData, customData, leadId = null }) {
  const cfg = metaConfig();
  if (!cfg.pixelId || !cfg.token) {
    log(leadId, eventName, 0, 'Pixel ID ou token não configurados');
    return { ok: false, skipped: true };
  }
  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId || undefined,
      event_source_url: sourceUrl || undefined,
      action_source: 'website',
      user_data: userData || {},
      custom_data: customData || undefined
    }]
  };
  if (cfg.testCode) payload.test_event_code = cfg.testCode;
  const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.token)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    const text = await r.text();
    log(leadId, eventName, r.ok ? 1 : 0, text.slice(0, 1000));
    return { ok: r.ok, response: text };
  } catch (e) {
    log(leadId, eventName, 0, String(e.message || e));
    return { ok: false, error: String(e.message || e) };
  }
}

function log(leadId, eventName, ok, response) {
  try {
    db.prepare('INSERT INTO meta_log (lead_id, event_name, ok, response) VALUES (?, ?, ?, ?)').run(leadId, eventName, ok, response);
  } catch (_) { /* log nunca derruba o fluxo */ }
}

// Mapeia etiquetas do painel para eventos do Meta
const TAG_EVENTS = {
  qualificado: 'LeadQualificado',
  desqualificado: 'LeadDesqualificado',
  visitou: 'Visitou',
  vendeu: 'Purchase'
};

function sendTagEvent(lead, status, siteUrl) {
  const eventName = TAG_EVENTS[status];
  if (!eventName) return Promise.resolve({ ok: false, skipped: true });
  const customData = {
    content_ids: lead.car_id ? [String(lead.car_id)] : undefined,
    content_type: 'vehicle',
    content_name: lead.car_label || undefined,
    lead_id: String(lead.id)
  };
  if (status === 'vendeu' || status === 'qualificado') {
    customData.value = lead.car_preco || 0;
    customData.currency = 'BRL';
  }
  return sendEvent({
    eventName,
    eventId: `${status}-${lead.id}`,
    sourceUrl: lead.page_url || siteUrl,
    userData: buildUserData(lead),
    customData,
    leadId: lead.id
  });
}

module.exports = { metaConfig, buildUserData, sendEvent, sendTagEvent, TAG_EVENTS };
