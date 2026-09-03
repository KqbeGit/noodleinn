// Contact form handler — emails submissions to the restaurant.
// Recipient is set by env CONTACT_EMAIL (falls back to the temp test address).
// Delivery uses FormSubmit (no account/keys needed). The FIRST message to a new
// address triggers a one-time activation email that the owner must click; after
// that, every submission lands in the inbox.
const TO = process.env.CONTACT_EMAIL || 'noodle@kqbellc.com';

function readBody(req) {
  return new Promise(function (resolve) {
    var data = '';
    req.on('data', function (c) { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
  });
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  var b = await readBody(req);

  var email = (b.email || '').trim();
  var message = (b.message || '').trim();
  var name = ((b.firstName || '') + ' ' + (b.lastName || '')).trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  if (!message) return res.status(400).json({ ok: false, error: 'Please enter a message.' });
  if (b.company) return res.status(200).json({ ok: true }); // honeypot: silently accept bots

  var payload = {
    name: name || 'Website visitor',
    email: email,
    phone: (b.phone || '').trim(),
    message: message,
    _subject: 'New enquiry from the Noodle Inn website',
    _template: 'table'
  };

  try {
    var r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(TO), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) return res.status(200).json({ ok: true });
    return res.status(502).json({ ok: false, error: 'Could not send right now — please try again, or email us directly.' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Something went wrong — please try again shortly.' });
  }
};
