import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { AIService } from './services/aiService';
import { SchemaType } from '@google/generative-ai';

async function testClaude() {
  console.log('--- Starting Claude Verification ---');
  console.log('API Key present:', !!process.env.ANTHROPIC_API_KEY);

  const BALLOT_TOOLS: any = [
    {
      functionDeclarations: [
        {
          name: "add_question",
          description: "Adds a new question to the ballot.",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              type: { type: SchemaType.STRING },
              title: { type: SchemaType.STRING }
            },
            required: ["type", "title"]
          }
        }
      ]
    }
  ];

  try {
    const result = await AIService.generate({
      history: [{ role: 'user', content: 'Suggest a head boy position for a school election.' }],
      systemPrompt: 'You are an election architect.',
      tools: BALLOT_TOOLS
    });

    console.log('Result Type:', result.type);
    console.log('Provider:', result.provider);
    console.log('Message:', result.message);
    if (result.calls) {
      console.log('Tool Calls:', JSON.stringify(result.calls, null, 2));
    }
    if (result.content) {
      console.log('Content:', JSON.stringify(result.content, null, 2));
    }
    
    console.log('--- Verification Successful ---');
  } catch (error: any) {
    console.error('--- Verification Failed ---');
    console.error('Error:', error.message);
    if (error.stack) console.error(error.stack);
  }
}

testClaude();
