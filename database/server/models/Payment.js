/**
 * ARC3D™ — Payment Model (MongoDB/Mongoose)
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Stores saved payment methods per user.
 * Full card numbers / CVV are NEVER stored — only last 4 digits.
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    method: {
        type: String,
        enum: ['card', 'paypal'],
        required: true
    },
    // Card fields (only for method === 'card')
    nameDisplay: {
        type: String,
        default: ''
    },
    lastFour: {
        type: String,
        default: ''
    },
    expiry: {
        type: String,
        default: ''
    },
    // PayPal fields
    paypalEmail: {
        type: String,
        default: ''
    },
    isDefault: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
