const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3004';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

async function optionalAuth(req, res, next) {
  if (!REQUIRE_AUTH) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const verifyRes = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      headers: { Authorization: header },
    });
    const data = await verifyRes.json();
    if (!data.valid) return res.status(401).json({ error: 'Invalid token' });
    req.user = data.user;
    next();
  } catch {
    return res.status(503).json({ error: 'Auth service unavailable' });
  }
}

module.exports = { optionalAuth };
