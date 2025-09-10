import { Router } from 'express';
import passport from 'passport';
import { signToken, authRequired } from '../middleware/auth.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';


const router = Router();


const finishLogin = async (req, res) => {
// Bootstrap: make first user admin + authorized
const adminCount = await User.countDocuments({ role: 'admin' });
if (adminCount === 0) {
req.user.role = 'admin';
req.user.siteAuthorized = true;
await req.user.save();
}
const token = signToken(req.user);
const url = new URL(process.env.FRONTEND_URL);
url.hash = `token=${token}`;
res.redirect(url.toString());
};


router.get('/google', passport.authenticate('google', { scope: ['profile','email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => finishLogin(req, res));


router.get('/facebook', passport.authenticate('facebook', { scope: ['public_profile','email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), (req, res) => finishLogin(req, res));


router.get('/me', authRequired, (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' }); // guard
  
    const u = req.user;
    let name;
    if (u.username) name = u.username;
    else if (u.firstName || u.lastName) name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  
    res.json({
      _id: u._id,
      name,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      photo: u.photo,
      role: u.role,
      siteAuthorized: u.siteAuthorized,
      banned: u.banned,
      provider: u.provider
    });
  });

// server/routes/authLocal.js

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const TOKEN_TTL = '30d';

function sign(user) {
  return jwt.sign({ sub: user._id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

async function promoteFirstUserIfNeeded(user) {
  const count = await User.countDocuments({});
  if (count === 1) {
    user.role = 'admin';
    user.isAuthorizedForSite = true;
    await user.save();
  }
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, firstName, lastName, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: (username||'').toLowerCase() }] });
    if (exists) return res.status(409).json({ error: 'Email or username already in use.' });

    const user = new User({
      username: username?.toLowerCase() || undefined,
      firstName, lastName,
      email: email.toLowerCase(),
      password,
      provider: 'local'
    });
    await user.save();
    await promoteFirstUserIfNeeded(user);

    const token = sign(user);
    res.json({ token });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body; // identifier can be email OR username
    if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials.' });

    const query = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { username: identifier.toLowerCase() };

    const user = await User.findOne(query).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = sign(user);
    res.json({ token });
  } catch (e) { next(e); }
});

// server/routes/passwordReset.js

import crypto from 'crypto';

router.post('/complete-reset', async (req, res, next) => {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) {
      return res.status(400).json({ error: 'Missing token, email, or password' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email: email.toLowerCase(),
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    }).select('+password');

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password = password;               // will be hashed by pre-save hook
    user.mustChangePassword = false;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;