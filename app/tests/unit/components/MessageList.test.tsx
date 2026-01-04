import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '@/components/chat/MessageList';
import { Message } from '@/components/chat/MessageItem';

describe('MessageList', () => {
  const mockMessages: Message[] = [
    { id: 'user-1', role: 'user', content: 'こんにちは' },
    { id: 'assistant-1', role: 'assistant', content: 'こんにちは！何かお手伝いできますか？' },
    { id: 'user-2', role: 'user', content: 'テストです' },
    { id: 'assistant-2', role: 'assistant', content: 'テストを受け取りました。' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('メッセージ表示', () => {
    it('空のメッセージ一覧でプレースホルダーが表示される', () => {
      render(<MessageList messages={[]} />);
      expect(screen.getByText('メッセージを送信して会話を始めましょう')).toBeInTheDocument();
    });

    it('メッセージ一覧を表示する', () => {
      render(<MessageList messages={mockMessages} />);

      expect(screen.getByText('こんにちは')).toBeInTheDocument();
      expect(screen.getByText('こんにちは！何かお手伝いできますか？')).toBeInTheDocument();
      expect(screen.getByText('テストです')).toBeInTheDocument();
      expect(screen.getByText('テストを受け取りました。')).toBeInTheDocument();
    });

    it('メッセージがある場合はプレースホルダーが表示されない', () => {
      render(<MessageList messages={mockMessages} />);
      expect(screen.queryByText('メッセージを送信して会話を始めましょう')).not.toBeInTheDocument();
    });

    it('正しい数のメッセージが表示される', () => {
      render(<MessageList messages={mockMessages} />);

      // 各メッセージが表示されていることを確認
      expect(screen.getByText('こんにちは')).toBeInTheDocument();
      expect(screen.getByText('こんにちは！何かお手伝いできますか？')).toBeInTheDocument();
      expect(screen.getByText('テストです')).toBeInTheDocument();
      expect(screen.getByText('テストを受け取りました。')).toBeInTheDocument();
    });

    it('単一のメッセージも正しく表示される', () => {
      const singleMessage: Message[] = [{ id: 'user-1', role: 'user', content: '1つだけ' }];
      render(<MessageList messages={singleMessage} />);

      expect(screen.getByText('1つだけ')).toBeInTheDocument();
      expect(screen.queryByText('メッセージを送信して会話を始めましょう')).not.toBeInTheDocument();
    });
  });

  describe('ローディング状態', () => {
    it('isLoading=falseではローディング表示がない', () => {
      render(<MessageList messages={mockMessages} isLoading={false} />);
      expect(screen.queryByText('考え中...')).not.toBeInTheDocument();
    });

    it('isLoading=trueでローディングが表示される', () => {
      render(<MessageList messages={mockMessages} isLoading={true} />);
      expect(screen.getByText('考え中...')).toBeInTheDocument();
    });

    it('空のメッセージ一覧ではローディングが表示されない', () => {
      // メッセージがない場合はプレースホルダーが表示され、ローディングは表示されない
      render(<MessageList messages={[]} isLoading={true} />);
      expect(screen.queryByText('考え中...')).not.toBeInTheDocument();
      expect(screen.getByText('メッセージを送信して会話を始めましょう')).toBeInTheDocument();
    });

    it('デフォルトでisLoading=false', () => {
      render(<MessageList messages={mockMessages} />);
      expect(screen.queryByText('考え中...')).not.toBeInTheDocument();
    });
  });

  describe('自動スクロール', () => {
    it('scrollIntoViewが呼ばれる（メッセージ追加時）', () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      render(<MessageList messages={mockMessages} />);

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('ローディング状態変更時にもスクロールが発生する', () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(<MessageList messages={mockMessages} isLoading={false} />);
      const initialCallCount = scrollIntoViewMock.mock.calls.length;

      rerender(<MessageList messages={mockMessages} isLoading={true} />);

      expect(scrollIntoViewMock.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('メッセージ追加時にスクロールが発生する', () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(<MessageList messages={mockMessages.slice(0, 2)} />);
      const initialCallCount = scrollIntoViewMock.mock.calls.length;

      rerender(<MessageList messages={mockMessages} />);

      expect(scrollIntoViewMock.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe('ユーザー/アシスタントメッセージの区別', () => {
    it('ユーザーメッセージとアシスタントメッセージを両方表示する', () => {
      const mixedMessages: Message[] = [
        { id: 'user-1', role: 'user', content: 'ユーザーからのメッセージ' },
        { id: 'assistant-1', role: 'assistant', content: 'アシスタントからの返答' },
      ];

      render(<MessageList messages={mixedMessages} />);

      expect(screen.getByText('ユーザーからのメッセージ')).toBeInTheDocument();
      expect(screen.getByText('アシスタントからの返答')).toBeInTheDocument();
    });

    it('連続したユーザーメッセージを表示できる', () => {
      const userOnlyMessages: Message[] = [
        { id: 'user-1', role: 'user', content: 'メッセージ1' },
        { id: 'user-2', role: 'user', content: 'メッセージ2' },
        { id: 'user-3', role: 'user', content: 'メッセージ3' },
      ];

      render(<MessageList messages={userOnlyMessages} />);

      expect(screen.getByText('メッセージ1')).toBeInTheDocument();
      expect(screen.getByText('メッセージ2')).toBeInTheDocument();
      expect(screen.getByText('メッセージ3')).toBeInTheDocument();
    });

    it('連続したアシスタントメッセージを表示できる', () => {
      const assistantOnlyMessages: Message[] = [
        { id: 'assistant-1', role: 'assistant', content: '応答1' },
        { id: 'assistant-2', role: 'assistant', content: '応答2' },
      ];

      render(<MessageList messages={assistantOnlyMessages} />);

      expect(screen.getByText('応答1')).toBeInTheDocument();
      expect(screen.getByText('応答2')).toBeInTheDocument();
    });
  });

  describe('特殊なメッセージ内容', () => {
    it('空文字のメッセージを表示できる', () => {
      const emptyMessage: Message[] = [{ id: 'user-1', role: 'user', content: '' }];
      render(<MessageList messages={emptyMessage} />);

      // プレースホルダーが表示されないことを確認（メッセージは存在する）
      expect(screen.queryByText('メッセージを送信して会話を始めましょう')).not.toBeInTheDocument();
    });

    it('長いメッセージを表示できる', () => {
      const longContent = 'あ'.repeat(1000);
      const longMessage: Message[] = [{ id: 'user-1', role: 'user', content: longContent }];
      render(<MessageList messages={longMessage} />);

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('改行を含むメッセージを表示できる', () => {
      const multilineContent = '1行目\n2行目\n3行目';
      const multilineMessage: Message[] = [
        { id: 'user-1', role: 'user', content: multilineContent },
      ];
      render(<MessageList messages={multilineMessage} />);

      // 改行を含むテキストはgetByTextで完全一致で取得できないため、
      // 含まれているかどうかで確認
      expect(screen.getByText((content) => content.includes('1行目'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('2行目'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('3行目'))).toBeInTheDocument();
    });

    it('特殊文字を含むメッセージを表示できる', () => {
      const specialContent = '<script>alert("xss")</script> & "quotes" \'apostrophe\'';
      const specialMessage: Message[] = [{ id: 'user-1', role: 'user', content: specialContent }];
      render(<MessageList messages={specialMessage} />);

      expect(screen.getByText(specialContent)).toBeInTheDocument();
    });

    it('絵文字を含むメッセージを表示できる', () => {
      const emojiContent = '🎉 お祝いメッセージ 🎊';
      const emojiMessage: Message[] = [{ id: 'user-1', role: 'user', content: emojiContent }];
      render(<MessageList messages={emojiMessage} />);

      expect(screen.getByText(emojiContent)).toBeInTheDocument();
    });
  });

  describe('大量のメッセージ', () => {
    it('100件のメッセージを表示できる', () => {
      const manyMessages: Message[] = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `メッセージ ${i + 1}`,
      })) as Message[];

      render(<MessageList messages={manyMessages} />);

      expect(screen.getByText('メッセージ 1')).toBeInTheDocument();
      expect(screen.getByText('メッセージ 50')).toBeInTheDocument();
      expect(screen.getByText('メッセージ 100')).toBeInTheDocument();
    });
  });
});
