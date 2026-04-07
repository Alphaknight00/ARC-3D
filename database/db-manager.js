/**
 * ARC3D™ Database Manager
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Core IndexedDB manager that initialises the ARC3D_UserDB database
 * and provides shared helpers for all stores (users, payments, purchases, subscriptions).
 * This file must be loaded BEFORE user-store.js and payment-store.js.
 */

'use strict';

class ARC3DDatabase {
    constructor() {
        this.DB_NAME    = 'ARC3D_UserDB';
        this.DB_VERSION = 1;
        this.db         = null;
        this.isReady    = false;
        this._readyPromise = this._open();
    }

    /* ── Open / Upgrade ─────────────────────────────────────────────── */

    _open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;

                // ── users ──
                if (!db.objectStoreNames.contains('users')) {
                    const users = db.createObjectStore('users', { keyPath: 'id' });
                    users.createIndex('email',        'email',        { unique: true });
                    users.createIndex('registeredAt', 'registeredAt', { unique: false });
                }

                // ── payments (saved card / PayPal details per user) ──
                if (!db.objectStoreNames.contains('payments')) {
                    const payments = db.createObjectStore('payments', { keyPath: 'id' });
                    payments.createIndex('userId', 'userId', { unique: false });
                }

                // ── purchases (transaction history) ──
                if (!db.objectStoreNames.contains('purchases')) {
                    const purchases = db.createObjectStore('purchases', { keyPath: 'id' });
                    purchases.createIndex('userId',      'userId',      { unique: false });
                    purchases.createIndex('purchasedAt', 'purchasedAt', { unique: false });
                }

                // ── subscriptions (one active plan per user) ──
                if (!db.objectStoreNames.contains('subscriptions')) {
                    const subs = db.createObjectStore('subscriptions', { keyPath: 'userId' });
                    subs.createIndex('plan',   'plan',   { unique: false });
                    subs.createIndex('status', 'status', { unique: false });
                }
            };

            req.onsuccess = (e) => {
                this.db      = e.target.result;
                this.isReady = true;
                console.log('[ARC3DDatabase] Ready — stores:', Array.from(this.db.objectStoreNames));
                resolve();
            };

            req.onerror = (e) => {
                console.error('[ARC3DDatabase] Failed to open:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    /** Wait until the database connection is established. */
    async waitForReady(timeout = 5000) {
        if (this.isReady) return;
        const timer = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('ARC3DDatabase open timeout')), timeout)
        );
        return Promise.race([this._readyPromise, timer]);
    }

    /* ── Generic CRUD helpers ──────────────────────────────────────── */

    /** Get a single record by key from a store. */
    async get(storeName, key) {
        await this.waitForReady();
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror   = () => reject(req.error);
        });
    }

    /** Get all records from a store. */
    async getAll(storeName) {
        await this.waitForReady();
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror   = () => reject(req.error);
        });
    }

    /** Get records by index value. */
    async getByIndex(storeName, indexName, value) {
        await this.waitForReady();
        return new Promise((resolve, reject) => {
            const tx    = this.db.transaction(storeName, 'readonly');
            const index = tx.objectStore(storeName).index(indexName);
            const req   = index.getAll(value);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror   = () => reject(req.error);
        });
    }

    /** Get a single record by index (first match). */
    async getOneByIndex(storeName, indexName, value) {
        await this.waitForReady();
        return new Promise((resolve, reject) => {
            const tx    = this.db.transaction(storeName, 'readonly');
            const index = tx.objectStore(storeName).index(indexName);
            const req   = index.get(value);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror   = () => reject(req.error);
        });
    }

    /** Put (insert / update) a record. */
    async put(storeName, record) {
        await this.waitForReady();
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).put(record);
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    }

    /** Delete a record by key. */
    async delete(storeName, key) {
        await this.waitForReady();
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => reject(req.error);
        });
    }

    /** Delete all records matching an index value (e.g. all of a user's purchases). */
    async deleteByIndex(storeName, indexName, value) {
        await this.waitForReady();
        return new Promise((resolve, reject) => {
            const tx    = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const req   = index.openCursor(IDBKeyRange.only(value));
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { cursor.delete(); cursor.continue(); }
            };
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => reject(tx.error);
        });
    }

    /** Clear an entire store. */
    async clearStore(storeName) {
        await this.waitForReady();
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).clear();
            req.onsuccess = () => resolve(true);
            req.onerror   = () => reject(req.error);
        });
    }

    /* ── Utility ───────────────────────────────────────────────────── */

    /** Generate a unique ID. */
    generateId(prefix = 'rec') {
        const ts   = Date.now().toString(36);
        const rand = Math.random().toString(36).substring(2, 10);
        return `${prefix}_${ts}_${rand}`;
    }

    /** SHA-256 hash helper (used for password hashing). */
    async hash(text) {
        const data   = new TextEncoder().encode(text);
        const buffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

// ── Global singleton ───────────────────────────────────────────────
window.arc3dDB = new ARC3DDatabase();
