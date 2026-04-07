/**
 * ARC3D™ — Subscription Model (MongoDB/Mongoose)
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * One active subscription / plan per user.
 */

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true  // one subscription per user
    },
    plan: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['purchased', 'pending', 'pending_paypal', 'cancelled'],
        default: 'pending'
    },
    method: {
        type: String,
        enum: ['card', 'paypal', null],
        default: null
    },
    lastFour: {
        type: String,
        default: null
    },
    transactionId: {
        type: String,
        default: null
    },
    freeUntil: {
        type: Date,
        default: null
    },
    subscribedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
