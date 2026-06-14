const jwt = require('jsonwebtoken');

/**
 * verifyToken — validates the short-lived access token from the cookie.
 * If expired, it automatically attempts a silent refresh using the
 * refresh token cookie, issues a new access token, and continues.
 * This prevents users from being randomly logged out mid-session.
 */
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    // No access token at all — try a refresh before giving up
    return attemptRefresh(req, res, next);
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // Access token expired — silently attempt refresh
      return attemptRefresh(req, res, next);
    }
    return res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
};

/**
 * attemptRefresh — tries to use the refresh token cookie to issue a new
 * access token. On success, sets the new cookie and continues the request.
 * On failure, clears both cookies and returns 401.
 */
function attemptRefresh(req, res, next) {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Issue a fresh access token (includes institutionId if present)
    const payload = { id: decoded.id, email: decoded.email, role: decoded.role };
    if (decoded.institutionId) payload.institutionId = decoded.institutionId;

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    req.user = decoded;
    return next();
  } catch (refreshErr) {
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === 'admin') return next();
    res.status(403).json({ error: 'Access denied. Super Admin required.' });
  });
};

// Multi-role verifier
const verifyRoles = (allowedRoles) => (req, res, next) => {
  verifyToken(req, res, () => {
    if (allowedRoles.includes(req.user.role)) return next();
    res.status(403).json({
      error: `Access denied. Requires one of: ${allowedRoles.join(', ')}`
    });
  });
};

module.exports = { verifyToken, verifyAdmin, verifyRoles };
