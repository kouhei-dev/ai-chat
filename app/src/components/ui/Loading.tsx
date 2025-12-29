'use client';

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export function Loading({ size = 'medium', message }: LoadingProps) {
  const sizeStyles = {
    small: 'w-4 h-4 border-2',
    medium: 'w-8 h-8 border-3',
    large: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeStyles[size]} border-[var(--primary)] border-t-transparent rounded-full animate-spin`}
      />
      {message && <p className="text-[var(--secondary)] text-sm">{message}</p>}
    </div>
  );
}
