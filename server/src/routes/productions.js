// routes/productions.js
import express from 'express';
import { body, validationResult, param } from 'express-validator';
import Production from '../models/Production.js';
import auth from '../middleware/auth.js';

const router = express.Router();

/* --------------------------- validators --------------------------- */

const validateProduction = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Production name is required and must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('type')
    .optional()
    .isIn(['film', 'tv', 'commercial', 'documentary', 'music-video', 'other'])
    .withMessage('Invalid production type'),
  body('status')
    .optional()
    .isIn(['development', 'pre-production', 'production', 'post-production', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('budget')
    .optional()
    .isNumeric()
    .withMessage('Budget must be a number'),
];

const validateSlug = [
  param('slug')
    .trim()
    .matches(/^[a-z0-9-]+$/i)
    .withMessage('Invalid slug format'),
];

/* --------------------------- helpers --------------------------- */

const isObjectIdLike = (v = '') => /^[a-f0-9]{24}$/i.test(String(v));

/**
 * Middleware: load production by id or from req.params.productionId
 * and enforce access.
 */
const loadProductionByIdWithAccess = async (req, res, next) => {
  try {
    const id = req.params.id || req.params.productionId;
    if (!id || !isObjectIdLike(id)) {
      return res.status(400).json({ message: 'Invalid production id' });
    }

    const production = await Production.findById(id);
    if (!production) return res.status(404).json({ message: 'Production not found' });

    if (typeof production.canUserAccess === 'function') {
      if (!production.canUserAccess(req.user.id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    req.production = production;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const ensureCanEdit = async (req, res, next) => {
  try {
    const production = req.production || (await Production.findById(req.params.id));
    if (!production) return res.status(404).json({ message: 'Production not found' });

    if (typeof production.canUserEdit === 'function') {
      if (!production.canUserEdit(req.user.id)) {
        return res.status(403).json({ message: 'Edit permission denied' });
      }
    }

    req.production = production;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* --------------------------- routes --------------------------- */

/**
 * GET /productions
 * List productions visible to the current user.
 */
router.get('/', auth, async (req, res) => {
  try {
    if (typeof Production.findUserProductions === 'function') {
      const productions = await Production.findUserProductions(req.user.id);
      return res.json(productions);
    }
    // Fallback: owner or team membership (adjust to your schema)
    const productions = await Production.find({
      $or: [{ owner: req.user.id }, { 'team.user': req.user.id }],
      isArchived: { $ne: true },
    });
    res.json(productions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * HEAD /productions/:slug
 * Quick existence check by slug. Returns 200 if exists & user has access, else 404/403.
 */
router.head('/:slug', auth, validateSlug, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.sendStatus(400);

  try {
    const production = await Production.findBySlug(req.params.slug);
    if (!production) return res.sendStatus(404);
    if (typeof production.canUserAccess === 'function' && !production.canUserAccess(req.user.id)) {
      return res.sendStatus(403);
    }
    return res.sendStatus(200);
  } catch {
    return res.sendStatus(500);
  }
});

/**
 * GET /productions/:slug
 * Fetch production by slug (preferred for your frontend).
 * NOTE: We prioritize slug lookup here. Use /productions/id/:id for id lookups.
 */
router.get('/:slug', auth, validateSlug, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const production = await Production.findBySlug(req.params.slug);
    if (!production) return res.status(404).json({ message: 'Production not found' });

    if (typeof production.canUserAccess === 'function' && !production.canUserAccess(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json(production);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * (Optional convenience) GET /productions/:slug/exists
 * JSON existence endpoint for the slug.
 */
router.get('/:slug/exists', auth, validateSlug, async (req, res) => {
  try {
    const production = await Production.findBySlug(req.params.slug);
    if (!production) return res.json({ exists: false });

    if (typeof production.canUserAccess === 'function' && !production.canUserAccess(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    return res.json({ exists: true, id: production._id });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /productions/id/:id
 * Fetch production by id (explicit id route to avoid slug/id collisions).
 */
router.get('/id/:id', auth, loadProductionByIdWithAccess, (req, res) => {
  res.json(req.production);
});

/**
 * POST /productions
 * Create a new production.
 */
router.post('/', auth, validateProduction, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const production = new Production({ ...req.body, owner: req.user.id });

    await production.save();
    await production.populate('owner', 'name email');

    res.status(201).json(production);
  } catch (err) {
    if (err.code === 11000) {
      // duplicate key (e.g., unique slug or name)
      return res.status(400).json({ message: 'Production with this name/slug already exists' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PUT /productions/:id
 * Update production by id.
 */
router.put('/:id', auth, ensureCanEdit, validateProduction, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    Object.assign(req.production, req.body);
    await req.production.save();
    await req.production.populate('owner', 'name email');
    await req.production.populate('team.user', 'name email');

    res.json(req.production);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Production with this name/slug already exists' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * DELETE /productions/:id
 * Soft-delete (archive) production by id.
 */
router.delete('/:id', auth, ensureCanEdit, async (req, res) => {
  try {
    req.production.isActive = false;
    req.production.isArchived = true;
    await req.production.save();
    res.json({ message: 'Production archived successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* --------------------------- team management --------------------------- */

/**
 * POST /productions/:id/team
 * Add a team member.
 */
router.post(
  '/:id/team',
  auth,
  ensureCanEdit,
  [
    body('userId').isMongoId().withMessage('Valid user ID required'),
    body('role')
      .optional()
      .isIn(['producer', 'director', 'assistant-director', 'coordinator', 'accountant', 'viewer']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

    try {
      const { userId, role = 'viewer' } = req.body;
      if (typeof req.production.addTeamMember === 'function') {
        await req.production.addTeamMember(userId, role);
      }
      await req.production.populate('team.user', 'name email');
      res.json(req.production);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

/**
 * DELETE /productions/:id/team/:userId
 * Remove a team member.
 */
router.delete('/:id/team/:userId', auth, ensureCanEdit, async (req, res) => {
  try {
    if (typeof req.production.removeTeamMember === 'function') {
      await req.production.removeTeamMember(req.params.userId);
    }
    await req.production.populate('team.user', 'name email');
    res.json(req.production);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PUT /productions/:id/team/:userId
 * Update team member role.
 */
router.put(
  '/:id/team/:userId',
  auth,
  ensureCanEdit,
  [body('role').isIn(['producer', 'director', 'assistant-director', 'coordinator', 'accountant', 'viewer'])],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

    try {
      if (typeof req.production.addTeamMember === 'function') {
        await req.production.addTeamMember(req.params.userId, req.body.role);
      }
      await req.production.populate('team.user', 'name email');
      res.json(req.production);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

/* --------------------- production-scoped example ---------------------- */

/**
 * GET /productions/:productionId/runsheets
 * Example of a production-scoped subresource – you can wire this to your runsheets controller.
 */
router.get('/:productionId/runsheets', auth, loadProductionByIdWithAccess, async (req, res) => {
  try {
    // Replace with your actual runsheets fetch
    res.json({
      message: 'Runsheets endpoint - integrate with your runsheets controller',
      productionId: req.production._id,
      production: req.production.name || req.production.title || req.production.slug,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * Make production context available to nested routes under /productions/:productionId/*
 */
// Load the production doc for any route with :productionId
router.param('productionId', async (req, res, next, id) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).json({ message: 'Invalid production id' });
    const production = await Production.findById(id);
    if (!production) return res.status(404).json({ message: 'Production not found' });
    req.production = production;
    next();
  } catch (e) {
    next(e);
  }
});

// Then ensure auth + access per route group:
router.use('/:productionId', auth, (req, res, next) => {
  if (typeof req.production?.canUserAccess === 'function' && !req.production.canUserAccess(req.user.id)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  req.productionId = req.production._id;
  req.productionSlug = req.production.slug;
  next();
});

export default router;
