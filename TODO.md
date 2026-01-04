# AIチャット - 実装計画 TODO

## フェーズ1: プロジェクト初期設定

- [x] Next.jsプロジェクトの作成（App Router、TypeScript）
- [x] ESLint + Prettierの設定
- [x] Tailwind CSSの設定
- [x] 基本ディレクトリ構成の作成
- [x] 環境変数ファイル（.env.example）の作成
- [x] .gitignoreの設定

## フェーズ2: データベース設定

- [x] Prismaのインストールと初期設定
- [x] MongoDB接続設定
- [x] Prismaスキーマの定義（Session, Conversation, Message）
- [x] Prismaクライアントの生成
- [x] データベース接続ユーティリティの作成（src/lib/db/prisma.ts）
- [x] データベース接続テストの実施
  - [x] MongoDBへの接続確認
  - [x] CRUD操作の動作確認（テストデータの作成・取得・削除）

## フェーズ3: バックエンド実装

### Hono設定
- [x] Honoのインストール
- [x] Next.js App Router上でのHonoルート設定（src/app/api/[[...route]]/route.ts）

### Mastra + Claude API設定
- [x] Mastraのインストールと設定
- [x] Claude-4-sonnet用のエージェント設定（src/lib/mastra/agent.ts）
- [x] システムプロンプトの定義

### セッション管理
- [x] セッションID生成ユーティリティの作成（UUIDv4）
- [x] セッション有効期限の設定（環境変数から取得）
- [x] POST /api/session エンドポイントの実装（セッション作成）
- [x] GET /api/session/:sessionId エンドポイントの実装（セッション検証）
- [x] 期限切れセッションのハンドリング

### APIエンドポイント
- [x] POST /api/chat エンドポイントの実装
- [x] リクエストバリデーション（セッションID検証を含む）
- [x] 会話履歴のDB保存処理
- [x] エラーハンドリング

## フェーズ4: フロントエンド実装

### レイアウト
- [x] 共通レイアウトの作成（src/app/layout.tsx）
- [x] メタデータ設定（タイトル、説明）
- [x] フォント設定

### チャットUIコンポーネント
- [x] ChatContainer.tsx - チャット全体のコンテナ
- [x] MessageList.tsx - メッセージ一覧表示
- [x] MessageItem.tsx - 個別メッセージ表示（ユーザー/AI区別）
- [x] ChatInput.tsx - メッセージ入力フォーム

### 共通UIコンポーネント
- [x] Button.tsx - ボタンコンポーネント
- [x] Loading.tsx - ローディング表示

### ページ実装
- [x] メインページ（src/app/page.tsx）
- [x] APIクライアントの作成（src/lib/api/chat.ts）

### スタイリング
- [x] ビジネスライクなカラースキームの定義
- [x] レスポンシブ対応（モバイル・タブレット・デスクトップ）
- [x] チャットバブルのスタイリング
- [x] 入力フォームのスタイリング

## フェーズ5: 状態管理・UX改善

### セッション管理（フロントエンド）
- [x] セッションIDのlocalStorage保存・取得
- [x] 初回アクセス時のセッション作成処理
- [x] セッション有効性チェック（ページ読み込み時）
- [x] セッション期限切れ時の再作成処理

### 会話状態管理
- [x] 会話状態の管理（useState/useReducer）
- [x] ローディング状態の表示
- [x] エラー状態の表示
- [x] 送信中の入力無効化
- [x] 自動スクロール（新メッセージ時）
- [x] 入力フォームのEnterキー送信対応

## フェーズ6: テスト

### 単体テスト（Vitest）
- [x] Vitestのインストールと設定
- [x] セッション管理APIのテスト
  - [x] セッション作成テスト
  - [x] セッション検証テスト
  - [x] 期限切れセッションのテスト
- [x] チャットAPIエンドポイントのテスト
- [x] ユーティリティ関数のテスト
- [x] コンポーネントのテスト

### E2Eテスト（Playwright）
- [x] Playwrightのインストールと設定
- [x] セッション管理のテスト（初回アクセス、再訪問）
- [x] 基本的なチャットフローのテスト
- [x] エラーケースのテスト

## フェーズ7: デプロイ準備

### Docker化
- [x] Dockerfileの作成
- [x] docker-compose.ymlの更新（アプリサービス追加）
- [x] .dockerignoreの作成

### Google Cloud Run設定
- [x] Cloud Run用の設定ファイル作成（cloudbuild.yaml）
- [x] 本番環境用環境変数の整理（.env.production.example）
- [x] デプロイスクリプトの作成（scripts/deploy.sh）

## フェーズ8: ドキュメント・仕上げ

- [x] READMEの作成（セットアップ手順、使い方）
- [x] 動作確認（ローカル環境）
- [x] 動作確認（本番環境）
- [x] パフォーマンス確認

---

## 進捗状況

| フェーズ | ステータス | 備考 |
|----------|------------|------|
| 1. プロジェクト初期設定 | 完了 | Next.js 16.1.1 + TypeScript + Tailwind CSS |
| 2. データベース設定 | 完了 | Prisma 6 + MongoDB 7（Docker、レプリカセット構成） |
| 3. バックエンド実装 | 完了 | Hono + Mastra + Claude API |
| 4. フロントエンド実装 | 完了 | React + Tailwind CSS + レスポンシブ対応 |
| 5. 状態管理・UX改善 | 完了 | フェーズ4で実装済み（セッション管理、状態管理、UX機能） |
| 6. テスト | 完了 | Vitest（45件）+ Playwright（10件） |
| 7. デプロイ準備 | 完了 | Docker + Cloud Run（cloudbuild.yaml, deploy.sh） |
| 8. ドキュメント・仕上げ | 完了 | README、本番デプロイ、動作確認完了 |

---

## 残タスク（改善項目）

コードレビューにより特定された改善項目。優先度順に記載。

### 🔴 Critical（セキュリティ・データ整合性） ✅ 完了

#### API入力バリデーション強化
- [x] メッセージの最大長制限を追加（400文字）
- [x] 空白のみのメッセージを拒否する検証を追加
- [x] sessionIdのUUID形式検証を追加
- [x] conversationIdのMongoDB ObjectId形式検証を追加
- [x] リクエストボディのJSON解析エラーハンドリング（400を返す）

#### セッション分離の強化
- [x] 会話取得時にsessionId所有権を検証（findFirstでsessionIdも条件に含める）

#### 期限切れセッションのクリーンアップ
- [x] cleanupExpiredSessions関数の実装（src/lib/session/index.ts）
- [x] POST /api/cleanup エンドポイントの追加（認証付き）
- [x] 関連するConversation/Messageのカスケード削除（トランザクション使用）
- [x] Cloud Scheduler設定手順をドキュメントに追記

### 🟠 High（機能・UX）

#### エラーリカバリー ✅ 完了
- [x] メッセージ送信失敗時のリトライボタン追加（ChatContainer.tsx）
- [x] APIリクエストのタイムアウト設定（30秒/60秒、chat.ts）
- [x] React Error Boundaryコンポーネントの追加（layout.tsxで適用済み）

#### 入力制御 ✅ 完了
- [x] メッセージ入力の最大文字数表示・制限（ChatInput.tsx、400文字）
- [x] 連続送信の防止（スロットリング、1秒間隔）

#### ヘルスチェック ✅ 完了
- [x] /api/health エンドポイントの追加（DB接続確認含む）
- [x] 起動時の環境変数検証（ANTHROPIC_API_KEY必須チェック）

### 🟡 Medium（堅牢性）

#### データベース最適化 ✅ 完了
- [x] Session.expiresAtにインデックス追加（クリーンアップクエリ用）
- [x] Conversation.sessionIdにインデックス追加
- [x] Message.roleをEnum型に変更（prisma/schema.prisma:38）
- [x] onDelete: Cascadeの設定（Conversation→Message）

#### エラーハンドリング統一 ✅ 完了
- [x] API エラーレスポンス形式の統一（エラーコード体系）
- [x] フロントエンドのJSON解析エラーハンドリング（chat.ts）
- [x] localStorage操作のエラーハンドリング（quota超過対策）

#### テストカバレッジ拡充 ✅ 完了
- [x] ChatContainerコンポーネントのテスト追加
- [x] MessageListコンポーネントのテスト追加
- [x] セッション→メッセージ→レスポンスの統合テスト
- [x] 大きなメッセージ、連続送信のエッジケーステスト

### 🟢 Low（改善・保守性）

#### アクセシビリティ ✅ 完了
- [x] ボタン・入力フィールドにaria-label追加
- [x] キーボードナビゲーション対応（メッセージ履歴）

#### セキュリティヘッダー ✅ 完了
- [x] Next.js middlewareでセキュリティヘッダー設定
  - X-Content-Type-Options
  - X-Frame-Options
  - Content-Security-Policy
  - Referrer-Policy
  - X-DNS-Prefetch-Control
  - Strict-Transport-Security（本番環境）
  - Permissions-Policy

#### 運用・監視 ✅ 完了
- [x] 構造化ログ出力（JSON形式、GCP向け）
- [x] リクエスト/レスポンスタイム計測
- [x] エラー追跡（Sentry等の導入検討）

#### ドキュメント
- [ ] APIドキュメント（OpenAPI/Swagger）
- [ ] アーキテクチャ図の作成

---

## 技術的負債メモ

| 項目 | 現状 | リスク | 対応方針 |
|------|------|--------|----------|
| CORS設定 | 未設定 | 別ドメインデプロイ時に問題 | 必要時にHono CORSミドルウェア追加 |
| CSRF対策 | 未実装 | 悪意あるサイトからの操作 | トークンベース認証導入時に対応 |
| レート制限 | 未実装（仕様通り） | API濫用の可能性 | 必要時にCloud Run設定で対応 |
| マルチタブ同期 | 未対応 | 複数タブで状態不整合 | BroadcastChannel API検討 |
| 会話履歴取得API | 未実装 | ブラウザ再起動で履歴喪失 | GET /api/conversations追加検討 |
