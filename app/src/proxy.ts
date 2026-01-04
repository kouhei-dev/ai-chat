import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * セキュリティヘッダーを設定するプロキシ
 *
 * 設定するヘッダー:
 * - X-Content-Type-Options: MIMEタイプスニッフィングを防止
 * - X-Frame-Options: クリックジャッキング攻撃を防止
 * - Content-Security-Policy: XSS・インジェクション攻撃を防止
 * - Referrer-Policy: リファラー情報の送信を制御
 * - X-DNS-Prefetch-Control: DNSプリフェッチを制御
 * - Strict-Transport-Security: HTTPS接続を強制（本番環境）
 * - Permissions-Policy: ブラウザ機能の使用を制限
 */
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();

  // MIMEタイプスニッフィングを防止
  // ブラウザがContent-Typeヘッダーを無視してコンテンツタイプを推測することを防ぐ
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // クリックジャッキング攻撃を防止
  // このサイトをiframeに埋め込むことを禁止
  response.headers.set('X-Frame-Options', 'DENY');

  // Content Security Policy
  // XSSやその他のインジェクション攻撃を防止
  const cspDirectives = [
    // デフォルトでは同一オリジンのみ許可
    "default-src 'self'",

    // スクリプト: 同一オリジン + Next.jsのインラインスクリプト用にunsafe-inline
    // 本番環境ではnonceベースに移行することを推奨
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

    // スタイル: 同一オリジン + インラインスタイル（Tailwind CSS用）
    "style-src 'self' 'unsafe-inline'",

    // 画像: 同一オリジン + data URL（アイコン等）
    "img-src 'self' data: blob:",

    // フォント: 同一オリジン + Google Fonts
    "font-src 'self' https://fonts.gstatic.com",

    // 接続先: 同一オリジン（API呼び出し用）
    "connect-src 'self'",

    // オブジェクト（Flash等）: 禁止
    "object-src 'none'",

    // base URI: 同一オリジンのみ
    "base-uri 'self'",

    // フォーム送信先: 同一オリジンのみ
    "form-action 'self'",

    // iframe埋め込み: 禁止（X-Frame-Optionsと同等）
    "frame-ancestors 'none'",

    // HTTPからHTTPSへのアップグレード（本番環境用）
    'upgrade-insecure-requests',
  ];

  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));

  // リファラーポリシー
  // クロスオリジンリクエストではオリジンのみ送信
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // DNSプリフェッチを有効化（パフォーマンス向上）
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // HTTPS接続を強制（本番環境でのみ有効）
  // max-age=1年、サブドメインも含む
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Permissions Policy（旧Feature Policy）
  // 不要なブラウザ機能を無効化
  const permissionsPolicy = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ];
  response.headers.set('Permissions-Policy', permissionsPolicy.join(', '));

  return response;
}

// プロキシを適用するパスを設定
// 静的ファイル（_next/static, _next/image, favicon.ico）は除外
export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスにマッチ:
     * - api (API routes) - APIは別途HonoでCORSを設定可能
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt
     * - sitemap.xml
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
