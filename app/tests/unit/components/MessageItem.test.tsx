import { describe, it, expect } from 'vitest';
import { render, screen, getDefaultNormalizer } from '@testing-library/react';
import { MessageItem } from '@/components/chat/MessageItem';

describe('MessageItem', () => {
  it('ユーザーメッセージを正しくレンダリングする', () => {
    const message = {
      id: '1',
      role: 'user' as const,
      content: 'ユーザーのメッセージ',
    };

    render(<MessageItem message={message} />);
    expect(screen.getByText('ユーザーのメッセージ')).toBeInTheDocument();
  });

  it('アシスタントメッセージを正しくレンダリングする', () => {
    const message = {
      id: '2',
      role: 'assistant' as const,
      content: 'アシスタントの応答',
    };

    render(<MessageItem message={message} />);
    expect(screen.getByText('アシスタントの応答')).toBeInTheDocument();
  });

  it('ユーザーメッセージは右寄せ', () => {
    const message = {
      id: '1',
      role: 'user' as const,
      content: 'テスト',
    };

    const { container } = render(<MessageItem message={message} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-end');
  });

  it('アシスタントメッセージは左寄せ', () => {
    const message = {
      id: '2',
      role: 'assistant' as const,
      content: 'テスト',
    };

    const { container } = render(<MessageItem message={message} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-start');
  });

  it('ユーザーメッセージにユーザー用スタイルが適用される', () => {
    const message = {
      id: '1',
      role: 'user' as const,
      content: 'テスト',
    };

    render(<MessageItem message={message} />);
    const bubble = screen.getByText('テスト').parentElement;
    expect(bubble?.className).toContain('bg-[var(--user-bubble)]');
  });

  it('アシスタントメッセージにアシスタント用スタイルが適用される', () => {
    const message = {
      id: '2',
      role: 'assistant' as const,
      content: 'テスト',
    };

    render(<MessageItem message={message} />);
    const bubble = screen.getByText('テスト').parentElement;
    expect(bubble?.className).toContain('bg-[var(--assistant-bubble)]');
  });

  it('改行を含むメッセージを正しく表示する', () => {
    const message = {
      id: '1',
      role: 'user' as const,
      content: '1行目\n2行目\n3行目',
    };

    render(<MessageItem message={message} />);
    expect(
      screen.getByText('1行目\n2行目\n3行目', {
        normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
      })
    ).toBeInTheDocument();
  });
});
