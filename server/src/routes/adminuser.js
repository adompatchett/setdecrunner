// server/routes/adminUsers.js (ESM)
import { Router } from 'express';
import User from '../models/User.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import crypto from 'crypto';
import { sendMail } from '../utils/mailer.js'; // make sure this file also exports ESM
import { resolveTenant } from '../middleware/tenant.js';
import { withTenant } from '../utils/withTenant.js';
import { resolve } from 'path';
const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

router.post('/users', authRequired, requireRole('admin'),resolveTenant,withTenant(async (req, res, next) => {
  try {
    const { email, firstName, lastName, username, role = 'user', siteAuthorized = false } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({
        provider: 'local',
        email: email.toLowerCase(),
        firstName,
        lastName,
        username: username ? username.toLowerCase() : undefined,
        role,
        siteAuthorized,
        mustChangePassword: true,
      });
    } else {
      user.firstName = firstName ?? user.firstName;
      user.lastName = lastName ?? user.lastName;
      user.username = username ? username.toLowerCase() : user.username;
      user.role = role || user.role;
      user.siteAuthorized = !!siteAuthorized;
      user.mustChangePassword = true;
    }

    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    user.passwordResetToken = hash;
    user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.save();

    const link = `${FRONTEND_URL}/set-password?token=${encodeURIComponent(raw)}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendMail({
        to: user.email,
        subject: 'You have been invited to Set Dec Runner',
        text: `Hi ${firstName || ''},\n\nClick the link to set your password:\n${link}\n\nThis link expires in 24 hours.`,
        html: `<p>Hi ${firstName || ''},</p><p>Click to set your password:</p><p><a href="${link}">${link}</a></p><p><small>Expires in 24 hours.</small></p>`
      });
    } catch (e) {
      console.error('Email send failed:', e);
    }

    res.json({ ok: true, userId: user._id });
  } catch (e) { next(e); }
}));

export default router;