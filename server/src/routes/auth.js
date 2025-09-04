import { Router } from 'express';
import passport from 'passport';
import { signToken, authRequired } from '../middleware/auth.js';
import User from '../models/User.js';


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
res.json({
_id: req.user._id,
name: req.user.name,
email: req.user.email,
photo: req.user.photo,
role: req.user.role,
siteAuthorized: req.user.siteAuthorized,
banned: req.user.banned
});
});


export default router;