const { readContentLogo } = require('./logoStorage');

// GET /uploads/logos/<sha256>.png, after requireSession and requireActive.
// The object key is built from the session's organization, never from the URL, so a
// sha from another organization simply does not exist here (404). Content-addressed
// bytes never change, so a successful response may be cached privately for a year.
module.exports = async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  const file = req.params.file;
  if (typeof file !== 'string' || !/^[a-f0-9]{64}\.png$/.test(file)) return res.status(404).json({ error: 'Logo not found' });
  try {
    const buffer = await readContentLogo(req.user.organizationId, file.slice(0, 64));
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    res.type('png').send(buffer);
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: 'Logo not found' });
    next(error);
  }
};
