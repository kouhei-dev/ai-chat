import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '@/components/chat/ChatInput';

describe('ChatInput', () => {
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
    render(<ChatInput onSend={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...');

    await userEvent.type(textarea, 'こんにちは');
    expect(screen.getByRole('button', { name: '送信' })).not.toBeDisabled();
  });

  it('送信後に入力フィールドがクリアされる', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...') as HTMLTextAreaElement;

    await userEvent.type(textarea, 'テストメッセージ');
    await userEvent.click(screen.getByRole('button', { name: '送信' }));

    expect(onSend).toHaveBeenCalledWith('テストメッセージ');
    expect(textarea.value).toBe('');
  });

  it('Enterキーで送信できる', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...');

    await userEvent.type(textarea, 'Enterテスト');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith('Enterテスト');
  });

  it('Shift+Enterでは送信されない', async () => {
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
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('メッセージを入力...');

    await userEvent.type(textarea, '   ');
    await userEvent.click(screen.getByRole('button', { name: '送信' }));

    expect(onSend).not.toHaveBeenCalled();
  });
});
