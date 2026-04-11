/**
 * ARC3D™ — Cloud API Client
 * Copyright © 2026 HSAN Studios. All Rights Reserved.
 *
 * Browser-side HTTP client that talks to the ARC3D Database Server.
 * Falls back to local IndexedDB when the server is unreachable.
 *
 * Load this AFTER db-init.js so local fallbacks are available.
 */

'use strict';

class ARC3DCloudAPI {
    constructor() {
        // Server URL — change when deploying to production
        this.baseUrl = this._detectBaseUrl();
        this.token   = localStorage.getItem('arc3d_auth_token') || null;
        this.online  = false;

        // Probe server on init
        this._checkConnection();
    }

    /* ══════════════════════════════════════════════════════════════════
       CONNECTION
       ══════════════════════════════════════════════════════════════════ */

    _detectBaseUrl() {
        // Check if a custom server URL is saved
        const saved = localStorage.getItem('arc3d_server_url');
        if (saved) return saved.replace(/\/+$/, '');
        // Production: when hosted on GitHub Pages, use the deployed server
        if (window.location.hostname === 'alphaknight00.github.io') {
            return 'https://arc3d-server.onrender.com';
        }
        // Default to localhost for development
        return 'http://localhost:3000';
    }

    async _checkConnection() {
        try {
            const res = await fetch(this.baseUrl + '/api/health', {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            this.online = res.ok;
        } catch (_) {
            this.online = false;
        }
        console.log('[CloudAPI] Server', this.online ? 'ONLINE' : 'OFFLINE (using local DB)');
        return this.online;
    }

    /* ══════════════════════════════════════════════════════════════════
       HTTP HELPERS
       ══════════════════════════════════════════════════════════════════ */

    async _request(method, path, body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = 'Bearer ' + this.token;
        }

        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);

        const res  = await fetch(this.baseUrl + path, opts);
        const data = await res.json();

        if (!res.ok) {
            const err   = new Error(data.message || 'Request failed');
            err.status  = res.status;
            err.data    = data;
            throw err;
        }
        return data;
    }

    _saveToken(token) {
        this.token = token;
        localStorage.setItem('arc3d_auth_token', token);
    }

    _clearToken() {
        this.token = null;
        localStorage.removeItem('arc3d_auth_token');
    }

    /* ══════════════════════════════════════════════════════════════════
       AUTH — Register / Login / Profile
       ══════════════════════════════════════════════════════════════════ */

    /**
     * Register a new user.
     * @returns {{ success, message?, token?, user? }}
     */
    async register(name, email, password) {
        if (!this.online) return this._localFallback('register', arguments);
        try {
            const data = await this._request('POST', '/api/auth/register', { name, email, password });
            if (data.token) this._saveToken(data.token);
            return { success: true, user: data.user };
        } catch (err) {
            return { success: false, message: err.data?.message || err.message };
        }
    }

    /**
     * Log in with email + password.
     * @returns {{ success, message?, token?, user? }}
     */
    async login(email, password) {
        if (!this.online) return this._localFallback('login', arguments);
        try {
            const data = await this._request('POST', '/api/auth/login', { email, password });
            if (data.token) this._saveToken(data.token);
            return { success: true, user: data.user };
        } catch (err) {
            return { success: false, message: err.data?.message || err.message };
        }
    }

    /**
     * Confirm email address.
     */
    async confirmEmail(email) {
        if (!this.online) return this._localFallback('confirmEmail', arguments);
        try {
            await this._request('POST', '/api/auth/confirm', { email });
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Get current logged-in user profile.
     */
    async getProfile() {
        if (!this.online || !this.token) return null;
        try {
            const data = await this._request('GET', '/api/auth/me');
            return data.user;
        } catch (_) {
            return null;
        }
    }

    /**
     * Update user profile fields.
     */
    async updateProfile(updates) {
        if (!this.online || !this.token) return null;
        try {
            const data = await this._request('PUT', '/api/auth/profile', updates);
            return data.user;
        } catch (_) {
            return null;
        }
    }

    /**
     * Change password.
     */
    async changePassword(currentPassword, newPassword) {
        if (!this.online || !this.token) return { success: false, message: 'Server offline.' };
        try {
            await this._request('PUT', '/api/auth/password', { currentPassword, newPassword });
            return { success: true };
        } catch (err) {
            return { success: false, message: err.data?.message || err.message };
        }
    }

    /**
     * Request a password reset code.
     */
    async forgotPassword(email) {
        if (!this.online) return { success: false, message: 'Server offline. Cannot reset password.' };
        try {
            const data = await this._request('POST', '/api/auth/forgot-password', { email });
            return { success: true, message: data.message };
        } catch (err) {
            return { success: false, message: err.data?.message || err.message };
        }
    }

    /**
     * Reset password using the 6-digit code.
     */
    async resetPassword(email, token, newPassword) {
        if (!this.online) return { success: false, message: 'Server offline. Cannot reset password.' };
        try {
            const data = await this._request('POST', '/api/auth/reset-password', { email, token, newPassword });
            return { success: true, message: data.message };
        } catch (err) {
            return { success: false, message: err.data?.message || err.message };
        }
    }

    /**
     * Delete account and all associated data.
     */
    async deleteAccount() {
        if (!this.online || !this.token) return false;
        try {
            await this._request('DELETE', '/api/auth/account');
            this._clearToken();
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Logout (client-side only — clears token).
     */
    logout() {
        this._clearToken();
    }

    /* ══════════════════════════════════════════════════════════════════
       PAYMENTS
       ══════════════════════════════════════════════════════════════════ */

    async savePaymentMethod(methodData) {
        if (!this.online || !this.token) return null;
        try {
            const data = await this._request('POST', '/api/payments/method', methodData);
            return data.payment;
        } catch (_) {
            return null;
        }
    }

    async getPaymentMethods() {
        if (!this.online || !this.token) return [];
        try {
            const data = await this._request('GET', '/api/payments/methods');
            return data.payments || [];
        } catch (_) {
            return [];
        }
    }

    async deletePaymentMethod(paymentId) {
        if (!this.online || !this.token) return false;
        try {
            await this._request('DELETE', '/api/payments/method/' + paymentId);
            return true;
        } catch (_) {
            return false;
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       PURCHASES
       ══════════════════════════════════════════════════════════════════ */

    async addPurchase(purchaseData) {
        if (!this.online || !this.token) return null;
        try {
            const data = await this._request('POST', '/api/payments/purchase', purchaseData);
            return data.purchase;
        } catch (_) {
            return null;
        }
    }

    async getPurchases() {
        if (!this.online || !this.token) return [];
        try {
            const data = await this._request('GET', '/api/payments/purchases');
            return data.purchases || [];
        } catch (_) {
            return [];
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       SUBSCRIPTION
       ══════════════════════════════════════════════════════════════════ */

    async getSubscription() {
        if (!this.online || !this.token) return null;
        try {
            const data = await this._request('GET', '/api/payments/subscription');
            return data.subscription;
        } catch (_) {
            return null;
        }
    }

    async setSubscription(subData) {
        if (!this.online || !this.token) return null;
        try {
            const data = await this._request('PUT', '/api/payments/subscription', subData);
            return data.subscription;
        } catch (_) {
            return null;
        }
    }

    /* ══════════════════════════════════════════════════════════════════
       PROJECTS — Cloud file storage
       ══════════════════════════════════════════════════════════════════ */

    /**
     * List all projects for the logged-in user (summaries, no heavy data).
     * @param {Object} [filter] - { type, favorite, search }
     */
    async listProjects(filter = {}) {
        if (!this.online || !this.token) return null;
        try {
            const params = new URLSearchParams();
            if (filter.type)     params.set('type', filter.type);
            if (filter.favorite) params.set('favorite', 'true');
            if (filter.search)   params.set('search', filter.search);
            const qs = params.toString();
            return await this._request('GET', '/api/projects' + (qs ? '?' + qs : ''));
        } catch (_) { return null; }
    }

    /**
     * Load a single project with full data.
     * @param {string} projectId
     */
    async loadProject(projectId) {
        if (!this.online || !this.token) return null;
        try {
            return await this._request('GET', '/api/projects/' + projectId);
        } catch (_) { return null; }
    }

    /**
     * Save a new project to the cloud.
     * @param {Object} project - { name, description, address, contact, type, tags, data, thumbnail, objectCount, isPublic, appVersion }
     */
    async createProject(project) {
        if (!this.online || !this.token) return null;
        try {
            return await this._request('POST', '/api/projects', project);
        } catch (_) { return null; }
    }

    /**
     * Update an existing project (full or partial update).
     * @param {string} projectId
     * @param {Object} updates - any subset of project fields
     */
    async updateProject(projectId, updates) {
        if (!this.online || !this.token) return null;
        try {
            return await this._request('PUT', '/api/projects/' + projectId, updates);
        } catch (_) { return null; }
    }

    /**
     * Delete a project.
     * @param {string} projectId
     */
    async deleteProject(projectId) {
        if (!this.online || !this.token) return null;
        try {
            return await this._request('DELETE', '/api/projects/' + projectId);
        } catch (_) { return null; }
    }

    /**
     * Toggle favorite status on a project.
     * @param {string} projectId
     */
    async toggleFavorite(projectId) {
        if (!this.online || !this.token) return null;
        try {
            return await this._request('PATCH', '/api/projects/' + projectId + '/favorite');
        } catch (_) { return null; }
    }

    /**
     * Duplicate a project on the server.
     * @param {string} projectId
     */
    async duplicateProject(projectId) {
        if (!this.online || !this.token) return null;
        try {
            return await this._request('POST', '/api/projects/' + projectId + '/duplicate');
        } catch (_) { return null; }
    }

    /* ══════════════════════════════════════════════════════════════════
       LOCAL FALLBACK — delegates to IndexedDB when server is down
       ══════════════════════════════════════════════════════════════════ */

    async _localFallback(method, args) {
        console.warn('[CloudAPI] Server offline — falling back to local DB for:', method);
        switch (method) {
            case 'register':
                if (window.simulateRegister) return window.simulateRegister(args[0], args[1], args[2]);
                return { success: false, message: 'Server unavailable and local fallback not loaded.' };
            case 'login':
                if (window.simulateLogin) return window.simulateLogin(args[0], args[1]);
                return { success: false, message: 'Server unavailable and local fallback not loaded.' };
            case 'confirmEmail':
                if (window.userStore) return window.userStore.confirmEmail(args[0]);
                return false;
            default:
                return null;
        }
    }
}

// ── Global singleton ───────────────────────────────────────────────
window.cloudAPI = new ARC3DCloudAPI();
