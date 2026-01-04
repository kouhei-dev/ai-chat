'use client';

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import { MessageItem, Message } from './MessageItem';
import { Loading } from '../ui/Loading';

interface MessageListProps {
  /** 表示するメッセージの配列 */
  messages: Message[];
  /** ローディング状態（AIが応答生成中） */
  isLoading?: boolean;
}

/**
 * メッセージ一覧表示コンポーネント
 * メッセージのリストを表示し、新着メッセージ時に自動スクロール
 * キーボードナビゲーション対応
 */
export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // 新しいメッセージが追加されたら最下部にスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // メッセージrefの登録
  const setMessageRef = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      messageRefs.current.set(id, element);
    } else {
      messageRefs.current.delete(id);
    }
  }, []);

  // キーボードナビゲーション
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (messages.length === 0) return;

      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowUp':
        case 'k': // vim style
          e.preventDefault();
          newIndex = focusedIndex <= 0 ? messages.length - 1 : focusedIndex - 1;
          break;
        case 'ArrowDown':
        case 'j': // vim style
          e.preventDefault();
          newIndex = focusedIndex >= messages.length - 1 ? 0 : focusedIndex + 1;
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = messages.length - 1;
          break;
        default:
          return;
      }

      setFocusedIndex(newIndex);
      const messageId = messages[newIndex]?.id;
      if (messageId) {
        const element = messageRefs.current.get(messageId);
        element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        element?.focus();
      }
    },
    [focusedIndex, messages]
  );

  // フォーカスがコンテナに入った時の処理
  const handleFocus = useCallback(() => {
    if (focusedIndex === -1 && messages.length > 0) {
      setFocusedIndex(messages.length - 1);
    }
  }, [focusedIndex, messages.length]);

  return (
    <div
      ref={containerRef}
      role="log"
      aria-label="チャット履歴"
      aria-live="polite"
      aria-relevant="additions"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      className="flex-1 overflow-y-auto p-4 md:p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-inset"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-[var(--secondary)]">
          <p>メッセージを送信して会話を始めましょう</p>
        </div>
      ) : (
        <>
          {messages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              ref={(el) => setMessageRef(message.id, el)}
              isFocused={focusedIndex === index}
              tabIndex={focusedIndex === index ? 0 : -1}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-4" role="status" aria-label="AIが応答を生成中">
              <div className="bg-[var(--assistant-bubble)] px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-[var(--border)]">
                <Loading size="small" message="考え中..." />
              </div>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
