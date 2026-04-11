/**
 * ARC3D™ — Auth Routes
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * POST /api/auth/register   — Create a new account
 * POST /api/auth/login      — Authenticate & receive JWT
 * POST /api/auth/confirm    — Mark email as confirmed
 * GET  /api/auth/me         — Get current user profile (requires JWT)
 * PUT  /api/auth/profile    — Update profile fields (requires JWT)
 * PUT  /api/auth/password   — Change password (requires JWT)
 * DELETE /api/auth/account  — Delete account and all data (requires JWT)
 */

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const User    = require('../models/User');
const Payment      = require('../models/Payment');
const Purchase     = require('../models/Purchase');
const Subscription = require('../models/Subscription');
const { auth, generateToken } = require('../middleware/auth');

/* ── Register ─────────────────────────────────────────────────── */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in instead.' });
        }

        const user = await User.create({
            name:      name.trim(),
            email:     email.toLowerCase().trim(),
            password:  password,
            confirmed: true
        });

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: user.toSafe()
        });
    } catch (err) {
        console.error('[register]', err.message);
        res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
    }
});

/* ── Login ────────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Update last login
        user.lastLoginAt = new Date();
        await user.save();

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: user.toSafe()
        });
    } catch (err) {
        console.error('[login]', err.message);
        res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
    }
});

/* ── Get current user ─────────────────────────────────────────── */
router.get('/me', auth, async (req, res) => {
    res.json({ success: true, user: req.user.toSafe() });
});

/* ── Update profile ───────────────────────────────────────────── */
router.put('/profile', auth, async (req, res) => {
    try {
        const allowed = ['name', 'email', 'phone', 'company'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = key === 'email'
                    ? req.body[key].toLowerCase().trim()
                    : req.body[key].trim();
            }
        }

        // Check email uniqueness if changing email
        if (updates.email && updates.email !== req.user.email) {
            const dup = await User.findOne({ email: updates.email });
            if (dup) {
                return res.status(409).json({ success: false, message: 'Email already in use.' });
            }
        }

        Object.assign(req.user, updates);
        await req.user.save();

        res.json({ success: true, user: req.user.toSafe() });
    } catch (err) {
        console.error('[profile]', err.message);
        res.status(500).json({ success: false, message: 'Update failed.' });
    }
});

/* ── Change password ──────────────────────────────────────────── */
router.put('/password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
        }

        // Reload with password field
        const user = await User.findById(req.user._id).select('+password');
        if (currentPassword) {
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
            }
        }

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
        console.error('[password]', err.message);
        res.status(500).json({ success: false, message: 'Password update failed.' });
    }
});

/* ── Delete account ───────────────────────────────────────────── */
router.delete('/account', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        await Payment.deleteMany({ userId });
        await Purchase.deleteMany({ userId });
        await Subscription.deleteOne({ userId });
        await User.findByIdAndDelete(userId);

        res.json({ success: true, message: 'Account deleted.' });
    } catch (err) {
        console.error('[delete]', err.message);
        res.status(500).json({ success: false, message: 'Account deletion failed.' });
    }
});

/* ── Forgot password — generate reset token ───────────────────── */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            // Return success even if user not found to prevent email enumeration
            return res.json({ success: true, message: 'If an account with that email exists, a password reset code has been generated.' });
        }

        // Generate a 6-digit reset code
        const resetToken = crypto.randomInt(100000, 999999).toString();
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        user.resetToken = resetToken;
        user.resetTokenExpires = resetTokenExpires;
        await user.save();

        console.log(`[forgot-password] Reset code for ${email}: ${resetToken}`);

        // TODO: Integrate email service (SendGrid, SES, etc.) to send the code
        // For now the code is logged server-side

        res.json({ success: true, message: 'If an account with that email exists, a password reset code has been generated.' });
    } catch (err) {
        console.error('[forgot-password]', err.message);
        res.status(500).json({ success: false, message: 'Request failed. Please try again.' });
    }
});

/* ── Reset password — validate token & set new password ───────── */
router.post('/reset-password', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) {
            return res.status(400).json({ success: false, message: 'Email, reset code and new password are required.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select('+resetToken +resetTokenExpires');
        if (!user || !user.resetToken || !user.resetTokenExpires) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
        }

        if (user.resetToken !== token.trim()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
        }

        if (user.resetTokenExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
        }

        user.password = newPassword;
        user.resetToken = null;
        user.resetTokenExpires = null;
        await user.save();

        res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
    } catch (err) {
        console.error('[reset-password]', err.message);
        res.status(500).json({ success: false, message: 'Password reset failed. Please try again.' });
    }
});

module.exports = router;
