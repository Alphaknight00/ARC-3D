/**
 * ARC3D™ — Payment & Purchase Routes
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * All routes require JWT authentication.
 *
 * POST   /api/payments/method         — Save a payment method (card / PayPal)
 * GET    /api/payments/methods        — List saved payment methods
 * DELETE /api/payments/method/:id     — Delete a saved payment method
 *
 * POST   /api/payments/purchase       — Record a purchase
 * GET    /api/payments/purchases      — Get purchase history
 *
 * GET    /api/payments/subscription   — Get current subscription
 * PUT    /api/payments/subscription   — Create or update subscription
 */

const express      = require('express');
const router       = express.Router();
const Payment      = require('../models/Payment');
const Purchase     = require('../models/Purchase');
const Subscription = require('../models/Subscription');
const { auth }     = require('../middleware/auth');

// All routes require authentication
router.use(auth);

/* ══════════════════════════════════════════════════════════════════
   PAYMENT METHODS
   ══════════════════════════════════════════════════════════════════ */

/* ── Save a payment method ────────────────────────────────────── */
router.post('/method', async (req, res) => {
    try {
        const { method, nameDisplay, lastFour, expiry, paypalEmail } = req.body;

        if (!method || !['card', 'paypal'].includes(method)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method.' });
        }

        // Un-default all existing methods for this user
        await Payment.updateMany(
            { userId: req.user._id },
            { $set: { isDefault: false } }
        );

        const record = await Payment.create({
            userId:      req.user._id,
            method,
            nameDisplay: nameDisplay || '',
            lastFour:    lastFour    || '',
            expiry:      expiry      || '',
            paypalEmail: paypalEmail || '',
            isDefault:   true
        });

        res.status(201).json({ success: true, payment: record });
    } catch (err) {
        console.error('[saveMethod]', err.message);
        res.status(500).json({ success: false, message: 'Failed to save payment method.' });
    }
});

/* ── List saved methods ───────────────────────────────────────── */
router.get('/methods', async (req, res) => {
    try {
        const methods = await Payment.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
        res.json({ success: true, payments: methods });
    } catch (err) {
        console.error('[getMethods]', err.message);
        res.status(500).json({ success: false, message: 'Failed to load payment methods.' });
    }
});

/* ── Delete a saved method ────────────────────────────────────── */
router.delete('/method/:id', async (req, res) => {
    try {
        const result = await Payment.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });
        if (!result) {
            return res.status(404).json({ success: false, message: 'Payment method not found.' });
        }
        res.json({ success: true, message: 'Payment method deleted.' });
    } catch (err) {
        console.error('[deleteMethod]', err.message);
        res.status(500).json({ success: false, message: 'Failed to delete payment method.' });
    }
});

/* ══════════════════════════════════════════════════════════════════
   PURCHASES
   ══════════════════════════════════════════════════════════════════ */

/* ── Record a purchase ────────────────────────────────────────── */
router.post('/purchase', async (req, res) => {
    try {
        const { plan, amount, currency, method, lastFour, transactionId, status } = req.body;

        if (!plan || !method || !transactionId) {
            return res.status(400).json({ success: false, message: 'Plan, method and transactionId are required.' });
        }

        const purchase = await Purchase.create({
            userId:        req.user._id,
            plan,
            amount:        amount   || 0,
            currency:      currency || 'GBP',
            method,
            lastFour:      lastFour || null,
            transactionId,
            status:        status || 'completed',
            purchasedAt:   new Date()
        });

        res.status(201).json({ success: true, purchase });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'Duplicate transaction.' });
        }
        console.error('[purchase]', err.message);
        res.status(500).json({ success: false, message: 'Failed to record purchase.' });
    }
});

/* ── Get purchase history ─────────────────────────────────────── */
router.get('/purchases', async (req, res) => {
    try {
        const purchases = await Purchase.find({ userId: req.user._id })
            .sort({ purchasedAt: -1 })
            .limit(50);
        res.json({ success: true, purchases });
    } catch (err) {
        console.error('[purchases]', err.message);
        res.status(500).json({ success: false, message: 'Failed to load purchases.' });
    }
});

/* ══════════════════════════════════════════════════════════════════
   SUBSCRIPTION
   ══════════════════════════════════════════════════════════════════ */

/* ── Get current subscription ─────────────────────────────────── */
router.get('/subscription', async (req, res) => {
    try {
        const sub = await Subscription.findOne({ userId: req.user._id });
        res.json({ success: true, subscription: sub || null });
    } catch (err) {
        console.error('[getSub]', err.message);
        res.status(500).json({ success: false, message: 'Failed to load subscription.' });
    }
});

/* ── Create or update subscription ────────────────────────────── */
router.put('/subscription', async (req, res) => {
    try {
        const { plan, status, method, lastFour, transactionId, freeUntil } = req.body;

        if (!plan) {
            return res.status(400).json({ success: false, message: 'Plan is required.' });
        }

        const sub = await Subscription.findOneAndUpdate(
            { userId: req.user._id },
            {
                $set: {
                    plan,
                    status:        status        || 'pending',
                    method:        method        || null,
                    lastFour:      lastFour      || null,
                    transactionId: transactionId || null,
                    freeUntil:     freeUntil     || null,
                    subscribedAt:  new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json({ success: true, subscription: sub });
    } catch (err) {
        console.error('[setSub]', err.message);
        res.status(500).json({ success: false, message: 'Failed to update subscription.' });
    }
});

module.exports = router;
