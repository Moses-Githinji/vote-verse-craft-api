/**
 * Seed example equipment items for development/testing
 * Usage: node -r ts-node/register scripts/seedEquipment.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Equipment } from '../src/models/Equipment';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shulepal';

async function run() {
  await mongoose.connect(MONGODB_URI);

  const items = [
    {
      name: 'Projector - Epson X300',
      description: '1080p portable projector',
      quantity: 3,
      dailyRate: 15,
      currency: 'USD',
    },
    {
      name: 'PA System - Yamaha',
      description: 'Portable PA with 2 mics',
      quantity: 2,
      dailyRate: 25,
      currency: 'USD',
    },
    {
      name: 'Folding Chair',
      description: 'Metal folding chair',
      quantity: 200,
      dailyRate: 0.5,
      currency: 'USD',
    },
    {
      name: 'Table - 6ft',
      description: 'Event table',
      quantity: 50,
      dailyRate: 1.5,
      currency: 'USD',
    },
  ];

  console.log('Seeding equipment...');
  await Equipment.deleteMany({});
  await Equipment.insertMany(items);
  console.log('Seeding complete.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});
