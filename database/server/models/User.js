/**
 * ARC3D™ — User Model (MongoDB/Mongoose)
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 8,
        select: false  // never return password by default
    },
    confirmed: {
        type: Boolean,
        default: false
    },
    phone: {
        type: String,
        default: '',
        trim: true
    },
    company: {
        type: String,
        default: '',
        trim: true
    },
    lastLoginAt: {
        type: Date,
        default: null
    },
    resetToken: {
        type: String,
        default: null,
        select: false
    },
    resetTokenExpires: {
        type: Date,
        default: null,
        select: false
    }
}, {
    timestamps: true  // adds createdAt, updatedAt
});

// email index already created by `unique: true` in the schema

// ── Hash password before saving ─────────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const rounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, rounds);
    next();
});

// ── Compare candidate password against stored hash ──────────────
userSchema.methods.comparePassword = async function (candidate) {
    return bcrypt.compare(candidate, this.password);
};

// ── Strip sensitive fields when converting to JSON ──────────────
userSchema.methods.toSafe = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.resetToken;
    delete obj.resetTokenExpires;
    delete obj.__v;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
