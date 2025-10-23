

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export enum Intent {
  QUERY_DOCUMENTS = 'query_documents',
  GENERATE_CODE = 'generate_code',
  CHIT_CHAT = 'chit_chat',
  UNKNOWN = 'unknown'
}

export enum ResponseType {
  RAG = 'RAG',
  CODE_GENERATION = 'Code Generation',
  CHIT_CHAT = 'Chit-Chat',
}

export enum ModelId {
  GEMINI_FLASH_LITE = 'gemini-flash-lite',
  GEMINI_PRO = 'gemini-pro'
}

export type Theme = 'light' | 'dark';

export interface ModelDefinition {
  id: ModelId;
  name: string;
  model: string;
}

export const MODELS: ModelDefinition[] = [
  {
    id: ModelId.GEMINI_FLASH_LITE,
    name: 'Gemini Flash Lite',
    model: 'gemini-flash-lite-latest'
  },
  {
    id: ModelId.GEMINI_PRO,
    name: 'Gemini Pro (Advanced)',
    model: 'gemini-2.5-pro'
  }
];

export interface Source {
  id: string;
  fileName: string;
  path: string;
}

export interface CodeSuggestion {
  file: Source;
  thought: string;
  originalContent: string;
  suggestedContent: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Attachment {
    name: string;
    type: string; // Mime type
    size: number;
    content: string; // base64 encoded
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  attachment?: Attachment;
  sources?: Source[];
  suggestion?: CodeSuggestion;
  editedFile?: Source;
  responseType?: ResponseType;
  modelId?: ModelId;
}

export interface DataSource {
  type: 'folder' | 'files' | 'drive' | 'database';
  name: string;
  fileCount: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  dataSource: DataSource | null;
  dataset: ElasticResult[];
}

export interface ElasticResult {
  source: Source;
  contentSnippet: string;
  score: number;
}