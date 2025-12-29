'use client';

import { useState, FormEvent, KeyboardEvent } from 'react';
import { Button } from '../ui/Button';

interface ChatInputProps {
  /** メッセージ送信時のコールバック */
  onSend: (message: string) => void;
  /** 送信中かどうか（trueの場合、入力を無効化） */
  isLoading?: boolean;
}

/**
 * メッセージ入力フォームコンポーネント
 * テキスト入力と送信ボタンを提供
 */
export function ChatInput({ onSend, isLoading = false }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enterキーで送信（Shift+Enterは改行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-[var(--border)] bg-white p-4">
      <div className="flex gap-3 max-w-4xl mx-auto">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力..."
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button type="submit" isLoading={isLoading} disabled={!message.trim()}>
          送信
        </Button>
      </div>
      <p className="text-xs text-[var(--secondary)] text-center mt-2">
        Enterで送信 / Shift+Enterで改行
      </p>
    </form>
  );
}
