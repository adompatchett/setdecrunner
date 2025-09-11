// src/routes/users.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

// Helpers
function sanitizeUser(doc) {
  if (!doc) return null;
  const u = doc.toObject ? doc.toObject() : doc;
  delete u.passwordHash;
  delete u.resetToken;
  delete u.resetTokenExp;
  return u;
}

// GET /api/users?q=&limit=...
router.get('/', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);

    const filter = q
      ? {
          $or: [
            { name:  { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ],
        }
      : {};

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id name email role siteAuthorized banned productionIds createdAt updatedAt')
      .lean();

    res.json(users);
  } catch (e) { next(e); }
});

// GET /api/users/:id
router.get('/:id', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('_id name email role siteAuthorized banned productionIds createdAt updatedAt');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (e) { next(e); }
});

// PATCH /api/users/:id
router.patch('/:id', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const { role, siteAuthorized, banned, name, password } = req.body || {};
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    if (name !== undefined) user.name = String(name).trim();
    if (role !== undefined) user.role = String(role);
    if (typeof siteAuthorized === 'boolean') user.siteAuthorized = siteAuthorized;
    if (typeof banned === 'boolean') user.banned = banned;

    if (password !== undefined && String(password).trim()) {
      user.passwordHash = await bcrypt.hash(String(password).trim(), 10);
      // If you track password reset flags, clear them here if desired
      user.mustChangePassword = false;
    }

    await user.save();
    res.json(sanitizeUser(user));
  } catch (e) { next(e); }
});

// DELETE /api/users/:id
router.delete('/:id', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true, deleted: !!user });
  } catch (e) { next(e); }
});

// POST /api/users  (create or upsert by email)
router.post('/', authRequired, requireRole('admin'), async (req, res, next) => {
  try {
    const {
      email,
      name,
      role = 'user',
      siteAuthorized = false,
      banned = false,
      password, // optional
    } = req.body || {};

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const emailLC = String(email).toLowerCase().trim();

    let user = await User.findOne({ email: emailLC });

    if (!user) {
      user = new User({
        email: emailLC,
        name: name ? String(name).trim() : undefined,
        role,
        siteAuthorized: !!siteAuthorized,
        banned: !!banned,
      });
      if (password && String(password).trim()) {
        user.passwordHash = await bcrypt.hash(String(password).trim(), 10);
      }
      await user.save();
    } else {
      // Update existing user
      if (name !== undefined) user.name = String(name).trim();
      if (role !== undefined) user.role = String(role);
      user.siteAuthorized = !!siteAuthorized;
      user.banned = !!banned;

      if (password && String(password).trim()) {
        user.passwordHash = await bcrypt.hash(String(password).trim(), 10);
        user.mustChangePassword = false;
      }
      await user.save();
    }

    // If you later add email invitations, do it here (behind env-guarded mailer)
    res.status(201).json(sanitizeUser(user));
  } catch (e) { next(e); }
});

export default router;
