const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_URL = 'http://localhost:8080/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function verify() {
  console.log('--- JS Security Verification Start ---');

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
    const res = await axios.get(`${API_URL}/school/elections/${electionB}/results`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('❌ BOLA Test Failed: Org A accessed Org B results');
  } catch (err) {
    if (err.response?.status === 404) {
      console.log('✅ BOLA Test Passed: Access denied (404)');
    } else {
      console.log(`❓ BOLA Test Result: Status ${err.response?.status}`);
    }
  }

  // 2. Test Super Admin Protection
  console.log('\n[2] Testing Super Admin Route Protection...');
  try {
    const res = await axios.get(`${API_URL}/subscription/admin/all`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('❌ Admin Protection Failed: Status 200');
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('✅ Admin Protection Passed: Forbidden (403)');
    } else {
      console.log(`❓ Admin Protection Result: Status ${err.response?.status}`);
    }
  }

  console.log('\n--- Verification Complete ---');
}

verify().catch(console.error);
