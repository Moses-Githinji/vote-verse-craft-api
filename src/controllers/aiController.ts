import { Request, Response } from 'express';
import { AIService } from '../services/aiService';
import { SchemaType } from '@google/generative-ai';
import { EntitlementService } from '../services/EntitlementService';

// In-memory job store (consider Redis or DB for production)
const aiJobs = new Map<
  string,
  {
    status: 'pending' | 'completed' | 'failed';
    data?: any;
    error?: string;
    timestamp: Date;
  }
>();

// Cleanup old jobs every hour
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 3600000);
    for (const [id, job] of aiJobs.entries()) {
      if (job.timestamp < oneHourAgo) aiJobs.delete(id);
    }
  }, 3600000);
}

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
        name: 'add_question',
        description: 'Adds a new question to the ballot with specific configurations.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            type: {
              type: SchemaType.STRING,
              description:
                "The type of question (e.g., 'single', 'multi', 'ranked', 'grid_multiple', 'section', 'short', 'paragraph', 'linear', 'rating', 'date', 'time', 'yesno', 'image_block', 'video_block').",
            },
            title: { type: SchemaType.STRING, description: 'The main text of the question.' },
            description: {
              type: SchemaType.STRING,
              description: 'Optional subtitle or instructions.',
            },
            options: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "List of choices for 'single', 'multi', 'dropdown', 'ranked' types.",
            },
            required: {
              type: SchemaType.BOOLEAN,
              description: 'Whether the voter MUST answer this.',
            },
            allowWriteIn: {
              type: SchemaType.BOOLEAN,
              description: "Allow voters to type their own answer (for 'single', 'multi').",
            },
            allowNota: { type: SchemaType.BOOLEAN, description: "Add 'None of the Above' option." },
            maxSelections: {
              type: SchemaType.NUMBER,
              description: "For 'multi' type, the maximum items a voter can pick.",
            },
            linearMin: {
              type: SchemaType.NUMBER,
              description: "Min value for 'linear' scale (usually 0 or 1).",
            },
            linearMax: {
              type: SchemaType.NUMBER,
              description: "Max value for 'linear' scale (usually 5 or 10).",
            },
            linearMinLabel: {
              type: SchemaType.STRING,
              description: "Label for the min side (e.g. 'Poor').",
            },
            linearMaxLabel: {
              type: SchemaType.STRING,
              description: "Label for the max side (e.g. 'Excellent').",
            },
            gridRows: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Rows for grid types.',
            },
            gridColumns: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Columns for grid types.',
            },
          },
          required: ['type', 'title'],
        },
      },
      {
        name: 'update_question_config',
        description: 'Updates specific configuration for an existing question.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING, description: 'The ID of the question to update.' },
            required: { type: SchemaType.BOOLEAN },
            allowWriteIn: { type: SchemaType.BOOLEAN },
            allowNota: { type: SchemaType.BOOLEAN },
            maxSelections: { type: SchemaType.NUMBER },
            description: { type: SchemaType.STRING },
          },
          required: ['id'],
        },
      },
      {
        name: 'set_election_dates',
        description: 'Sets the start and end dates for the election.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            startDate: {
              type: SchemaType.STRING,
              description: 'ISO format date string for start.',
            },
            endDate: { type: SchemaType.STRING, description: 'ISO format date string for end.' },
          },
        },
      },
      {
        name: 'update_ballot_info',
        description: 'Updates the election title or description.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
          },
        },
      },
    ],
  },
];

export const generateBallotQuestions = async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      orgType,
      electionTitle,
      step = 'generate',
      history = [],
      ballotState = [],
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    // --- Entitlement Check ---
    const orgId = (req as any).userOrgId;
    if (!orgId) return res.status(403).json({ success: false, message: 'Organization required' });

    const gate = await EntitlementService.canUse(orgId, 'aiBallotArchitect');
    if (!gate.allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FEATURE_LOCKED',
          message:
            'AI Ballot Architect is a Pro feature. Upgrade your plan to unlock AI assistance.',
          currentPlan: gate.currentPlan,
          requiredPlan: 'pro',
        },
      });
    }

    const pruneHistory = (msgs: any[], max = 10) => {
      if (msgs.length <= max) return msgs;
      return msgs.slice(-max);
    };

    const activeHistory = pruneHistory(history);
    if (activeHistory.length === 0 || activeHistory[activeHistory.length - 1].content !== prompt) {
      activeHistory.push({ role: 'user', content: prompt });
    }

    let systemPrompt = '';
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
                options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ['id', 'question'],
            },
          },
        },
      };

      const currentBallot = JSON.stringify(ballotState, null, 2);
      systemPrompt = `
        You are a PROACTIVE AI Election Architect for ${orgType} elections. 
        Build a perfect ballot for "${electionTitle}".
        LONG-TERM MEMORY: ${currentBallot}
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
                maxSelections: { type: SchemaType.NUMBER },
              },
              required: ['id', 'type', 'title', 'options'],
            },
          },
        },
      };

      const currentBallot = JSON.stringify(ballotState, null, 2);
      systemPrompt = `
        You are a PROACTIVE AI Election Architect for ${orgType} elections. 
        Build a professional ballot for "${electionTitle}".
        LONG-TERM MEMORY: ${currentBallot}
      `;
    }

    const result = await AIService.generate({
      history: activeHistory,
      systemPrompt: systemPrompt + '\nIMPORTANT: Always provide a textual explanation.',
      responseSchema,
      tools: BALLOT_TOOLS,
    });

    return res.json({
      success: true,
      data: {
        type:
          result.type === 'content'
            ? step === 'clarify'
              ? 'clarification'
              : 'questions'
            : result.type,
        content:
          result.type === 'content'
            ? step === 'clarify'
              ? result.content?.clarifications
              : result.content?.questions
            : result.content,
        calls: result.calls,
        message: result.message,
        provider: result.provider,
      },
    });
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process AI request',
      error: error.message,
    });
  }
};

export const getAIJobStatus = async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = aiJobs.get(jobId as string);

  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  res.json({
    success: true,
    data: job,
  });
};

export const analyzeBallot = async (req: Request, res: Response) => {
  try {
    const { questions, orgType, title, description = '' } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ success: false, message: 'Questions array is required' });
    }

    // --- Entitlement Check ---
    const orgId = (req as any).userOrgId;
    if (!orgId) return res.status(403).json({ success: false, message: 'Organization required' });

    const gate = await EntitlementService.canUse(orgId, 'aiBallotArchitect');
    if (!gate.allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FEATURE_LOCKED',
          message: 'AI Ballot Analysis is a Pro feature. Upgrade your plan to unlock AI auditing.',
          currentPlan: gate.currentPlan,
          requiredPlan: 'pro',
        },
      });
    }

    const ballotPrompt = `
      Election Title: ${title}
      Organization Type: ${orgType}
      Description: ${description}
      
      Ballot Structure:
      ${JSON.stringify(questions, null, 2)}
    `;

    const systemPrompt = `
      You are an expert Election Auditor and UX Specialist. 
      Your task is to analyze the provided ballot structure and provide constructive, professional feedback.
      
      Evaluate based on:
      1. Clarity: Are questions easy to understand?
      2. Neutrality: Is there any leading or biased language?
      3. Completeness: Are there missing essential categories for a ${orgType} election?
      4. UX: Is the flow logical?
      
      Provide your analysis in the specified JSON format.
    `;

    const responseSchema: any = {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.NUMBER, description: 'Quality score from 1-100' },
        feedback: { type: SchemaType.STRING, description: 'Overall summary of the ballot quality' },
        suggestions: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Actionable suggestions for improvement',
        },
        complianceCheck: {
          type: SchemaType.STRING,
          description: 'Check against standard ${orgType} election practices',
        },
      },
      required: ['score', 'feedback', 'suggestions', 'complianceCheck'],
    };

    const result = await AIService.generate({
      history: [{ role: 'user', content: ballotPrompt }],
      systemPrompt,
      responseSchema,
    });

    res.json({
      success: true,
      data: result.content,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to analyze ballot',
      error: error.message,
    });
  }
};
