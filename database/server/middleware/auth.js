/**
 * ARC3D™ — JWT Authentication Middleware
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 */

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify the JWT token from the Authorization header.
 * Attaches the authenticated user to `req.user`.
 */
async function auth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }

        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found.' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        }
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
}

/**
 * Generate a JWT for a user.
 */
function generateToken(userId) {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

module.exports = { auth, generateToken };
