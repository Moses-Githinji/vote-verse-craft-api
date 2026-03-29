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
        description: "Adds a new question to the ballot with specific configurations.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            type: { 
              type: SchemaType.STRING, 
              description: "The type of question (e.g., 'single', 'multi', 'ranked', 'grid_multiple', 'section', 'short', 'paragraph', 'linear', 'rating', 'date', 'time', 'yesno', 'image_block', 'video_block')." 
            },
            title: { type: SchemaType.STRING, description: "The main text of the question." },
            description: { type: SchemaType.STRING, description: "Optional subtitle or instructions." },
            options: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING },
              description: "List of choices for 'single', 'multi', 'dropdown', 'ranked' types."
            },
            required: { type: SchemaType.BOOLEAN, description: "Whether the voter MUST answer this." },
            allowWriteIn: { type: SchemaType.BOOLEAN, description: "Allow voters to type their own answer (for 'single', 'multi')." },
            allowNota: { type: SchemaType.BOOLEAN, description: "Add 'None of the Above' option." },
            maxSelections: { type: SchemaType.NUMBER, description: "For 'multi' type, the maximum items a voter can pick." },
            linearMin: { type: SchemaType.NUMBER, description: "Min value for 'linear' scale (usually 0 or 1)." },
            linearMax: { type: SchemaType.NUMBER, description: "Max value for 'linear' scale (usually 5 or 10)." },
            linearMinLabel: { type: SchemaType.STRING, description: "Label for the min side (e.g. 'Poor')." },
            linearMaxLabel: { type: SchemaType.STRING, description: "Label for the max side (e.g. 'Excellent')." },
            gridRows: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Rows for grid types." },
            gridColumns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Columns for grid types." }
          },
          required: ["type", "title"]
        }
      },
      {
        name: "update_question_config",
        description: "Updates specific configuration for an existing question.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING, description: "The ID of the question to update." },
            required: { type: SchemaType.BOOLEAN },
            allowWriteIn: { type: SchemaType.BOOLEAN },
            allowNota: { type: SchemaType.BOOLEAN },
            maxSelections: { type: SchemaType.NUMBER },
            description: { type: SchemaType.STRING }
          },
          required: ["id"]
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
        
        Available Question Types and Capabilities:
        - 'single': Multiple choice. Supports allowWriteIn, allowNota.
        - 'multi': Checkboxes. Supports allowWriteIn, allowNota, maxSelections.
        - 'ranked': Ranked choice voting.
        - 'short': Single line text.
        - 'paragraph': Multi-line text.
        - 'linear': Scale (e.g., 1-10). Uses linearMin, linearMax, linearMinLabel, linearMaxLabel.
        - 'rating': Star rating (1-5).
        - 'grid_multiple' / 'grid_checkbox': Matrix questions. Uses gridRows, gridColumns.
        - 'date' / 'time' / 'yesno': Specialized pickers.
        - 'section': Header for organization.
        
        ${currentQuestions}
        
        GUIDELINES:
        1. PRIORITIZE ACTIONS: Use tools (add_question, update_question_config, etc.) to perform the user's intent immediately.
        2. CONFIGURE THOROUGHLY: Set 'required', 'allowWriteIn', 'maxSelections' etc. based on the context (e.g., Student Council positions usually allow write-ins).
        3. BE AN ARCHITECT: Suggest and implement best-practice structures for ${orgType} elections.
        
        User Intent: ${prompt}
      `;
    }

    const result = await AIService.generate({
      history,
      systemPrompt: systemPrompt + "\nIMPORTANT: Always provide a textual explanation of what you are doing, especially when using tools.",
      responseSchema,
      tools: BALLOT_TOOLS
    });
    
    // Check for mixed or function calls
    if (result.type === 'mixed' || result.type === 'tool_call') {
      return res.status(200).json({
        success: true,
        data: {
          type: result.type,
          calls: result.calls,
          message: result.message,
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

    // Structured JSON response (clarifications or questions schema)
    res.status(200).json({
      success: true,
      data: {
        type: step === 'clarify' ? 'clarification' : 'questions',
        content: step === 'clarify' ? result.content?.clarifications : result.content?.questions,
        message: result.message, // Include text if it arrived even with structured data
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
