const { PASSWORD, setSessionCookie, clearSessionCookie } = require('./_auth');

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
    const body = await readBody(req);
    if (typeof body.password === 'string' && body.password === PASSWORD) {
      setSessionCookie(res);
      res.status(200).json({ ok: true });
    } else {
      res.status(401).json({ ok: false, error: 'Incorrect password' });
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
