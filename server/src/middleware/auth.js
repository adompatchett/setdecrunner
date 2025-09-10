// server/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const TOKEN_TTL  = process.env.JWT_TTL  || '7d';

/* ---------------- token helpers ---------------- */

export function signToken(user) {
  const id = user?._id?.toString();
  if (!id) throw new Error('signToken: user._id missing');
  return jwt.sign({ uid: id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function getTokenFromReq(req) {
  const hdr = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof hdr === 'string' && hdr.startsWith('Bearer ')) return hdr.slice(7).trim();
  // optional cookie support (if you set it server-side)
  const cookie = req.cookies?.token;
  if (cookie) return cookie;
  return null;
}

/* ---------------- core middlewares ---------------- */

export async function authRequired(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: missing token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.uid || payload.sub;
    const user = await User.findById(userId);
    if (!user)   return res.status(401).json({ error: 'Unauthorized: user not found' });
    if (user.banned) return res.status(403).json({ error: 'Banned' });

    req.user = user;
    req.auth = payload;
    return next();
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Like authRequired, but doesn't error if no token; it just sets req.user when present.
export async function optionalAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.uid || payload.sub;
    const user = await User.findById(userId);
    if (user && !user.banned) {
      req.user = user;
      req.auth = payload;
    }
  } catch {
    // ignore invalid/expired token in optional mode
  }
  next();
}

/* ---------------- authorization helpers ---------------- */

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // admins bypass; 'any' allows any authenticated user
  if (req.user.role === 'admin') return next();
  if (roles.includes('any')) return next();
  if (roles.length === 0) return next(); // no specific role required
  if (roles.includes(req.user.role)) return next();

  return res.status(403).json({ error: 'Forbidden' });
};

export const requireSiteAuthorized = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.user.siteAuthorized && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Site access not yet authorized' });
  }
  next();
};

/* ---------------- default export (for `import auth from ...`) ---------------- */

// Default to the strict auth middleware for convenience.
export default authRequired;
