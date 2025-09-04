import { Router } from 'express';
import User from '../models/User.js';
import { authRequired, requireRole } from '../middleware/auth.js';


const router = Router();


router.get('/', authRequired, requireRole('admin'), async (req, res) => {
const q = (req.query.q || '').trim();
const filter = q ? { $or: [
{ name: { $regex: q, $options: 'i' } },
{ email: { $regex: q, $options: 'i' } }
]} : {};
const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
res.json(users);
});


router.get('/:id', authRequired, requireRole('admin'), async (req, res) => {
const user = await User.findById(req.params.id);
if (!user) return res.status(404).json({ error: 'Not found' });
res.json(user);
});


router.patch('/:id', authRequired, requireRole('admin'), async (req, res) => {
const { role, siteAuthorized, banned } = req.body;
const user = await User.findById(req.params.id);
if (!user) return res.status(404).json({ error: 'Not found' });
if (role) user.role = role;
if (typeof siteAuthorized === 'boolean') user.siteAuthorized = siteAuthorized;
if (typeof banned === 'boolean') user.banned = banned;
await user.save();
res.json(user);
});


router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
const user = await User.findByIdAndDelete(req.params.id);
res.json({ ok: true, deleted: !!user });
});


export default router;