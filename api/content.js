// Reads/writes the editable site content.
// Storage: Vercel Blob. Each save writes a uniquely-named blob (content-*.json)
// and the read picks the newest — this avoids Blob's public-URL CDN caching,
// which would otherwise serve a stale version after an overwrite.
// Falls back to the bundled defaults so the site works before storage is enabled.
const { isAuthed } = require('./_auth');

const PREFIX = 'content';           // blobs are named content-<random>.json
const BASENAME = 'content.json';    // put() adds a random suffix to this

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) { data += c; if (data.length > 5e6) reject(new Error('too large')); });
    req.on('end', function () { resolve(data); });
  });
}

async function defaults(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const r = await fetch(proto + '://' + host + '/content.default.json');
  return await r.json();
}

async function readFromBlob() {
  const { list } = require('@vercel/blob');
  const { blobs } = await list({ prefix: PREFIX });
  if (!blobs || !blobs.length) return null;
  blobs.sort(function (a, b) { return new Date(b.uploadedAt) - new Date(a.uploadedAt); });
  const r = await fetch(blobs[0].url);          // newest; unique URL, so never stale
  if (!r.ok) return null;
  return await r.json();
}

module.exports = async function (req, res) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const saved = await readFromBlob();
      if (saved) return res.status(200).json(saved);
    } catch (e) { /* storage not set up yet — fall through to defaults */ }
    try {
      return res.status(200).json(await defaults(req));
    } catch (e) {
      return res.status(200).json({ groups: [], text: {}, menu: [] });
    }
  }

  if (req.method === 'POST') {
    if (!isAuthed(req)) return res.status(401).json({ ok: false, error: 'Not signed in' });
    let parsed;
    try { parsed = JSON.parse(await readBody(req)); }
    catch (e) { return res.status(400).json({ ok: false, error: 'Invalid JSON' }); }

    try {
      const { put, list, del } = require('@vercel/blob');
      const saved = await put(BASENAME, JSON.stringify(parsed), {
        access: 'public', contentType: 'application/json',
        addRandomSuffix: true, cacheControlMaxAge: 0
      });
      // tidy up older versions so the store doesn't accumulate copies
      try {
        const { blobs } = await list({ prefix: PREFIX });
        const stale = blobs.filter(function (b) { return b.url !== saved.url; }).map(function (b) { return b.url; });
        if (stale.length) await del(stale);
      } catch (e) { /* non-fatal */ }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(503).json({
        ok: false,
        error: 'Cloud storage is not enabled yet. In your Vercel dashboard open this project → Storage → create a Blob store, then redeploy.'
      });
    }
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
