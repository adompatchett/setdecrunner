import { Router } from 'express';
import User from '../models/User.js';
import { resolveTenant } from '../middleware/tenant.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { withTenant } from '../utils/withTenant.js';


const router = Router();


router.get('/', authRequired, requireRole('admin'),resolveTenant, withTenant(async (req, res) => {
const q = (req.query.q || '').trim();
const filter = q ? { $or: [
{ name: { $regex: q, $options: 'i' } },
{ email: { $regex: q, $options: 'i' } }
]} : {};
const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
res.json(users);
}));


router.get('/:id', authRequired, requireRole('admin'),resolveTenant, withTenant( async (req, res) => {
const user = await User.findById(req.params.id);
if (!user) return res.status(404).json({ error: 'Not found' });
res.json(user);
}));


router.patch('/:id', authRequired, requireRole('admin'),resolveTenant, withTenant( async (req, res) => {
const { role, siteAuthorized, banned } = req.body;
const user = await User.findById(req.params.id);
if (!user) return res.status(404).json({ error: 'Not found' });
if (role) user.role = role;
if (typeof siteAuthorized === 'boolean') user.siteAuthorized = siteAuthorized;
if (typeof banned === 'boolean') user.banned = banned;
await user.save();
res.json(user);
}));


router.delete('/:id', authRequired,resolveTenant, requireRole('admin'), withTenant( async (req, res) => {
const user = await User.findByIdAndDelete(req.params.id);
res.json({ ok: true, deleted: !!user });
}));

router.post('/users', authRequired,resolveTenant, requireRole('admin'), withTenant( async (req, res, next) => {
    try {
      const { email, firstName, lastName, role = 'user', siteAuthorized = false, username } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });
  
      let user = await User.findOne({ email: email.toLowerCase() });
  
      if (!user) {
        user = new User({
          provider: 'local',
          email: email.toLowerCase(),
          firstName,
          lastName,
          username: username?.toLowerCase() || undefined,
          role,
          siteAuthorized,
          mustChangePassword: true,
        });
      } else {
        // If they exist (e.g., OAuth), ensure they can log in locally after setting password
        user.role = role || user.role;
        user.siteAuthorized = siteAuthorized ?? user.siteAuthorized;
        user.mustChangePassword = true;
      }
  
      // Issue reset/invite token
      const rawToken = user.issueResetToken();
      await user.save();
  
      const link = `${FRONTEND_URL}/set-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(user.email)}`;
  
      const subject = 'You have been invited to SetDec Runner';
      const text = `Hi ${firstName || ''},
  
  You've been granted access. Click the link below to set your password:
  ${link}
  
  This link expires in 24 hours.`;
  
      const html = `
        <p>Hi ${firstName || ''},</p>
        <p>You've been granted access to <b>SetDec Runner</b>.</p>
        <p><a href="${link}">Click here to set your password</a> (expires in 24 hours).</p>
        <p>If you didn't expect this, you can ignore this email.</p>
      `;
  
      await sendMail({ to: user.email, subject, text, html });
  
      res.json({ ok: true, userId: user._id });
    } catch (e) { next(e); }
  }));

export default router;