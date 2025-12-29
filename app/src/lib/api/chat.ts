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

export async function createSession(): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE}/session`, {
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
  const response = await fetch(`${API_BASE}/session/${sessionId}`, {
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
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || 'メッセージの送信に失敗しました');
  }

  return response.json();
}
