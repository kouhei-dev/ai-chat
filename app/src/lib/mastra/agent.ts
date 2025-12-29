import { Agent } from '@mastra/core/agent';

const SYSTEM_PROMPT = `あなたはフレンドリーなAIアシスタントです。
ユーザーとの会話を楽しみ、質問に丁寧に答えてください。

以下のガイドラインに従ってください：
- 日本語で応答してください
- 親しみやすく、カジュアルなトーンで話してください
- 回答は簡潔で分かりやすくしてください
- Markdownは使用せず、プレーンテキストで応答してください`;

export const chatAgent = new Agent({
  id: 'chat-agent',
  name: 'Chat Agent',
  instructions: SYSTEM_PROMPT,
  model: 'anthropic/claude-sonnet-4-20250514',
});

export async function generateResponse(
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> {
  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const response = await chatAgent.generate(messages);

  return response.text;
}
