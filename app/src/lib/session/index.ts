import { randomUUID } from 'crypto';
import { prisma } from '../db/prisma';

/**
 * 環境変数からセッション有効期限（時間）を取得する
 * @returns セッション有効期限（時間）
 * @throws 環境変数が不正な値の場合
 */
function getSessionExpiryHours(): number {
  const envValue = process.env.SESSION_EXPIRY_HOURS;

  // 環境変数が未設定の場合はデフォルト値を返す
  if (envValue === undefined || envValue === '') {
    return 24;
  }

  const hours = parseInt(envValue, 10);

  // 数値に変換できない場合はエラー
  if (isNaN(hours)) {
    throw new Error(`SESSION_EXPIRY_HOURS must be a valid number, got: ${envValue}`);
  }

  // 0以下の値はエラー
  if (hours <= 0) {
    throw new Error(`SESSION_EXPIRY_HOURS must be a positive number, got: ${hours}`);
  }

  return hours;
}

export function generateSessionId(): string {
  return randomUUID();
}

export function calculateExpiryDate(): Date {
  const sessionExpiryHours = getSessionExpiryHours();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + sessionExpiryHours);
  return expiresAt;
}

export async function createSession(): Promise<{
  sessionId: string;
  expiresAt: Date;
}> {
  const sessionId = generateSessionId();
  const expiresAt = calculateExpiryDate();

  await prisma.session.create({
    data: {
      sessionId,
      expiresAt,
    },
  });

  return { sessionId, expiresAt };
}

export async function validateSession(sessionId: string): Promise<{
  valid: boolean;
  session?: {
    sessionId: string;
    expiresAt: Date;
  };
  message?: string;
}> {
  const session = await prisma.session.findUnique({
    where: { sessionId },
  });

  if (!session) {
    return {
      valid: false,
      message: 'セッションが見つかりません',
    };
  }

  if (new Date() > session.expiresAt) {
    return {
      valid: false,
      message: 'セッションが期限切れです',
    };
  }

  return {
    valid: true,
    session: {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    },
  };
}

export async function getSessionById(sessionId: string) {
  return prisma.session.findUnique({
    where: { sessionId },
    include: {
      conversations: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

/**
 * 期限切れセッションとその関連データ（Conversation, Message）を削除する
 * @returns 削除されたセッション数
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();

  // 期限切れセッションを取得
  const expiredSessions = await prisma.session.findMany({
    where: {
      expiresAt: { lt: now },
    },
    select: { id: true },
  });

  if (expiredSessions.length === 0) {
    return 0;
  }

  const sessionIds = expiredSessions.map((s) => s.id);

  // 関連する会話を取得
  const conversations = await prisma.conversation.findMany({
    where: {
      sessionId: { in: sessionIds },
    },
    select: { id: true },
  });

  const conversationIds = conversations.map((c) => c.id);

  // トランザクションで関連データを削除
  // 順序: Messages → Conversations → Sessions
  await prisma.$transaction([
    // メッセージを削除
    prisma.message.deleteMany({
      where: {
        conversationId: { in: conversationIds },
      },
    }),
    // 会話を削除
    prisma.conversation.deleteMany({
      where: {
        sessionId: { in: sessionIds },
      },
    }),
    // セッションを削除
    prisma.session.deleteMany({
      where: {
        id: { in: sessionIds },
      },
    }),
  ]);

  return expiredSessions.length;
}
