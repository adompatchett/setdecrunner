import { Router } from 'express';
import Item from '../models/Item.js';
import { authRequired, requireSiteAuthorized } from '../middleware/auth.js';
import { upload } from '../utils/uploader.js';


const router = Router();


router.post('/', authRequired, requireSiteAuthorized, async (req, res) => {
const item = await Item.create({ ...req.body, owner: req.user._id });
res.status(201).json(item);
});


router.get('/', authRequired, requireSiteAuthorized, async (req, res) => {
const { q = '', placeId } = req.query;
const filter = {};
if (q.trim()) Object.assign(filter, { $text: { $search: q.trim() } });
if (placeId) Object.assign(filter, { location: placeId });
const items = await Item.find(filter).sort({ createdAt: -1 }).limit(200).populate('location');
res.json(items);
});


router.get('/:id', authRequired, requireSiteAuthorized, async (req, res) => {
const item = await Item.findById(req.params.id).populate('location');
if (!item) return res.status(404).json({ error: 'Not found' });
res.json(item);
});


router.patch('/:id', authRequired, requireSiteAuthorized, async (req, res) => {
const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
if (!item) return res.status(404).json({ error: 'Not found' });
res.json(item);
});


router.delete('/:id', authRequired, requireSiteAuthorized, async (req, res) => {
await Item.findByIdAndDelete(req.params.id);
res.json({ ok: true });
});


router.post('/:id/photos', authRequired, requireSiteAuthorized, upload.array('photos', 6), async (req, res) => {
const item = await Item.findById(req.params.id);
if (!item) return res.status(404).json({ error: 'Not found' });
const urls = req.files.map(f => `/uploads/${f.filename}`);
item.photos.push(...urls);
await item.save();
res.json(item);
});


router.delete('/:id/photos', authRequired, requireSiteAuthorized, async (req, res) => {
const { url } = req.body;
const item = await Item.findById(req.params.id);
if (!item) return res.status(404).json({ error: 'Not found' });
item.photos = item.photos.filter(p => p !== url);
await item.save();
res.json(item);
});


export default router;