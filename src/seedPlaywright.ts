import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Organization } from './models/Organization';
import { User } from './models/User';
import { Election, IBallotQuestion } from './models/Election';
import { Candidate } from './models/Candidate';
import { Voter } from './models/Voter';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shulepal';

const seedComprehensiveTest = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to Database');

    const orgId = new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"); // School ID
    const userId = new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a20"); // Admin ID
    const electionId = new mongoose.Types.ObjectId("77f9a0b1c9e77c001f3b3a77"); // New Election ID

    // Ensure org exists (assumes standard seed.ts already ran)
    const org = await Organization.findById(orgId);
    if (!org) {
       console.error("Please run the standard 'seed.ts' first to generate organizations.");
       process.exit(1);
    }

    // Clear previous tests if needed
    await Election.deleteOne({ _id: electionId });

    // Exhaustive 17-component ballot
    const questions: IBallotQuestion[] = [
      { id: "pw_q01", type: "section", title: "Playwright E2E Comprehensive Test", options: [], allowNota: false, allowWriteIn: false, description: "Testing all interactive question types." } as any,
      { id: "pw_q02", type: "short", title: "Short Answer Test", options: [], allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q03", type: "paragraph", title: "Paragraph Test", options: [], allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q04", type: "single", title: "Single Choice Test", options: ["Option A", "Option B", "Option C"], allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q05", type: "multi", title: "Multiple Choice Test", options: ["Check 1", "Check 2", "Check 3"], maxSelections: 2, allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q06", type: "dropdown", title: "Dropdown Test", options: ["Drop 1", "Drop 2", "Drop 3"], allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q07", type: "linear", title: "Linear Scale Test", options: [], linearMin: 1, linearMax: 10, linearMinLabel: "Bad", linearMaxLabel: "Good", allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q08", type: "rating", title: "Star Rating Test", options: [], ratingMax: 5, allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q09", type: "grid_multiple", title: "Radio Grid Test", options: ["Col 1", "Col 2"], gridRows: ["Row 1", "Row 2"], allowNota: false, allowWriteIn: false, required: true } as any,
      { id: "pw_q10", type: "grid_checkbox", title: "Checkbox Grid Test", options: ["Box 1", "Box 2"], gridRows: ["Line 1", "Line 2"], allowNota: false, allowWriteIn: false, required: true } as any,
      { id: "pw_q11", type: "date", title: "Date Picker Test", options: [], dateFormat: "date", allowNota: false, allowWriteIn: false, required: true } as any,
      { id: "pw_q12", type: "time", title: "Time Picker Test", options: [], dateFormat: "time", allowNota: false, allowWriteIn: false, required: true } as any,
      { id: "pw_q13", type: "ranked", title: "Ranked Choice Test", options: ["Rank A", "Rank B", "Rank C"], allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q14", type: "yesno", title: "Yes/No/Abstain Test", options: ["Yes", "No", "Abstain"], allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q15", type: "file", title: "File Upload Test", options: [], allowNota: false, allowWriteIn: false, required: true },
      { id: "pw_q16", type: "image_block", title: "Look at this test image", options: [], imageUrl: "https://via.placeholder.com/150", allowNota: false, allowWriteIn: false } as any,
      { id: "pw_q17", type: "video_block", title: "Look at this test video", options: [], videoUrl: "https://example.com/video", allowNota: false, allowWriteIn: false } as any,
    ];

    const testElection = {
      _id: electionId,
      organizationId: orgId,
      title: "Automated Question Type Verification Ballot",
      description: "A comprehensive ballot containing all 17 layout and question types for Playwright testing.",
      electionType: "general",
      votingMethod: "mixed",
      status: "active",
      startDate: new Date("2020-01-01T00:00:00Z"),
      endDate: new Date("2030-12-31T00:00:00Z"),
      createdBy: userId,
      ballotQuestions: questions
    };

    await Election.create(testElection);

    // Make sure we have a voter we can test with
    const pwVoter = await Voter.findOne({ organizationId: orgId, studentId: "PW-TEST" });
    if (pwVoter) {
        await Voter.updateOne({ _id: pwVoter._id }, { $set: { hasVoted: false } }); // Reset for re-runs
    } else {
        await Voter.create({
            organizationId: orgId,
            name: "Playwright Automated Tester",
            authCredential: "PW-TEST",
            studentId: "PW-TEST",
            stream: "TEST",
            isActive: true,
            hasVoted: false
        });
    }

    console.log('✅ Generated 17-question Playwright test ballot and test voter (PW-TEST).');
    process.exit(0);

  } catch (error) {
    console.error('❌ Playwright Seeding failed:', error);
    process.exit(1);
  }
};

seedComprehensiveTest();
