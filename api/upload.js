// Authorises direct-to-Blob uploads from the admin panel (images & video).
// The file goes straight from the browser to Vercel Blob (no 4.5MB function
// limit), so large videos work. Only a signed-in admin can get an upload token.
const { handleUpload } = require('@vercel/blob/client');
const { isAuthed } = require('./_auth');

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let d = '';
    req.on('data', function (c) { d += c; if (d.length > 1e7) reject(new Error('payload too large')); });
    req.on('end', function () { resolve(d); });
  });
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { body = {}; }
  try {
    const result = await handleUpload({
      body: body,
      request: req,
      onBeforeGenerateToken: async function () {
        if (!isAuthed(req)) throw new Error('Not signed in');
        return {
          allowedContentTypes: [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
            'video/mp4', 'video/webm', 'video/quicktime'
          ],
          maximumSizeInBytes: 209715200, // 200 MB
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async function () { /* URL is saved via the content save */ }
    });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(400).json({ error: (e && e.message) || 'Upload failed' });
  }
};
