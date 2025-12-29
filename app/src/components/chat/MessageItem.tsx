'use client';

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
}

/**
 * 個別メッセージ表示コンポーネント
 * ユーザーとAIのメッセージを区別してスタイリング
 */
export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] md:max-w-[70%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-[var(--user-bubble)] text-[var(--user-text)] rounded-br-md'
            : 'bg-[var(--assistant-bubble)] text-[var(--assistant-text)] rounded-bl-md shadow-sm border border-[var(--border)]'
        }`}
      >
        <p className="text-sm md:text-base whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}
