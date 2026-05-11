import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

// Support multiple Google AI API key environment variable names
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_CLOUD_API_KEY || process.env.GOOGLE_AI_API_KEY || '');
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

const getOpenAI = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder' });
  }
  return openaiClient;
};

const getAnthropic = () => {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.info(`[AIService] Initializing Anthropic with key starting with: ${apiKey?.substring(0, 10)}...`);
    anthropicClient = new Anthropic({ apiKey: apiKey || 'sk-ant-placeholder' });
  }
  return anthropicClient;
};

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProviderOptions {
  history: AIMessage[];
  systemPrompt: string;
  responseSchema?: any;
  tools?: any[];
}

export interface AIResponse {
  type: 'content' | 'tool_call' | 'message' | 'mixed';
  content?: any;
  calls?: any[];
  message?: string;
  provider: string;
}

export class AIService {
  private static cleanJsonResponse(text: string): string {
    if (!text) return "";
    try {
      JSON.parse(text);
      return text;
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
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
  }

  private static sanitizeHistory(history: AIMessage[]): AIMessage[] {
    if (!history || !Array.isArray(history) || history.length === 0) return [];
    const merged: AIMessage[] = [];
    for (const msg of history) {
      if (msg.role === 'system') continue;
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      const last = merged[merged.length - 1];
      if (last && last.role === role) {
        last.content += '\n' + msg.content;
      } else {
        merged.push({ role, content: msg.content });
      }
    }
    // Ensure the first message is 'user' for Anthropic & Gemini
    if (merged.length > 0 && merged[0].role !== 'user') {
      merged.unshift({ role: 'user', content: 'Hello' });
    }
    return merged;
  }

  static async generate(options: AIProviderOptions): Promise<AIResponse> {
    const providers = [
      { name: 'Claude', fn: this.generateWithClaude.bind(this) },
      { name: 'Gemini', fn: this.generateWithGemini.bind(this) },
      { name: 'OpenAI', fn: this.generateWithOpenAI.bind(this) }
    ];

    // Map tools to a common format
    let normalizedTools = options.tools;
    if (options.tools && options.tools[0]?.functionDeclarations) {
      normalizedTools = options.tools[0].functionDeclarations;
    }

    const normalizeSchema = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(normalizeSchema);
      
      const res: any = {};
      for (const key in obj) {
        if (key === 'type' && (typeof obj[key] === 'string' || typeof obj[key] === 'number')) {
          const val = String(obj[key]).toLowerCase();
          if (val === '6' || val === 'object') res[key] = 'object';
          else if (val === '0' || val === 'string') res[key] = 'string';
          else if (val === '1' || val === 'number') res[key] = 'number';
          else if (val === '2' || val === 'integer') res[key] = 'integer';
          else if (val === '3' || val === 'boolean') res[key] = 'boolean';
          else if (val === '4' || val === 'array') res[key] = 'array';
          else res[key] = val;
        } else {
          // Recursively normalize everything else (properties, required, items, etc.)
          res[key] = normalizeSchema(obj[key]);
        }
      }
      if (res.type === 'object' && !res.properties && !res.items) res.properties = {};
      return res;
    };

    const providerOptions = {
      ...options,
      tools: normalizedTools?.map((t: any) => ({
        ...t,
        parameters: normalizeSchema(t.parameters)
      }))
    };

    let lastError: any = null;

    for (const provider of providers) {
      try {
        logger.info(`[AIService] Attempting generation with ${provider.name}...`);
        
        // Add a 20-second timeout for each provider
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${provider.name} timeout after 20s`)), 20000)
        );
        
        const response = await Promise.race([
          provider.fn(providerOptions),
          timeoutPromise
        ]) as AIResponse;

        logger.info(`[AIService] ${provider.name} success.`);
        return response;
      } catch (error: any) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        logger.warn(`[AIService] ${provider.name} failed: ${errorMsg}`);
        lastError = { provider: provider.name, message: errorMsg, details: error.response?.data };
      }
    }

    throw new Error(`All AI providers failed. Last provider (${lastError?.provider}) error: ${lastError?.message}`);
  }

  private static async generateWithGemini(options: AIProviderOptions): Promise<AIResponse> {
    const sanitizedHistory = this.sanitizeHistory(options.history);
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          tools: options.tools ? [{ functionDeclarations: options.tools }] : undefined,
          systemInstruction: options.systemPrompt,
          generationConfig: {
            responseMimeType: (!options.tools && options.responseSchema) ? "application/json" : "text/plain",
            responseSchema: !options.tools ? options.responseSchema : undefined
          }
        });

        const chat = model.startChat({
          history: sanitizedHistory.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        });

        const lastMessage = sanitizedHistory[sanitizedHistory.length - 1]?.content || "Please continue.";
        const result = await chat.sendMessage(lastMessage);
        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];

        const calls = parts.filter(p => !!p.functionCall).map(c => ({
          name: c.functionCall!.name,
          args: c.functionCall!.args
        }));
        
        const textPart = parts.find(p => !!p.text)?.text || "";

        if (calls.length > 0) {
          return { 
            type: textPart ? 'mixed' : 'tool_call', 
            calls, 
            message: textPart || undefined,
            provider: 'Gemini' 
          };
        }

        if (options.responseSchema) {
          try {
            const text = this.cleanJsonResponse(textPart);
            return { type: 'content', content: JSON.parse(text), provider: 'Gemini' };
          } catch (e) {
            return { type: 'message', message: textPart, provider: 'Gemini' };
          }
        }

        return { type: 'message', message: textPart, provider: 'Gemini' };
      } catch (err: any) {
        lastError = err;
        logger.warn(`[AIService] Gemini model ${modelName} failed: ${err.message || err}`);
        continue;
      }
    }

    throw lastError;
  }

  private static async generateWithOpenAI(options: AIProviderOptions): Promise<AIResponse> {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 10) {
      throw new Error('OpenAI API Key not configured');
    }

    const client = getOpenAI();
    const modelsToTry = ["gpt-4o-mini", "gpt-4o"];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await client.chat.completions.create({
          model: modelName,
          messages: [
            { role: "system", content: options.systemPrompt },
            ...options.history.map(m => ({ role: m.role as any, content: m.content }))
          ],
          response_format: (!options.tools && options.responseSchema) ? { type: "json_object" } : undefined,
          tools: options.tools?.map((t: any) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters
            }
          }))
        });

        const message = response.choices[0].message;
        const calls = message.tool_calls
          ?.filter(tc => tc.type === 'function')
          .map(tc => ({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          })) || [];

        if (calls.length > 0) {
          return {
            type: message.content ? 'mixed' : 'tool_call',
            calls,
            message: message.content || undefined,
            provider: 'OpenAI'
          };
        }

        if (options.responseSchema) {
          try {
            return {
              type: 'content',
              content: JSON.parse(message.content || '{}'),
              provider: 'OpenAI'
            };
          } catch (e) {
            return { type: 'message', message: message.content || "", provider: 'OpenAI' };
          }
        }

        return {
          type: 'message',
          message: message.content || "",
          provider: 'OpenAI'
        };
      } catch (err: any) {
        lastError = err;
        logger.warn(`[AIService] OpenAI model ${modelName} failed: ${err.message || err}`);
        continue;
      }
    }

    throw lastError;
  }

  private static async generateWithClaude(options: AIProviderOptions): Promise<AIResponse> {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.length < 10) {
      throw new Error('Anthropic API Key not configured');
    }

    const client = getAnthropic();
    const claudeTools = options.tools?.map((t: any) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));

    if (claudeTools) {
      console.info("[AIService] Claude Tools JSON:");
      console.info(JSON.stringify(claudeTools, null, 2));
      logger.info(`[AIService] Claude Tools count: ${claudeTools.length}`);
    }

    const sanitizedHistory = this.sanitizeHistory(options.history);
    const modelsToTry = [
      "claude-3-5-sonnet-latest",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307"
    ];

    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await client.messages.create({
          model: modelName,
          max_tokens: 4000,
          system: options.systemPrompt,
          messages: sanitizedHistory.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          })),
          tools: claudeTools
        });

        const calls = response.content
          .filter(p => p.type === 'tool_use')
          .map((tu: any) => ({ name: tu.name, args: tu.input }));

        const textPart = response.content.find(p => p.type === 'text');
        const rawText = textPart && textPart.type === 'text' ? textPart.text : '';
        
        if (calls.length > 0) {
          return {
            type: rawText ? 'mixed' : 'tool_call',
            calls,
            message: rawText || undefined,
            provider: 'Claude'
          };
        }
        
        if (options.responseSchema) {
          try {
            const text = this.cleanJsonResponse(rawText);
            return { type: 'content', content: JSON.parse(text), provider: 'Claude' };
          } catch (e) {
            return { type: 'message', message: rawText, provider: 'Claude' };
          }
        }

        return {
          type: 'message',
          message: rawText,
          provider: 'Claude'
        };
      } catch (err: any) {
        lastError = err;
        logger.warn(`[AIService] Claude model ${modelName} failed: ${err.message || err}`);
        continue;
      }
    }

    throw lastError;
  }
}
