// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const signToken = (user) =>
  jwt.sign({ uid: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

export const authRequired = async (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.uid);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.banned) return res.status(403).json({ error: 'Banned' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Usage:
 *  - requireRole('any')       -> any authenticated user
 *  - requireRole('manager')   -> only specific role(s), admins always allowed
 *  - requireRole('user','driver') -> any of these roles (or admin)
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // If route allows "any" authenticated user, allow
  if (roles.includes('any')) return next();

  // Admins are always allowed for role-gated routes
  if (req.user.role === 'admin') return next();

  // Otherwise require explicit role match
  if (roles.length > 0 && roles.includes(req.user.role)) return next();

  return res.status(403).json({ error: 'Forbidden' });
};

export const requireSiteAuthorized = (req, res, next) => {
  if (!req.user?.siteAuthorized && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Site access not yet authorized' });
  }
  next();
};