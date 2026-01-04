'use client';

import { forwardRef } from 'react';

/**
 * メッセージの型定義
 */
export interface Message {
  /** メッセージの一意識別子 */
  id: string;
  /** 送信者の役割（user: ユーザー, assistant: AI） */
  role: 'user' | 'assistant';
  /** メッセージの内容 */
  content: string;
}

interface MessageItemProps {
  /** 表示するメッセージ */
  message: Message;
  /** フォーカス状態（キーボードナビゲーション用） */
  isFocused?: boolean;
  /** タブインデックス（キーボードナビゲーション用） */
  tabIndex?: number;
}

/**
 * 個別メッセージ表示コンポーネント
 * ユーザーとAIのメッセージを区別してスタイリング
 * キーボードナビゲーション対応
 */
export const MessageItem = forwardRef<HTMLDivElement, MessageItemProps>(
  ({ message, isFocused = false, tabIndex = -1 }, ref) => {
    const isUser = message.role === 'user';
    const roleLabel = isUser ? 'あなた' : 'AI';

    return (
      <div
        ref={ref}
        tabIndex={tabIndex}
        aria-label={`${roleLabel}のメッセージ: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 focus:outline-none`}
      >
        <div
          className={`max-w-[80%] md:max-w-[70%] px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-[var(--user-bubble)] text-[var(--user-text)] rounded-br-md'
              : 'bg-[var(--assistant-bubble)] text-[var(--assistant-text)] rounded-bl-md shadow-sm border border-[var(--border)]'
          } ${isFocused ? 'ring-2 ring-[var(--primary)] ring-offset-2' : ''}`}
        >
          <p className="text-sm md:text-base whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }
);

MessageItem.displayName = 'MessageItem';
