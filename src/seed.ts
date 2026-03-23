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

    // Clear existing data (optional, but good for clean seeding)
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Election.deleteMany({});
    await Candidate.deleteMany({});
    await Voter.deleteMany({});

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
        name: "Umoja SACCO Ltd",
        email: "secretary@umojasacco.co.ke",
        password: await bcrypt.hash("sacco2025", 10),
        settings: {},
        isActive: true,
        createdAt: new Date("2025-03-22T00:00:00Z")
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a12"),
        orgType: "church",
        name: "Grace Chapel International",
        email: "admin@gracechapel.church.ke",
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
        createdAt: new Date("2025-03-22T00:00:00Z")
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a21"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a11"),
        email: "secretary@umojasacco.co.ke",
        passwordHash: await bcrypt.hash("sacco2025", 10),
        firstName: "David",
        lastName: "Kipchoge",
        role: "admin",
        isActive: true,
        createdAt: new Date("2025-03-22T00:00:00Z")
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a22"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a12"),
        email: "admin@gracechapel.church.ke",
        passwordHash: await bcrypt.hash("church2025", 10),
        firstName: "Pastor Sarah",
        lastName: "Wanjiku",
        role: "admin",
        isActive: true,
        createdAt: new Date("2025-03-22T00:00:00Z")
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
        createdAt: new Date("2025-03-22T00:00:00Z")
      }
    ]);

    console.log('Inserting Elections...');
    await Election.insertMany([
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"),
        title: "Student Council Elections 2025",
        description: "Annual democratic voting for student council.",
        electionType: "general",
        votingMethod: "first_past_post",
        status: "active",
        startDate: new Date("2025-03-22T00:00:00Z"),
        endDate: new Date("2025-03-24T00:00:00Z"),
        settings: {},
        createdBy: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a20"),
        createdAt: new Date("2025-03-22T00:00:00Z")
      }
    ]);

    console.log('Inserting Candidates...');
    await Candidate.insertMany([
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a01"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Amina Wanjiku",
        description: "Form 4A",
        manifesto: "As your Student Council President, I will focus on improving our learning environment through better library resources, more extracurricular clubs, and enhanced student-teacher communication. Together, we can build a more vibrant and supportive school community.",
        imageUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "president", "admissionNumber": "ADM2025001" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a02"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Brian Omondi",
        description: "Form 4B",
        manifesto: "Education goes beyond academics. I will champion mental health awareness, improve sports facilities, introduce study breaks, and create safe spaces for all students. Let's make our school a place where every student can thrive.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "president", "admissionNumber": "ADM2025002" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a03"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Cynthia Mutua",
        description: "Form 4A",
        manifesto: "A clean and healthy environment is essential for learning. I will prioritize mental health support services, maintain a cleaner school compound, organize wellness programs, and ensure every student has access to necessary resources for success.",
        imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "president", "admissionNumber": "ADM2025003" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a04"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "David Kiprop",
        description: "Form 4C",
        manifesto: "Technology integration is key to modern education. I will push for digital classrooms, coding clubs, e-learning resources, and modern computer labs. The future belongs to those who embrace technology, and I'll ensure we're leading the way.",
        imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "vice_president", "admissionNumber": "ADM2025004" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a05"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Grace Wambui",
        description: "Form 4B",
        manifesto: "I believe in student empowerment and leadership development. As Vice President, I'll organize leadership workshops, create mentorship programs, and establish student committees to address various school issues effectively.",
        imageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "vice_president", "admissionNumber": "ADM2025005" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a06"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Evans Kariuki",
        description: "Form 4A",
        manifesto: "Effective communication is the backbone of any organization. I will ensure transparent communication between students, teachers, and administration, maintain accurate records, and coordinate all student activities efficiently.",
        imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "secretary", "admissionNumber": "ADM2025006" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a07"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Faith Chebet",
        description: "Form 4C",
        manifesto: "Documentation and organization are my strengths. I will maintain comprehensive records of all student council activities, ensure smooth coordination of events, and create a centralized system for student feedback and suggestions.",
        imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "secretary", "admissionNumber": "ADM2025007" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a08"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "George Otieno",
        description: "Form 4B",
        manifesto: "Financial transparency and accountability are crucial. I will maintain accurate financial records, ensure proper budget allocation for student activities, and work towards increasing funding for clubs and societies through fundraising initiatives.",
        imageUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "treasurer", "admissionNumber": "ADM2025008" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a09"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Hannah Kiprop",
        description: "Form 4A",
        manifesto: "Sports build character and promote healthy lifestyles. I will advocate for better sports facilities, organize inter-house competitions, introduce new sports, and ensure every student has access to quality physical education programs.",
        imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "sports_captain", "admissionNumber": "ADM2025009" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a0a"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Isaac Mwangi",
        description: "Form 4C",
        manifesto: "Physical fitness is essential for academic success. I will promote inclusive sports programs, organize fitness challenges, improve equipment maintenance, and create opportunities for students with different athletic abilities.",
        imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "sports_captain", "admissionNumber": "ADM2025010" },
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a0b"),
        electionId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a30"),
        name: "Joyce Achieng",
        description: "Form 4B",
        manifesto: "Culture shapes our identity. I will organize cultural festivals, promote traditional dances and music, celebrate diversity, and create platforms for students to showcase their cultural heritage and talents.",
        imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face",
        candidateMetadata: { "positionId": "cultural_secretary", "admissionNumber": "ADM2025011" },
        isActive: true
      }
    ]);

    console.log('Inserting Voters...');
    await Voter.insertMany([
      {
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"),
        name: "Job Makori Funyula",
        authCredential: "34567",
        studentId: "34567",
        stream: "3B",
        isActive: true,
        hasVoted: false,
        createdAt: new Date("2025-03-22T00:00:00Z")
      },
      {
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"),
        name: "Millicent Wangeci Kariuki",
        authCredential: "34568",
        studentId: "34568",
        stream: "3B",
        isActive: true,
        hasVoted: false,
        createdAt: new Date("2025-03-22T00:00:00Z")
      },
      {
        organizationId: new mongoose.Types.ObjectId("65f9a0b1c9e77c001f3b3a10"),
        name: "Martin Ogola Okwiri",
        authCredential: "34569",
        studentId: "34569",
        stream: "3B",
        isActive: true,
        hasVoted: false,
        createdAt: new Date("2025-03-22T00:00:00Z")
      }
    ]);

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
