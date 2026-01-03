import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput, MAX_MESSAGE_LENGTH, SEND_THROTTLE_MS } from '@/components/chat/ChatInput';

describe('ChatInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('入力フィールドをレンダリングする', () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByPlaceholderText('メッセージを入力...')).toBeInTheDocument();
  });

  it('送信ボタンをレンダリングする', () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument();
  });

  it('空のメッセージでは送信ボタンが無効', () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
  });

  it('メッセージ入力後に送信ボタンが有効になる', async () => {
    vi.useRealTimers();
    render(<ChatInput onSend={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...');

    await userEvent.type(textarea, 'こんにちは');
    expect(screen.getByRole('button', { name: '送信' })).not.toBeDisabled();
  });

  it('送信後に入力フィールドがクリアされる', async () => {
    vi.useRealTimers();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...') as HTMLTextAreaElement;

    await userEvent.type(textarea, 'テストメッセージ');
    await userEvent.click(screen.getByRole('button', { name: '送信' }));

    expect(onSend).toHaveBeenCalledWith('テストメッセージ');
    expect(textarea.value).toBe('');
  });

  it('Enterキーで送信できる', async () => {
    vi.useRealTimers();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...');

    await userEvent.type(textarea, 'Enterテスト');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith('Enterテスト');
  });

  it('Shift+Enterでは送信されない', async () => {
    vi.useRealTimers();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...');

    await userEvent.type(textarea, 'テスト');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('isLoading時は入力が無効になる', () => {
    render(<ChatInput onSend={vi.fn()} isLoading />);
    expect(screen.getByPlaceholderText('メッセージを入力...')).toBeDisabled();
  });

  it('空白のみのメッセージは送信されない', async () => {
    vi.useRealTimers();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...');

    await userEvent.type(textarea, '   ');
    await userEvent.click(screen.getByRole('button', { name: '送信' }));

    expect(onSend).not.toHaveBeenCalled();
  });

  describe('文字数制限', () => {
    it('文字数カウンターを表示する', () => {
      render(<ChatInput onSend={vi.fn()} />);
      expect(screen.getByText(`0 / ${MAX_MESSAGE_LENGTH}`)).toBeInTheDocument();
    });

    it('入力に応じて文字数カウンターが更新される', async () => {
      vi.useRealTimers();
      render(<ChatInput onSend={vi.fn()} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      await userEvent.type(textarea, 'テスト');
      expect(screen.getByText(`3 / ${MAX_MESSAGE_LENGTH}`)).toBeInTheDocument();
    });

    it('最大文字数を超える入力は制限される', async () => {
      vi.useRealTimers();
      render(<ChatInput onSend={vi.fn()} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...') as HTMLTextAreaElement;

      // 最大文字数を超える文字列を作成
      const longMessage = 'あ'.repeat(MAX_MESSAGE_LENGTH + 50);
      await userEvent.type(textarea, longMessage);

      expect(textarea.value.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    });

    it('textareaにmaxLength属性が設定されている', () => {
      render(<ChatInput onSend={vi.fn()} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      expect(textarea).toHaveAttribute('maxLength', String(MAX_MESSAGE_LENGTH));
    });

    it('80%以上で警告色になる', async () => {
      vi.useRealTimers();
      render(<ChatInput onSend={vi.fn()} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 80%以上の文字数を入力
      const nearLimitLength = Math.ceil(MAX_MESSAGE_LENGTH * 0.8);
      const nearLimitMessage = 'a'.repeat(nearLimitLength);
      await userEvent.type(textarea, nearLimitMessage);

      const counter = screen.getByText(`${nearLimitLength} / ${MAX_MESSAGE_LENGTH}`);
      expect(counter).toHaveClass('text-amber-600');
    });

    it('100%で赤色になる', async () => {
      vi.useRealTimers();
      render(<ChatInput onSend={vi.fn()} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 最大文字数を入力
      const fullMessage = 'a'.repeat(MAX_MESSAGE_LENGTH);
      await userEvent.type(textarea, fullMessage);

      const counter = screen.getByText(`${MAX_MESSAGE_LENGTH} / ${MAX_MESSAGE_LENGTH}`);
      expect(counter).toHaveClass('text-red-600');
    });
  });

  describe('連続送信防止', () => {
    it('送信後は一定時間送信ボタンが無効になる', async () => {
      vi.useRealTimers();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 最初のメッセージを送信
      await userEvent.type(textarea, 'メッセージ1');
      await userEvent.click(screen.getByRole('button', { name: '送信' }));

      expect(onSend).toHaveBeenCalledTimes(1);

      // 送信直後は送信ボタンが無効
      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
    });

    it('スロットル時間経過後に送信ボタンが有効になる', async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // メッセージを入力して送信
      fireEvent.change(textarea, { target: { value: 'メッセージ1' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      expect(onSend).toHaveBeenCalledTimes(1);

      // 送信直後は無効
      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();

      // 新しいメッセージを入力
      fireEvent.change(textarea, { target: { value: 'メッセージ2' } });

      // スロットル時間経過（actでラップして状態更新を反映）
      await act(async () => {
        vi.advanceTimersByTime(SEND_THROTTLE_MS);
      });

      // 有効になる
      expect(screen.getByRole('button', { name: '送信' })).not.toBeDisabled();
    });

    it('スロットル中は連続して送信できない', async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 最初のメッセージを送信
      fireEvent.change(textarea, { target: { value: 'メッセージ1' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      expect(onSend).toHaveBeenCalledTimes(1);

      // すぐに2回目の送信を試みる
      fireEvent.change(textarea, { target: { value: 'メッセージ2' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      // 2回目は送信されない
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it('スロットル時間経過後は再度送信できる', async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} />);
      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 最初のメッセージを送信
      fireEvent.change(textarea, { target: { value: 'メッセージ1' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenLastCalledWith('メッセージ1');

      // スロットル時間経過（actでラップして状態更新を反映）
      await act(async () => {
        vi.advanceTimersByTime(SEND_THROTTLE_MS);
      });

      // 2回目のメッセージを送信
      fireEvent.change(textarea, { target: { value: 'メッセージ2' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      expect(onSend).toHaveBeenCalledTimes(2);
      expect(onSend).toHaveBeenLastCalledWith('メッセージ2');
    });
  });
});
