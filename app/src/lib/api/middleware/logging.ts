/**
 * ロギングミドルウェア
 *
 * リクエスト/レスポンスのロギングとレスポンスタイム計測を行う
 */

import type { Context, MiddlewareHandler, Next } from 'hono';
import { logger, type LogContext } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

// リクエストIDを格納するためのキー
const REQUEST_ID_KEY = 'requestId';

/**
 * リクエストIDを取得
 * Cloud Run等のリバースプロキシが設定している場合はそれを使用
 */
function getRequestId(c: Context): string {
  // Cloud RunやLoad Balancerが設定するトレースヘッダー
  const traceHeader = c.req.header('X-Cloud-Trace-Context');
  if (traceHeader) {
    // フォーマット: TRACE_ID/SPAN_ID;o=TRACE_TRUE
    const traceId = traceHeader.split('/')[0];
    if (traceId) return traceId;
  }

  // X-Request-Idヘッダー
  const requestId = c.req.header('X-Request-Id');
  if (requestId) return requestId;

  // 新しいIDを生成
  return uuidv4();
}

/**
 * クライアントIPアドレスを取得
 */
function getClientIp(c: Context): string | undefined {
  // X-Forwarded-For ヘッダー（プロキシ経由）
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // X-Real-IP ヘッダー
  const realIp = c.req.header('X-Real-IP');
  if (realIp) return realIp;

  return undefined;
}

/**
 * ロギングミドルウェア
 *
 * 機能:
 * - リクエストIDの付与（トレーシング用）
 * - リクエスト/レスポンスのロギング
 * - レスポンスタイムの計測とヘッダー付与
 */
export const loggingMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const startTime = performance.now();
  const requestId = getRequestId(c);

  // コンテキストにリクエストIDを保存
  c.set(REQUEST_ID_KEY, requestId);

  // リクエスト情報を収集
  const method = c.req.method;
  const path = c.req.path;
  const userAgent = c.req.header('User-Agent');
  const clientIp = getClientIp(c);

  // リクエスト開始ログ（開発環境のみ）
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`--> ${method} ${path}`, {
      requestId,
      userAgent,
      clientIp,
    });
  }

  // リクエスト処理
  await next();

  // レスポンスタイム計算
  const endTime = performance.now();
  const latencyMs = Math.round(endTime - startTime);

  // X-Response-Timeヘッダーを追加
  c.res.headers.set('X-Response-Time', `${latencyMs}ms`);

  // X-Request-Idヘッダーを追加（トレーシング用）
  c.res.headers.set('X-Request-Id', requestId);

  // ロギング用コンテキスト
  const logContext: LogContext = {
    requestId,
    userAgent,
    clientIp,
  };

  // セッションIDがあれば追加
  try {
    const body = c.req.raw.clone();
    const json = await body.json().catch(() => null);
    if (json && typeof json === 'object' && 'sessionId' in json) {
      logContext.sessionId = String(json.sessionId);
    }
  } catch {
    // JSON解析エラーは無視
  }

  // レスポンスログ
  logger.logRequest(method, path, c.res.status, latencyMs, logContext);
};

/**
 * リクエストIDを取得するヘルパー関数
 */
export function getRequestIdFromContext(c: Context): string | undefined {
  return c.get(REQUEST_ID_KEY);
}

export default loggingMiddleware;
