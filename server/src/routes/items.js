import { Router } from 'express';
import Item from '../models/Item.js';
import { authRequired, requireSiteAuthorized } from '../middleware/auth.js';
import { upload } from '../utils/uploader.js';


const router = Router();


// Create item (supports multipart form-data: fields + optional image/photos)
router.post(
    '/',
    authRequired,
    requireSiteAuthorized,
    upload.fields([
      { name: 'image',  maxCount: 1 },   // single image field (frontend uses this)
      { name: 'photos', maxCount: 10 },  // or multiple photos if you want
    ]),
    async (req, res) => {
      try {
        const name = (req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'name is required' });
  
        // Collect uploaded file URLs
        const filesA = (req.files?.image  || []);
        const filesB = (req.files?.photos || []);
        const photos = [...filesA, ...filesB].map(f => `/uploads/${f.filename}`);
  
        const item = await Item.create({
          name,
          description: (req.body.description || '').trim() || undefined,
          location: req.body.location || undefined, // ensure this matches your schema
          quantity: req.body.quantity != null ? Number(req.body.quantity) : undefined,
          photos,
          owner: req.user._id,
        });
  
        await item.populate('location');
        res.status(201).json(item);
      } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message || 'Failed to create item' });
      }
    }
  );

  router.post(
    '/:id',
    authRequired,
    requireSiteAuthorized,
    upload.fields([
      { name: 'image',  maxCount: 1 },
      { name: 'photos', maxCount: 10 },
    ]),
    async (req, res) => {
      try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Not found' });
  
        // Only apply known fields that were actually provided
        const updates = {};
        if (req.body.name !== undefined) {
          updates.name = String(req.body.name).trim();
          if (!updates.name) return res.status(400).json({ error: 'name cannot be empty' });
        }
        if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
        if (req.body.location !== undefined)    updates.location    = req.body.location || null;
        if (req.body.quantity !== undefined)    updates.quantity    = Number(req.body.quantity);
  
        Object.assign(item, updates);
  
        // Append any uploaded images
        const filesA = (req.files?.image  || []);
        const filesB = (req.files?.photos || []);
        if (filesA.length || filesB.length) {
          if (!Array.isArray(item.photos)) item.photos = [];
          item.photos.push(...[...filesA, ...filesB].map(f => `/uploads/${f.filename}`));
        }
  
        await item.save();
        await item.populate('location');
        res.json(item);
      } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message || 'Failed to update item' });
      }
    }
  );

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