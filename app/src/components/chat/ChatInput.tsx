'use client';

import { useState, useCallback, FormEvent, KeyboardEvent } from 'react';
import { Button } from '../ui/Button';

/** メッセージの最大文字数（APIと同じ制限） */
export const MAX_MESSAGE_LENGTH = 400;

/** 連続送信防止の待機時間（ミリ秒） */
export const SEND_THROTTLE_MS = 1000;

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
  const [isThrottled, setIsThrottled] = useState(false);

  const canSend = message.trim().length > 0 && !isLoading && !isThrottled;

  const handleSend = useCallback(() => {
    if (!canSend) {
      return;
    }

    const trimmedMessage = message.trim();

    // 送信処理
    onSend(trimmedMessage);
    setMessage('');

    // スロットル状態を設定（連続送信防止）
    setIsThrottled(true);
    setTimeout(() => {
      setIsThrottled(false);
    }, SEND_THROTTLE_MS);
  }, [canSend, message, onSend]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enterキーで送信（Shift+Enterは改行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // 最大文字数を超えないように制限
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(value);
    }
  };

  const characterCount = message.length;
  const isNearLimit = characterCount >= MAX_MESSAGE_LENGTH * 0.8;
  const isAtLimit = characterCount >= MAX_MESSAGE_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="border-t border-[var(--border)] bg-white p-4">
      <div className="flex gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            disabled={isLoading}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <Button type="submit" isLoading={isLoading} disabled={!canSend}>
          送信
        </Button>
      </div>
      <div className="flex justify-between items-center max-w-4xl mx-auto mt-2">
        <p className="text-xs text-[var(--secondary)]">Enterで送信 / Shift+Enterで改行</p>
        <p
          className={`text-xs ${
            isAtLimit
              ? 'text-red-600 font-medium'
              : isNearLimit
                ? 'text-amber-600'
                : 'text-[var(--secondary)]'
          }`}
        >
          {characterCount} / {MAX_MESSAGE_LENGTH}
        </p>
      </div>
    </form>
  );
}
