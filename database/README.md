# ARC3D™ Database System

**Copyright © 2026 HSAN Studios. All Rights Reserved.**

## Overview

This folder contains the client-side IndexedDB database system that stores user accounts, payment details, purchase history, and subscription plans for the ARC3D™ homepage.

All data is stored **locally in the user's browser** using IndexedDB (`ARC3D_UserDB` database). No data is sent to external servers.

## Files

| File | Purpose |
|------|---------|
| `db-manager.js` | Core database manager — opens IndexedDB, creates object stores, provides generic CRUD helpers |
| `user-store.js` | User accounts — registration, authentication, email confirmation, profile management |
| `payment-store.js` | Payment methods, purchase history, and subscription/plan state |
| `db-init.js` | Initialisation script — runs migration from legacy localStorage, exposes backward-compatible wrapper functions |

## Load Order

Scripts must be loaded in this exact order in `index.html`:

```html
<script src="database/db-manager.js"></script>
<script src="database/user-store.js"></script>
<script src="database/payment-store.js"></script>
<script src="database/db-init.js"></script>
```

## Database Schema

### `ARC3D_UserDB` (IndexedDB)

**Store: `users`**
| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string | Primary Key | Unique user ID (e.g. `user_abc123`) |
| `email` | string | Unique | Lowercase email address |
| `name` | string | — | Full name |
| `passwordHash` | string | — | SHA-256 hash of password |
| `confirmed` | boolean | — | Email confirmation status |
| `registeredAt` | string | Indexed | ISO date string |
| `lastLoginAt` | string | — | ISO date string |
| `phone` | string | — | Phone number |
| `company` | string | — | Company name |

**Store: `payments`**
| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string | Primary Key | Unique payment method ID |
| `userId` | string | Indexed | Owner user ID |
| `method` | string | — | `'card'` or `'paypal'` |
| `nameHash` | string | — | SHA-256 hash of cardholder name |
| `nameDisplay` | string | — | Masked name (e.g. `J*** S***`) |
| `lastFour` | string | — | Last 4 digits of card |
| `expiry` | string | — | Card expiry `MM / YY` |
| `paypalEmail` | string | — | PayPal email (for PayPal method) |
| `isDefault` | boolean | — | Whether this is the default method |
| `savedAt` | string | — | ISO date string |

**Store: `purchases`**
| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string | Primary Key | Unique purchase ID |
| `userId` | string | Indexed | Buyer user ID |
| `plan` | string | — | Plan name (e.g. `Basic Download`) |
| `amount` | number | — | Amount in GBP |
| `currency` | string | — | Currency code |
| `method` | string | — | Payment method used |
| `lastFour` | string | — | Card last 4 (if card) |
| `purchasedAt` | string | Indexed | ISO date string |
| `transactionId` | string | — | Transaction reference |
| `status` | string | — | `'completed'`, `'free_beta'`, etc. |

**Store: `subscriptions`**
| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `userId` | string | Primary Key | One subscription per user |
| `plan` | string | Indexed | Active plan name |
| `status` | string | Indexed | `'purchased'`, `'pending'`, `'cancelled'` |
| `subscribedAt` | string | — | ISO date string |
| `method` | string | — | Payment method |
| `transactionId` | string | — | Related transaction |
| `freeUntil` | string | — | Beta free period end date |

## Global API

After loading, the following globals are available:

```javascript
window.arc3dDB        // ARC3DDatabase instance (core IndexedDB manager)
window.userStore      // UserStore instance (user accounts)
window.paymentStore   // PaymentStore instance (payments & purchases)
```

## Backward Compatibility

`db-init.js` exposes the same function signatures that the old inline localStorage code used:

- `getUsersDB()` / `saveUsersDB(users)`
- `hashPassword(password)`
- `encryptCardData(cardName, lastFour, expiry, method)`
- `getUserPaymentData(email)` / `saveUserPaymentData(email, data)`
- `getUserPurchases(email)` / `addUserPurchase(email, purchase)`
- `simulateLogin(email, password)` / `simulateRegister(name, email, password)`

These now use IndexedDB internally but fall back to localStorage if IndexedDB is unavailable.

## Security

- Passwords are hashed with SHA-256 via the Web Crypto API
- Full card numbers and CVV codes are **never** stored
- Only the last 4 card digits and a hashed cardholder name are persisted
- All data stays in the user's browser — nothing is transmitted externally
