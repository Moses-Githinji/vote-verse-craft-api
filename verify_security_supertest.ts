import request from 'supertest';
import { app } from './src/app';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function runTests() {
  console.log('--- Supertest Security Verification Start ---');

  // Connect to DB for ID lookups
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const orgA = '65f9a0b1c9e77c001f3b3a10';
  const orgB = '65f9a0b1c9e77c001f3b3a11';
  const electionB = '65f9a10fc9e77c001f3b3a14'; // Belongs to B

  const tokenA = jwt.sign({ 
    id: 'user_a',
    organization: { id: orgA, type: 'school' }, 
    role: 'admin' 
  }, JWT_SECRET);

  const superAdminToken = jwt.sign({ 
    id: 'super_admin_id',
    role: 'super_admin' 
  }, JWT_SECRET);

  // 1. Test BOLA on Election Results
  console.log('\n[1] Testing BOLA on Election Results...');
  const res1 = await request(app)
    .get(`/api/v1/school/elections/${electionB}/results`)
    .set('Authorization', `Bearer ${tokenA}`);
  
  if (res1.status === 404) {
    console.log('✅ BOLA Test Passed: Access denied (404) for Org A accessing Org B election');
  } else {
    console.log(`❌ BOLA Test Failed: Status ${res1.status}. Expected 404.`);
  }

  // 2. Test Super Admin Protection
  console.log('\n[2] Testing Super Admin Route Protection...');
  const res2 = await request(app)
    .get('/api/v1/subscription/admin/all')
    .set('Authorization', `Bearer ${tokenA}`);
  
  if (res2.status === 403) {
    console.log('✅ Admin Protection Passed: Forbidden (403) for non-super-admin');
  } else {
    console.log(`❌ Admin Protection Failed: Status ${res2.status}. Expected 403.`);
  }

  // 3. Test Super Admin Access
  console.log('\n[3] Testing Super Admin Access (listAllSubscriptions)...');
  const res3 = await request(app)
    .get('/api/v1/subscription/admin/all')
    .set('Authorization', `Bearer ${superAdminToken}`);
  
  if (res3.status === 200) {
    console.log('✅ Super Admin Access Passed: Status 200');
  } else {
    console.log(`❌ Super Admin Access Failed: Status ${res3.status}. Expected 200/Authorized. (Got ${res3.status})`);
  }

  await mongoose.disconnect();
  console.log('\n--- Verification Complete ---');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
