import mongoose from 'mongoose';
import { Subscription } from './src/models/Subscription';
import { Voter } from './src/models/Voter';
import { Election } from './src/models/Election';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to DB');

  const subs = await Subscription.find({});
  console.log(`Found ${subs.length} subscriptions to migrate`);

  for (const sub of subs) {
    const voterCount = await Voter.countDocuments({ organizationId: sub.organizationId, isActive: true });
    const electionCount = await Election.countDocuments({ 
      organizationId: sub.organizationId, 
      status: { $in: ['active', 'scheduled'] } 
    });

    await Subscription.findByIdAndUpdate(sub._id, {
      usage: {
        voters: voterCount,
        activeElections: electionCount
      }
    });
    console.log(`Updated Org ${sub.organizationId}: Voters=${voterCount}, Elections=${electionCount}`);
  }

  console.log('Migration complete');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
