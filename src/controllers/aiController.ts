import { Request, Response } from 'express';
import { IBallotQuestion } from '../models/Election';
import { AIService } from '../services/aiService';
import { SchemaType } from '@google/generative-ai';


const QUESTION_TYPE_CONTEXT = `
Available Question Types:
- 'short': Single line text response
- 'paragraph': Multi-line text response
- 'single': Multiple Choice (Radio buttons - select one)
- 'multi': Checkboxes (Select multiple)
- 'dropdown': Select from a list
- 'file': File upload
- 'linear': Scale from 1 to 10
- 'rating': Star rating 1-5
- 'grid_multiple': Matrix of radio buttons
- 'grid_checkbox': Matrix of checkboxes
- 'date': Date picker
- 'time': Time picker
- 'ranked': Ranked Choice (Drag to rank options)
- 'yesno': Yes / No / Abstain (Three fixed options)
- 'section': Section Header (Title and description)
- 'image_block': Standalone image
- 'video_block': Standalone video link
`;

const BALLOT_TOOLS: any = [
  {
    functionDeclarations: [
      {
        name: "add_question",
        description: "Adds a new question to the ballot. Useful for adding specific items, positions, or inquiries.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            type: { 
              type: SchemaType.STRING, 
              description: "The type of question (e.g., 'single', 'multi', 'ranked', 'grid_multiple', 'section')." 
            },
            title: { type: SchemaType.STRING, description: "The main text of the question." },
            options: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING },
              description: "List of choices for the question."
            }
          },
          required: ["type", "title"]
        }
      },
      {
        name: "set_election_dates",
        description: "Sets the start and end dates for the election.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            startDate: { type: SchemaType.STRING, description: "ISO format date string for start." },
            endDate: { type: SchemaType.STRING, description: "ISO format date string for end." }
          }
        }
      },
      {
        name: "update_ballot_info",
        description: "Updates the election title or description.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING }
          }
        }
      }
    ]
  }
];

export const generateBallotQuestions = async (req: Request, res: Response) => {
  try {
    const { prompt, orgType, electionTitle, step = 'generate', context = '', ballotState = [] } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    // Parse context string into history array if possible
    // Format: "User: msg\n\nAssistant: msg"
    const history: any[] = [];
    if (context) {
      const parts = context.split('\n\n');
      for (const part of parts) {
        if (part.startsWith('User: ')) {
          history.push({ role: 'user', content: part.replace('User: ', '') });
        } else if (part.startsWith('Assistant: ')) {
          history.push({ role: 'assistant', content: part.replace('Assistant: ', '') });
        }
      }
    }

    // Add current prompt to history if it's not already there
    if (history.length === 0 || history[history.length - 1].content !== prompt) {
      history.push({ role: 'user', content: prompt });
    }

    let systemPrompt = "";
    let responseSchema: any = null;

    if (step === 'clarify') {
      responseSchema = {
        type: SchemaType.OBJECT,
        properties: {
          clarifications: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                question: { type: SchemaType.STRING },
                placeholder: { type: SchemaType.STRING },
                options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
              },
              required: ["id", "question"]
            }
          }
        }
      };

      const currentQuestions = ballotState.length > 0 
        ? `Current Ballot contains:\n${ballotState.map((q: any, i: number) => `${i+1}. ${q.title} (${q.type})`).join('\n')}`
        : "The ballot is currently empty.";

      systemPrompt = `
        You are an AI Election Architect for ${orgType} elections. 
        Your goal is to build a perfect ballot for "${electionTitle}".
        
        ${currentQuestions}
        
        BE PROACTIVE:
        1. If the user suggests a number of positions or a school setup, IMMEDIATELY use the 'add_question' tool to create them.
        2. DO NOT just say "I'm listening" or ask for more detail if you can reasonably assume standard roles (e.g., President, VP, etc. for schools).
        3. If you do need more info, identify 2-3 critical missing pieces but ONLY after proposing what you can.
        
        Current User Request: ${prompt}
      `;
    } else {
      responseSchema = {
        type: SchemaType.OBJECT,
        properties: {
          questions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                type: { type: SchemaType.STRING },
                title: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                required: { type: SchemaType.BOOLEAN },
                allowWriteIn: { type: SchemaType.BOOLEAN },
                allowNota: { type: SchemaType.BOOLEAN },
                maxSelections: { type: SchemaType.NUMBER }
              },
              required: ["id", "type", "title", "options"]
            }
          }
        }
      };

      const currentQuestions = ballotState.length > 0 
        ? `Current Ballot contains:\n${ballotState.map((q: any, i: number) => `${i+1}. ${q.title} (${q.type})`).join('\n')}`
        : "The ballot is currently empty.";

      systemPrompt = `
        You are an AI Election Architect specializing in ${orgType} elections. 
        Your task is to build a professional, industry-standard ballot for "${electionTitle}".
        
        Technical Context:
        ${QUESTION_TYPE_CONTEXT}
        
        ${currentQuestions}
        
        GUIDELINES:
        1. PRIORITIZE ACTIONS: Use tools (add_question, update_ballot_info, etc.) to perform the user's intent immediately.
        2. BE AN ARCHITECT: If the user is unsure, suggest and implement the most common/best-practice structures for ${orgType} elections.
        3. AVOID PASSIVITY: Do not ask for more detail if you can make a helpful proposal instead.
        
        User Intent: ${prompt}
      `;
    }

    const result = await AIService.generate({
      history,
      systemPrompt,
      responseSchema,
      tools: BALLOT_TOOLS
    });
    
    // Check for function calls
    if (result.type === 'tool_call') {
      return res.status(200).json({
        success: true,
        data: {
          type: 'tool_call',
          calls: result.calls,
          provider: result.provider
        }
      });
    }

    // Handle plain text reasoning/suggestions
    if (result.type === 'message') {
      return res.status(200).json({
        success: true,
        data: {
          type: 'message',
          message: result.message,
          provider: result.provider
        }
      });
    }

    // Structured JSON response
    res.status(200).json({
      success: true,
      data: {
        type: step === 'clarify' ? 'clarification' : 'questions',
        content: step === 'clarify' ? result.content?.clarifications : result.content?.questions,
        provider: result.provider
      }
    });
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process AI request',
      error: error.message
    });
  }
};
