import mongoose from 'mongoose';
import { InventoryConfig } from './models/InventoryConfig';
import dotenv from 'dotenv';

dotenv.config();

const seedInventory = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vote-verse');
    console.log('Connected to MongoDB');

    // Create global inventory if it doesn't exist
    const existing = await InventoryConfig.findOne();
    if (!existing) {
      await InventoryConfig.create({
        totalBooths: 20,
        totalTechnicians: 5,
        bufferDays: 1
      });
      console.log('✅ Initial inventory seeded: 20 booths, 5 technicians.');
    } else {
      console.log('ℹ️ Inventory already exists. Skipping seed.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedInventory();
