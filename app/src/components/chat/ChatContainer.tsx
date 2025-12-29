'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { Loading } from '../ui/Loading';
import { Message } from './MessageItem';
import { createSession, validateSession, sendMessage, SessionResponse } from '@/lib/api/chat';

const SESSION_KEY = 'ai-chat-session-id';

/**
 * チャット全体のコンテナコンポーネント
 * セッション管理、メッセージ送受信、状態管理を担当
 */
export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // セッションの初期化
  const initializeSession = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // localStorageからセッションIDを取得
      const storedSessionId = localStorage.getItem(SESSION_KEY);

      if (storedSessionId) {
        // 既存セッションの検証
        const validation = await validateSession(storedSessionId);
        if (validation.valid) {
          setSessionId(storedSessionId);
          setIsInitializing(false);
          return;
        }
        // 無効なセッションは削除
        localStorage.removeItem(SESSION_KEY);
      }

      // 新規セッションの作成
      const session: SessionResponse = await createSession();
      localStorage.setItem(SESSION_KEY, session.sessionId);
      setSessionId(session.sessionId);
    } catch (err) {
      setError('セッションの初期化に失敗しました。ページを再読み込みしてください。');
      console.error('Session initialization error:', err);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // メッセージ送信
  const handleSend = async (content: string) => {
    if (!sessionId) {
      setError('セッションが無効です。ページを再読み込みしてください。');
      return;
    }

    // ユーザーメッセージを追加
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendMessage({
        message: content,
        sessionId,
        conversationId: conversationId || undefined,
      });

      // 会話IDを保存
      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      // AIの応答を追加
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'メッセージの送信に失敗しました';
      setError(errorMessage);
      console.error('Message send error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 初期化中の表示
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading size="large" message="初期化中..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* ヘッダー */}
      <header className="bg-white border-b border-[var(--border)] px-4 py-3 shadow-sm">
        <h1 className="text-lg md:text-xl font-bold text-center text-[var(--foreground)]">
          AIチャット
        </h1>
      </header>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-4 rounded">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* メッセージ一覧 */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* 入力フォーム */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
