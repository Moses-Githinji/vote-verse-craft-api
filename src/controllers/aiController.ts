import { Request, Response } from 'express';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { IBallotQuestion } from '../models/Election';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_CLOUD_API_KEY || '');

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
    const { prompt, orgType, electionTitle, step = 'generate', context = '' } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }


    const cleanJsonResponse = (text: string) => {
      try {
        // First, check if it's already valid JSON
        JSON.parse(text);
        return text;
      } catch (e) {
        // If not, try to extract the first balanced JSON object
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          // Attempt to find the shortest prefix that is valid JSON to avoid greedy matching over multiple objects
          let str = match[0];
          for (let i = str.length; i > 0; i--) {
            if (str[i-1] === '}') {
              try {
                const sub = str.substring(0, i);
                JSON.parse(sub);
                return sub;
              } catch (e) {}
            }
          }
        }
        return text;
      }
    };

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

      systemPrompt = `
        You are an expert election consultant for ${orgType} elections. 
        The admin wants to create a ballot for "${electionTitle}".
        Based on the prompt: "${prompt}", identify 2-3 critical pieces of information missing to create an industry-standard ballot.
        
        If you have enough information to perform actions (like adding a question), use the provided tools.
        Otherwise, return exactly 2-3 clarification questions in JSON format.
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

      systemPrompt = `
        You are an expert election consultant specializing in ${orgType} elections. 
        Your task is to generate professional, industry-standard ballot questions for an election titled "${electionTitle}".
        
        Technical Context:
        ${QUESTION_TYPE_CONTEXT}
        
        Requirements:
        1. Use the most appropriate question types.
        2. Use tools to perform granular updates if requested.
        3. User Intent: ${prompt}
        4. Additional Context: ${context}
      `;
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      tools: BALLOT_TOOLS,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(systemPrompt);
    const response = result.response;
    
    // Check for function calls
    const calls = response.candidates?.[0]?.content?.parts?.filter(p => p.functionCall);
    
    if (calls && calls.length > 0) {
      return res.status(200).json({
        success: true,
        data: {
          type: 'tool_call',
          calls: calls.map(c => c.functionCall)
        }
      });
    }

    // Default to structured JSON response
    const text = cleanJsonResponse(response.text());
    const parsed = JSON.parse(text);

    res.status(200).json({
      success: true,
      data: {
        type: step === 'clarify' ? 'clarification' : 'questions',
        content: step === 'clarify' ? parsed.clarifications : parsed.questions
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
