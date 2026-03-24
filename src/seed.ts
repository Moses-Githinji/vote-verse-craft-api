import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Organization } from './models/Organization';
import { User } from './models/User';
import { Election } from './models/Election';
import { Candidate } from './models/Candidate';
import { Voter } from './models/Voter';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shulepal';

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to Database');

    // Clear existing data
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Election.deleteMany({});
    await Candidate.deleteMany({});
    await Voter.deleteMany({});

    // ─── Organizations ───────────────────────────────────────────
    console.log('Inserting Organizations...');
    const orgs = [
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"),
        orgType: "school",
        name: "Green Valley Academy",
        email: "admin@greenvalley.school.ke",
        password: await bcrypt.hash("school2025", 10),
        settings: {},
        isActive: true,
        createdAt: new Date("2025-03-22T00:00:00Z")
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a11"),
        orgType: "sacco",
        name: "Mwangaza SACCO Ltd",
        email: "secretary@mwangazasacco.co.ke",
        password: await bcrypt.hash("sacco2025", 10),
        settings: {},
        isActive: true,
        createdAt: new Date("2025-03-22T00:00:00Z")
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a12"),
        orgType: "church",
        name: "ACK St. Paul's Parish",
        email: "admin@stpauls.church.ke",
        password: await bcrypt.hash("church2025", 10),
        settings: {},
        isActive: true,
        createdAt: new Date("2025-03-22T00:00:00Z")
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a13"),
        orgType: "political",
        name: "Wananchi Democratic Party",
        email: "registrar@wananchi.party.ke",
        password: await bcrypt.hash("political2025", 10),
        settings: {},
        isActive: true,
        createdAt: new Date("2025-03-22T00:00:00Z")
      }
    ];
    await Organization.insertMany(orgs);

    // ─── Users (Admins) ──────────────────────────────────────────
    console.log('Inserting Users...');
    await User.insertMany([
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a20"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"),
        email: "admin@greenvalley.school.ke",
        passwordHash: await bcrypt.hash("school2025", 10),
        firstName: "Jane",
        lastName: "Muthoni",
        role: "admin",
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a21"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a11"),
        email: "secretary@mwangazasacco.co.ke",
        passwordHash: await bcrypt.hash("sacco2025", 10),
        firstName: "David",
        lastName: "Kipchoge",
        role: "admin",
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a22"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a12"),
        email: "admin@stpauls.church.ke",
        passwordHash: await bcrypt.hash("church2025", 10),
        firstName: "Pastor Sarah",
        lastName: "Wanjiku",
        role: "admin",
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a23"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a13"),
        email: "registrar@wananchi.party.ke",
        passwordHash: await bcrypt.hash("political2025", 10),
        firstName: "Hon. James",
        lastName: "Ochieng",
        role: "admin",
        isActive: true,
      }
    ]);

    // ─── Elections with Ballot Questions ─────────────────────────
    console.log('Inserting Elections...');
    await Election.insertMany([
      // 🎓 School Election
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"),
        title: "Student Council Elections 2026",
        description: "Annual democratic voting for student council leadership roles.",
        electionType: "general",
        votingMethod: "first_past_post",
        status: "active",
        startDate: new Date("2026-03-22T00:00:00Z"),
        endDate: new Date("2026-03-28T00:00:00Z"),
        createdBy: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a20"),
        ballotQuestions: [
          { id: "sch_q1", type: "single", title: "Who should be the next Head Boy?", options: ["Brian Kimani", "Daniel Ochieng", "Samuel Mwangi"], allowWriteIn: false, allowNota: true },
          { id: "sch_q2", type: "single", title: "Who should be the next Head Girl?", options: ["Faith Wanjiku", "Grace Akinyi", "Mercy Chebet"], allowWriteIn: false, allowNota: true },
          { id: "sch_q3", type: "single", title: "Who should be the Deputy Head Boy?", options: ["Kevin Njoroge", "Victor Otieno"], allowWriteIn: false, allowNota: true },
          { id: "sch_q4", type: "single", title: "Who should be the Deputy Head Girl?", options: ["Diana Wambui", "Lilian Adhiambo"], allowWriteIn: false, allowNota: true },
          { id: "sch_q5", type: "single", title: "Who should be the Games Captain?", options: ["James Kiprop", "Peter Wafula", "Alex Mutiso"], allowWriteIn: false, allowNota: false },
          { id: "sch_q6", type: "single", title: "Who should be the Dining Hall Captain?", options: ["Angela Muthoni", "Esther Nyambura"], allowWriteIn: false, allowNota: false },
          { id: "sch_q7", type: "yesno", title: "Should the school adopt a weekend study program?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
        ]
      },
      // 🏦 SACCO Election
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a31"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a11"),
        title: "Mwangaza SACCO AGM Elections 2026",
        description: "Annual General Meeting elections for SACCO leadership and resolutions.",
        electionType: "agm",
        votingMethod: "mixed",
        status: "active",
        startDate: new Date("2026-03-22T00:00:00Z"),
        endDate: new Date("2026-03-28T00:00:00Z"),
        createdBy: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a21"),
        ballotQuestions: [
          { id: "sacco_q1", type: "single", title: "Who should be the SACCO Chairperson?", options: ["John Kamau", "Mary Wangari", "Peter Oloo"], allowWriteIn: true, allowNota: true },
          { id: "sacco_q2", type: "single", title: "Who should be the Vice Chairperson?", options: ["Agnes Njeri", "Tom Onyango"], allowWriteIn: true, allowNota: true },
          { id: "sacco_q3", type: "single", title: "Who should be the Secretary?", options: ["David Mwangi", "Rose Awino", "Michael Kibet"], allowWriteIn: false, allowNota: true },
          { id: "sacco_q4", type: "single", title: "Who should be the Treasurer?", options: ["Susan Wanjiru", "Joseph Ouma"], allowWriteIn: false, allowNota: true },
          { id: "sacco_q5", type: "multi", title: "Select up to 3 members for the Supervisory Committee", options: ["Alice Muthoni", "George Ochieng", "Lucy Chepkorir", "Simon Nganga", "Betty Auma"], allowWriteIn: false, allowNota: false, maxSelections: 3 },
          { id: "sacco_q6", type: "yesno", title: "Should the SACCO increase the monthly contribution from KES 2,000 to KES 3,000?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
          { id: "sacco_q7", type: "yesno", title: "Should the SACCO adopt a mobile lending platform?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
          { id: "sacco_q8", type: "yesno", title: "Approve the audited financial report for FY 2025?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
        ]
      },
      // ⛪ Church Election
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a32"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a12"),
        title: "ACK St. Paul's Parish Annual Conference 2026",
        description: "Annual church conference with leadership confirmations and resolutions.",
        electionType: "conference",
        votingMethod: "mixed",
        status: "active",
        startDate: new Date("2026-03-22T00:00:00Z"),
        endDate: new Date("2026-03-28T00:00:00Z"),
        createdBy: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a22"),
        ballotQuestions: [
          { id: "church_q1", type: "yesno", title: "Confirm Rev. James Karanja as Parish Vicar for the 2026–2029 term", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
          { id: "church_q2", type: "yesno", title: "Confirm Elder Philip Muturi to the Parish Council", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
          { id: "church_q3", type: "yesno", title: "Confirm Deaconess Margaret Wanjiku to the Parish Council", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
          { id: "church_q4", type: "yesno", title: "Should the church allocate KES 5M for the new sanctuary building project?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
          { id: "church_q5", type: "yesno", title: "Approve the 2026 annual budget of KES 12M?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
          { id: "church_q6", type: "single", title: "Who should be the Church Treasurer?", options: ["Stephen Ndirangu", "Beatrice Atieno", "Charles Kiplagat"], allowWriteIn: false, allowNota: true },
          { id: "church_q7", type: "single", title: "Who should be the Youth Leader?", options: ["Kevin Maina", "Sharon Nyambura"], allowWriteIn: true, allowNota: false },
          { id: "church_q8", type: "yesno", title: "Should the church start a Saturday community outreach program?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
        ]
      },
      // 🏛️ Political Party Election
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a33"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a13"),
        title: "Wananchi Party Nomination Primaries 2026 — Nairobi County",
        description: "Party primaries and nomination elections for Nairobi County.",
        electionType: "primaries",
        votingMethod: "mixed",
        status: "active",
        startDate: new Date("2026-03-22T00:00:00Z"),
        endDate: new Date("2026-03-28T00:00:00Z"),
        createdBy: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a23"),
        ballotQuestions: [
          { id: "pol_q1", type: "ranked", title: "Rank your preferred candidate for Governor — Nairobi County", options: ["Hon. Sarah Wambui", "Hon. James Orengo", "Hon. Patrick Mwangi", "Dr. Alice Cheruiyot"], allowWriteIn: false, allowNota: true },
          { id: "pol_q2", type: "ranked", title: "Rank your preferred candidate for Senator — Nairobi County", options: ["Hon. Michael Kuria", "Hon. Grace Akello", "Barr. David Mutua"], allowWriteIn: false, allowNota: true },
          { id: "pol_q3", type: "single", title: "Who should be the Party Nominee for MP — Westlands Constituency?", options: ["Timothy Njuguna", "Rebecca Achieng", "Hassan Omar", "Josephine Wangeci"], allowWriteIn: false, allowNota: true },
          { id: "pol_q4", type: "single", title: "Who should be the Party Nominee for MP — Langata Constituency?", options: ["Martin Shikuku", "Amina Abdalla", "George Magoha"], allowWriteIn: false, allowNota: true },
          { id: "pol_q5", type: "multi", title: "Select up to 5 delegates for the National Delegates Conference", options: ["Jane Njoki", "Paul Ochieng", "Fatuma Hassan", "Bernard Kosgei", "Winnie Odinga", "Eric Wainaina", "Catherine Mumbi", "Robert Alai"], allowWriteIn: false, allowNota: false, maxSelections: 5 },
          { id: "pol_q6", type: "yesno", title: "Should the party adopt the proposed coalition agreement with Kenya First Alliance?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
          { id: "pol_q7", type: "yesno", title: "Approve the revised party constitution amendments?", options: ["Yes", "No", "Abstain"], allowWriteIn: false, allowNota: false },
        ]
      }
    ]);

    // ─── Candidates (Rich profiles for School) ───────────────────
    console.log('Inserting Candidates...');
    await Candidate.insertMany([
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a01"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Brian Kimani",
        description: "Form 4A",
        manifesto: "As your Head Boy, I will focus on discipline, academic excellence, and creating a safe learning environment for all students.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { questionId: "sch_q1", admissionNumber: "ADM2026001" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a02"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Daniel Ochieng",
        description: "Form 4B",
        manifesto: "Education goes beyond academics. I will champion mental health awareness, improve sports facilities, and create safe spaces for all students.",
        imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { questionId: "sch_q1", admissionNumber: "ADM2026002" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a03"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Samuel Mwangi",
        description: "Form 4A",
        manifesto: "I believe in a student-led transformation. Together, we can build a more vibrant and supportive school community.",
        imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { questionId: "sch_q1", admissionNumber: "ADM2026003" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a04"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Faith Wanjiku",
        description: "Form 4C",
        manifesto: "As Head Girl, I will prioritize student welfare, inclusivity, and open communication with the administration.",
        imageUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { questionId: "sch_q2", admissionNumber: "ADM2026004" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a05"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Grace Akinyi",
        description: "Form 4B",
        manifesto: "I will champion girls' rights, promote academic excellence, and ensure every student's voice is heard.",
        imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { questionId: "sch_q2", admissionNumber: "ADM2026005" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a06"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Mercy Chebet",
        description: "Form 4A",
        manifesto: "Leadership through service. I will serve as a bridge between students and the school administration.",
        imageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { questionId: "sch_q2", admissionNumber: "ADM2026006" },
        isActive: true
      },
    ]);

    // ─── Voters ──────────────────────────────────────────────────
    console.log('Inserting Voters...');
    await Voter.insertMany([
      // School voters
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"), name: "Job Makori Funyula", authCredential: "34567", studentId: "34567", stream: "3B", isActive: true, hasVoted: false },
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"), name: "Millicent Wangeci Kariuki", authCredential: "34568", studentId: "34568", stream: "3B", isActive: true, hasVoted: false },
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"), name: "Martin Ogola Okwiri", authCredential: "34569", studentId: "34569", stream: "3B", isActive: true, hasVoted: false },
      // SACCO voters (members)
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a11"), name: "James Mwangi Kamau", authCredential: "SACCO001", isActive: true, hasVoted: false },
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a11"), name: "Esther Wanjiru Ngugi", authCredential: "SACCO002", isActive: true, hasVoted: false },
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a11"), name: "Philip Otieno Odhiambo", authCredential: "SACCO003", isActive: true, hasVoted: false },
      // Church voters (members)
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a12"), name: "Rev. Michael Njoroge", authCredential: "CHURCH001", isActive: true, hasVoted: false },
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a12"), name: "Deaconess Ruth Muthoni", authCredential: "CHURCH002", isActive: true, hasVoted: false },
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a12"), name: "Elder John Karanja", authCredential: "CHURCH003", isActive: true, hasVoted: false },
      // Political party voters (delegates)
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a13"), name: "Agnes Wambui Ndungu", authCredential: "WDP001", isActive: true, hasVoted: false },
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a13"), name: "Charles Omondi Ogutu", authCredential: "WDP002", isActive: true, hasVoted: false },
      { organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a13"), name: "Fatuma Hassan Ali", authCredential: "WDP003", isActive: true, hasVoted: false },
    ]);

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
