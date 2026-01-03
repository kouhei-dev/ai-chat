import { Hono } from 'hono';
import {
  createSession,
  validateSession,
  getSessionById,
  cleanupExpiredSessions,
} from '@/lib/session';
import { generateResponse } from '@/lib/mastra/agent';
import { prisma } from '@/lib/db/prisma';

// 定数
const MAX_MESSAGE_LENGTH = 400; // メッセージの最大文字数
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_REGEX = /^[0-9a-f]{24}$/i;

// UUIDv4形式の検証
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// MongoDB ObjectID形式の検証
function isValidObjectId(value: string): boolean {
  return OBJECT_ID_REGEX.test(value);
}

export const app = new Hono().basePath('/api');

// Health check endpoint with database connection verification
app.get('/health', async (c) => {
  const startTime = Date.now();

  // 環境変数チェック
  const anthropicApiKeyConfigured = !!process.env.ANTHROPIC_API_KEY;

  // データベース接続チェック
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let dbError: string | undefined;

  try {
    // シンプルなクエリでDB接続を確認
    await prisma.$runCommandRaw({ ping: 1 });
    dbStatus = 'connected';
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'Unknown error';
    console.error('Health check - DB connection error:', dbError);
  }

  const responseTime = Date.now() - startTime;

  // 全体のステータス判定
  const isHealthy = dbStatus === 'connected' && anthropicApiKeyConfigured;

  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
    checks: {
      database: {
        status: dbStatus,
        ...(dbError && { error: dbError }),
      },
      configuration: {
        anthropicApiKey: anthropicApiKeyConfigured ? 'configured' : 'missing',
      },
    },
  };

  return c.json(response, isHealthy ? 200 : 503);
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
    // JSONパースエラーハンドリング
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'リクエストボディが不正です' }, 400);
    }

    const { message, sessionId, conversationId } = body;

    // メッセージのバリデーション
    if (!message || typeof message !== 'string') {
      return c.json({ error: 'メッセージは必須です' }, 400);
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return c.json({ error: 'メッセージを入力してください' }, 400);
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return c.json({ error: `メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください` }, 400);
    }

    // セッションIDのバリデーション
    if (!sessionId || typeof sessionId !== 'string') {
      return c.json({ error: 'セッションIDは必須です' }, 400);
    }

    if (!isValidUUID(sessionId)) {
      return c.json({ error: 'セッションIDの形式が不正です' }, 400);
    }

    // conversationIdのバリデーション（指定された場合）
    if (conversationId !== undefined && conversationId !== null) {
      if (typeof conversationId !== 'string' || !isValidObjectId(conversationId)) {
        return c.json({ error: '会話IDの形式が不正です' }, 400);
      }
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
      // セッション所有権を検証：sessionIdも条件に含める
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          sessionId: session.id, // セッション所有権の検証
        },
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
      role: msg.role,
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

// POST /api/cleanup - 期限切れセッションのクリーンアップ
// Cloud Schedulerから定期実行される想定
// 認証: Authorization: Bearer <CLEANUP_SECRET> ヘッダーが必要
app.post('/cleanup', async (c) => {
  try {
    // 認証チェック
    const authHeader = c.req.header('Authorization');
    const cleanupSecret = process.env.CLEANUP_SECRET;

    if (!cleanupSecret) {
      console.error('CLEANUP_SECRET is not configured');
      return c.json({ error: 'クリーンアップ機能が設定されていません' }, 503);
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: '認証が必要です' }, 401);
    }

    const token = authHeader.substring(7); // 'Bearer ' の後ろを取得
    if (token !== cleanupSecret) {
      return c.json({ error: '認証に失敗しました' }, 403);
    }

    const deletedCount = await cleanupExpiredSessions();
    return c.json({
      message: '期限切れセッションを削除しました',
      deletedCount,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return c.json({ error: 'クリーンアップ処理中にエラーが発生しました' }, 500);
  }
});
