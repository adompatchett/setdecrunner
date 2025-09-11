// server/routes/adminUsers.js
import { Router } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import { authRequired, requireRole } from '../middleware/auth.js';

// Mailer is optional; we’ll no-op if it’s missing or throws
let sendMail = null;
try {
  const mod = await import('../utils/mailer.js');
  sendMail = mod.sendMail || null;
} catch {
  // no mailer configured; we’ll just log the invite link
}

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * POST /api/admin/users
 * Admin-only. Creates or updates a user and emails them a “set password” link.
 * Body: { email, firstName?, lastName?, name?, username?, role?, siteAuthorized? }
 */
router.post(
  '/users',
  authRequired,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const {
        email,
        firstName,
        lastName,
        name,
        username,
        role = 'user',
        siteAuthorized = false,
      } = req.body || {};

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const emailLC = String(email).toLowerCase().trim();
      const displayName =
        (name && String(name).trim()) ||
        [firstName, lastName].filter(Boolean).join(' ').trim() ||
        undefined;

      let user = await User.findOne({ email: emailLC });

      if (!user) {
        user = new User({
          provider: 'local',
          email: emailLC,
          name: displayName,
          username: username ? String(username).toLowerCase().trim() : undefined,
          role: String(role),
          siteAuthorized: !!siteAuthorized,
          mustChangePassword: true,
        });
      } else {
        if (displayName !== undefined) user.name = displayName;
        if (username !== undefined) user.username = username ? String(username).toLowerCase().trim() : user.username;
        if (role !== undefined) user.role = String(role);
        user.siteAuthorized = !!siteAuthorized;
        user.mustChangePassword = true;
      }

      // Issue a one-time reset token (store hash in DB)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Use conventional field names; if your schema uses different ones, update here.
      user.passwordResetToken = tokenHash;
      user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await user.save();

      const link = `${FRONTEND_URL}/set-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(
        user.email
      )}`;

      // Try to send an email; if mailer not configured, log link so you can copy it.
      try {
        if (sendMail) {
          await sendMail({
            to: user.email,
            subject: 'You have been invited to Set Dec Runner',
            text: `Hi ${displayName || ''},

You’ve been granted access. Click the link below to set your password:
${link}

This link expires in 24 hours.`,
            html: `
              <p>Hi ${displayName || ''},</p>
              <p>You've been granted access to <b>Set Dec Runner</b>.</p>
              <p><a href="${link}">Click here to set your password</a> (expires in 24 hours).</p>
              <p>If you didn't expect this, you can ignore this email.</p>
            `,
          });
        } else {
          console.warn('[adminUsers] sendMail not configured. Invite link:', link);
        }
      } catch (mailErr) {
        console.error('Email send failed:', mailErr);
        // We still return success; the admin can copy the link from logs.
      }

      res.json({ ok: true, userId: user._id });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
