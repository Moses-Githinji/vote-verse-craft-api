import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_CLOUD_API_KEY || '');
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

  static async generate(options: AIProviderOptions): Promise<AIResponse> {
    const providers = [
      { name: 'Claude', fn: this.generateWithClaude.bind(this) }
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
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: options.tools ? [{ functionDeclarations: options.tools }] : undefined,
      systemInstruction: options.systemPrompt,
      generationConfig: {
        responseMimeType: options.responseSchema ? "application/json" : "text/plain",
        responseSchema: options.responseSchema
      }
    });

    const chat = model.startChat({
      history: options.history.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    });

    const lastMessage = options.history[options.history.length - 1]?.content || "Please continue.";
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
  }

  private static async generateWithOpenAI(options: AIProviderOptions): Promise<AIResponse> {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 10) {
      throw new Error('OpenAI API Key not configured');
    }

    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: options.systemPrompt },
        ...options.history.map(m => ({ role: m.role as any, content: m.content }))
      ],
      response_format: options.responseSchema ? { type: "json_object" } : undefined,
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

    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      system: options.systemPrompt,
      messages: options.history
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
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
  }
}
