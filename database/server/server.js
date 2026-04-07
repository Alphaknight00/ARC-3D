/**
 * ARC3D™ Database Server
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Express + MongoDB backend for user authentication,
 * payment data, purchase history and subscription management.
 *
 * Usage:
 *   cd database/server
 *   npm install
 *   node server.js          (or: npm start)
 */

require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const paymentRoutes = require('./routes/payments');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Security headers ────────────────────────────────────────── */
app.use(helmet());

/* ── CORS ────────────────────────────────────────────────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (file://, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        callback(new Error('CORS: Origin ' + origin + ' not allowed'));
    },
    credentials: true
}));

/* ── Body parsing ────────────────────────────────────────────── */
app.use(express.json({ limit: '1mb' }));

/* ── Rate limiting ───────────────────────────────────────────── */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 20,                    // 20 attempts per window
    message: { success: false, message: 'Too many attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', generalLimiter);

/* ── Routes ──────────────────────────────────────────────────── */
app.use('/api/auth',     authRoutes);
app.use('/api/payments', paymentRoutes);

/* ── Health check ────────────────────────────────────────────── */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ARC3D Database Server',
        version: '1.0.0',
        time: new Date().toISOString()
    });
});

/* ── 404 fallback ────────────────────────────────────────────── */
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

/* ── Global error handler ────────────────────────────────────── */
app.use((err, req, res, _next) => {
    console.error('[server error]', err.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

/* ── Connect to MongoDB & start ──────────────────────────────── */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arc3d';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('[MongoDB] Connected to', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
        app.listen(PORT, () => {
            console.log(`\n  ╔══════════════════════════════════════════╗`);
            console.log(`  ║  ARC3D™ Database Server                 ║`);
            console.log(`  ║  Running on http://localhost:${PORT}       ║`);
            console.log(`  ║  © 2026 HSAN Studios                    ║`);
            console.log(`  ╚══════════════════════════════════════════╝\n`);
        });
    })
    .catch(err => {
        console.error('[MongoDB] Connection failed:', err.message);
        process.exit(1);
    });
