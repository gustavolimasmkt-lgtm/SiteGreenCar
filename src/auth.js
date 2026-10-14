const crypto = require('crypto');

const COOKIE = 'gc_admin';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('gc-' + (process.env.ADMIN_PASSWORD || 'dev')).digest('hex');

const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function isLogged(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function login(res, secure) {
  const exp = String(Date.now() + MAX_AGE_MS);
  res.setHeader('Set-Cookie', `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_MS / 1000}${secure ? '; Secure' : ''}`);
}

function logout(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function checkPassword(pw) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real) return false;
  const a = Buffer.from(sign(String(pw || '')));
  const b = Buffer.from(sign(real));
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (isLogged(req)) return next();
  if (req.path.startsWith('/api/') || req.xhr) return res.status(401).json({ error: 'Não autorizado' });
  return res.redirect('/painel/login');
}

module.exports = { parseCookies, isLogged, login, logout, checkPassword, requireAdmin };
