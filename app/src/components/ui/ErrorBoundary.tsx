'use client';

import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary コンポーネント
 * 子コンポーネントでエラーが発生した際にキャッチして、フォールバックUIを表示する
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // カスタムフォールバックが提供されている場合はそれを使用
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // デフォルトのエラー表示
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="max-w-md w-full mx-4">
            <div className="bg-white border border-red-200 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">エラーが発生しました</h2>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">
                  アプリケーションで予期しないエラーが発生しました。
                </p>
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700 font-medium mb-2">
                    エラー詳細
                  </summary>
                  <pre className="bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-40">
                    {this.state.error.message}
                  </pre>
                </details>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={this.resetError}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  再試行
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors"
                >
                  ページを再読み込み
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
