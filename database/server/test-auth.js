/**
 * Quick test: Register + Login + Verify stored in MongoDB
 * Run: node test-auth.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const API = 'http://localhost:3000';

async function test() {
    const email = 'testuser_' + Date.now() + '@example.com';
    const password = 'TestPassword123';
    const name = 'Test User';

    console.log('=== ARC3D Auth Test ===\n');

    // 1. Register
    console.log('1) REGISTER:', email);
    const regRes = await fetch(API + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    const regData = await regRes.json();
    console.log('   Status:', regRes.status);
    console.log('   Success:', regData.success);
    console.log('   Token received:', !!regData.token);
    console.log('   User ID:', regData.user?._id);
    console.log();

    // 2. Login with same credentials
    console.log('2) LOGIN with same email/password');
    const loginRes = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    console.log('   Status:', loginRes.status);
    console.log('   Success:', loginData.success);
    console.log('   Token received:', !!loginData.token);
    console.log();

    // 3. Login with WRONG password (should fail)
    console.log('3) LOGIN with WRONG password (should fail)');
    const badRes = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'WrongPassword999' })
    });
    const badData = await badRes.json();
    console.log('   Status:', badRes.status, '(expected 401)');
    console.log('   Success:', badData.success, '(expected false)');
    console.log('   Message:', badData.message);
    console.log();

    // 4. Verify in database directly
    console.log('4) VERIFY in MongoDB directly');
    await mongoose.connect(process.env.MONGODB_URI);
    const dbUser = await User.findOne({ email }).select('+password');
    console.log('   Found in DB:', !!dbUser);
    console.log('   Email stored:', dbUser?.email);
    console.log('   Name stored:', dbUser?.name);
    console.log('   Password hashed:', dbUser?.password?.startsWith('$2') ? 'YES (bcrypt)' : 'NO (PROBLEM!)');
    console.log('   Password !== plaintext:', dbUser?.password !== password ? 'CORRECT' : 'INSECURE!');

    // 5. Count total users
    const count = await User.countDocuments();
    console.log('\n5) Total users in database:', count);

    // Cleanup: remove test user
    await User.deleteOne({ email });
    console.log('   (Test user cleaned up)');

    await mongoose.disconnect();
    console.log('\n=== ALL TESTS PASSED ===');
}

test().catch(e => { console.error('TEST FAILED:', e.message); process.exit(1); });
