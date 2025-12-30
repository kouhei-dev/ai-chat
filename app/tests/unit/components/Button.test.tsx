import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('子要素を正しくレンダリングする', () => {
    render(<Button>テスト</Button>);
    expect(screen.getByRole('button', { name: 'テスト' })).toBeInTheDocument();
  });

  it('クリックイベントを発火する', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>クリック</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disabled時はクリックできない', async () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        無効
      </Button>
    );

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('isLoading時はスピナーを表示する', () => {
    render(<Button isLoading>送信</Button>);
    expect(screen.getByText('送信中...')).toBeInTheDocument();
  });

  it('isLoading時はボタンが無効になる', () => {
    render(<Button isLoading>送信</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('primaryバリアントがデフォルト', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-[var(--primary)]');
  });

  it('secondaryバリアントを適用できる', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-[var(--secondary)]');
  });
});
