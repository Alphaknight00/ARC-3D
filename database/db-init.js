/**
 * ARC3D™ Database Initialiser
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Runs after all database modules are loaded.
 * – Waits for IndexedDB to open
 * – Migrates legacy localStorage data on first run
 * – Exposes convenience wrappers that the homepage JS calls
 *
 * Load order:  db-manager.js → user-store.js → payment-store.js → db-init.js
 */

'use strict';

(async function initDatabase() {
    const db          = window.arc3dDB;
    const userStore   = window.userStore;
    const paymentStore = window.paymentStore;

    try {
        await db.waitForReady();

        // ── One-time migration from localStorage → IndexedDB ─────────
        const migrated = localStorage.getItem('arc3d_db_migrated');
        if (!migrated) {
            await userStore.migrateFromLocalStorage();
            await paymentStore.migrateFromLocalStorage();
            localStorage.setItem('arc3d_db_migrated', new Date().toISOString());
            console.log('[db-init] One-time migration complete');
        }

        console.log('[db-init] ARC3D™ database ready');
    } catch (e) {
        console.error('[db-init] Database initialisation failed:', e);
    }

    /* ══════════════════════════════════════════════════════════════════
       BACKWARD-COMPATIBLE WRAPPERS
       These replace the old localStorage-only functions that the
       homepage JS calls, bridging them to the new IndexedDB stores.
       ══════════════════════════════════════════════════════════════════ */

    /**
     * getUsersDB() – returns the full users array (legacy format).
     * Old code calls this directly; we proxy it to IndexedDB.
     */
    window.getUsersDB = async function () {
        try {
            return await userStore.getAll();
        } catch (_) {
            return JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
        }
    };

    /**
     * saveUsersDB() – writes users array (legacy format).
     * Kept for backward compat; prefer userStore methods directly.
     */
    window.saveUsersDB = async function (users) {
        try {
            for (const u of users) {
                await db.put('users', u);
            }
        } catch (_) { /* fallback handled in caller */ }
        localStorage.setItem('arc3d_users_db', JSON.stringify(users));
    };

    /**
     * hashPassword() – SHA-256 hash (already existed, now delegates to db-manager).
     */
    window.hashPassword = function (password) {
        return db.hash(password);
    };

    /**
     * getUserPaymentData() – returns the default payment method for a user.
     */
    window.getUserPaymentData = async function (email) {
        try {
            const user = await userStore.getByEmail(email);
            if (!user) return null;
            return await paymentStore.getDefaultPayment(user.id);
        } catch (_) {
            // Fallback to legacy
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            const u = users.find(x => x.email?.toLowerCase() === email?.toLowerCase());
            return u ? (u.paymentData || null) : null;
        }
    };

    /**
     * saveUserPaymentData() – persist a payment method for a user.
     */
    window.saveUserPaymentData = async function (email, paymentData) {
        try {
            const user = await userStore.getByEmail(email);
            if (!user) return;
            if (paymentData.method === 'paypal') {
                await paymentStore.savePayPal(user.id, paymentData.paypalEmail || email);
            } else {
                await paymentStore.saveCard(user.id, {
                    cardName: paymentData.nameDisplay || '',
                    lastFour: paymentData.lastFour || '',
                    expiry:   paymentData.expiry || ''
                });
            }
        } catch (_) {
            // Fallback: mirror to legacy localStorage
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            const u = users.find(x => x.email?.toLowerCase() === email?.toLowerCase());
            if (u) { u.paymentData = paymentData; localStorage.setItem('arc3d_users_db', JSON.stringify(users)); }
        }
    };

    /**
     * getUserPurchases() – returns purchase history for a user.
     */
    window.getUserPurchases = async function (email) {
        try {
            const user = await userStore.getByEmail(email);
            if (!user) return [];
            return await paymentStore.getPurchases(user.id);
        } catch (_) {
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            const u = users.find(x => x.email?.toLowerCase() === email?.toLowerCase());
            return u ? (u.purchases || []) : [];
        }
    };

    /**
     * addUserPurchase() – record a new purchase.
     */
    window.addUserPurchase = async function (email, purchase) {
        try {
            const user = await userStore.getByEmail(email);
            if (!user) return;
            await paymentStore.addPurchase(user.id, purchase);
        } catch (_) {
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            const u = users.find(x => x.email?.toLowerCase() === email?.toLowerCase());
            if (u) {
                if (!u.purchases) u.purchases = [];
                u.purchases.push(purchase);
                localStorage.setItem('arc3d_users_db', JSON.stringify(users));
            }
        }
    };

    /**
     * simulateLogin() – authenticate a user.
     */
    window.simulateLogin = async function (email, password) {
        try {
            return await userStore.login(email, password);
        } catch (_) {
            // Fallback to inline legacy
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            const user  = users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
            if (!user) return { success: false, message: 'Invalid email or password.' };
            const hash = await db.hash(password);
            if (user.passwordHash !== hash) return { success: false, message: 'Invalid email or password.' };
            if (!user.confirmed) return { success: false, message: 'Please confirm your email address.' };
            return { success: true, user: { id: user.id, name: user.name, email: user.email, type: 'user' } };
        }
    };

    /**
     * simulateRegister() – register a new user.
     */
    window.simulateRegister = async function (name, email, password) {
        try {
            const result = await userStore.register(name, email, password);
            return result;
        } catch (_) {
            // Fallback to inline legacy
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            if (users.find(u => u.email?.toLowerCase() === email?.toLowerCase())) {
                return { success: false, message: 'An account with this email already exists.' };
            }
            const hash = await db.hash(password);
            users.push({ id: 'user_' + Date.now(), name, email, passwordHash: hash, confirmed: false, registeredAt: new Date().toISOString() });
            localStorage.setItem('arc3d_users_db', JSON.stringify(users));
            return { success: true };
        }
    };

    /**
     * encryptCardData() – mirrors the old function signature.
     */
    window.encryptCardData = async function (cardName, lastFour, expiry, method) {
        const nameHash = await db.hash(cardName);
        return {
            nameHash:    nameHash,
            nameDisplay: cardName.split(' ').map(p => p.charAt(0).toUpperCase() + '***').join(' '),
            lastFour:    lastFour,
            expiry:      expiry,
            method:      method || 'card',
            savedAt:     new Date().toISOString()
        };
    };

})();
