import type { ChatMessage, LLMConfig, Session, WorkflowDef } from '@/types';
import { buildSkillsContext } from './skill-loader';
import { callLLM, streamLLM } from './llm/client';
import { getSession, createSession, updateSession, setSessionStatus } from './db';
import { loadWorkflowDef } from './skill-loader';

/**
 * Build the system prompt for a given workflow phase.
 */
function buildSystemPrompt(workflow: WorkflowDef, phaseIdx: number, history: ChatMessage[]): string {
  const phase = workflow.phases[phaseIdx];
  const total = workflow.phases.length;

  // Load skill content for this phase
  const skillsContext = buildSkillsContext(phase.skills);

  return [
    `你是「PM Workflow Assistant」，一个专业的产品经理工作流助手。`,
    ``,
    `## 当前工作流`,
    `${workflow.emoji} ${workflow.name}：${workflow.shortDesc}`,
    ``,
    `## 当前阶段`,
    `${phaseIdx + 1}/${total} — ${phase.title}`,
    `说明：${phase.description}`,
    `引导策略：${phase.guidance}`,
    ``,
    `## 执行规则`,
    `1. 每次只问一个问题，等待用户回答后再继续`,
    `2. 给出 2-4 个编号选项帮助用户快速选择`,
    `3. 如果用户自行输入文字回答，尊重并继续`,
    `4. 一个阶段完成后，告诉用户"✅ ${phase.title} 完成"，然后自然过渡到下一阶段`,
    `5. 所有阶段完成后，生成一份结构化的总结报告`,
    `6. 全程使用中文交流`,
    ``,
    `## 参考 Skill 文档`,
    skillsContext,
    ``,
    `## 对话历史摘要`,
    history.slice(-8).map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.substring(0, 150)}`).join('\n'),
  ].join('\n');
}

/**
 * Process one message in a workflow session.
 * Returns the AI response and updated session state.
 */
export async function processMessage(
  input: { sessionId?: string; workflowId?: string; message: string },
  config: LLMConfig,
): Promise<{ sessionId: string; response: string; phaseCompleted: boolean; currentPhase: number; totalPhases: number }> {
  // ── Resolve or create session ──
  let session: Session;
  if (input.sessionId) {
    session = getSession(input.sessionId) || createSession(input.workflowId || 'idea-refinement');
  } else if (input.workflowId) {
    session = createSession(input.workflowId);
  } else {
    session = createSession('idea-refinement'); // default
  }

  // ── Load workflow definition ──
  const workflow = loadWorkflowDef(session.workflowId);
  if (!workflow) {
    return { sessionId: session.sessionId, response: `工作流 "${session.workflowId}" 定义未找到`, phaseCompleted: false, currentPhase: 0, totalPhases: 0 };
  }

  // ── Add user message to history ──
  const messages: ChatMessage[] = [...session.messages, { role: 'user', content: input.message }];

  // ── Build system prompt ──
  const systemPrompt = buildSystemPrompt(workflow, session.currentPhase, messages);

  // ── Call LLM ──
  const llmMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const result = await callLLM(config, llmMessages);

  // ── Update session ──
  const updatedMessages: ChatMessage[] = [
    ...messages,
    { role: 'assistant', content: result.content },
  ];

  // ── Check if phase completed ──
  const phaseCompleted = checkPhaseComplete(result.content);
  let newPhase = session.currentPhase;
  if (phaseCompleted && session.currentPhase + 1 < workflow.phases.length) {
    newPhase = session.currentPhase + 1;
  }

  updateSession(session.sessionId, {
    messages: updatedMessages,
    currentPhase: newPhase,
  });

  return {
    sessionId: session.sessionId,
    response: result.content,
    phaseCompleted,
    currentPhase: newPhase,
    totalPhases: workflow.phases.length,
  };
}

/**
 * Generate a streaming response for a workflow session.
 */
export async function* processMessageStream(
  input: { sessionId?: string; workflowId?: string; message: string },
  config: LLMConfig,
): AsyncGenerator<{ delta: string; done: boolean; sessionId: string; currentPhase?: number }, void, unknown> {
  // ── Resolve or create session ──
  let session: Session;
  if (input.sessionId) {
    session = getSession(input.sessionId) || createSession(input.workflowId || 'idea-refinement');
  } else if (input.workflowId) {
    session = createSession(input.workflowId);
  } else {
    session = createSession('idea-refinement');
  }

  const workflow = loadWorkflowDef(session.workflowId);
  if (!workflow) {
    yield { delta: `工作流未找到`, done: true, sessionId: session.sessionId };
    return;
  }

  // ── Set streaming status ──
  setSessionStatus(session.sessionId, 'streaming');

  const messages: ChatMessage[] = [...session.messages, { role: 'user', content: input.message }];
  const systemPrompt = buildSystemPrompt(workflow, session.currentPhase, messages);

  const llmMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  let fullContent = '';

  for await (const chunk of streamLLM(config, llmMessages)) {
    fullContent += chunk;
    yield { delta: chunk, done: false, sessionId: session.sessionId };
  }

  // ── Save to session ──
  const updatedMessages: ChatMessage[] = [
    ...messages,
    { role: 'assistant', content: fullContent },
  ];

  const phaseCompleted = checkPhaseComplete(fullContent);
  let newPhase = session.currentPhase;
  if (phaseCompleted && session.currentPhase + 1 < workflow.phases.length) {
    newPhase = session.currentPhase + 1;
  }

  updateSession(session.sessionId, {
    messages: updatedMessages,
    currentPhase: newPhase,
    status: 'unread', // mark as unread so sidebar shows red dot
  });

  yield { delta: '', done: true, sessionId: session.sessionId, currentPhase: newPhase };
}

/**
 * Simple heuristic to detect phase completion.
 */
function checkPhaseComplete(response: string): boolean {
  const markers = ['✅', '完成', 'Phase Complete', '进入下一阶段', '下一阶段', '好的，我们进入'];
  return markers.some((m) => response.includes(m));
}

/**
 * Start a new workflow session with an initial greeting.
 */
export async function startSession(workflowId: string, config: LLMConfig): Promise<{ sessionId: string; greeting: string }> {
  const session = createSession(workflowId);
  const workflow = loadWorkflowDef(workflowId);
  if (!workflow) {
    return { sessionId: session.sessionId, greeting: `欢迎使用 PM Workflow Assistant。` };
  }

  const systemPrompt = buildSystemPrompt(workflow, 0, []);

  const result = await callLLM(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请开始第一阶段。用中文引导我。' },
  ]);

  // Save the greeting
  updateSession(session.sessionId, {
    messages: [
      { role: 'assistant', content: result.content },
    ],
  });

  return { sessionId: session.sessionId, greeting: result.content };
}
