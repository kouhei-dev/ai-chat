/**
 * エラーハンドリングミドルウェア
 *
 * 未処理のエラーをキャッチしてログ出力とレスポンス整形を行う
 */

import type { Context, MiddlewareHandler, Next } from 'hono';
import { logger } from '@/lib/logger';
import { ErrorCodes, createErrorResponse } from '../errors';

/**
 * グローバルエラーハンドリングミドルウェア
 *
 * 機能:
 * - 未処理エラーのキャッチとログ出力
 * - 統一されたエラーレスポンス形式
 * - スタックトレースの適切な処理（本番環境では非表示）
 */
export const errorHandlerMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    const requestId = c.get('requestId') as string | undefined;
    const isProduction = process.env.NODE_ENV === 'production';

    // エラーログ出力
    logger.logError(error, 'Unhandled error in request handler', {
      requestId,
      path: c.req.path,
      method: c.req.method,
    });

    // エラーレスポンスを構築
    const statusCode = getStatusCodeFromError(error);
    const errorMessage = isProduction
      ? 'サーバーエラーが発生しました'
      : error instanceof Error
        ? error.message
        : String(error);

    const baseResponse = createErrorResponse(ErrorCodes.INTERNAL_ERROR, errorMessage);

    // レスポンスオブジェクトを構築
    const response: Record<string, unknown> = {
      ...baseResponse,
    };

    // 開発環境ではスタックトレースを追加
    if (!isProduction && error instanceof Error && error.stack) {
      response.stack = error.stack;
    }

    // リクエストIDをレスポンスに含める
    if (requestId) {
      response.requestId = requestId;
    }

    return c.json(response, statusCode as 500 | 503);
  }
};

/**
 * エラーからHTTPステータスコードを推測
 */
function getStatusCodeFromError(error: unknown): number {
  if (error instanceof Error) {
    // Prismaのエラー
    if (error.name === 'PrismaClientKnownRequestError') {
      return 400;
    }
    if (error.name === 'PrismaClientInitializationError') {
      return 503;
    }

    // カスタムエラーでstatusCodeプロパティがある場合
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
  }

  return 500;
}

export default errorHandlerMiddleware;
