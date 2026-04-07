/**
 * ARC3D™ User Store
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Handles user accounts, registration, authentication, email confirmation,
 * and profile management.  All data is stored in the 'users' object store
 * of the ARC3D_UserDB IndexedDB database.
 *
 * Depends on: db-manager.js (window.arc3dDB)
 */

'use strict';

class UserStore {
    constructor(db) {
        /** @type {ARC3DDatabase} */
        this.db = db;
        this.STORE = 'users';
    }

    /* ── Registration ──────────────────────────────────────────────── */

    /**
     * Register a new user.
     * @param {string} name
     * @param {string} email
     * @param {string} password – plain text (will be hashed)
     * @returns {{ success: boolean, message?: string, user?: object }}
     */
    async register(name, email, password) {
        // Check for duplicate email
        const existing = await this.getByEmail(email);
        if (existing) {
            return { success: false, message: 'An account with this email already exists. Please log in instead.' };
        }

        const passwordHash = await this.db.hash(password);
        const user = {
            id:           this.db.generateId('user'),
            name:         name,
            email:        email.toLowerCase().trim(),
            passwordHash: passwordHash,
            confirmed:    false,
            registeredAt: new Date().toISOString(),
            lastLoginAt:  null,
            phone:        '',
            company:      ''
        };

        await this.db.put(this.STORE, user);

        // Mirror to localStorage for backward compatibility
        this._syncToLocalStorage();

        return { success: true, user: user };
    }

    /* ── Authentication ────────────────────────────────────────────── */

    /**
     * Authenticate a user by email + password.
     * @returns {{ success: boolean, message?: string, user?: object }}
     */
    async login(email, password) {
        const user = await this.getByEmail(email);
        if (!user) {
            return { success: false, message: 'Invalid email or password.' };
        }

        const passwordHash = await this.db.hash(password);
        if (user.passwordHash !== passwordHash) {
            return { success: false, message: 'Invalid email or password.' };
        }

        if (!user.confirmed) {
            return {
                success: false,
                message: 'Please confirm your email address before logging in. Check your inbox for the confirmation email.'
            };
        }

        // Update last login
        user.lastLoginAt = new Date().toISOString();
        await this.db.put(this.STORE, user);

        return {
            success: true,
            user: {
                id:    user.id,
                name:  user.name,
                email: user.email,
                type:  'user'
            }
        };
    }

    /* ── Email Confirmation ────────────────────────────────────────── */

    /**
     * Mark a user's email as confirmed.
     * @param {string} email
     * @returns {boolean}
     */
    async confirmEmail(email) {
        const user = await this.getByEmail(email);
        if (!user) return false;
        user.confirmed = true;
        await this.db.put(this.STORE, user);
        this._syncToLocalStorage();
        return true;
    }

    /* ── Profile ───────────────────────────────────────────────────── */

    /**
     * Update profile fields for a user.
     * @param {string} userId
     * @param {{ name?, email?, phone?, company?, passwordHash? }} updates
     */
    async updateProfile(userId, updates) {
        const user = await this.db.get(this.STORE, userId);
        if (!user) return null;

        const allowed = ['name', 'email', 'phone', 'company', 'passwordHash'];
        for (const key of allowed) {
            if (updates[key] !== undefined) {
                user[key] = key === 'email' ? updates[key].toLowerCase().trim() : updates[key];
            }
        }
        user.updatedAt = new Date().toISOString();
        await this.db.put(this.STORE, user);
        this._syncToLocalStorage();
        return user;
    }

    /* ── Lookup ─────────────────────────────────────────────────────── */

    /** Get a user by their primary ID. */
    async getById(userId) {
        return this.db.get(this.STORE, userId);
    }

    /** Get a user by email (case-insensitive). */
    async getByEmail(email) {
        return this.db.getOneByIndex(this.STORE, 'email', email.toLowerCase().trim());
    }

    /** Get all registered users. */
    async getAll() {
        return this.db.getAll(this.STORE);
    }

    /* ── Deletion ──────────────────────────────────────────────────── */

    /**
     * Delete a user account and all related data (payments, purchases, subscription).
     * @param {string} userId
     */
    async deleteAccount(userId) {
        // Remove related records first
        await this.db.deleteByIndex('payments',  'userId', userId);
        await this.db.deleteByIndex('purchases', 'userId', userId);
        try { await this.db.delete('subscriptions', userId); } catch (_) { /* may not exist */ }
        // Remove user
        await this.db.delete(this.STORE, userId);
        this._syncToLocalStorage();
        return true;
    }

    /* ── localStorage backward-compat mirror ──────────────────────── */

    /**
     * Keep arc3d_users_db in localStorage in sync so any old code
     * that directly reads it still works during the migration period.
     */
    async _syncToLocalStorage() {
        try {
            const users = await this.getAll();
            const legacy = users.map(u => ({
                id:           u.id,
                name:         u.name,
                email:        u.email,
                passwordHash: u.passwordHash,
                confirmed:    u.confirmed,
                registeredAt: u.registeredAt
            }));
            localStorage.setItem('arc3d_users_db', JSON.stringify(legacy));
        } catch (_) { /* non-critical */ }
    }

    /* ── Data migration – one-time import from localStorage ────────── */

    /**
     * Import existing users from the legacy localStorage array (arc3d_users_db)
     * into IndexedDB, skipping any that already exist.
     */
    async migrateFromLocalStorage() {
        try {
            const raw = localStorage.getItem('arc3d_users_db');
            if (!raw) return;
            const legacy = JSON.parse(raw);
            if (!Array.isArray(legacy)) return;

            for (const u of legacy) {
                if (!u.email) continue;
                const exists = await this.getByEmail(u.email);
                if (exists) continue;

                await this.db.put(this.STORE, {
                    id:           u.id || this.db.generateId('user'),
                    name:         u.name || '',
                    email:        u.email.toLowerCase().trim(),
                    passwordHash: u.passwordHash || '',
                    confirmed:    !!u.confirmed,
                    registeredAt: u.registeredAt || new Date().toISOString(),
                    lastLoginAt:  null,
                    phone:        u.phone || '',
                    company:      u.company || '',
                    // Migrate payment data if present
                    _legacyPayment: u.paymentData || null,
                    _legacyPurchases: u.purchases || []
                });
            }
            console.log('[UserStore] Migrated', legacy.length, 'users from localStorage');
        } catch (e) {
            console.warn('[UserStore] Migration skipped:', e.message);
        }
    }
}

// ── Global singleton ───────────────────────────────────────────────
window.userStore = new UserStore(window.arc3dDB);
