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
    const { prompt, orgType, electionTitle, step = 'generate', history = [], ballotState = [] } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    // Helper: Prune history to keep only recent messages for short-term memory
    const pruneHistory = (msgs: any[], max = 10) => {
      if (msgs.length <= max) return msgs;
      // Keep first system/init message if any, and last N-1 messages
      return msgs.slice(-max);
    };

    const activeHistory = pruneHistory(history);

    // Add current prompt to history if it's not already there (at the end)
    if (activeHistory.length === 0 || activeHistory[activeHistory.length - 1].content !== prompt) {
      activeHistory.push({ role: 'user', content: prompt });
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

      const currentBallot = JSON.stringify(ballotState, null, 2);

      systemPrompt = `
        You are a PROACTIVE AI Election Architect for ${orgType} elections. 
        Your goal is to build a perfect ballot for "${electionTitle}".
        
        STRICT BEHAVIORAL RULES:
        1. ACTIONS FIRST: If the user describes an election or gives an okay, IMMEDIATELY use the tools to build it.
        2. PAST TENSE CONFIRMATION: Only report: "I have now [Action]" after execution.
        3. NO VERBAL LOOPS: Don't promise to build; just build.
        4. CHECK HISTORY: Look at previous messages to see if a request has multiple steps.
        
        LONG-TERM MEMORY (Current Ballot State):
        ${currentBallot}
        
        User Instruction: ${prompt}
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

      const currentBallot = JSON.stringify(ballotState, null, 2);

      systemPrompt = `
        You are a PROACTIVE AI Election Architect specializing in ${orgType} elections. 
        Your task is to build a professional, industry-standard ballot for "${electionTitle}".
        
        STRICT BEHAVIORAL RULES:
        1. ACTIONS FIRST: Do not say "I will do X" or "I am going to build X". Execute the tools IMMEDIATELY.
        2. PAST TENSE CONFIRMATION: Only after a tool is successfully called should you report: "I have now [Action]".
        3. BE AN ARCHITECT: If the user says "Build it" or "Okay," automatically implement the most common/best-practice structures for ${orgType} elections.
        4. NO VERBAL LOOPS: If you already performed an action, do not promise it again. Look at the Current Ballot state.
        5. MULTI-STEP REMEMBRANCE: If the user gave multiple instructions in one message, ensure you address ALL of them. Check the history if you feel you missed a step.
        
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
        
        LONG-TERM MEMORY (Current Ballot State):
        ${currentBallot}
        
        User Intent: ${prompt}
      `;
    }

    const result = await AIService.generate({
      history: activeHistory,
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
