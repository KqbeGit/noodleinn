// Shared auth helpers for the Noodle Inn admin API.
const crypto = require('crypto');

const PASSWORD = process.env.ADMIN_PASSWORD || 'NoodleInn2026!';
// Secret used to sign the session cookie. Set ADMIN_SECRET in Vercel for extra safety.
const SECRET = process.env.ADMIN_SECRET || 'noodle-inn-default-secret-change-me';
const COOKIE = 'ni_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

function makeToken() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return exp + '.' + sign(exp);
}

function tokenValid(token) {
  if (!token || token.indexOf('.') === -1) return false;
  const i = token.lastIndexOf('.');
  const exp = token.slice(0, i), sig = token.slice(i + 1);
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  if (a.length !== b.length) return false;               // wrong shape
  if (!crypto.timingSafeEqual(a, b)) return false;       // constant-time compare
  return Number(exp) > Date.now();
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(function (part) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function isAuthed(req) {
  return tokenValid(parseCookies(req)[COOKIE]);
}

function setSessionCookie(res) {
  res.setHeader('Set-Cookie',
    COOKIE + '=' + makeToken() + '; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=' + MAX_AGE);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0');
}

module.exports = { PASSWORD, isAuthed, setSessionCookie, clearSessionCookie };
