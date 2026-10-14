const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// No Railway, usa sempre o caminho real do volume (evita gravar fora dele por variável errada)
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'greencar.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  versao TEXT DEFAULT '',
  ano_fab INTEGER,
  ano_modelo INTEGER,
  km INTEGER DEFAULT 0,
  cambio TEXT DEFAULT '',
  combustivel TEXT DEFAULT '',
  cor TEXT DEFAULT '',
  portas INTEGER,
  motor TEXT DEFAULT '',
  categoria TEXT DEFAULT '',
  final_placa TEXT DEFAULT '',
  preco INTEGER NOT NULL,
  opcionais TEXT DEFAULT '[]',
  unico_dono INTEGER DEFAULT 0,
  laudo_aprovado INTEGER DEFAULT 0,
  laudo_texto TEXT DEFAULT '',
  revisoes TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  status TEXT DEFAULT 'disponivel',
  destaque INTEGER DEFAULT 0,
  vendido_em TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  file TEXT NOT NULL,
  thumb TEXT NOT NULL,
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER REFERENCES cars(id) ON DELETE SET NULL,
  car_label TEXT,
  car_preco INTEGER,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  pagamento TEXT,
  entrada TEXT,
  tem_troca INTEGER DEFAULT 0,
  troca_modelo TEXT,
  troca_ano TEXT,
  troca_km TEXT,
  prazo TEXT,
  status TEXT DEFAULT 'novo',
  notas TEXT DEFAULT '',
  clicou_whatsapp INTEGER DEFAULT 0,
  event_id TEXT,
  fbp TEXT,
  fbc TEXT,
  ip TEXT,
  user_agent TEXT,
  page_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  notificado TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  status_at TEXT
);

CREATE TABLE IF NOT EXISTS meta_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  event_name TEXT,
  ok INTEGER,
  response TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// Migrações leves: adiciona colunas novas sem quebrar bancos existentes
function ensureColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
ensureColumn('leads', 'notificado', "TEXT DEFAULT ''");

const getSetting = (key, fallback = '') => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row && row.value !== null && row.value !== '' ? row.value : fallback;
};
const setSetting = (key, value) => {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? '' : String(value));
};
const allSettings = () => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value]));

// Valores iniciais da loja (sem segredos: tokens e senhas entram só pelo painel)
const DEFAULTS = {
  store_name: 'GreenCar',
  store_city: 'Criciúma, SC',
  company_name: 'Greencar Multimarcas LTDA',
  company_cnpj: '62.645.418/0001-03',
  site_url: 'https://greencarsc.com.br',
  wa_number: '5548996743297',
  notify_number: '5548996743297',
  pixel_id: '1653316109554194',
  evo_instance: 'greencar-leads',
  smtp_host: 'smtp.gmail.com',
  smtp_port: '587'
};
const insertDefault = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULTS)) insertDefault.run(k, v);

module.exports = { db, DATA_DIR, UPLOAD_DIR, getSetting, setSetting, allSettings };
