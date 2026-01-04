import { Hono } from 'hono';
import {
  createSession,
  validateSession,
  getSessionById,
  cleanupExpiredSessions,
} from '@/lib/session';
import { generateResponse } from '@/lib/mastra/agent';
import { prisma } from '@/lib/db/prisma';
import { ErrorCodes, createErrorResponse } from './errors';
import { loggingMiddleware, errorHandlerMiddleware } from './middleware';
import { logger } from '@/lib/logger';

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

// ミドルウェアの適用（順序重要：エラーハンドラ → ロギング）
app.use('*', errorHandlerMiddleware);
app.use('*', loggingMiddleware);

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
    logger.logDbConnection('error', dbError);
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
    logger.logError(error, 'Session creation error');
    return c.json(
      createErrorResponse(ErrorCodes.SESSION_CREATE_FAILED, 'セッションの作成に失敗しました'),
      500
    );
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
          code: ErrorCodes.SESSION_INVALID,
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
    logger.logError(error, 'Session validation error');
    return c.json(
      createErrorResponse(ErrorCodes.SESSION_VALIDATE_FAILED, 'セッションの検証に失敗しました'),
      500
    );
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
      return c.json(
        createErrorResponse(ErrorCodes.INVALID_REQUEST_BODY, 'リクエストボディが不正です'),
        400
      );
    }

    const { message, sessionId, conversationId } = body;

    // メッセージのバリデーション
    if (!message || typeof message !== 'string') {
      return c.json(createErrorResponse(ErrorCodes.MISSING_MESSAGE, 'メッセージは必須です'), 400);
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return c.json(
        createErrorResponse(ErrorCodes.EMPTY_MESSAGE, 'メッセージを入力してください'),
        400
      );
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return c.json(
        createErrorResponse(
          ErrorCodes.MESSAGE_TOO_LONG,
          `メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください`
        ),
        400
      );
    }

    // セッションIDのバリデーション
    if (!sessionId || typeof sessionId !== 'string') {
      return c.json(
        createErrorResponse(ErrorCodes.MISSING_SESSION_ID, 'セッションIDは必須です'),
        400
      );
    }

    if (!isValidUUID(sessionId)) {
      return c.json(
        createErrorResponse(ErrorCodes.INVALID_SESSION_ID_FORMAT, 'セッションIDの形式が不正です'),
        400
      );
    }

    // conversationIdのバリデーション（指定された場合）
    if (conversationId !== undefined && conversationId !== null) {
      if (typeof conversationId !== 'string' || !isValidObjectId(conversationId)) {
        return c.json(
          createErrorResponse(ErrorCodes.INVALID_CONVERSATION_ID_FORMAT, '会話IDの形式が不正です'),
          400
        );
      }
    }

    // セッション検証
    const sessionResult = await validateSession(sessionId);
    if (!sessionResult.valid) {
      return c.json(
        createErrorResponse(
          ErrorCodes.SESSION_INVALID,
          sessionResult.message || 'セッションが無効または期限切れです'
        ),
        401
      );
    }

    // セッション情報を取得
    const session = await getSessionById(sessionId);
    if (!session) {
      return c.json(
        createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, 'セッションが見つかりません'),
        404
      );
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
        return c.json(
          createErrorResponse(ErrorCodes.CONVERSATION_NOT_FOUND, '会話が見つかりません'),
          404
        );
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
    logger.logError(error, 'Chat error');
    return c.json(
      createErrorResponse(ErrorCodes.CHAT_ERROR, 'チャット処理中にエラーが発生しました'),
      500
    );
  }
});

// 定数: 会話履歴取得の最大メッセージ数
const MAX_MESSAGES_PER_CONVERSATION = 100;

// GET /api/conversations - 会話履歴取得
app.get('/conversations', async (c) => {
  try {
    const sessionId = c.req.query('sessionId');

    // セッションIDのバリデーション
    if (!sessionId || typeof sessionId !== 'string') {
      return c.json(
        createErrorResponse(ErrorCodes.MISSING_SESSION_ID, 'セッションIDは必須です'),
        400
      );
    }

    if (!isValidUUID(sessionId)) {
      return c.json(
        createErrorResponse(ErrorCodes.INVALID_SESSION_ID_FORMAT, 'セッションIDの形式が不正です'),
        400
      );
    }

    // セッション検証
    const sessionResult = await validateSession(sessionId);
    if (!sessionResult.valid) {
      return c.json(
        createErrorResponse(
          ErrorCodes.SESSION_INVALID,
          sessionResult.message || 'セッションが無効または期限切れです'
        ),
        401
      );
    }

    // セッション情報を取得
    const session = await getSessionById(sessionId);
    if (!session) {
      return c.json(
        createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, 'セッションが見つかりません'),
        404
      );
    }

    // 会話履歴を取得（最新順、各会話のメッセージは最大100件）
    const conversations = await prisma.conversation.findMany({
      where: {
        sessionId: session.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: MAX_MESSAGES_PER_CONVERSATION,
        },
      },
    });

    // レスポンス形式に変換
    const response = {
      conversations: conversations.map((conv) => ({
        id: conv.id,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        messages: conv.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        })),
      })),
    };

    return c.json(response);
  } catch (error) {
    logger.logError(error, 'Conversations fetch error');
    return c.json(
      createErrorResponse(ErrorCodes.CONVERSATIONS_FETCH_ERROR, '会話履歴の取得に失敗しました'),
      500
    );
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
      logger.error('CLEANUP_SECRET is not configured');
      return c.json(
        createErrorResponse(
          ErrorCodes.CLEANUP_NOT_CONFIGURED,
          'クリーンアップ機能が設定されていません'
        ),
        503
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(createErrorResponse(ErrorCodes.AUTH_REQUIRED, '認証が必要です'), 401);
    }

    const token = authHeader.substring(7); // 'Bearer ' の後ろを取得
    if (token !== cleanupSecret) {
      return c.json(createErrorResponse(ErrorCodes.AUTH_FAILED, '認証に失敗しました'), 403);
    }

    const deletedCount = await cleanupExpiredSessions();
    logger.info('Cleanup completed', { deletedCount });
    return c.json({
      message: '期限切れセッションを削除しました',
      deletedCount,
    });
  } catch (error) {
    logger.logError(error, 'Cleanup error');
    return c.json(
      createErrorResponse(ErrorCodes.CLEANUP_ERROR, 'クリーンアップ処理中にエラーが発生しました'),
      500
    );
  }
});
