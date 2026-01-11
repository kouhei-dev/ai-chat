import { Agent } from '@mastra/core/agent';
import type { CoreMessage } from 'ai';

const SYSTEM_PROMPT = `あなたはフレンドリーなAIアシスタントです。
ユーザーとの会話を楽しみ、質問に丁寧に答えてください。

以下のガイドラインに従ってください：
- 日本語で応答してください
- 親しみやすく、カジュアルなトーンで話してください
- 回答は簡潔で分かりやすくしてください
- Markdownは使用せず、プレーンテキストで応答してください
- ユーザーが画像を送信した場合は、画像の内容を分析して適切に応答してください`;

export const chatAgent = new Agent({
  id: 'chat-agent',
  name: 'Chat Agent',
  instructions: SYSTEM_PROMPT,
  model: 'anthropic/claude-sonnet-4-20250514',
});

export async function generateResponse(
  message: string,
  conversationHistory: {
    role: 'user' | 'assistant';
    content: string;
    imageData?: string;
    imageMimeType?: string;
  }[] = [],
  imageData?: string,
  imageMimeType?: string
): Promise<string> {
  const messages: CoreMessage[] = [
    // 会話履歴を追加
    ...conversationHistory.map((msg) => {
      if (msg.imageData && msg.imageMimeType) {
        // 画像付きメッセージ
        return {
          role: msg.role,
          content: [
            { type: 'text' as const, text: msg.content },
            {
              type: 'image' as const,
              image: `data:${msg.imageMimeType};base64,${msg.imageData}`,
            },
          ],
        };
      }
      // テキストのみのメッセージ
      return {
        role: msg.role,
        content: msg.content,
      };
    }),
  ];

  // 現在のメッセージを追加
  if (imageData && imageMimeType) {
    // 画像付きメッセージ
    messages.push({
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: message },
        {
          type: 'image' as const,
          image: `data:${imageMimeType};base64,${imageData}`,
        },
      ],
    });
  } else {
    // テキストのみのメッセージ
    messages.push({ role: 'user' as const, content: message });
  }

  const response = await chatAgent.generate(messages);

  return response.text;
}
