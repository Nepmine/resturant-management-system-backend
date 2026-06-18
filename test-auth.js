#!/usr/bin/env node

/**
 * Test Authentication Flow
 * 
 * Usage:
 *   node test-auth.js [command]
 * 
 * Commands:
 *   generate-token    - Generate a valid access token for testing
 *   test-protected    - Test a protected endpoint
 *   test-refresh      - Test token refresh
 */

const jwt = require('jsonwebtoken');
const http = require('http');
const readline = require('readline');

require('dotenv').config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const API_BASE = `http://localhost:${process.env.PORT || 3000}/api/v1`;

// ─────────────────────────────────────────────────────────────────────────────
// Token Generation
// ─────────────────────────────────────────────────────────────────────────────

function generateAccessToken(staffId = 1, restaurantId = 1, branchId = 1, role = 'admin') {
  const token = jwt.sign(
    {
      sub: staffId,
      restaurantId,
      branchId,
      role,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  console.log('\n✅ Generated Access Token:');
  console.log('─'.repeat(80));
  console.log(token);
  console.log('─'.repeat(80));

  const decoded = jwt.decode(token, { complete: true });
  console.log('\n📋 Token Payload:');
  console.log(JSON.stringify(decoded.payload, null, 2));

  return token;
}

function generateRefreshToken(staffId = 1, familyId = undefined) {
  familyId = familyId || require('crypto').randomUUID();
  const token = jwt.sign(
    {
      sub: staffId,
      familyId,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  console.log('\n✅ Generated Refresh Token:');
  console.log('─'.repeat(80));
  console.log(token);
  console.log('─'.repeat(80));

  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Scenarios
// ─────────────────────────────────────────────────────────────────────────────

async function testProtectedEndpoint(token) {
  console.log('\n🧪 Test: Protected Endpoint (/auth/me)');
  console.log('─'.repeat(80));

  try {
    const response = await makeRequest('GET', '/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.status === 200) {
      console.log('✅ Protected endpoint accessible!');
    } else {
      console.log('❌ Failed to access protected endpoint');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testRefreshToken(refreshToken) {
  console.log('\n🧪 Test: Refresh Token Endpoint');
  console.log('─'.repeat(80));

  try {
    const response = await makeRequest('POST', '/auth/refresh', {
      body: {
        refreshToken,
      },
    });

    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.status === 200 && response.body.data?.accessToken) {
      console.log('✅ Token refreshed successfully!');
      console.log('\n🆕 New Access Token:');
      console.log(response.body.data.accessToken);
      return response.body.data.accessToken;
    } else {
      console.log('❌ Failed to refresh token');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testLogout(accessToken) {
  console.log('\n🧪 Test: Logout Endpoint');
  console.log('─'.repeat(80));

  try {
    const response = await makeRequest('POST', '/auth/logout', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        everywhere: false,
      },
    });

    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.status === 200 || response.status === 204) {
      console.log('✅ Logged out successfully!');
    } else {
      console.log('❌ Failed to logout');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testFullAuthFlow() {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + '🔐 Full Authentication Flow Test' + ' '.repeat(25) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  // Step 1: Generate tokens
  console.log('\n📍 Step 1: Generate Test Tokens');
  console.log('─'.repeat(80));
  const accessToken = generateAccessToken(1, 1, 1, 'admin');
  const refreshToken = generateRefreshToken(1);

  // Step 2: Test protected endpoint
  console.log('\n📍 Step 2: Test Protected Endpoint with Access Token');
  await testProtectedEndpoint(accessToken);

  // Step 3: Test token refresh
  console.log('\n📍 Step 3: Test Token Refresh');
  const newAccessToken = await testRefreshToken(refreshToken);

  // Step 4: Test with new token
  if (newAccessToken) {
    console.log('\n📍 Step 4: Test Protected Endpoint with New Token');
    await testProtectedEndpoint(newAccessToken);
  }

  // Step 5: Test logout
  console.log('\n📍 Step 5: Test Logout');
  await testLogout(accessToken);

  // Step 6: Verify old token is revoked
  console.log('\n📍 Step 6: Verify Revoked Token (should fail)');
  await testProtectedEndpoint(accessToken);

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Authentication flow test complete!');
  console.log('═'.repeat(80) + '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const command = process.argv[2];

if (command === 'generate-token') {
  generateAccessToken();
} else if (command === 'generate-refresh') {
  generateRefreshToken();
} else if (command === 'full-flow') {
  testFullAuthFlow().catch(console.error);
} else {
  console.log(`
Usage: node test-auth.js [command]

Commands:
  generate-token      Generate an access token for manual testing
  generate-refresh    Generate a refresh token for manual testing
  full-flow          Run full authentication flow test (default)
  
Examples:
  node test-auth.js full-flow
  node test-auth.js generate-token
`);
  
  // Default: run full flow
  testFullAuthFlow().catch(console.error);
}
