/**
 * GCP Cloud Logging向け構造化ログユーティリティ
 *
 * Cloud Loggingのログ形式に準拠したJSON構造化ログを出力
 * https://cloud.google.com/logging/docs/structured-logging
 */

// ログレベル（GCP Cloud Loggingの severity に対応）
export type LogSeverity = 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'ALERT';

// HTTPリクエスト情報
export interface HttpRequestLog {
  requestMethod: string;
  requestUrl: string;
  status?: number;
  userAgent?: string;
  remoteIp?: string;
  latency?: string; // "0.123s" 形式
  protocol?: string;
  requestSize?: string;
  responseSize?: string;
}

// 構造化ログエントリ
export interface LogEntry {
  severity: LogSeverity;
  message: string;
  timestamp?: string;
  httpRequest?: HttpRequestLog;
  'logging.googleapis.com/trace'?: string;
  'logging.googleapis.com/spanId'?: string;
  labels?: Record<string, string>;
  [key: string]: unknown;
}

// エラー情報
export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
}

// ログコンテキスト
export interface LogContext {
  requestId?: string;
  sessionId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

/**
 * GCP Cloud Logging形式で構造化ログを出力するロガークラス
 */
class Logger {
  private projectId?: string;
  private serviceName: string;
  private isProduction: boolean;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    this.serviceName = process.env.K_SERVICE || 'ai-chat';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * ログエントリを出力
   */
  private log(severity: LogSeverity, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      'logging.googleapis.com/labels': {
        service: this.serviceName,
      },
      ...data,
    };

    // 本番環境ではJSON形式で出力
    if (this.isProduction) {
      console.log(JSON.stringify(entry));
    } else {
      // 開発環境では読みやすい形式で出力
      const color = this.getColorForSeverity(severity);
      const prefix = `${color}[${severity}]${this.resetColor()}`;
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} ${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  /**
   * 開発環境用の色コード取得
   */
  private getColorForSeverity(severity: LogSeverity): string {
    const colors: Record<LogSeverity, string> = {
      DEBUG: '\x1b[36m', // cyan
      INFO: '\x1b[32m', // green
      NOTICE: '\x1b[34m', // blue
      WARNING: '\x1b[33m', // yellow
      ERROR: '\x1b[31m', // red
      CRITICAL: '\x1b[35m', // magenta
      ALERT: '\x1b[41m', // red background
    };
    return colors[severity];
  }

  private resetColor(): string {
    return '\x1b[0m';
  }

  /**
   * HTTPリクエストログを出力
   */
  logRequest(
    method: string,
    path: string,
    status: number,
    latencyMs: number,
    context?: LogContext
  ): void {
    const severity: LogSeverity = status >= 500 ? 'ERROR' : status >= 400 ? 'WARNING' : 'INFO';

    const httpRequest: HttpRequestLog = {
      requestMethod: method,
      requestUrl: path,
      status,
      latency: `${(latencyMs / 1000).toFixed(3)}s`,
    };

    this.log(severity, `${method} ${path} ${status} ${latencyMs}ms`, {
      httpRequest,
      ...context,
    });
  }

  /**
   * エラーログを出力
   */
  logError(error: Error | unknown, message?: string, context?: LogContext): void {
    const errorInfo: ErrorInfo =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : {
            name: 'UnknownError',
            message: String(error),
          };

    this.log('ERROR', message || errorInfo.message, {
      error: errorInfo,
      ...context,
    });
  }

  /**
   * 各ログレベルのメソッド
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('DEBUG', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('INFO', message, data);
  }

  notice(message: string, data?: Record<string, unknown>): void {
    this.log('NOTICE', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('WARNING', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('ERROR', message, data);
  }

  critical(message: string, data?: Record<string, unknown>): void {
    this.log('CRITICAL', message, data);
  }

  /**
   * アプリケーション起動ログ
   */
  logStartup(port?: number | string): void {
    this.info('Application started', {
      port,
      nodeEnv: process.env.NODE_ENV,
      service: this.serviceName,
      projectId: this.projectId,
    });
  }

  /**
   * データベース接続ログ
   */
  logDbConnection(status: 'connected' | 'disconnected' | 'error', error?: string): void {
    if (status === 'error') {
      this.error('Database connection error', { dbStatus: status, error });
    } else {
      this.info(`Database ${status}`, { dbStatus: status });
    }
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();

export default logger;
