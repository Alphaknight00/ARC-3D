/**
 * ARC3D™ Project Routes
 * CRUD endpoints for user CAD project files
 */

const express = require('express');
const router  = express.Router();
const { auth }    = require('../middleware/auth');
const Project = require('../models/Project');

// All routes require authentication
router.use(auth);

// ─── Max payload for project data (50 MB) ────────────────────────
const MAX_PROJECT_SIZE = 50 * 1024 * 1024;

/**
 * GET /api/projects
 * List current user's projects (summaries only — no heavy data)
 * Query params: ?type=residential&favorite=true&search=keyword
 */
router.get('/', async (req, res) => {
    try {
        const filter = { userId: req.userId };

        if (req.query.type)     filter.type = req.query.type;
        if (req.query.favorite) filter.favorite = req.query.favorite === 'true';

        let query = Project.find(filter)
            .select('-data')           // exclude heavy project data
            .sort({ updatedAt: -1 });

        if (req.query.search) {
            const term = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx   = new RegExp(term, 'i');
            filter.$or = [
                { name: rx },
                { description: rx },
                { address: rx },
                { tags: rx }
            ];
            query = Project.find(filter).select('-data').sort({ updatedAt: -1 });
        }

        const projects = await query.lean();
        res.json(projects.map(p => ({
            id:          p._id,
            name:        p.name,
            description: p.description,
            address:     p.address,
            contact:     p.contact,
            type:        p.type,
            tags:        p.tags,
            favorite:    p.favorite,
            isPublic:    p.isPublic,
            objectCount: p.objectCount,
            size:        p.size,
            appVersion:  p.appVersion,
            thumbnail:   p.thumbnail,
            createdAt:   p.createdAt,
            updatedAt:   p.updatedAt
        })));
    } catch (err) {
        console.error('[projects] list error:', err.message);
        res.status(500).json({ error: 'Failed to list projects' });
    }
});

/**
 * GET /api/projects/:id
 * Load a single project with full data
 */
router.get('/:id', async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        res.json({
            id:          project._id,
            name:        project.name,
            description: project.description,
            address:     project.address,
            contact:     project.contact,
            type:        project.type,
            tags:        project.tags,
            favorite:    project.favorite,
            isPublic:    project.isPublic,
            objectCount: project.objectCount,
            size:        project.size,
            appVersion:  project.appVersion,
            thumbnail:   project.thumbnail,
            data:        project.data,
            createdAt:   project.createdAt,
            updatedAt:   project.updatedAt
        });
    } catch (err) {
        console.error('[projects] load error:', err.message);
        res.status(500).json({ error: 'Failed to load project' });
    }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req, res) => {
    try {
        const { name, description, address, contact, type, tags, data, thumbnail, objectCount, isPublic, appVersion } = req.body;

        if (!name || !data) {
            return res.status(400).json({ error: 'Project name and data are required' });
        }

        const dataStr = JSON.stringify(data);
        if (dataStr.length > MAX_PROJECT_SIZE) {
            return res.status(413).json({ error: 'Project exceeds maximum size (50 MB)' });
        }

        const project = await Project.create({
            userId: req.userId,
            name,
            description: description || '',
            address:     address || '',
            contact:     contact || '',
            type:        type || 'residential',
            tags:        tags || [],
            data,
            thumbnail:   thumbnail || '',
            objectCount: objectCount || 0,
            size:        dataStr.length,
            isPublic:    isPublic || false,
            appVersion:  appVersion || '2.1'
        });

        res.status(201).json({
            id:        project._id,
            name:      project.name,
            type:      project.type,
            size:      project.size,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
        });
    } catch (err) {
        console.error('[projects] create error:', err.message);
        res.status(500).json({ error: 'Failed to save project' });
    }
});

/**
 * PUT /api/projects/:id
 * Update an existing project (full overwrite of data)
 */
router.put('/:id', async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { name, description, address, contact, type, tags, data, thumbnail, objectCount, isPublic, appVersion } = req.body;

        if (data) {
            const dataStr = JSON.stringify(data);
            if (dataStr.length > MAX_PROJECT_SIZE) {
                return res.status(413).json({ error: 'Project exceeds maximum size (50 MB)' });
            }
            project.data = data;
            project.size = dataStr.length;
        }

        if (name !== undefined)        project.name        = name;
        if (description !== undefined) project.description = description;
        if (address !== undefined)     project.address     = address;
        if (contact !== undefined)     project.contact     = contact;
        if (type !== undefined)        project.type        = type;
        if (tags !== undefined)        project.tags        = tags;
        if (thumbnail !== undefined)   project.thumbnail   = thumbnail;
        if (objectCount !== undefined) project.objectCount = objectCount;
        if (isPublic !== undefined)    project.isPublic    = isPublic;
        if (appVersion !== undefined)  project.appVersion  = appVersion;

        await project.save();

        res.json({
            id:        project._id,
            name:      project.name,
            type:      project.type,
            size:      project.size,
            updatedAt: project.updatedAt
        });
    } catch (err) {
        console.error('[projects] update error:', err.message);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

/**
 * DELETE /api/projects/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const result = await Project.deleteOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[projects] delete error:', err.message);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

/**
 * PATCH /api/projects/:id/favorite
 * Toggle favorite status
 */
router.patch('/:id/favorite', async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        project.favorite = !project.favorite;
        await project.save();
        res.json({ id: project._id, favorite: project.favorite });
    } catch (err) {
        console.error('[projects] favorite error:', err.message);
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
});

/**
 * POST /api/projects/:id/duplicate
 * Duplicate a project
 */
router.post('/:id/duplicate', async (req, res) => {
    try {
        const source = await Project.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (!source) return res.status(404).json({ error: 'Project not found' });

        const copy = await Project.create({
            userId:      req.userId,
            name:        source.name + ' (Copy)',
            description: source.description,
            address:     source.address,
            contact:     source.contact,
            type:        source.type,
            tags:        source.tags,
            data:        source.data,
            thumbnail:   source.thumbnail,
            objectCount: source.objectCount,
            size:        source.size,
            appVersion:  source.appVersion
        });

        res.status(201).json({
            id:        copy._id,
            name:      copy.name,
            createdAt: copy.createdAt
        });
    } catch (err) {
        console.error('[projects] duplicate error:', err.message);
        res.status(500).json({ error: 'Failed to duplicate project' });
    }
});

module.exports = router;
