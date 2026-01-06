# AIチャット - プロジェクト仕様書

## 概要
エンターテイメント用AIチャットボット。一般ユーザーが気軽に会話を楽しめることを目的としたWebアプリケーション。

## 技術スタック

### フロントエンド
- **フレームワーク**: Next.js (App Router)
- **UIライブラリ**: React
- **スタイリング**: Tailwind CSS（ビジネスライクなデザイン）
- **言語**: TypeScript
- **レスポンシブ(スマホ)対応**: 必須

### バックエンド
- **APIフレームワーク**: Hono (Next.js App Router上で動作)
- **ORM**: Prisma
- **AIフレームワーク**: Mastra
- **AIモデル**: Claude-4-sonnet (Anthropic)

### データベース
- **DB**: MongoDB
- **用途**: 会話履歴の永続保存（分析・改善用）

### インフラ
- **デプロイ先**: Google Cloud Run
- **コンテナ化**: Docker
- **想定接続人数**: 5-10人

### テスト
- **単体テスト**: Vitest
- **E2Eテスト**: Playwright

## 機能要件

### コア機能
- ユーザーがテキストメッセージを送信
- AIが応答を生成して表示
- 会話履歴をセッション中のみUI上で表示

### 会話仕様
- **キャラクター**: ニュートラル（特定のペルソナなし）
- **応答形式**: プレーンテキスト（Markdown非対応）
- **ストリーミング**: 非対応（応答完了後に一括表示）
- **対応言語**: 日本語のみ

### 認証・制限
- **ユーザー認証**: 不要（誰でも利用可能）
- **レート制限**: なし

### セッション管理
- **セッションID**: UUIDv4で生成
- **有効期限**: 24時間（環境変数で設定可能）
- **保存先**: MongoDB（Sessionコレクション）
- **動作仕様**:
  - 初回アクセス時にセッションIDを生成し、クライアントに返却
  - クライアントはセッションIDをlocalStorageに保存
  - 以降のリクエストにセッションIDを含めて送信
  - 有効期限切れの場合は新規セッションを作成
  - セッションに紐づく会話履歴をUI上に表示

### 非機能要件
- **多言語対応**: 不要
- **画像認識**: 不要
- **音声入力**: 不要
- **会話履歴検索**: 不要

## ディレクトリ構成

詳細は [docs/architecture.md](docs/architecture.md) を参照。

**主要ディレクトリ:**
- `app/src/app/` - Next.js App Router（ページ、APIルート）
- `app/src/components/` - Reactコンポーネント（chat/, ui/）
- `app/src/lib/` - ライブラリ（api/, db/, mastra/, session/, logger/）
- `app/tests/` - テスト（unit/, e2e/）
- `docs/` - ドキュメント（アーキテクチャ図等）

## データモデル

### Session（セッション）
```prisma
model Session {
  id           String        @id @default(auto()) @map("_id") @db.ObjectId
  sessionId    String        @unique // UUIDv4
  conversations Conversation[]
  expiresAt    DateTime
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}
```

### Conversation（会話）
```prisma
model Conversation {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  sessionId String    @db.ObjectId
  session   Session   @relation(fields: [sessionId], references: [id])
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(auto()) @map("_id") @db.ObjectId
  conversationId String       @db.ObjectId
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  role           String       // "user" | "assistant"
  content        String
  createdAt      DateTime     @default(now())
}
```

## API設計

### エンドポイント

#### POST /api/session
新規セッションを作成

**レスポンス**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2024-01-02T12:00:00.000Z"
}
```

#### GET /api/session/:sessionId
セッションの有効性を確認

**レスポンス（有効な場合）**
```json
{
  "valid": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2024-01-02T12:00:00.000Z"
}
```

**レスポンス（無効/期限切れの場合）**
```json
{
  "valid": false,
  "message": "セッションが無効または期限切れです"
}
```

#### POST /api/chat
チャットメッセージを送信し、AI応答を取得

**リクエスト**
```json
{
  "message": "こんにちは",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "conversationId": "optional-conversation-id"
}
```

**レスポンス**
```json
{
  "response": "こんにちは！何かお手伝いできることはありますか？",
  "conversationId": "conversation-id",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### POST /api/cleanup
期限切れセッションのクリーンアップ（Cloud Scheduler用）

**認証**: `Authorization: Bearer <CLEANUP_SECRET>` ヘッダーが必要

**レスポンス（成功時）**
```json
{
  "message": "期限切れセッションを削除しました",
  "deletedCount": 5
}
```

**エラーレスポンス**
| ステータス | 説明 |
|------------|------|
| 401 | 認証ヘッダーなし |
| 403 | 認証トークン不正 |
| 503 | CLEANUP_SECRET未設定 |

## 開発ガイドライン

### コーディング規約
- TypeScriptの厳格モード（strict: true）を使用
- ESLint + Prettierでコード品質を維持
- コンポーネントは関数コンポーネント + hooksパターン
- **実装後は必ず `npm run lint:fix` と `npm run format` を実行すること**
- `npm run build` やテストの通過も確認すること

### コミットメッセージ
- 日本語で記述
- [AI生成]と記載する
- 例: `[AI生成] feat: チャット入力コンポーネントを追加`

### ブランチ戦略
- `main`: 本番環境
- `develop`: 開発環境
- `feature/*`: 機能開発

## 環境変数

```env
# データベース
# レプリカセット構成が必要（Prismaのトランザクション機能に必要）
DATABASE_URL="mongodb://localhost:27017/ai-chat?replicaSet=rs0"

# Anthropic API
ANTHROPIC_API_KEY="your-api-key"

# セッション設定
SESSION_EXPIRY_HOURS=24

# クリーンアップ認証（Cloud Scheduler用）
# 本番環境では強力なランダム文字列を設定
CLEANUP_SECRET="your-cleanup-secret"

# エラー追跡（オプショナル）
# Sentryを使用する場合はDSNを設定
# SENTRY_DSN=""

# GCP設定（Cloud Run環境では自動設定されるため、ローカル開発用）
# GOOGLE_CLOUD_PROJECT=""

# アプリケーション
NODE_ENV="development"
```

## セットアップ手順

```bash
# appディレクトリに移動
cd app

# 環境変数ファイルの作成
cp .env.example .env
# .envファイルを編集し、ANTHROPIC_API_KEYを設定

# 初期セットアップ（依存関係インストール、MongoDB起動、DB初期化）
make init

# 開発サーバー起動
make dev
```

### 手動セットアップ（makeが使用できない場合）

```bash
npm install                # 依存関係インストール
docker compose up -d       # MongoDB起動
# MongoDBが healthy になるまで待機（約30秒）
npm run db:generate        # Prismaクライアント生成
npm run db:push            # スキーマをDBに反映
npm run dev                # 開発サーバー起動
```

## NPMスクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLintチェック |
| `npm run lint:fix` | ESLint自動修正 |
| `npm run format` | Prettier整形 |
| `npm run format:check` | Prettier整形チェック |
| `npm run db:generate` | Prismaクライアント生成 |
| `npm run db:push` | スキーマをDBに反映 |
| `npm run db:studio` | Prisma Studio起動（DBブラウザ） |
| `npm run db:test` | データベース接続テスト |
| `npm run test` | 単体テスト（Vitest、ウォッチモード） |
| `npm run test:run` | 単体テスト（1回実行） |
| `npm run test:coverage` | 単体テスト（カバレッジ付き） |
| `npm run test:e2e` | E2Eテスト（Playwright） |
| `npm run test:e2e:ui` | E2Eテスト（Playwright UIモード） |

## テスト実行

```bash
# 単体テスト（Vitest）
npm run test          # ウォッチモード（開発中に使用）
npm run test:run      # 1回実行（CI向け）
npm run test:coverage # カバレッジレポート生成

# E2Eテスト（Playwright）
npm run test:e2e      # ヘッドレス実行
npm run test:e2e:ui   # UIモード（デバッグ用）
```

**注意**: E2Eテスト実行前に以下が必要です：
- MongoDBが起動していること（`docker compose up -d`）
- Playwrightのブラウザがインストールされていること（`npx playwright install chromium`）
- システム依存ライブラリがインストールされていること（`sudo npx playwright install-deps chromium`）

## デプロイ手順

### 前提条件
- Google Cloud CLIがインストールされていること
- Google Cloudプロジェクトが作成されていること
- 以下のAPIが有効化されていること：
  - Cloud Run API
  - Cloud Build API
  - Artifact Registry API

### 方法1: デプロイスクリプトを使用（推奨）

```bash
# appディレクトリで実行
./scripts/deploy.sh YOUR_PROJECT_ID
```

スクリプトが自動で以下を実行します：
1. Artifact Registryリポジトリの作成（初回のみ）
2. Dockerイメージのビルド
3. Artifact Registryへのプッシュ
4. Cloud Runへのデプロイ

### 方法2: Cloud Buildを使用（CI/CD向け）

```bash
# appディレクトリで実行
gcloud builds submit --config cloudbuild.yaml
```

### 方法3: 手動デプロイ

```bash
# 変数設定
PROJECT_ID="your-project-id"
REGION="asia-northeast1"
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/ai-chat/ai-chat-app"

# Artifact Registryリポジトリ作成（初回のみ）
gcloud artifacts repositories create ai-chat \
  --repository-format=docker \
  --location=${REGION}

# Dockerイメージビルド & プッシュ
docker build -t ${IMAGE_TAG}:latest .
docker push ${IMAGE_TAG}:latest

# Cloud Runにデプロイ
gcloud run deploy ai-chat \
  --image ${IMAGE_TAG}:latest \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated
```

### 環境変数の設定（デプロイ後に必須）

```bash
gcloud run services update ai-chat \
  --region asia-northeast1 \
  --set-env-vars DATABASE_URL="mongodb+srv://user:pass@cluster.mongodb.net/ai-chat" \
  --set-env-vars ANTHROPIC_API_KEY="sk-ant-api03-xxxxx" \
  --set-env-vars SESSION_EXPIRY_HOURS=24
```

**注意**:
- `DATABASE_URL`: 本番環境ではMongoDB Atlas等のマネージドサービスを推奨
- `ANTHROPIC_API_KEY`: Anthropic Consoleから取得
- 環境変数の詳細は `.env.production.example` を参照

### 期限切れセッションのクリーンアップ（Cloud Scheduler設定）

期限切れセッションを定期的に削除するため、Cloud Schedulerを設定します。

```bash
# 1. シークレット生成（この値をメモしておく）
CLEANUP_SECRET=$(openssl rand -hex 32)
echo "CLEANUP_SECRET: ${CLEANUP_SECRET}"

# 2. Cloud Runにシークレットを設定
gcloud run services update ai-chat \
  --region asia-northeast1 \
  --set-env-vars CLEANUP_SECRET="${CLEANUP_SECRET}"

# 3. Cloud Schedulerジョブを作成（毎日深夜3時に実行）
SERVICE_URL=$(gcloud run services describe ai-chat --region asia-northeast1 --format 'value(status.url)')

gcloud scheduler jobs create http cleanup-sessions \
  --location asia-northeast1 \
  --schedule "0 3 * * *" \
  --uri "${SERVICE_URL}/api/cleanup" \
  --http-method POST \
  --headers "Authorization=Bearer ${CLEANUP_SECRET}"
```

**確認方法**:
```bash
# ジョブを手動で実行してテスト
gcloud scheduler jobs run cleanup-sessions --location asia-northeast1

# ログで結果を確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ai-chat" --limit 10
```

### ローカルで本番ビルドをテスト

```bash
# MongoDB + アプリを起動
docker compose --profile prod up --build

# アクセス
open http://localhost:3000
```
