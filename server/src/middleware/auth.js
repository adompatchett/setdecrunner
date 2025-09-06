// server/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const TOKEN_TTL = process.env.JWT_TTL || '7d';

export function signToken(user) {
  const id = user?._id?.toString();
  if (!id) throw new Error('signToken: user._id missing');
  return jwt.sign(
    { uid: id, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  if (roles.includes('any')) return next();
  if (req.user.role === 'admin') return next();
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

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized: missing token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.uid || payload.sub;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized: user not found' });
    if (user.banned) return res.status(403).json({ error: 'Banned' });

    req.user = user;
    req.auth = payload;
    next();
  } catch (err) {
    console.error('authRequired error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

