'use client';

import { useEffect, useRef } from 'react';
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
 */
export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが追加されたら最下部にスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-[var(--secondary)]">
          <p>メッセージを送信して会話を始めましょう</p>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-4">
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
