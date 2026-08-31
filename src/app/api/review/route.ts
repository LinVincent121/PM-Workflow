import { NextRequest } from 'next/server';
import { getSettings, addAuditLog } from '@/lib/db';
import { callLLM } from '@/lib/llm/client';
import { loadWorkflowDef } from '@/lib/skill-loader';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { content, workflowId } = await request.json();
    if (!content) return Response.json({ error: '缺少 content' }, { status: 400 });

    const settings = getSettings(currentUser()?.userId);
    if (!settings.llmApiKey) {
      return Response.json({ error: '请先配置 LLM API Key' }, { status: 400 });
    }

    const config = {
      apiKey: settings.llmApiKey,
      baseUrl: settings.llmBaseUrl || 'https://api.openai.com/v1',
      model: settings.llmModel || 'gpt-4o',
    };

    // Context from workflow if available
    let workflowContext = '';
    if (workflowId) {
      const wf = loadWorkflowDef(workflowId);
      if (wf) {
        workflowContext = `该文档来自「${wf.name}」工作流，预期产出：${wf.outputs.join('、')}。`;
      }
    }

    const prompt = [
      '你是一位资深产品文档审查专家。请审查以下 Markdown 文档内容，从以下维度评估：',
      '',
      '1. **完整性** — 文档是否覆盖了所有必要内容？是否有遗漏的关键信息？',
      '2. **质量** — 内容是否具体、可操作、有数据支撑？还是有空泛的表述？',
      '3. **结构** — 逻辑是否清晰？段落组织是否合理？',
      '4. **差距** — 有哪些明显的缺陷或需要补充的地方？',
      '',
      workflowContext,
      '',
      '请严格按以下 JSON 格式回复（只输出 JSON，不要其他内容）：',
      '{',
      '  "summary": "一段总体评价（中文，50字以内）",',
      '  "strengths": ["优点1", "优点2", "优点3"],',
      '  "weaknesses": ["缺点1", "缺点2", "缺点3"],',
      '  "suggestions": ["改进建议1", "改进建议2", "改进建议3"],',
      '  "completeness": 85',
      '}',
      '',
      '待审查文档：',
      content,
    ].join('\n');

    const result = await callLLM(config, [
      { role: 'user', content: prompt },
    ]);

    // Parse JSON from response
    const text = result.content.trim();
    try {
      // Handle possible markdown code fences
      const jsonStr = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
      const review = JSON.parse(jsonStr);
      if (currentUser()) addAuditLog(currentUser()!.userId, 'review_output', workflowId || '', review.summary || '审查完成');
      return Response.json({
        summary: review.summary || '审查完成',
        strengths: review.strengths || [],
        weaknesses: review.weaknesses || [],
        suggestions: review.suggestions || [],
        completeness: review.completeness ?? 0,
      });
    } catch {
      // Fallback: return the raw text as summary
      if (currentUser()) addAuditLog(currentUser()!.userId, 'review_output', workflowId || '', text.substring(0, 4000));
      return Response.json({
        summary: text.substring(0, 200),
        strengths: [],
        weaknesses: [],
        suggestions: [],
        completeness: 0,
      });
    }
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
