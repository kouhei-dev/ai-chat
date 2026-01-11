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
  imageData?: string; // base64エンコードされた画像データ
  imageMimeType?: string; // 画像のMIMEタイプ
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  sessionId: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  imageData?: string; // base64エンコードされた画像データ
  imageMimeType?: string; // 画像のMIMEタイプ
  createdAt: string;
}

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface ApiError {
  error: string;
  code?: string;
}

const API_BASE = '/api';

/**
 * レスポンスをJSONとしてパースする（エラーハンドリング付き）
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error('サーバーからの応答が空です');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('サーバーからの応答を解析できませんでした');
  }
}

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
    const error = await parseJsonResponse<ApiError>(response);
    throw new Error(error.error || 'セッションの作成に失敗しました');
  }

  return parseJsonResponse<SessionResponse>(response);
}

export async function validateSession(sessionId: string): Promise<SessionValidationResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/session/${sessionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    try {
      const error = await parseJsonResponse<ApiError>(response);
      return {
        valid: false,
        message: error.error || 'セッションの検証に失敗しました',
      };
    } catch {
      return {
        valid: false,
        message: 'セッションの検証に失敗しました',
      };
    }
  }

  return parseJsonResponse<SessionValidationResponse>(response);
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
    const error = await parseJsonResponse<ApiError>(response);
    throw new Error(error.error || 'メッセージの送信に失敗しました');
  }

  return parseJsonResponse<ChatResponse>(response);
}

export async function getConversations(sessionId: string): Promise<ConversationsResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/conversations?sessionId=${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await parseJsonResponse<ApiError>(response);
    throw new Error(error.error || '会話履歴の取得に失敗しました');
  }

  return parseJsonResponse<ConversationsResponse>(response);
}
