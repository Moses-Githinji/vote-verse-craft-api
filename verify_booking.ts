import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Booking } from './src/models/Booking';

dotenv.config();

const API_URL = 'http://localhost:4000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shulepal';

const verifyBookingSystem = async () => {
  try {
    console.log('--- 🛡️ Starting Booking System Verification ---');

    // 0. Cleanup DB for fresh run
    await mongoose.connect(MONGODB_URI);
    await Booking.deleteMany({ startDate: new Date('2026-05-10') });
    console.log('✅ DATABASE CLEANUP: Removed existing May 10 bookings.');

    // 1. Generate a fake admin token
    const token = jwt.sign({
      id: 'admin-123',
      role: 'admin',
      organization: { id: '60d5f9b4f1b2c3d4e5f6a7b8', type: 'school' }
    }, JWT_SECRET);

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Check initial availability for 'Standard' (5 booths)
    console.log('\n1. Checking initial availability for Standard (5 booths)...');
    const av1 = await axios.get(`${API_URL}/booking/availability?planId=standard`, { headers });
    console.log('Blocked Dates (Expected Empty):', av1.data.data.blockedDates);

    // 3. Create a booking that consumes 5 booths (Standard)
    console.log('\n2. Creating a Standard booking for May 10, 2026...');
    const booking1 = await axios.post(`${API_URL}/booking/reserve`, {
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      planId: 'standard'
    }, { headers });
    console.log('Booking 1 Status:', booking1.data.data.status);
    const booking1Id = booking1.data.data._id;

    // 4. Confirm the booking (so it counts against availability)
    console.log('\n3. Confirming Booking 1...');
    await axios.patch(`${API_URL}/booking/${booking1Id}/verify`, { status: 'confirmed' }, { headers });
    console.log('Booking 1 confirmed.');

    // 5. Create 1 more Standard booking (total 10 booths, 4 staff - Valid for 20/5 limit)
    console.log('\n4. Creating 1 more Standard booking...');
    const b2 = await axios.post(`${API_URL}/booking/reserve`, {
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      planId: 'standard'
    }, { headers });
    await axios.patch(`${API_URL}/booking/${b2.data.data._id}/verify`, { status: 'confirmed' }, { headers });
    console.log('Total 10/20 booths, 4/5 staff used.');

    // 6. Check availability again — May 10 and May 9, 11 (buffers) should be blocked for a 3rd Standard booking
    // because a 3rd Standard needs 2 staff, and 4 + 2 = 6 > 5.
    console.log('\n5. Checking availability for a 3rd Standard booking (should be blocked by STAFF)...');
    const av2 = await axios.get(`${API_URL}/booking/availability?planId=standard`, { headers });
    
    const expectedBlocked = ['2026-05-09', '2026-05-10', '2026-05-11'];
    const matched = expectedBlocked.every(d => av2.data.data.blockedDates.includes(d));
    
    if (matched) {
      console.log('✅ SUCCESS: Date range correctly blocked by resource (Staff) exhaustion.');
      console.log('Blocked Dates:', av2.data.data.blockedDates);
    } else {
      console.log('❌ FAILURE: Blocked dates mismatch.');
      console.log('Expected:', expectedBlocked);
      console.log('Received:', av2.data.data.blockedDates);
    }

    // 7. Try to book a 3rd Standard on the same date (should fail)
    console.log('\n6. Attempting to book a 3rd Standard (should return 409)...');
    try {
      await axios.post(`${API_URL}/booking/reserve`, {
        startDate: '2026-05-10',
        endDate: '2026-05-10',
        planId: 'standard'
      }, { headers });
      console.log('❌ FAILURE: Booking unexpectedly succeeded.');
    } catch (err: any) {
      if (err.response?.status === 409) {
        console.log('✅ SUCCESS: Correctly rejected with 409 Conflict.');
        console.log('Reason:', err.response.data.message);
      } else {
        console.log('❌ FAILURE: Unexpected error status:', err.response?.status);
      }
    }

    console.log('\n--- 🎉 Verification Complete ---');
    await mongoose.disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Verification script failed:', error.response?.data || error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

verifyBookingSystem();
