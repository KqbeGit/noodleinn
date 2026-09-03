const crypto = require('crypto');
const { PASSWORD, setSessionCookie, clearSessionCookie } = require('./_auth');

// ---------- rate limiting ----------
// Per-IP: 5 failed attempts per 15 minutes, then locked out for the rest of
// the window. Global backstop: 100 failures/15 min across all IPs. State is
// per warm serverless instance (best-effort), which is plenty to make
// password guessing impractical on a site this size.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;
const GLOBAL_MAX = 100;
const fails = new Map(); // ip -> { count, first }
let globalFails = { count: 0, first: 0 };

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function prune(now) {
  if (fails.size > 500) {
    for (const [ip, rec] of fails) {
      if (now - rec.first > WINDOW_MS) fails.delete(ip);
    }
  }
}

function lockedUntil(ip, now) {
  const rec = fails.get(ip);
  if (rec && now - rec.first <= WINDOW_MS && rec.count >= MAX_TRIES) {
    return rec.first + WINDOW_MS;
  }
  if (now - globalFails.first <= WINDOW_MS && globalFails.count >= GLOBAL_MAX) {
    return globalFails.first + WINDOW_MS;
  }
  return 0;
}

function recordFail(ip, now) {
  const rec = fails.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) fails.set(ip, { count: 1, first: now });
  else rec.count += 1;
  if (now - globalFails.first > WINDOW_MS) globalFails = { count: 0, first: now };
  globalFails.count += 1;
  prune(now);
}

// constant-time password check (hash both sides, then timing-safe compare)
function passwordMatches(candidate) {
  const a = crypto.createHash('sha256').update(String(candidate)).digest();
  const b = crypto.createHash('sha256').update(String(PASSWORD)).digest();
  return crypto.timingSafeEqual(a, b);
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function readBody(req) {
  return new Promise(function (resolve) {
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { resolve({}); }
    });
  });
}

module.exports = async function (req, res) {
  if (req.method === 'POST') {
    const now = Date.now();
    const ip = clientIp(req);

    const until = lockedUntil(ip, now);
    if (until) {
      const mins = Math.max(1, Math.ceil((until - now) / 60000));
      res.setHeader('Retry-After', String(mins * 60));
      res.status(429).json({
        ok: false,
        error: 'Too many attempts. Please wait ' + mins + ' minute' + (mins === 1 ? '' : 's') + ' and try again.'
      });
      return;
    }

    const body = await readBody(req);
    if (typeof body.password === 'string' && passwordMatches(body.password)) {
      fails.delete(ip);
      setSessionCookie(res);
      res.status(200).json({ ok: true });
    } else {
      recordFail(ip, now);
      await sleep(500); // slow down guessing
      res.status(401).json({ ok: false, error: 'Incorrect password. Please try again.' });
    }
    return;
  }
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
    return;
  }
  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
