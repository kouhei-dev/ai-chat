/**
 * エラー追跡ユーティリティ
 *
 * Sentryへのエラー報告機能を提供
 * 環境変数 SENTRY_DSN が設定されている場合のみ有効
 */

import { logger } from '@/lib/logger';

// Sentryの型定義（動的インポート用）
interface SentryLike {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, context?: Record<string, unknown>) => string;
  captureMessage: (message: string, level?: string) => string;
  setUser: (user: { id?: string; email?: string } | null) => void;
  setTag: (key: string, value: string) => void;
  setExtra: (key: string, value: unknown) => void;
}

// Sentryインスタンス（動的にロード）
let sentry: SentryLike | null = null;
let isInitialized = false;

/**
 * エラー追跡を初期化
 * SENTRY_DSNが設定されている場合のみSentryを初期化
 */
export async function initErrorTracking(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  const sentryDsn = process.env.SENTRY_DSN;

  if (!sentryDsn) {
    logger.info('Error tracking disabled (SENTRY_DSN not configured)');
    return;
  }

  try {
    // Sentryを動的にインポート（オプショナル依存）
    // @ts-expect-error - Sentryはオプショナル依存のため型定義がない場合がある
    const sentryModule = await import('@sentry/node').catch(() => null);

    if (!sentryModule) {
      logger.warn('Sentry package not installed, error tracking disabled');
      return;
    }

    (sentryModule as SentryLike).init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version,
      // Cloud Run/GCP向けの設定
      serverName: process.env.K_SERVICE || 'ai-chat',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // パフォーマンス計測のサンプリングレート（本番は10%）
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });

    sentry = sentryModule as SentryLike;
    logger.info('Error tracking initialized (Sentry)', {
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    logger.logError(error, 'Failed to initialize Sentry');
  }
}

/**
 * エラーを報告
 */
export function captureError(
  error: Error | unknown,
  context?: {
    requestId?: string;
    sessionId?: string;
    path?: string;
    method?: string;
    [key: string]: unknown;
  }
): void {
  // 常にロガーにも出力
  logger.logError(error, 'Captured error', context);

  if (!sentry) return;

  try {
    // コンテキスト情報を設定
    if (context) {
      if (context.requestId) {
        sentry.setTag('requestId', context.requestId);
      }
      if (context.sessionId) {
        sentry.setTag('sessionId', context.sessionId);
      }
      if (context.path) {
        sentry.setTag('path', context.path);
      }
      if (context.method) {
        sentry.setTag('method', context.method);
      }

      // 追加のコンテキストをextraに設定
      Object.entries(context).forEach(([key, value]) => {
        if (!['requestId', 'sessionId', 'path', 'method'].includes(key)) {
          sentry!.setExtra(key, value);
        }
      });
    }

    sentry.captureException(error);
  } catch (captureError) {
    logger.logError(captureError, 'Failed to capture error in Sentry');
  }
}

/**
 * メッセージを報告（エラー以外のイベント）
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  if (!sentry) {
    logger.info(`Captured message: ${message}`, { level });
    return;
  }

  try {
    sentry.captureMessage(message, level);
  } catch (error) {
    logger.logError(error, 'Failed to capture message in Sentry');
  }
}

/**
 * ユーザー情報を設定
 */
export function setUser(user: { id?: string; email?: string } | null): void {
  if (!sentry) return;
  sentry.setUser(user);
}

/**
 * エラー追跡が有効かどうかを確認
 */
export function isErrorTrackingEnabled(): boolean {
  return sentry !== null;
}

const errorTracking = {
  init: initErrorTracking,
  captureError,
  captureMessage,
  setUser,
  isEnabled: isErrorTrackingEnabled,
};

export default errorTracking;
