import { randomUUID } from 'crypto';
import { prisma } from '../db/prisma';

const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || '24', 10);

export function generateSessionId(): string {
  return randomUUID();
}

export function calculateExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);
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
