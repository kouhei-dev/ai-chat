export interface SessionResponse {
  sessionId: string;
  expiresAt: string;
}

export interface SessionValidationResponse {
  valid: boolean;
  sessionId?: string;
  expiresAt?: string;
  message?: string;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  conversationId?: string;
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  sessionId: string;
}

export interface ApiError {
  error: string;
}

const API_BASE = '/api';

// タイムアウト設定（ミリ秒）
export const DEFAULT_TIMEOUT = 30000; // 30秒
export const CHAT_TIMEOUT = 60000; // チャットAPI用: 60秒（AI応答待ちを考慮）

/**
 * タイムアウト付きfetchリクエスト
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('リクエストがタイムアウトしました。時間をおいて再度お試しください。');
    }
    throw error;
  }
}

export async function createSession(): Promise<SessionResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || 'セッションの作成に失敗しました');
  }

  return response.json();
}

export async function validateSession(sessionId: string): Promise<SessionValidationResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/session/${sessionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    return {
      valid: false,
      message: error.error || 'セッションの検証に失敗しました',
    };
  }

  return response.json();
}

export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
    CHAT_TIMEOUT // チャットAPIは長めのタイムアウトを設定
  );

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || 'メッセージの送信に失敗しました');
  }

  return response.json();
}
