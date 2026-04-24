import { AIService, AIMessage } from './aiService';
import { WhatsAppService } from './WhatsAppService';
import { Organization } from '../models/Organization';
import { Voter } from '../models/Voter';

// Simple in-memory session store (In production, use Redis or MongoDB)
const sessions = new Map<string, {
  history: AIMessage[];
  context: any;
  lastActive: number;
}>();

const SESSION_TIMEOUT = 3600000; // 1 hour

export class WhatsAppAgentService {
  /**
   * Main entry point for processing an incoming WhatsApp message
   */
  static async handleIncomingMessage(from: string, text: string) {
    try {
      // 1. Get or create session
      let session = sessions.get(from);
      if (!session || (Date.now() - session.lastActive) > SESSION_TIMEOUT) {
        session = {
          history: [],
          context: await this.resolveContext(from),
          lastActive: Date.now()
        };
        sessions.set(from, session);
      }
      session.lastActive = Date.now();

      // 2. Prepare AI instructions
      const systemPrompt = this.generateSystemPrompt(session.context);

      // 3. Update history
      session.history.push({ role: 'user', content: text });
      
      // Limit history to last 10 messages
      if (session.history.length > 11) {
        session.history = session.history.slice(-11);
      }

      // 4. Generate AI Response
      const response = await AIService.generate({
        history: session.history,
        systemPrompt,
        // No specific response schema for free-form agent chat, let it be natural text
      });

      const responseText = response.message || "I'm sorry, I couldn't process that request.";

      // 5. Update history with assistant response
      session.history.push({ role: 'assistant', content: responseText });

      // 6. Send back to WhatsApp
      await WhatsAppService.sendMessage(from, responseText);

    } catch (error: any) {
      console.error('WhatsApp Agent Error:', error.message);
      await WhatsAppService.sendMessage(from, "I'm experiencing some technical difficulties. Please try again later.");
    }
  }

  /**
   * Resolve who is messaging based on their phone number
   */
  private static async resolveContext(phone: string) {
    const [org, voter] = await Promise.all([
      Organization.findOne({ phone }),
      Voter.findOne({ phone }).populate('organizationId', 'name')
    ]);

    return {
      orgName: org?.name,
      orgType: org?.orgType,
      voterName: voter?.name,
      voterOrgName: (voter?.organizationId as any)?.name,
      isRegisteredVoter: !!voter,
      isOrgAdmin: !!org
    };
  }

  /**
   * Create personalized instructions for the AI
   */
  private static generateSystemPrompt(context: any): string {
    let identity = "You are the VoteVerse Assistant, a helpful AI dedicated to ensuring smooth, transparent, and secure elections.";
    
    if (context.isOrgAdmin) {
      identity += ` You are speaking with an administrator from ${context.orgName}. Help them with booking intents, invoice status, or managing their dashboard.`;
    } else if (context.isRegisteredVoter) {
      identity += ` You are speaking with ${context.voterName}, a registered voter from ${context.voterOrgName}. Help them with polling locations, eligibility, and how to use the ballot.`;
    } else {
      identity += " You are speaking with a new user interested in VoteVerse. Walk them through our consultative onboarding and mention how we handle 'Managed Services' for institutional clients.";
    }

    return `
      ${identity}
      
      TONE: Professional, supportive, and efficient.
      GUARDRAILS:
      - If users ask about legal election mandates, suggest they consult their specific institution's bylaws.
      - If users are frustrated, suggest they contact our human tech leads.
      - Keep responses concise for WhatsApp readability.
      - Never hallucinate data about specific elections not found in the context provided.
    `;
  }
}
