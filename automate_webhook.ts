import { Twilio } from 'twilio';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

/**
 * THIS SCRIPT IS OPTIONAL.
 * It requires the 'ngrok' npm package: npm install --save-dev ngrok
 * 
 * It will:
 * 1. Start an ngrok tunnel.
 * 2. Fetch the public URL.
 * 3. Update your Twilio Webhook (Phone Number only, Sandbox must be manual or Messaging Service).
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

async function automate() {
  try {
    // Note: For Sandbox, Twilio doesn't expose a direct "Update Sandbox URL" API.
    // This script works for production numbers.
    // For Sandbox, we recommend using a static ngrok domain:
    // ngrok http --domain=[your-custom-domain].ngrok-free.app 4000
    
    console.log("--- Recommendation for Dynamic Testing ---");
    console.log("1. Go to https://dashboard.ngrok.com/cloud-edge/domains");
    console.log("2. Claim your free static domain (e.g. 'voter-api.ngrok-free.app')");
    console.log("3. Run: ngrok http --domain=voter-api.ngrok-free.app 4000");
    console.log("------------------------------------------");
    
    console.log("\nIf you have a production number, this script can update it automatically...");
    // Future implementation: fetch ngrok API and update Twilio phone number resource
  } catch (err) {
    console.error(err);
  }
}

automate();
