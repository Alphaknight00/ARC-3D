/**
 * ARC3D™ Database Initialiser
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Runs after all database modules are loaded.
 * – Waits for IndexedDB to open
 * – Migrates legacy localStorage data on first run
 * – Exposes convenience wrappers that the homepage JS calls
 * – Routes through Cloud API when server is online, falls back to local DB
 *
 * Load order:  db-manager.js → user-store.js → payment-store.js → db-init.js → api-client.js
 */

'use strict';

(async function initDatabase() {
    const db           = window.arc3dDB;
    const userStore    = window.userStore;
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

    /* Helper: get the cloud API if it's online */
    function cloud() {
        return (window.cloudAPI && window.cloudAPI.online) ? window.cloudAPI : null;
    }

    /* ══════════════════════════════════════════════════════════════════
       BACKWARD-COMPATIBLE WRAPPERS
       Cloud API → Local IndexedDB → localStorage  (triple fallback)
       ══════════════════════════════════════════════════════════════════ */

    window.getUsersDB = async function () {
        try { return await userStore.getAll(); }
        catch (_) { return JSON.parse(localStorage.getItem('arc3d_users_db') || '[]'); }
    };

    window.saveUsersDB = async function (users) {
        try { for (const u of users) await db.put('users', u); }
        catch (_) {}
        localStorage.setItem('arc3d_users_db', JSON.stringify(users));
    };

    window.hashPassword = function (password) {
        return db.hash(password);
    };

    /**
     * simulateLogin — Cloud → Local IndexedDB → localStorage
     */
    window.simulateLogin = async function (email, password) {
        // 1) Try cloud server
        const api = cloud();
        if (api) {
            const result = await api.login(email, password);
            if (result.success) {
                // Also cache in local IndexedDB so offline works
                try { await userStore.migrateFromLocalStorage(); } catch (_) {}
            }
            return result;
        }
        // 2) Local IndexedDB
        try { return await userStore.login(email, password); }
        catch (_) {}
        // 3) Legacy localStorage
        const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
        const user  = users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
        if (!user) return { success: false, message: 'Invalid email or password.' };
        const hash = await db.hash(password);
        if (user.passwordHash !== hash) return { success: false, message: 'Invalid email or password.' };
        if (!user.confirmed) return { success: false, message: 'Please confirm your email address.' };
        return { success: true, user: { id: user.id, name: user.name, email: user.email, type: 'user' } };
    };

    /**
     * simulateRegister — Cloud → Local IndexedDB → localStorage
     */
    window.simulateRegister = async function (name, email, password) {
        // 1) Try cloud server
        const api = cloud();
        if (api) {
            const result = await api.register(name, email, password);
            if (result.success) {
                // Mirror to local DB
                try { await userStore.register(name, email, password); } catch (_) {}
            }
            return result;
        }
        // 2) Local IndexedDB
        try { return await userStore.register(name, email, password); }
        catch (_) {}
        // 3) Legacy localStorage
        const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
        if (users.find(u => u.email?.toLowerCase() === email?.toLowerCase())) {
            return { success: false, message: 'An account with this email already exists.' };
        }
        const hash = await db.hash(password);
        users.push({ id: 'user_' + Date.now(), name, email, passwordHash: hash, confirmed: true, registeredAt: new Date().toISOString() });
        localStorage.setItem('arc3d_users_db', JSON.stringify(users));
        return { success: true };
    };

    /**
     * simulateForgotPassword — Cloud only (no local reset)
     */
    window.simulateForgotPassword = async function (email) {
        const api = cloud();
        if (api) {
            return await api.forgotPassword(email);
        }
        return { success: false, message: 'Password reset requires a server connection. Please try again later.' };
    };

    /**
     * simulateResetPassword — Cloud only (no local reset)
     */
    window.simulateResetPassword = async function (email, token, newPassword) {
        const api = cloud();
        if (api) {
            return await api.resetPassword(email, token, newPassword);
        }
        return { success: false, message: 'Password reset requires a server connection. Please try again later.' };
    };

    /**
     * getUserPaymentData — Cloud → Local IndexedDB → localStorage
     */
    window.getUserPaymentData = async function (email) {
        // 1) Cloud
        const api = cloud();
        if (api) {
            const methods = await api.getPaymentMethods();
            return methods.find(m => m.isDefault) || methods[0] || null;
        }
        // 2) Local IndexedDB
        try {
            const user = await userStore.getByEmail(email);
            if (!user) return null;
            return await paymentStore.getDefaultPayment(user.id);
        } catch (_) {}
        // 3) Legacy
        const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
        const u = users.find(x => x.email?.toLowerCase() === email?.toLowerCase());
        return u ? (u.paymentData || null) : null;
    };

    /**
     * saveUserPaymentData — Cloud → Local IndexedDB → localStorage
     */
    window.saveUserPaymentData = async function (email, paymentData) {
        // 1) Cloud
        const api = cloud();
        if (api) {
            await api.savePaymentMethod({
                method:      paymentData.method || 'card',
                nameDisplay: paymentData.nameDisplay || '',
                lastFour:    paymentData.lastFour || '',
                expiry:      paymentData.expiry || '',
                paypalEmail: paymentData.paypalEmail || ''
            });
        }
        // 2) Local IndexedDB
        try {
            const user = await userStore.getByEmail(email);
            if (user) {
                if (paymentData.method === 'paypal') {
                    await paymentStore.savePayPal(user.id, paymentData.paypalEmail || email);
                } else {
                    await paymentStore.saveCard(user.id, {
                        cardName: paymentData.nameDisplay || '',
                        lastFour: paymentData.lastFour || '',
                        expiry:   paymentData.expiry || ''
                    });
                }
            }
        } catch (_) {
            // 3) Legacy
            const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
            const u = users.find(x => x.email?.toLowerCase() === email?.toLowerCase());
            if (u) { u.paymentData = paymentData; localStorage.setItem('arc3d_users_db', JSON.stringify(users)); }
        }
    };

    /**
     * getUserPurchases — Cloud → Local IndexedDB → localStorage
     */
    window.getUserPurchases = async function (email) {
        // 1) Cloud
        const api = cloud();
        if (api) {
            const purchases = await api.getPurchases();
            if (purchases.length > 0) return purchases;
        }
        // 2) Local IndexedDB
        try {
            const user = await userStore.getByEmail(email);
            if (user) return await paymentStore.getPurchases(user.id);
        } catch (_) {}
        // 3) Legacy
        const users = JSON.parse(localStorage.getItem('arc3d_users_db') || '[]');
        const u = users.find(x => x.email?.toLowerCase() === email?.toLowerCase());
        return u ? (u.purchases || []) : [];
    };

    /**
     * addUserPurchase — Cloud → Local IndexedDB → localStorage
     */
    window.addUserPurchase = async function (email, purchase) {
        // 1) Cloud
        const api = cloud();
        if (api) {
            await api.addPurchase(purchase);
        }
        // 2) Local IndexedDB
        try {
            const user = await userStore.getByEmail(email);
            if (user) await paymentStore.addPurchase(user.id, purchase);
        } catch (_) {
            // 3) Legacy
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
     * encryptCardData – mirrors the old function signature.
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
