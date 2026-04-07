/**
 * ARC3D™ Payment Store
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Handles saved payment methods (card / PayPal), purchase history,
 * and subscription plan state.  All data stored in the 'payments',
 * 'purchases', and 'subscriptions' object stores of ARC3D_UserDB.
 *
 * Depends on: db-manager.js (window.arc3dDB)
 */

'use strict';

class PaymentStore {
    constructor(db) {
        /** @type {ARC3DDatabase} */
        this.db = db;
    }

    /* ══════════════════════════════════════════════════════════════════
       SAVED PAYMENT METHODS  (store: 'payments')
       ══════════════════════════════════════════════════════════════════ */

    /**
     * Save a card payment method for a user.
     * Only the last 4 digits and a hashed cardholder name are stored.
     * Full card number and CVV are NEVER persisted.
     *
     * @param {string} userId
     * @param {{ cardName: string, lastFour: string, expiry: string }} details
     */
    async saveCard(userId, details) {
        const nameHash = await this.db.hash(details.cardName);
        const record = {
            id:          this.db.generateId('pay'),
            userId:      userId,
            method:      'card',
            nameHash:    nameHash,
            nameDisplay: this._maskName(details.cardName),
            lastFour:    details.lastFour,
            expiry:      details.expiry,
            savedAt:     new Date().toISOString(),
            isDefault:   true
        };

        // Un-default any other saved methods for this user
        await this._clearDefaultForUser(userId);
        await this.db.put('payments', record);
        this._syncPaymentToLocalStorage(userId, record);
        return record;
    }

    /**
     * Save a PayPal payment method for a user.
     * @param {string} userId
     * @param {string} paypalEmail
     */
    async savePayPal(userId, paypalEmail) {
        const record = {
            id:          this.db.generateId('pay'),
            userId:      userId,
            method:      'paypal',
            paypalEmail: paypalEmail,
            savedAt:     new Date().toISOString(),
            isDefault:   true
        };

        await this._clearDefaultForUser(userId);
        await this.db.put('payments', record);
        this._syncPaymentToLocalStorage(userId, record);
        return record;
    }

    /**
     * Get all saved payment methods for a user.
     * @param {string} userId
     */
    async getPaymentMethods(userId) {
        return this.db.getByIndex('payments', 'userId', userId);
    }

    /**
     * Get the default payment method for a user.
     * @param {string} userId
     */
    async getDefaultPayment(userId) {
        const methods = await this.getPaymentMethods(userId);
        return methods.find(m => m.isDefault) || methods[0] || null;
    }

    /**
     * Delete a saved payment method.
     * @param {string} paymentId
     */
    async deletePaymentMethod(paymentId) {
        return this.db.delete('payments', paymentId);
    }

    /** Clear the isDefault flag on all methods for a user. */
    async _clearDefaultForUser(userId) {
        const methods = await this.getPaymentMethods(userId);
        for (const m of methods) {
            if (m.isDefault) {
                m.isDefault = false;
                await this.db.put('payments', m);
            }
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       PURCHASE HISTORY  (store: 'purchases')
       ══════════════════════════════════════════════════════════════════ */

    /**
     * Record a new purchase transaction.
     * @param {string} userId
     * @param {{ plan: string, amount: number, currency?: string, method: string, lastFour?: string }} details
     * @returns {object} The saved purchase record.
     */
    async addPurchase(userId, details) {
        const record = {
            id:            this.db.generateId('txn'),
            userId:        userId,
            plan:          details.plan,
            amount:        details.amount,
            currency:      details.currency || 'GBP',
            method:        details.method,
            lastFour:      details.lastFour || null,
            purchasedAt:   new Date().toISOString(),
            transactionId: this._generateTransactionId(details.method),
            status:        details.amount > 0 ? 'completed' : 'free_beta'
        };

        await this.db.put('purchases', record);
        this._syncPurchasesToLocalStorage(userId);
        return record;
    }

    /**
     * Get all purchases for a user, sorted newest-first.
     * @param {string} userId
     */
    async getPurchases(userId) {
        const records = await this.db.getByIndex('purchases', 'userId', userId);
        return records.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    }

    /**
     * Get a single purchase by its record ID.
     * @param {string} purchaseId
     */
    async getPurchase(purchaseId) {
        return this.db.get('purchases', purchaseId);
    }

    /* ══════════════════════════════════════════════════════════════════
       SUBSCRIPTION / PLAN STATE  (store: 'subscriptions')
       ══════════════════════════════════════════════════════════════════ */

    /**
     * Get the user's current subscription/plan.
     * @param {string} userId
     */
    async getSubscription(userId) {
        return this.db.get('subscriptions', userId);
    }

    /**
     * Create or update the user's subscription plan.
     * @param {string} userId
     * @param {{ plan: string, status: string, method?: string, lastFour?: string, transactionId?: string, freeUntil?: string }} details
     */
    async setSubscription(userId, details) {
        const existing = await this.getSubscription(userId) || {};
        const record = {
            ...existing,
            userId:        userId,
            plan:          details.plan,
            status:        details.status,
            subscribedAt:  details.subscribedAt || new Date().toISOString(),
            method:        details.method   || existing.method  || null,
            lastFour:      details.lastFour || existing.lastFour || null,
            transactionId: details.transactionId || existing.transactionId || null,
            freeUntil:     details.freeUntil || existing.freeUntil || null,
            updatedAt:     new Date().toISOString()
        };

        await this.db.put('subscriptions', record);

        // Mirror to localStorage for backward compat
        try {
            localStorage.setItem('arc3d_subscription', JSON.stringify(record));
        } catch (_) { /* non-critical */ }

        return record;
    }

    /**
     * Cancel a user's subscription (mark as cancelled).
     * @param {string} userId
     */
    async cancelSubscription(userId) {
        const sub = await this.getSubscription(userId);
        if (!sub) return null;
        sub.status    = 'cancelled';
        sub.updatedAt = new Date().toISOString();
        await this.db.put('subscriptions', sub);
        try { localStorage.setItem('arc3d_subscription', JSON.stringify(sub)); } catch (_) {}
        return sub;
    }

    /* ══════════════════════════════════════════════════════════════════
       DATA MIGRATION  (one-time import from localStorage)
       ══════════════════════════════════════════════════════════════════ */

    /**
     * Migrate payment data and purchases from the legacy localStorage
     * arc3d_users_db entries that were tagged during user migration.
     */
    async migrateFromLocalStorage() {
        try {
            const users = await this.db.getAll('users');
            for (const user of users) {
                // Migrate legacy payment data
                if (user._legacyPayment) {
                    const pay = user._legacyPayment;
                    if (pay.method === 'paypal') {
                        await this.savePayPal(user.id, pay.paypalEmail || user.email);
                    } else if (pay.lastFour) {
                        await this.db.put('payments', {
                            id:          this.db.generateId('pay'),
                            userId:      user.id,
                            method:      'card',
                            nameHash:    pay.nameHash || '',
                            nameDisplay: pay.nameDisplay || '',
                            lastFour:    pay.lastFour,
                            expiry:      pay.expiry || '',
                            savedAt:     pay.savedAt || new Date().toISOString(),
                            isDefault:   true
                        });
                    }
                    delete user._legacyPayment;
                    await this.db.put('users', user);
                }

                // Migrate legacy purchases
                if (user._legacyPurchases && user._legacyPurchases.length > 0) {
                    for (const p of user._legacyPurchases) {
                        await this.db.put('purchases', {
                            id:            p.transactionId || this.db.generateId('txn'),
                            userId:        user.id,
                            plan:          p.plan || 'Unknown',
                            amount:        p.amount || 0,
                            currency:      p.currency || 'GBP',
                            method:        p.method || 'card',
                            lastFour:      p.lastFour || null,
                            purchasedAt:   p.purchasedAt || new Date().toISOString(),
                            transactionId: p.transactionId || this.db.generateId('txn'),
                            status:        'completed'
                        });
                    }
                    delete user._legacyPurchases;
                    await this.db.put('users', user);
                }
            }

            // Migrate arc3d_subscription from localStorage
            const subRaw = localStorage.getItem('arc3d_subscription');
            const session = JSON.parse(localStorage.getItem('userSession') || 'null');
            if (subRaw && session) {
                const sub  = JSON.parse(subRaw);
                const user = await window.userStore?.getByEmail(session.email);
                if (user && sub.plan) {
                    const existing = await this.getSubscription(user.id);
                    if (!existing) {
                        await this.setSubscription(user.id, {
                            plan:          sub.plan,
                            status:        sub.status || 'pending',
                            method:        sub.method || null,
                            lastFour:      sub.lastFour || null,
                            transactionId: sub.transactionId || null,
                            subscribedAt:  sub.subscribedAt || new Date().toISOString()
                        });
                    }
                }
            }

            console.log('[PaymentStore] Migration complete');
        } catch (e) {
            console.warn('[PaymentStore] Migration skipped:', e.message);
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       INTERNAL HELPERS
       ══════════════════════════════════════════════════════════════════ */

    /** Mask a cardholder name: "John Smith" → "J*** S***" */
    _maskName(name) {
        return name.split(' ').map(part =>
            part.charAt(0).toUpperCase() + '***'
        ).join(' ');
    }

    /** Generate a human-readable transaction ID. */
    _generateTransactionId(method) {
        const prefix = method === 'paypal' ? 'PP' : 'TXN';
        const ts     = Date.now();
        const rand   = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}_${ts}_${rand}`;
    }

    /** Keep legacy localStorage in sync for backward compat. */
    async _syncPaymentToLocalStorage(userId, record) {
        try {
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            const user  = users.find(u => u.id === userId);
            if (user) {
                user.paymentData = record;
                localStorage.setItem('arc3d_users_db', JSON.stringify(users));
            }
        } catch (_) { /* non-critical */ }
    }

    /** Sync purchases to legacy localStorage. */
    async _syncPurchasesToLocalStorage(userId) {
        try {
            const purchases = await this.getPurchases(userId);
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            const user  = users.find(u => u.id === userId);
            if (user) {
                user.purchases = purchases.map(p => ({
                    plan:          p.plan,
                    amount:        p.amount,
                    currency:      p.currency,
                    method:        p.method,
                    lastFour:      p.lastFour,
                    purchasedAt:   p.purchasedAt,
                    transactionId: p.transactionId
                }));
                localStorage.setItem('arc3d_users_db', JSON.stringify(users));
            }
        } catch (_) { /* non-critical */ }
    }
}

// ── Global singleton ───────────────────────────────────────────────
window.paymentStore = new PaymentStore(window.arc3dDB);
