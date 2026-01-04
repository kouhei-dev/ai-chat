'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * ボタンコンポーネントのプロパティ
 * HTMLButtonElementの標準属性を継承し、カスタムプロパティを追加
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** ボタン内に表示する内容 */
  children: ReactNode;
  /** ボタンのスタイルバリエーション（primary: 青, secondary: グレー） */
  variant?: 'primary' | 'secondary';
  /** ローディング状態（trueの場合、スピナーを表示し操作を無効化） */
  isLoading?: boolean;
}

/**
 * 共通ボタンコンポーネント
 * アプリケーション全体で統一されたスタイルのボタンを提供
 */
export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles =
    'px-4 py-2 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary:
      'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] focus:ring-[var(--primary)]',
    secondary: 'bg-[var(--secondary)] text-white hover:opacity-80 focus:ring-[var(--secondary)]',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          送信中...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
