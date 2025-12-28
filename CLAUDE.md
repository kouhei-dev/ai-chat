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

```
ai-chat/
├── CLAUDE.md                   # プロジェクト仕様書
├── TODO.md                     # 実装計画
├── tests/
│   ├── unit/                   # Vitestテスト
│   └── e2e/                    # Playwrightテスト
└── app/                        # Next.jsプロジェクト
    ├── src/
    │   ├── app/                # Next.js App Router
    │   │   ├── api/
    │   │   │   └── [[...route]]/   # Hono APIルート
    │   │   │       └── route.ts
    │   │   ├── globals.css
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── components/         # UIコンポーネント
    │   │   ├── chat/
    │   │   │   ├── ChatContainer.tsx
    │   │   │   ├── MessageList.tsx
    │   │   │   ├── MessageItem.tsx
    │   │   │   └── ChatInput.tsx
    │   │   └── ui/             # 共通UIコンポーネント
    │   ├── lib/
    │   │   ├── db/             # Prisma関連
    │   │   │   └── prisma.ts
    │   │   ├── mastra/         # Mastra設定
    │   │   │   └── agent.ts
    │   │   └── api/            # APIクライアント
    │   └── types/              # 型定義
    ├── prisma/
    │   └── schema.prisma
    ├── public/
    ├── .env.example
    ├── .gitignore
    ├── .prettierrc
    ├── eslint.config.mjs
    ├── next.config.ts
    ├── package.json
    ├── postcss.config.mjs
    ├── tsconfig.json
    ├── Dockerfile
    └── docker-compose.yml
```

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

## 開発ガイドライン

### コーディング規約
- TypeScriptの厳格モード（strict: true）を使用
- ESLint + Prettierでコード品質を維持
- コンポーネントは関数コンポーネント + hooksパターン

### コミットメッセージ
- 日本語で記述
- 例: `feat: チャット入力コンポーネントを追加`

### ブランチ戦略
- `main`: 本番環境
- `develop`: 開発環境
- `feature/*`: 機能開発

## 環境変数

```env
# データベース
DATABASE_URL="mongodb://localhost:27017/ai-chat"

# Anthropic API
ANTHROPIC_API_KEY="your-api-key"

# セッション設定
SESSION_EXPIRY_HOURS=24

# アプリケーション
NODE_ENV="development"
```

## セットアップ手順

```bash
# appディレクトリに移動
cd app

# 依存関係インストール
npm install

# Prisma初期化
npx prisma generate
npx prisma db push

# 開発サーバー起動
npm run dev

# テスト実行
npm run test        # 単体テスト
npm run test:e2e    # E2Eテスト
```

## デプロイ手順

### Google Cloud Run
1. Google Cloud Project の作成
2. Cloud Run の有効化
3. Dockerfile の作成
4. Dockerイメージをビルド
5. Cloud Build でのイメージビルド
6. Cloud Runにデプロイ
7. 環境変数の設定

```bash
# ビルド & プッシュ
gcloud builds submit --tag gcr.io/PROJECT_ID/ai-chat

# デプロイ
gcloud run deploy ai-chat \
  --image gcr.io/PROJECT_ID/ai-chat \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```
