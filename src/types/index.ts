// ─── Shared types for PM Workflow Assistant ───

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface WorkflowPhase {
  id: string;
  title: string;
  description: string;
  skills: string[];
  guidance: string;
}

export interface WorkflowDef {
  id: string;
  name: string;
  emoji: string;
  shortDesc: string;
  description: string;
  skills: string[];
  phases: WorkflowPhase[];
  outputs: string[];
  estimatedTime: string;
  triggerScenarios: string[];
}

export interface Session {
  sessionId: string;
  workflowId: string;
  currentPhase: number;
  messages: ChatMessage[];
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: 'idle' | 'streaming' | 'unread';
}

export interface AppSettings {
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
}

export interface ChatRequest {
  sessionId?: string;
  workflowId?: string;
  message: string;
}
