/**
 * ARC3D™ — Purchase Model (MongoDB/Mongoose)
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Records every purchase / download transaction.
 */

const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    plan: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'GBP'
    },
    method: {
        type: String,
        enum: ['card', 'paypal'],
        required: true
    },
    lastFour: {
        type: String,
        default: null
    },
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['completed', 'pending', 'pending_paypal', 'free_beta', 'cancelled'],
        default: 'completed'
    },
    purchasedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

purchaseSchema.index({ userId: 1, purchasedAt: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
