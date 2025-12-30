import { Hono } from 'hono';
import { createSession, validateSession, getSessionById } from '@/lib/session';
import { generateResponse } from '@/lib/mastra/agent';
import { prisma } from '@/lib/db/prisma';

export const app = new Hono().basePath('/api');

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// POST /api/session - 新規セッション作成
app.post('/session', async (c) => {
  try {
    const { sessionId, expiresAt } = await createSession();
    return c.json({ sessionId, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('Session creation error:', error);
    return c.json({ error: 'セッションの作成に失敗しました' }, 500);
  }
});

// GET /api/session/:sessionId - セッション検証
app.get('/session/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const result = await validateSession(sessionId);

    if (!result.valid) {
      return c.json(
        {
          valid: false,
          message: result.message || 'セッションが無効または期限切れです',
        },
        400
      );
    }

    return c.json({
      valid: true,
      sessionId: result.session!.sessionId,
      expiresAt: result.session!.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return c.json({ error: 'セッションの検証に失敗しました' }, 500);
  }
});

// POST /api/chat - チャットメッセージ送信
app.post('/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { message, sessionId, conversationId } = body;

    // バリデーション
    if (!message || typeof message !== 'string') {
      return c.json({ error: 'メッセージは必須です' }, 400);
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return c.json({ error: 'セッションIDは必須です' }, 400);
    }

    // セッション検証
    const sessionResult = await validateSession(sessionId);
    if (!sessionResult.valid) {
      return c.json(
        {
          error: sessionResult.message || 'セッションが無効または期限切れです',
        },
        401
      );
    }

    // セッション情報を取得
    const session = await getSessionById(sessionId);
    if (!session) {
      return c.json({ error: 'セッションが見つかりません' }, 404);
    }

    // 会話を取得または作成
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!conversation) {
        return c.json({ error: '会話が見つかりません' }, 404);
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          sessionId: session.id,
        },
        include: {
          messages: true,
        },
      });
    }

    // ユーザーメッセージを保存
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    // 会話履歴を準備
    const conversationHistory = conversation.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // AI応答を生成
    const responseText = await generateResponse(message, conversationHistory);

    // アシスタントメッセージを保存
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: responseText,
      },
    });

    return c.json({
      response: responseText,
      conversationId: conversation.id,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'チャット処理中にエラーが発生しました' }, 500);
  }
});
