

import { GoogleGenAI, Content, Part } from "@google/genai";
import { ElasticResult, Intent, ChatMessage } from '../types';

const getSystemInstruction = (hasDataSource: boolean): string => {
  if (!hasDataSource) {
      return `You are a helpful and friendly assistant. Respond conversationally.`;
  }
  return `You are "Elastic CodeMind", a world-class AI assistant for analyzing documents and code.

**Your Core Task:**
Answer the user's question based *only* on the context provided with the latest user message. If the user provides an image or file, use it as primary context.

**Formatting Rules (Follow Strictly):**
1.  **Structure:** Use Markdown for all responses. Use headers (#, ##), bold text, and lists to structure your answers clearly.
2.  **Clarity:** Provide concise and accurate answers.
3.  **File References:** When you mention a file name from the context, you **MUST** wrap it like this: \`file:path/to/filename.ext\`. For example: \`file:src/lib/auth.ts\`.
4.  **Tables:** If data is tabular, present it in a Markdown table.
5.  **Code:** Format all code examples in Markdown code blocks with the correct language identifier (e.g., \`\`\`typescript).
6.  **Context is Key:** If the provided context is insufficient to answer, you **MUST** state that clearly. Do not invent information or use knowledge outside of the provided context.`;
};

const getApiKey = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return process.env.API_KEY;
}

// Helper to convert our ChatMessage array to Gemini's Content array
const buildConversationHistory = (history: ChatMessage[]): Content[] => {
    return history.map(msg => {
        const parts: Part[] = [{ text: msg.content }];
        if (msg.attachment) {
            parts.push({
                inlineData: {
                    mimeType: msg.attachment.type,
                    data: msg.attachment.content,
                }
            })
        }
        return { role: msg.role, parts };
    });
};

export const classifyIntent = async (userQuery: string, model: string): Promise<Intent> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const prompt = `You are an advanced intent classifier for an AI assistant that helps with documents and code. Your job is to determine the user's primary intent.

Classify the user's message into one of three categories:
1. 'query_documents': The user is asking for information, asking a question, requesting a summary, or looking for something within the provided context.
2. 'generate_code': The user is asking to write new code, modify existing code, refactor, add features, fix bugs, or asking to edit or rewrite the content of a document.
3. 'chit_chat': The user is making a social comment, greeting, expressing gratitude, or saying something not related to the documents or code.

Respond with only one of the three category names: 'query_documents', 'generate_code', or 'chit_chat'.

User: "How does the authentication work?"
Assistant: query_documents

User: "Hey there"
Assistant: chit_chat

User: "Add a logout function to the auth service."
Assistant: generate_code

User: "Can you refactor the user model to include a new field?"
Assistant: generate_code

User: "That's awesome, thanks a lot!"
Assistant: chit_chat

User: "Rewrite the abstract for the BERT paper to be more concise."
Assistant: generate_code

User: "What's the difference between BERT and the Transformer model?"
Assistant: query_documents

User: "${userQuery}"
Assistant:`;

    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        const intent = response.text.trim() as Intent;
        if (Object.values(Intent).includes(intent)) {
            return intent;
        }
        return Intent.UNKNOWN;
    } catch (error) {
        console.error("Intent classification error:", error);
        return Intent.QUERY_DOCUMENTS; // Fallback to default
    }
};

export const streamChitChatResponse = async (history: ChatMessage[], model: string) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const conversationHistory = buildConversationHistory(history);
    const hasDataSource = history.some(m => m.role === 'model' && m.sources && m.sources.length > 0);

    try {
        return await ai.models.generateContentStream({
          model,
          contents: conversationHistory,
          config: {
            systemInstruction: getSystemInstruction(hasDataSource)
          }
        });
    } catch (error) {
        console.error("Gemini API error (Chit-Chat):", error);
        throw new Error("There was an error communicating with the Gemini API.");
    }
};

export const streamCodeGenerationResponse = async (history: ChatMessage[], context: ElasticResult[], model: string) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const conversationHistory = buildConversationHistory(history);
    const lastUserMessageContent = conversationHistory.pop();
    if (!lastUserMessageContent) throw new Error("Cannot generate code from empty history.");

    const contextString = context.map(result => `
---
File: ${result.source.path}/${result.source.fileName}
Content:
\`\`\`
${result.contentSnippet.trim()}
\`\`\`
---
    `).join('\n');

    const codeGenPrompt = `
**CONVERSATION HISTORY:**
${history.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n')}

**SEARCH CONTEXT FOR CURRENT REQUEST:**
${contextString}

**USER'S CURRENT REQUEST:**
${lastUserMessageContent.parts[0].text}
`;
    
    const parts: Part[] = [{ text: codeGenPrompt }];
    if (lastUserMessageContent.parts.length > 1) {
      parts.push(lastUserMessageContent.parts[1]); // Keep attachment if present
    }

    conversationHistory.push({ role: 'user', parts });

    const systemInstruction = `You are an expert AI assistant, skilled in both programming and content editing. Your task is to modify a source file based on the user's request, using the provided context and conversation history.

You MUST follow these rules exactly:
1.  Respond with a single, valid JSON object. Do not add any text, markdown, or comments before or after the JSON object.
2.  The JSON object must have this exact structure: { "filePath": string, "thought": string, "newContent": string } or { "error": string }.
3.  'filePath': Identify the single most relevant file from the context to modify. The 'filePath' value must exactly match the path and filename from the context (e.g., "src/lib/auth/auth.ts").
4.  'thought': Provide a brief, one-sentence explanation of the changes you are making.
5.  'newContent': This field MUST contain the COMPLETE and UNALTERED content of the file with the requested modifications. It must be a single string.
6.  DO NOT use diff format (e.g., lines starting with '+' or '-').
7.  DO NOT return only the changed snippet. Return the ENTIRE file.
8.  If you cannot fulfill the request or the context is insufficient, respond with a JSON object containing an 'error' field. Example: { "error": "I could not find a relevant file to modify in the provided context." }

Example of a PERFECT response:
{
  "filePath": "src/services/api.ts",
  "thought": "I will add a new function to delete a user's profile.",
  "newContent": "import axios from 'axios';\\n\\nconst api = axios.create({\\n  baseURL: '/api',\\n});\\n\\nexport const fetchUserProfile = async (userId: string) => {\\n  const response = await api.get(\`/users/\${userId}\`);\\n  return response.data;\\n};\\n\\nexport const updateUserProfile = async (userId: string, data: any) => {\\n  const response = await api.put(\`/users/\${userId}\`, data);\\n  return response.data;\\n};\\n\\nexport const deleteUserProfile = async (userId: string) => {\\n  const response = await api.delete(\`/users/\${userId}\`);\\n  return response.data;\\n};"
}`


    try {
        return await ai.models.generateContentStream({
            model,
            contents: conversationHistory,
            config: {
                systemInstruction,
                responseMimeType: 'application/json'
            }
        });
    } catch (error) {
        console.error("Gemini API error (Code Generation):", error);
        throw new Error("There was an error communicating with the Gemini API for code generation.");
    }
}


export const streamAiResponse = async (history: ChatMessage[], context: ElasticResult[], model: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const conversationHistory = buildConversationHistory(history);
  const lastUserMessageContent = conversationHistory.pop();
  if (!lastUserMessageContent) throw new Error("Cannot get AI response from empty history.");

  const contextString = context.map(result => `
---
File: ${result.source.path}/${result.source.fileName}
Relevance Score: ${result.score}

\`\`\`
${result.contentSnippet.trim()}
\`\`\`
---
  `).join('\n');

  const finalUserPromptText = `
**SEARCH CONTEXT:**
${contextString}

**USER'S QUESTION:**
${lastUserMessageContent.parts[0].text}
  `;

  const finalParts: Part[] = [{ text: finalUserPromptText }];
  if (lastUserMessageContent.parts.length > 1) {
    finalParts.push(lastUserMessageContent.parts[1]); // Keep attachment
  }

  conversationHistory.push({ role: 'user', parts: finalParts });

  try {
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: conversationHistory,
      config: {
        systemInstruction: getSystemInstruction(true),
      }
    });
    return responseStream;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("There was an error communicating with the Gemini API.");
  }
};