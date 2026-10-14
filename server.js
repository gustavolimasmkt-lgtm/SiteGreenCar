const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const { db, UPLOAD_DIR, getSetting, setSetting, allSettings } = require('./src/db');
const util = require('./src/util');
const auth = require('./src/auth');
const meta = require('./src/meta');
const notify = require('./src/notify');
const siteViews = require('./src/views/site');
const adminViews = require('./src/views/admin');

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;
const TOKEN_SECRET = process.env.SESSION_SECRET || 'gc-token-' + (process.env.ADMIN_PASSWORD || 'dev');

const siteUrl = (req) => (getSetting('site_url') || process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
const leadToken = (id) => crypto.createHmac('sha256', TOKEN_SECRET).update('lead-' + id).digest('hex').slice(0, 24);

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

/* ------------------------------------------------------------------ */
/* Consultas                                                          */
/* ------------------------------------------------------------------ */
const coverSql = `(SELECT thumb FROM photos p WHERE p.car_id = cars.id ORDER BY position, id LIMIT 1)`;
const listPublicCars = () => db.prepare(`
  SELECT cars.*, ${coverSql} AS cover FROM cars
  WHERE status IN ('disponivel', 'reservado')
  ORDER BY destaque DESC, created_at DESC`).all();
const getCarBySlug = (slug) => db.prepare('SELECT * FROM cars WHERE slug = ?').get(slug);
const getCar = (id) => db.prepare('SELECT * FROM cars WHERE id = ?').get(id);
const carPhotos = (id) => db.prepare('SELECT * FROM photos WHERE car_id = ? ORDER BY position, id').all(id);

function publicSettings() {
  const s = allSettings();
  return s;
}

/* ------------------------------------------------------------------ */
/* Site público                                                       */
/* ------------------------------------------------------------------ */
app.get('/', (req, res) => {
  const s = publicSettings();
  res.send(siteViews.homePage({ cars: listPublicCars(), s, siteUrl: siteUrl(req) }));
});

app.get('/carro/:slug', (req, res) => {
  const s = publicSettings();
  const car = getCarBySlug(req.params.slug);
  if (!car || car.status === 'oculto') return res.status(404).send(siteViews.notFoundPage({ s }));
  const photos = carPhotos(car.id);
  // Outros carros: os de faixa de preço mais próxima primeiro
  const others = listPublicCars().filter(c => c.id !== car.id)
    .sort((a, b) => Math.abs(a.preco - car.preco) - Math.abs(b.preco - car.preco))
    .slice(0, car.status === 'vendido' ? 6 : 3);
  res.send(siteViews.carPage({ car, photos, others, s, siteUrl: siteUrl(req), waNumber: (s.wa_number || '').replace(/\D/g, '') }));
});

app.get('/politica-de-privacidade', (req, res) => res.send(siteViews.privacyPage({ s: publicSettings() })));

function requestInfo(req, body = {}) {
  const cookies = auth.parseCookies(req);
  let fbc = cookies._fbc || '';
  const fbclid = body.fbclid || '';
  if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  return {
    ip: req.ip,
    ua: (req.get('user-agent') || '').slice(0, 400),
    fbp: cookies._fbp || '',
    fbc
  };
}

// Limite simples por IP contra envios em massa
const hits = new Map();
function rateLimited(ip, max = 6, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

function waLeadUrl(lead, car) {
  const num = (getSetting('wa_number') || '').replace(/\D/g, '');
  if (!num) return '';
  const linhas = [
    `Olá! Tenho interesse no ${lead.car_label} (${util.brl(lead.car_preco)}) que vi no site.`,
    '',
    `Pagamento: ${util.PAGAMENTO[lead.pagamento] || '-'}${lead.entrada ? ', entrada de ' + lead.entrada : ''}`,
    `Troca: ${lead.tem_troca ? [lead.troca_modelo, lead.troca_ano, lead.troca_km ? lead.troca_km + ' km' : ''].filter(Boolean).join(', ') : 'não'}`,
    `Quando: ${(util.PRAZO[lead.prazo] || '-').toLowerCase()}`
  ];
  return `https://wa.me/${num}?text=${encodeURIComponent(linhas.join('\n'))}`;
}

const clip = (v, n = 120) => String(v == null ? '' : v).trim().slice(0, n);

app.post('/api/leads', async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true, id: 0 }); // honeypot
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Muitos envios seguidos. Aguarde alguns minutos ou chame no WhatsApp.' });

  const car = getCar(Number(b.car_id));
  if (!car) return res.status(400).json({ error: 'Carro não encontrado.' });
  const nome = clip(b.nome, 80);
  const whatsapp = util.normalizePhone(b.whatsapp);
  if (nome.length < 2) return res.status(400).json({ error: 'Informe seu nome.' });
  if (!util.isValidBrPhone(whatsapp)) return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });
  const pagamento = ['avista', 'financiamento'].includes(b.pagamento) ? b.pagamento : null;
  const prazo = ['semana', 'mes', 'pesquisando'].includes(b.prazo) ? b.prazo : null;
  if (!pagamento || !prazo || !b.consent) return res.status(400).json({ error: 'Preencha todas as perguntas.' });
  const temTroca = String(b.tem_troca) === '1' ? 1 : 0;
  const entradaNum = pagamento === 'financiamento' ? util.parseMoney(b.entrada) : 0;

  const info = requestInfo(req, b);
  const eventId = clip(b.event_id, 80) || ('lead-' + crypto.randomUUID());
  const row = {
    car_id: car.id,
    car_label: util.carLabel(car),
    car_preco: car.preco,
    nome,
    whatsapp,
    pagamento,
    entrada: pagamento === 'financiamento' ? util.brl(entradaNum) : '',
    tem_troca: temTroca,
    troca_modelo: temTroca ? clip(b.troca_modelo, 80) : '',
    troca_ano: temTroca ? clip(b.troca_ano, 4) : '',
    troca_km: temTroca ? clip(b.troca_km, 12) : '',
    prazo,
    event_id: eventId,
    fbp: info.fbp, fbc: info.fbc, ip: info.ip, user_agent: info.ua,
    page_url: clip(b.page_url, 500),
    utm_source: clip(b.utm_source), utm_medium: clip(b.utm_medium), utm_campaign: clip(b.utm_campaign, 200),
    utm_content: clip(b.utm_content, 200), utm_term: clip(b.utm_term, 200)
  };
  const cols = Object.keys(row);
  const r = db.prepare(`INSERT INTO leads (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(row);
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(r.lastInsertRowid);

  res.json({ ok: true, id: lead.id, token: leadToken(lead.id), wa_url: waLeadUrl(lead, car) });

  // Depois de responder: notificação e evento do Meta, sem segurar o visitante
  const base = siteUrl(req);
  notify.notifyLead(lead, base).catch(e => console.error('[notify]', e));
  meta.sendEvent({
    eventName: 'Lead',
    eventId,
    sourceUrl: lead.page_url,
    userData: meta.buildUserData(lead, info),
    customData: { content_ids: [String(car.id)], content_type: 'vehicle', content_name: lead.car_label, value: car.preco, currency: 'BRL' },
    leadId: lead.id
  }).catch(e => console.error('[meta]', e));
});

app.post('/api/track', express.text({ type: 'text/plain' }), (req, res) => {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
  b = b || {};
  res.status(204).end();
  const info = requestInfo(req, b);
  if (b.event === 'ViewContent') {
    const car = getCar(Number(b.car_id));
    if (!car) return;
    meta.sendEvent({
      eventName: 'ViewContent', eventId: clip(b.event_id, 80), sourceUrl: clip(b.page_url, 500),
      userData: meta.buildUserData(null, info),
      customData: { content_ids: [String(car.id)], content_type: 'vehicle', content_name: util.carLabel(car), value: car.preco, currency: 'BRL' }
    }).catch(() => {});
  } else if (b.event === 'Contact') {
    const id = Number(b.lead_id);
    if (!id || b.token !== leadToken(id)) return;
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!lead) return;
    db.prepare('UPDATE leads SET clicou_whatsapp = 1 WHERE id = ?').run(id);
    meta.sendEvent({
      eventName: 'Contact', eventId: clip(b.event_id, 80), sourceUrl: clip(b.page_url, 500),
      userData: meta.buildUserData(lead, info),
      customData: { content_ids: [String(lead.car_id)], content_type: 'vehicle' }, leadId: id
    }).catch(() => {});
  }
});

/* ------------------------------------------------------------------ */
/* Painel                                                             */
/* ------------------------------------------------------------------ */
const loginTries = new Map();

app.get('/painel/login', (req, res) => {
  if (auth.isLogged(req)) return res.redirect('/painel');
  res.send(adminViews.loginPage({ error: '', noPassword: !process.env.ADMIN_PASSWORD }));
});
app.post('/painel/login', (req, res) => {
  const k = req.ip;
  const t = (loginTries.get(k) || []).filter(x => Date.now() - x < 15 * 60 * 1000);
  if (t.length >= 8) return res.status(429).send(adminViews.loginPage({ error: 'Muitas tentativas. Aguarde 15 minutos.' }));
  if (!auth.checkPassword(req.body.password)) {
    t.push(Date.now()); loginTries.set(k, t);
    return res.status(401).send(adminViews.loginPage({ error: 'Senha incorreta.', noPassword: !process.env.ADMIN_PASSWORD }));
  }
  loginTries.delete(k);
  auth.login(res, req.secure);
  res.redirect('/painel');
});
app.get('/painel/sair', (req, res) => { auth.logout(res); res.redirect('/painel/login'); });

const admin = express.Router();
admin.use(auth.requireAdmin);
app.use('/painel', admin);

admin.get('/', (req, res) => res.redirect('/painel/leads'));

/* ---------- Leads ---------- */
function leadStats() {
  const q = (sql, ...a) => db.prepare(sql).get(...a).n;
  return {
    total7: q(`SELECT COUNT(*) n FROM leads WHERE created_at >= datetime('now','-7 days')`),
    novos: q(`SELECT COUNT(*) n FROM leads WHERE status = 'novo'`),
    qualificados: q(`SELECT COUNT(*) n FROM leads WHERE status IN ('qualificado','visitou','vendeu')`),
    avaliados: q(`SELECT COUNT(*) n FROM leads WHERE status != 'novo'`),
    vendas: q(`SELECT COUNT(*) n FROM leads WHERE status = 'vendeu'`),
    total: q('SELECT COUNT(*) n FROM leads')
  };
}

admin.get('/leads', (req, res) => {
  const status = Object.keys(util.STATUS_LEAD).includes(req.query.status) ? req.query.status : '';
  const carId = Number(req.query.carro) || 0;
  const where = [];
  const args = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (carId) { where.push('car_id = ?'); args.push(carId); }
  const leads = db.prepare(`SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`).all(...args);
  const cars = db.prepare('SELECT id, marca, modelo, ano_modelo FROM cars ORDER BY marca, modelo').all();
  res.send(adminViews.leadsPage({ leads, stats: leadStats(), status, carId, cars, s: allSettings() }));
});

admin.get('/leads.csv', (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const cols = ['id', 'created_at', 'status', 'nome', 'whatsapp', 'car_label', 'car_preco', 'pagamento', 'entrada', 'tem_troca', 'troca_modelo', 'troca_ano', 'troca_km', 'prazo', 'clicou_whatsapp', 'utm_campaign', 'utm_content', 'notas'];
  const csvEsc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const out = [cols.join(';')].concat(leads.map(l => cols.map(c => csvEsc(l[c])).join(';'))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-greencar-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + out);
});

admin.get('/leads/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.params.id));
  if (!lead) return res.redirect('/painel/leads');
  const logs = db.prepare('SELECT * FROM meta_log WHERE lead_id = ? ORDER BY id DESC').all(lead.id);
  res.send(adminViews.leadDetailPage({ lead, logs, s: allSettings() }));
});

admin.post('/api/leads/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  if (!Object.keys(util.STATUS_LEAD).includes(status)) return res.status(400).json({ error: 'Etiqueta inválida' });
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  db.prepare(`UPDATE leads SET status = ?, status_at = datetime('now') WHERE id = ?`).run(status, id);

  let metaResult = { skipped: true };
  if (meta.TAG_EVENTS[status]) {
    const already = db.prepare('SELECT 1 FROM meta_log WHERE lead_id = ? AND event_name = ? AND ok = 1').get(id, meta.TAG_EVENTS[status]);
    if (!already) metaResult = await meta.sendTagEvent({ ...lead, status }, status, siteUrl(req));
    else metaResult = { ok: true, duplicate: true };
  }
  res.json({ ok: true, status, meta: { ok: !!metaResult.ok, skipped: !!metaResult.skipped, duplicate: !!metaResult.duplicate } });
});

admin.post('/api/leads/:id/notas', (req, res) => {
  db.prepare('UPDATE leads SET notas = ? WHERE id = ?').run(clip(req.body.notas, 4000), Number(req.params.id));
  res.json({ ok: true });
});

admin.post('/api/leads/:id/excluir', (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ---------- Carros ---------- */
admin.get('/carros', (req, res) => {
  const cars = db.prepare(`
    SELECT cars.*, ${coverSql} AS cover,
      (SELECT COUNT(*) FROM leads l WHERE l.car_id = cars.id) AS n_leads,
      (SELECT COUNT(*) FROM leads l WHERE l.car_id = cars.id AND l.status IN ('qualificado','visitou','vendeu')) AS n_qual
    FROM cars ORDER BY CASE status WHEN 'disponivel' THEN 0 WHEN 'reservado' THEN 1 WHEN 'oculto' THEN 2 ELSE 3 END, created_at DESC`).all();
  res.send(adminViews.carsPage({ cars, siteUrl: siteUrl(req), s: allSettings() }));
});

admin.get('/carros/novo', (req, res) => res.send(adminViews.carFormPage({ car: null, photos: [], s: allSettings() })));
admin.get('/carros/:id', (req, res) => {
  const car = getCar(Number(req.params.id));
  if (!car) return res.redirect('/painel/carros');
  res.send(adminViews.carFormPage({ car, photos: carPhotos(car.id), s: allSettings(), siteUrl: siteUrl(req), saved: req.query.ok === '1' }));
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 40 } });

async function savePhoto(buffer) {
  const name = crypto.randomBytes(10).toString('hex');
  const img = sharp(buffer, { failOn: 'none' }).rotate();
  await img.clone().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(UPLOAD_DIR, name + '.webp'));
  await img.clone().resize({ width: 640, height: 480, fit: 'cover' }).webp({ quality: 74 }).toFile(path.join(UPLOAD_DIR, name + '-t.webp'));
  return { file: `/uploads/${name}.webp`, thumb: `/uploads/${name}-t.webp` };
}

function carFromBody(b) {
  const int = (v) => { const n = parseInt(String(v || '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : null; };
  const opcionais = String(b.opcionais || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 80);
  return {
    marca: clip(b.marca, 40), modelo: clip(b.modelo, 60), versao: clip(b.versao, 120),
    ano_fab: int(b.ano_fab), ano_modelo: int(b.ano_modelo), km: int(b.km) || 0,
    cambio: clip(b.cambio, 30), combustivel: clip(b.combustivel, 30), cor: clip(b.cor, 30),
    portas: int(b.portas), motor: clip(b.motor, 30), categoria: clip(b.categoria, 30),
    final_placa: clip(b.final_placa, 2), preco: util.parseMoney(b.preco),
    opcionais: JSON.stringify(opcionais),
    unico_dono: b.unico_dono ? 1 : 0, laudo_aprovado: b.laudo_aprovado ? 1 : 0,
    laudo_texto: clip(b.laudo_texto, 1000), revisoes: clip(b.revisoes, 2000), descricao: clip(b.descricao, 5000),
    status: Object.keys(util.STATUS_CAR).includes(b.status) ? b.status : 'disponivel',
    destaque: b.destaque ? 1 : 0
  };
}

function uniqueSlug(base, ignoreId) {
  let slug = base || 'carro';
  let i = 2;
  while (db.prepare('SELECT id FROM cars WHERE slug = ? AND id != ?').get(slug, ignoreId || 0)) slug = `${base}-${i++}`;
  return slug;
}

admin.post('/carros/salvar', upload.array('fotos', 40), async (req, res) => {
  const b = req.body;
  const data = carFromBody(b);
  if (!data.marca || !data.modelo || !data.preco) {
    return res.status(400).send(adminViews.carFormPage({ car: { ...data, id: Number(b.id) || null }, photos: b.id ? carPhotos(Number(b.id)) : [], s: allSettings(), error: 'Preencha marca, modelo e preço.' }));
  }
  let id = Number(b.id) || 0;
  const prev = id ? getCar(id) : null;
  if (prev) {
    const vendidoEm = data.status === 'vendido' ? (prev.vendido_em || new Date().toISOString()) : null;
    const sets = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE cars SET ${sets}, vendido_em = @vendido_em, updated_at = datetime('now') WHERE id = @id`).run({ ...data, vendido_em: vendidoEm, id });
  } else {
    const slug = uniqueSlug(util.slugify(`${data.marca} ${data.modelo} ${data.versao} ${data.ano_modelo || ''}`));
    const cols = Object.keys(data);
    const r = db.prepare(`INSERT INTO cars (slug, ${cols.join(',')}) VALUES (@slug, ${cols.map(c => '@' + c).join(',')})`).run({ ...data, slug });
    id = r.lastInsertRowid;
  }
  const files = req.files || [];
  let pos = (db.prepare('SELECT MAX(position) m FROM photos WHERE car_id = ?').get(id).m || 0) + 1;
  for (const f of files) {
    try {
      const saved = await savePhoto(f.buffer);
      db.prepare('INSERT INTO photos (car_id, file, thumb, position) VALUES (?, ?, ?, ?)').run(id, saved.file, saved.thumb, pos++);
    } catch (e) { console.error('[foto]', e.message); }
  }
  res.redirect(`/painel/carros/${id}?ok=1`);
});

admin.post('/api/carros/:id/status', (req, res) => {
  const status = req.body.status;
  if (!Object.keys(util.STATUS_CAR).includes(status)) return res.status(400).json({ error: 'Status inválido' });
  db.prepare(`UPDATE cars SET status = ?, vendido_em = CASE WHEN ? = 'vendido' THEN COALESCE(vendido_em, datetime('now')) ELSE NULL END, updated_at = datetime('now') WHERE id = ?`)
    .run(status, status, Number(req.params.id));
  res.json({ ok: true });
});

admin.post('/api/carros/:id/fotos-ordem', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
  const st = db.prepare('UPDATE photos SET position = ? WHERE id = ? AND car_id = ?');
  db.transaction(() => ids.forEach((pid, i) => st.run(i, pid, Number(req.params.id))))();
  res.json({ ok: true });
});

admin.post('/api/fotos/:id/excluir', (req, res) => {
  const p = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  if (p) {
    db.prepare('DELETE FROM photos WHERE id = ?').run(p.id);
    [p.file, p.thumb].forEach(u => fs.unlink(path.join(UPLOAD_DIR, path.basename(u)), () => {}));
  }
  res.json({ ok: true });
});

admin.post('/api/carros/:id/excluir', (req, res) => {
  const id = Number(req.params.id);
  carPhotos(id).forEach(p => [p.file, p.thumb].forEach(u => fs.unlink(path.join(UPLOAD_DIR, path.basename(u)), () => {})));
  db.prepare('DELETE FROM cars WHERE id = ?').run(id);
  res.json({ ok: true });
});

/* ---------- Configurações ---------- */
const SETTING_KEYS = [
  'store_name', 'store_city', 'store_address', 'store_hours', 'store_instagram', 'wa_number', 'privacy_contact',
  'company_name', 'company_cnpj', 'site_url', 'indexar', 'home_title', 'home_subtitle',
  'color_primary', 'color_soft',
  'pixel_id', 'capi_token', 'test_event_code', 'graph_version',
  'evo_url', 'evo_key', 'evo_instance', 'notify_number',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'notify_email'
];
const SECRET_KEYS = ['capi_token', 'evo_key', 'smtp_pass'];

admin.get('/config', (req, res) => res.send(adminViews.configPage({ s: allSettings(), saved: req.query.ok === '1', siteUrl: siteUrl(req) })));

admin.post('/config', upload.single('logo'), async (req, res) => {
  const b = req.body;
  for (const k of SETTING_KEYS) {
    if (!(k in b) && k !== 'indexar') continue;
    let v = k === 'indexar' ? (b.indexar ? '1' : '0') : String(b[k] || '').trim();
    if (SECRET_KEYS.includes(k) && v === '••••••') continue; // não sobrescreve segredo mascarado
    if (['wa_number', 'notify_number'].includes(k) && v) v = util.normalizePhone(v);
    if (k === 'pixel_id') v = v.replace(/\D/g, '');
    setSetting(k, v);
  }
  if (b.remove_logo) setSetting('logo', '');
  if (req.file) {
    try {
      const name = 'logo-' + crypto.randomBytes(6).toString('hex') + '.png';
      await sharp(req.file.buffer).resize({ height: 160, withoutEnlargement: true }).png().toFile(path.join(UPLOAD_DIR, name));
      setSetting('logo', '/uploads/' + name);
    } catch (e) { console.error('[logo]', e.message); }
  }
  res.redirect('/painel/config?ok=1');
});

admin.post('/api/meta/teste', async (req, res) => {
  const r = await meta.sendEvent({
    eventName: 'Lead', eventId: 'teste-' + Date.now(), sourceUrl: siteUrl(req) + '/',
    userData: meta.buildUserData({ whatsapp: '5548999999999', nome: 'Teste Painel' }, { ip: req.ip, ua: req.get('user-agent') }),
    customData: { content_type: 'vehicle', value: 1, currency: 'BRL' }
  });
  res.json({ ok: !!r.ok, response: r.response || r.error || (r.skipped ? 'Pixel ID ou token não configurados' : '') });
});

admin.get('/api/whatsapp/estado', async (req, res) => {
  try { res.json({ state: await notify.waState() }); }
  catch (e) { res.json({ state: 'erro', error: e.message }); }
});
admin.post('/api/whatsapp/conectar', async (req, res) => {
  try { res.json(await notify.waConnect()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
admin.post('/api/whatsapp/desconectar', async (req, res) => {
  try { await notify.waLogout(); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
admin.post('/api/whatsapp/teste', async (req, res) => {
  try { await notify.sendWhatsApp('✅ Teste do painel GreenCar: as notificações de lead vão chegar neste número.'); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
admin.post('/api/email/teste', async (req, res) => {
  try { await notify.sendEmail('Teste do painel GreenCar', 'As notificações de lead de reserva vão chegar neste e-mail.'); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

admin.get('/eventos', (req, res) => {
  const logs = db.prepare('SELECT * FROM meta_log ORDER BY id DESC LIMIT 200').all();
  res.send(adminViews.logsPage({ logs, s: allSettings() }));
});

/* ------------------------------------------------------------------ */
app.use((req, res) => res.status(404).send(siteViews.notFoundPage({ s: publicSettings() })));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Erro interno. Tente de novo em instantes.');
});

app.listen(PORT, () => {
  console.log(`GreenCar rodando na porta ${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('ATENÇÃO: defina ADMIN_PASSWORD para acessar o painel.');
});
