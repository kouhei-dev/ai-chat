/**
 * APIエラーコード定義
 * 統一的なエラーハンドリングのためのエラーコード体系
 */

// エラーコード定義
export const ErrorCodes = {
  // バリデーションエラー (400)
  INVALID_REQUEST_BODY: 'INVALID_REQUEST_BODY',
  MISSING_MESSAGE: 'MISSING_MESSAGE',
  EMPTY_MESSAGE: 'EMPTY_MESSAGE',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  MISSING_SESSION_ID: 'MISSING_SESSION_ID',
  INVALID_SESSION_ID_FORMAT: 'INVALID_SESSION_ID_FORMAT',
  INVALID_CONVERSATION_ID_FORMAT: 'INVALID_CONVERSATION_ID_FORMAT',

  // 認証エラー (401)
  SESSION_INVALID: 'SESSION_INVALID',
  AUTH_REQUIRED: 'AUTH_REQUIRED',

  // 認可エラー (403)
  AUTH_FAILED: 'AUTH_FAILED',

  // Not Found (404)
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',

  // サーバーエラー (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
  SESSION_VALIDATE_FAILED: 'SESSION_VALIDATE_FAILED',
  CHAT_ERROR: 'CHAT_ERROR',
  CLEANUP_ERROR: 'CLEANUP_ERROR',

  // サービス利用不可 (503)
  CLEANUP_NOT_CONFIGURED: 'CLEANUP_NOT_CONFIGURED',
  SERVICE_UNHEALTHY: 'SERVICE_UNHEALTHY',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// APIエラーレスポンス型
export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
}

/**
 * 統一されたエラーレスポンスを生成するヘルパー関数
 */
export function createErrorResponse(code: ErrorCode, message: string): ApiErrorResponse {
  return {
    error: message,
    code,
  };
}
