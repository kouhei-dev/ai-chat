import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// エラーを発生させるテスト用コンポーネント
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('テストエラー');
  }
  return <div>正常なコンテンツ</div>;
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // console.errorを抑制（React Error Boundaryのエラーログを無視）
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('子コンポーネントが正常な場合はそのまま表示される', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('正常なコンテンツ')).toBeInTheDocument();
  });

  it('子コンポーネントでエラーが発生するとデフォルトのフォールバックUIを表示する', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(
      screen.getByText('アプリケーションで予期しないエラーが発生しました。')
    ).toBeInTheDocument();
  });

  it('エラー詳細を表示できる', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // エラー詳細のsummary要素をクリック
    const summary = screen.getByText('エラー詳細');
    expect(summary).toBeInTheDocument();

    // エラーメッセージが詳細に含まれている
    expect(screen.getByText('テストエラー')).toBeInTheDocument();
  });

  it('再試行ボタンでエラー状態をリセットできる', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ConditionalError() {
      if (shouldThrow) {
        throw new Error('テストエラー');
      }
      return <div>リカバリー成功</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    // エラー状態を確認
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();

    // 再試行前にshouldThrowをfalseに設定
    shouldThrow = false;

    // 再試行ボタンをクリック
    await user.click(screen.getByRole('button', { name: '再試行' }));

    // 再レンダリングをトリガー
    rerender(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    // エラー状態がリセットされ、正常なコンテンツが表示される
    expect(screen.getByText('リカバリー成功')).toBeInTheDocument();
  });

  it('ページを再読み込みボタンがwindow.location.reloadを呼び出す', async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole('button', { name: 'ページを再読み込み' }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('カスタムフォールバックが提供されている場合はそれを使用する', () => {
    const customFallback = (error: Error, resetError: () => void) => (
      <div>
        <p data-testid="custom-error">カスタムエラー: {error.message}</p>
        <button onClick={resetError}>リセット</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-error')).toHaveTextContent('カスタムエラー: テストエラー');
    expect(screen.getByRole('button', { name: 'リセット' })).toBeInTheDocument();
  });

  it('カスタムフォールバックのリセット関数が動作する', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ConditionalError() {
      if (shouldThrow) {
        throw new Error('カスタムテスト');
      }
      return <div>正常に戻った</div>;
    }

    const customFallback = (_error: Error, resetError: () => void) => (
      <button onClick={resetError}>カスタムリセット</button>
    );

    const { rerender } = render(
      <ErrorBoundary fallback={customFallback}>
        <ConditionalError />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: 'カスタムリセット' })).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'カスタムリセット' }));

    rerender(
      <ErrorBoundary fallback={customFallback}>
        <ConditionalError />
      </ErrorBoundary>
    );

    expect(screen.getByText('正常に戻った')).toBeInTheDocument();
  });

  it('componentDidCatchでエラーをログ出力する', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // console.errorが呼び出されたことを確認
    expect(consoleErrorSpy).toHaveBeenCalled();
    // ErrorBoundaryからのログが含まれていることを確認
    const errorCalls = consoleErrorSpy.mock.calls.flat();
    expect(errorCalls.some((arg) => String(arg).includes('ErrorBoundary'))).toBe(true);
  });
});
