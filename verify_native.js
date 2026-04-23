const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_URL = 'http://localhost:4000/api/v1'; // Corrected port
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function makeRequest(url, method, token) {
  return new Promise((resolve, reject) => {
    const options = {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data });
      });
    });

    req.on('error', (err) => { 
      console.error('Request detail:', { url, method, error: err.message });
      reject(err); 
    });
    req.end();
  });
}

async function verify() {
  console.log('--- Native JS Security Verification (Port 4000) ---');

  const orgA = '65f9a0b1c9e77c001f3b3a10';
  const orgB = '65f9a0b1c9e77c001f3b3a11';
  const electionB = '65f9a10fc9e77c001f3b3a14';

  const tokenA = jwt.sign({ 
    user: { id: 'user_a' },
    organization: { id: orgA, type: 'school' }, 
    role: 'admin' 
  }, JWT_SECRET);

  const superAdminToken = jwt.sign({ 
    user: { id: 'super_admin_id' },
    role: 'super_admin' 
  }, JWT_SECRET);

  // 1. Test BOLA on Election Results
  console.log('\n[1] Testing BOLA on Election Results...');
  try {
    const res = await makeRequest(`${API_URL}/school/elections/${electionB}/results`, 'GET', tokenA);
    if (res.status === 404) {
      console.log('✅ BOLA Test Passed: Access denied (404)');
    } else {
      console.log(`❌ BOLA Test Failed: Status ${res.status}. Expected 404.`);
    }
  } catch (err) {
    console.error('BOLA Test Request Error:', err.message);
  }

  // 2. Test Super Admin Protection
  console.log('\n[2] Testing Super Admin Route Protection...');
  try {
    const res = await makeRequest(`${API_URL}/subscription/admin/all`, 'GET', tokenA);
    if (res.status === 403) {
      console.log('✅ Admin Protection Passed: Forbidden (403)');
    } else {
      console.log(`❌ Admin Protection Failed: Status ${res.status}. Expected 403.`);
    }
  } catch (err) {
    console.error('Admin Protection Request Error:', err.message);
  }

  // 3. Test Valid Super Admin Access
  console.log('\n[3] Testing Valid Super Admin Access...');
  try {
    const res = await makeRequest(`${API_URL}/subscription/admin/all`, 'GET', superAdminToken);
    if (res.status === 200) {
      console.log('✅ Super Admin Access Passed: Status 200');
    } else {
      console.log(`❌ Super Admin Access Failed: Status ${res.status}. Expected 200.`);
    }
  } catch (err) {
    console.error('Super Admin Access Request Error:', err.message);
  }

  console.log('\n--- Verification Complete ---');
}

verify().catch(console.error);
