import { WhatsAppService } from './src/services/WhatsAppService';
import dotenv from 'dotenv';

dotenv.config();

/**
 * USAGE:
 * Fill in your real TWILIO credentials in .env
 * Then run: npx ts-node send_test_whatsapp.ts
 */

async function runTest() {
  const testPhone = process.argv[2]; // Pass phone number as argument

  if (!testPhone) {
    console.error('Please provide a phone number as an argument. Example:');
    console.error('npx ts-node send_test_whatsapp.ts +254XXXXXXXXX');
    process.exit(1);
  }

  console.log(`Sending test intent confirmation to ${testPhone}...`);
  
  try {
    const result = await WhatsAppService.sendIntentConfirmation(testPhone, 'VoteVerse Test Org');
    console.log('Success! Message SID:', result?.sid);
    process.exit(0);
  } catch (err: any) {
    console.error('Failed to send message:', err.message);
    process.exit(1);
  }
}

runTest();
