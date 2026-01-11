'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { Loading } from '../ui/Loading';
import { Message } from './MessageItem';
import {
  createSession,
  validateSession,
  sendMessage,
  getConversations,
  SessionResponse,
} from '@/lib/api/chat';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';

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
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  // セッションの初期化
  const initializeSession = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // localStorageからセッションIDを取得（エラーハンドリング付き）
      const storedSessionId = safeGetItem(SESSION_KEY);

      if (storedSessionId) {
        // 既存セッションの検証
        const validation = await validateSession(storedSessionId);
        if (validation.valid) {
          setSessionId(storedSessionId);

          // 会話履歴を取得
          try {
            const { conversations } = await getConversations(storedSessionId);
            if (conversations.length > 0) {
              // 最新の会話を使用
              const latestConversation = conversations[0];
              setConversationId(latestConversation.id);

              // メッセージを復元
              const restoredMessages: Message[] = latestConversation.messages.map((msg, index) => ({
                id: `restored-${msg.role}-${index}`,
                role: msg.role,
                content: msg.content,
                imageData: msg.imageData,
                imageMimeType: msg.imageMimeType,
              }));
              setMessages(restoredMessages);
            }
          } catch (err) {
            // 履歴取得に失敗しても、セッションは有効なので続行
            console.warn('会話履歴の取得に失敗しました:', err);
          }

          setIsInitializing(false);
          return;
        }
        // 無効なセッションは削除
        safeRemoveItem(SESSION_KEY);
      }

      // 新規セッションの作成
      const session: SessionResponse = await createSession();
      // セッションIDをlocalStorageに保存（失敗しても処理は続行）
      if (!safeSetItem(SESSION_KEY, session.sessionId)) {
        console.warn(
          'セッションIDの保存に失敗しました。ページを再読み込みすると新しいセッションが作成されます。'
        );
      }
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
  const handleSend = async (content: string, imageData?: string, imageMimeType?: string) => {
    if (!sessionId) {
      setError('セッションが無効です。ページを再読み込みしてください。');
      return;
    }

    // ユーザーメッセージを追加
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      imageData,
      imageMimeType,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setFailedMessage(null);

    try {
      const response = await sendMessage({
        message: content,
        sessionId,
        conversationId: conversationId || undefined,
        imageData,
        imageMimeType,
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
      setFailedMessage(content);
      console.error('Message send error:', err);

      // 失敗したメッセージを削除
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  // リトライ処理
  const handleRetry = () => {
    if (failedMessage) {
      handleSend(failedMessage);
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
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-4 rounded"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-red-700 text-sm flex-1">{error}</p>
            {failedMessage && (
              <button
                onClick={handleRetry}
                disabled={isLoading}
                aria-label="失敗したメッセージを再送信"
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                再送信
              </button>
            )}
          </div>
        </div>
      )}

      {/* メッセージ一覧 */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* 入力フォーム */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
