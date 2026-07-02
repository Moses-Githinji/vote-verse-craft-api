import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Organization } from './models/Organization';
import { User, SuperAdmin } from './models/User';
import { Plan } from './models/Plan';
import { PLAN_LIMITS } from './config/entitlements';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shulepal';

/**
 * System Baseline Seeding
 * This script ensures the essential infrastructure exists:
 * 1. Service Plans (Starter, Pro, Enterprise)
 * 2. System Administration Organization
 * 3. Super Admin User
 */
const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to Database');

    // 1. Seed Plans (Foundation)
    await seedPlans();

    // 2. Ensure Super Admin exists (System Baseline)
    await seedSuperAdmin();

    console.log('✅ System baseline seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

async function seedPlans() {
  console.log('Upserting Plans...');
  const planDefs = [
    {
      planId: 'starter',
      name: 'Starter (Free)',
      description: 'For small clubs and organizations just getting started with digital voting.',
      features: PLAN_LIMITS.starter,
    },
    {
      planId: 'pro',
      name: 'Pro (Growth)',
      description: 'For mid-sized organizations that need more elections and advanced analytics.',
      features: PLAN_LIMITS.pro,
    },
    {
      planId: 'enterprise',
      name: 'Enterprise (Scale)',
      description: 'For large organizations needing unlimited capacity, AI insights, and white-labeling.',
      features: PLAN_LIMITS.enterprise,
    },
  ];

  for (const p of planDefs) {
    await Plan.findOneAndUpdate({ planId: p.planId }, p, { upsert: true, new: true });
  }
  console.log('✅ Plans seeded (3 plans).');
}

async function seedSuperAdmin() {
  console.log('Ensuring Super Admin exists...');
  const email = 'admin@kurapap.io';
  const password = 'KuraPap@Admin2025';

  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Upsert the system organization first
  const org = await Organization.findOneAndUpdate(
    { email: email },
    {
      orgType: 'other',
      name: 'System Administration',
      email: email,
      phone: '+10000000000',
      isActive: true,
    },
    { upsert: true, new: true }
  );

  // Upsert the super admin
  await SuperAdmin.findOneAndUpdate(
    { email },
    {
      email,
      passwordHash: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'super_admin',
      isActive: true,
    },
    { upsert: true, new: true }
  );

  console.log(`✅ Super admin verified/updated: ${email}`);
}

seedDatabase();
