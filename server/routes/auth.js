// server/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';

import User from '../models/User.js';
import Production, { normalizeSlug } from '../models/Production.js';
import { issueJwt, authRequired } from '../middleware/auth.js';
import {
  passport,
  encodeState,
  decodeState,
  GOOGLE_ENABLED,
  FACEBOOK_ENABLED,
} from '../passport.js';

const router = Router();
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

/**
 * Helper: standardize error responses
 */
function sendError(res, code, msg) {
  return res.status(code).json({ error: msg });
}

/**
 * Probe which providers are enabled (optional, useful for the client)
 * GET /api/auth/providers -> { google: boolean, facebook: boolean }
 */
router.get('/providers', (_req, res) => {
  res.json({ google: GOOGLE_ENABLED, facebook: FACEBOOK_ENABLED });
});


// ---------------------------
// Local auth
// ---------------------------

// Register (local) — does NOT auto-join a production here
router.post('/local/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return sendError(res, 400, 'Email and password required');

    const emailLC = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email: emailLC });
    if (exists) return sendError(res, 409, 'Email already in use');

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ email: emailLC, name, passwordHash, productionIds: [] });

    const token = issueJwt(user);
    return res.json({
      token,
      user: { id: user._id, email: user.email, productionIds: user.productionIds, role: user.role },
    });
  } catch (e) {
    return sendError(res, 500, e.message || 'Registration failed');
  }
});

// Login (local) — user must already be a member of the slug’s production
router.post('/local/login', async (req, res) => {
  try {
    const { email, password, slug } = req.body || {};
    if (!email || !password || !slug) {
      return sendError(res, 400, 'Email, password, and slug required');
    }

    const emailLC = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: emailLC });
    if (!user || !user.passwordHash) return sendError(res, 401, 'Invalid credentials');

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return sendError(res, 401, 'Invalid credentials');

    const prod = await Production.findOne({ slug: normalizeSlug(slug), isActive: true })
      .select('_id slug')
      .lean();
    if (!prod) return sendError(res, 404, 'Production not found');

    const isMember = (user.productionIds || []).map(String).includes(String(prod._id));
    if (!isMember) return sendError(res, 403, 'Not authorized for this production');

    const token = issueJwt(user);
    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        productionIds: user.productionIds,
        role: user.role,
        homeSlug: slug,
      },
    });
  } catch (e) {
    return sendError(res, 500, e.message || 'Login failed');
  }
});


// ---------------------------
// Google OAuth
// ---------------------------

router.get('/google', (req, res, next) => {
  if (!GOOGLE_ENABLED) return sendError(res, 501, 'Google OAuth not configured');

  const slug = normalizeSlug(String(req.query.slug || ''));
  const r = String(req.query.r || '');
  const state = encodeState({ slug, r });

  passport.authenticate('google', {
    scope: ['email', 'profile'],
    state,
  })(req, res, next);
});

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!GOOGLE_ENABLED) return res.redirect(`${ORIGIN}/?err=google-disabled`);
    next();
  },
  passport.authenticate('google', { session: false, failureRedirect: `${ORIGIN}/?err=google-failed` }),
  async (req, res) => {
    try {
      const { slug, r } = decodeState(String(req.query.state || '')) || {};
      const token = issueJwt(req.user);
      const dest = `${ORIGIN}/${encodeURIComponent(slug || '')}/login?token=${encodeURIComponent(token)}${
        r ? `&r=${encodeURIComponent(r)}` : ''
      }`;
      return res.redirect(dest);
    } catch {
      return res.redirect(`${ORIGIN}/?err=oauth-failed`);
    }
  }
);


// ---------------------------
// Facebook OAuth
// ---------------------------

router.get('/facebook', (req, res, next) => {
  if (!FACEBOOK_ENABLED) return sendError(res, 501, 'Facebook OAuth not configured');

  const slug = normalizeSlug(String(req.query.slug || ''));
  const r = String(req.query.r || '');
  const state = encodeState({ slug, r });

  passport.authenticate('facebook', {
    scope: ['email'],
    state,
  })(req, res, next);
});

router.get(
  '/facebook/callback',
  (req, res, next) => {
    if (!FACEBOOK_ENABLED) return res.redirect(`${ORIGIN}/?err=facebook-disabled`);
    next();
  },
  passport.authenticate('facebook', { session: false, failureRedirect: `${ORIGIN}/?err=facebook-failed` }),
  async (req, res) => {
    try {
      const { slug, r } = decodeState(String(req.query.state || '')) || {};
      const token = issueJwt(req.user);
      const dest = `${ORIGIN}/${encodeURIComponent(slug || '')}/login?token=${encodeURIComponent(token)}${
        r ? `&r=${encodeURIComponent(r)}` : ''
      }`;
      return res.redirect(dest);
    } catch {
      return res.redirect(`${ORIGIN}/?err=oauth-failed`);
    }
  }
);


// ---------------------------
/** Me: return the current user profile (requires JWT) */
// ---------------------------
router.get('/me', authRequired, async (req, res) => {
  const prodId = req.header('x-production-id');
  let prodRole = null;

  if (prodId) {
    const p = await Production.findById(prodId).select('ownerUserId members').lean();
    if (p) {
      const m = (p.members || []).find((r) => String(r.user) === String(req.user._id));
      const isOwner = String(p.ownerUserId || '') === String(req.user._id);
      prodRole = isOwner ? 'admin' : (m?.role || null);
    }
  }

  res.json({
    _id: req.user._id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    siteAuthorized: req.user.siteAuthorized,
    productionIds: req.user.productionIds || [],
    productionRole: prodRole, // << handy for UI
  });
});

export default router;
