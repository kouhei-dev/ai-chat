'use client';

import { useState, useCallback, FormEvent, KeyboardEvent } from 'react';
import { Button } from '../ui/Button';

/** メッセージの最大文字数（APIと同じ制限） */
export const MAX_MESSAGE_LENGTH = 400;

/** 連続送信防止の待機時間（ミリ秒） */
export const SEND_THROTTLE_MS = 1000;

/** 画像の最大サイズ（バイト） */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/** 対応画像形式 */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface ChatInputProps {
  /** メッセージ送信時のコールバック */
  onSend: (message: string, imageData?: string, imageMimeType?: string) => void;
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
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const canSend = message.trim().length > 0 && !isLoading && !isThrottled;

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルタイプの検証
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('対応していない画像形式です。JPEG, PNG, GIF, WebPのいずれかを選択してください。');
      return;
    }

    // ファイルサイズの検証
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError(`画像サイズは${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください。`);
      return;
    }

    // base64エンコード
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:image/jpeg;base64,... の形式から base64 部分だけを取得
      const base64Data = result.split(',')[1];
      setImageData(base64Data);
      setImageMimeType(file.type);
      setImageError(null);
    };
    reader.onerror = () => {
      setImageError('画像の読み込みに失敗しました。');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageData(null);
    setImageMimeType(null);
    setImageError(null);
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) {
      return;
    }

    const trimmedMessage = message.trim();

    // 送信処理
    onSend(trimmedMessage, imageData || undefined, imageMimeType || undefined);
    setMessage('');
    setImageData(null);
    setImageMimeType(null);
    setImageError(null);

    // スロットル状態を設定（連続送信防止）
    setIsThrottled(true);
    setTimeout(() => {
      setIsThrottled(false);
    }, SEND_THROTTLE_MS);
  }, [canSend, message, imageData, imageMimeType, onSend]);

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
      <div className="max-w-4xl mx-auto">
        {/* 画像プレビュー */}
        {imageData && imageMimeType && (
          <div className="mb-3 relative inline-block">
            <img
              src={`data:${imageMimeType};base64,${imageData}`}
              alt="プレビュー"
              className="rounded-lg max-h-32 border border-[var(--border)]"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="画像を削除"
            >
              ×
            </button>
          </div>
        )}

        {/* エラーメッセージ */}
        {imageError && (
          <div className="mb-3 text-sm text-red-600" role="alert">
            {imageError}
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              disabled={isLoading}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={1}
              aria-label="メッセージ入力欄"
              aria-describedby="input-hint character-count"
              className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* 画像アップロードボタン */}
          <label
            className="flex items-center justify-center px-4 py-3 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="画像を添付"
          >
            <input
              type="file"
              accept={SUPPORTED_IMAGE_TYPES.join(',')}
              onChange={handleImageSelect}
              disabled={isLoading}
              className="hidden"
            />
            <span className="text-2xl">📎</span>
          </label>

          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!canSend}
            aria-label={isLoading ? 'メッセージを送信中' : 'メッセージを送信'}
          >
            送信
          </Button>
        </div>
        <div className="flex justify-between items-center mt-2">
          <p id="input-hint" className="text-xs text-[var(--secondary)]">
            Enterで送信 / Shift+Enterで改行
          </p>
          <p
            id="character-count"
            aria-live="polite"
            aria-atomic="true"
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
      </div>
    </form>
  );
}
