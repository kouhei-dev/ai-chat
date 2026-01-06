# AIチャット アーキテクチャ図

## 1. システム構成図

```mermaid
graph TB
    subgraph "クライアント"
        Browser[ブラウザ]
        LocalStorage[(localStorage)]
    end

    subgraph "Google Cloud Platform"
        subgraph "Cloud Run"
            NextJS[Next.js App Router]
            subgraph "API Layer"
                Hono[Hono API]
                Middleware[ミドルウェア<br/>- ロギング<br/>- エラーハンドリング]
            end
            subgraph "Business Logic"
                Session[セッション管理]
                MastraAgent[Mastra Agent]
            end
        end

        CloudScheduler[Cloud Scheduler]
    end

    subgraph "外部サービス"
        MongoDB[(MongoDB Atlas)]
        ClaudeAPI[Claude API<br/>Anthropic]
    end

    Browser -->|HTTPS| NextJS
    Browser <-->|sessionId| LocalStorage
    NextJS --> Hono
    Hono --> Middleware
    Middleware --> Session
    Middleware --> MastraAgent
    Session --> MongoDB
    MastraAgent --> ClaudeAPI
    Hono --> MongoDB
    CloudScheduler -->|POST /api/cleanup| Hono

    style NextJS fill:#0070f3,color:#fff
    style Hono fill:#ff6b35,color:#fff
    style MongoDB fill:#4db33d,color:#fff
    style ClaudeAPI fill:#d4a574,color:#000
```

## 2. リクエストフロー図

### 2.1 チャットメッセージ送信フロー

```mermaid
sequenceDiagram
    participant B as ブラウザ
    participant N as Next.js
    participant H as Hono API
    participant S as セッション管理
    participant DB as MongoDB
    participant M as Mastra Agent
    participant C as Claude API

    B->>N: POST /api/chat
    N->>H: リクエスト転送
    H->>H: ミドルウェア処理<br/>(ロギング開始)

    H->>S: セッション検証
    S->>DB: セッション取得
    DB-->>S: セッション情報
    S-->>H: 検証結果

    alt セッション無効
        H-->>B: 401 Unauthorized
    end

    H->>DB: 会話取得/作成
    DB-->>H: 会話情報

    H->>DB: ユーザーメッセージ保存

    H->>M: AI応答生成リクエスト
    M->>C: Claude API呼び出し
    C-->>M: AI応答
    M-->>H: 応答テキスト

    H->>DB: アシスタントメッセージ保存

    H->>H: ミドルウェア処理<br/>(レスポンスタイム計測)
    H-->>N: JSONレスポンス
    N-->>B: 200 OK + AI応答
```

### 2.2 セッション初期化フロー

```mermaid
sequenceDiagram
    participant B as ブラウザ
    participant LS as localStorage
    participant API as Hono API
    participant DB as MongoDB

    B->>LS: sessionId取得

    alt sessionIdあり
        LS-->>B: sessionId
        B->>API: GET /api/session/{id}
        API->>DB: セッション検証

        alt 有効
            DB-->>API: セッション情報
            API-->>B: valid: true
            B->>API: GET /api/conversations
            API->>DB: 会話履歴取得
            DB-->>API: 会話一覧
            API-->>B: conversations
            B->>B: メッセージ復元
        else 無効/期限切れ
            API-->>B: valid: false
            B->>LS: sessionId削除
            B->>API: POST /api/session
        end
    else sessionIdなし
        B->>API: POST /api/session
        API->>DB: セッション作成
        DB-->>API: 新規セッション
        API-->>B: sessionId
        B->>LS: sessionId保存
    end
```

## 3. データモデル図

```mermaid
erDiagram
    Session ||--o{ Conversation : "has"
    Conversation ||--o{ Message : "contains"

    Session {
        ObjectId id PK
        String sessionId UK "UUIDv4"
        DateTime expiresAt "インデックス付き"
        DateTime createdAt
        DateTime updatedAt
    }

    Conversation {
        ObjectId id PK
        ObjectId sessionId FK "インデックス付き"
        DateTime createdAt
        DateTime updatedAt
    }

    Message {
        ObjectId id PK
        ObjectId conversationId FK
        MessageRole role "user | assistant"
        String content
        DateTime createdAt
    }
```

## 4. ディレクトリ構成

```
ai-chat/
├── CLAUDE.md                 # プロジェクト仕様書
├── TODO.md                   # 実装計画
├── README.md                 # セットアップ手順
├── docs/                     # ドキュメント
│   ├── architecture.md       # 本ファイル
│   └── api-documentation-plan.md
│
└── app/                      # Next.jsアプリケーション
    ├── src/
    │   ├── app/              # Next.js App Router
    │   │   ├── api/[[...route]]/  # Hono APIルート
    │   │   ├── layout.tsx    # ルートレイアウト
    │   │   └── page.tsx      # メインページ
    │   │
    │   ├── components/       # Reactコンポーネント
    │   │   ├── chat/         # チャット関連
    │   │   │   ├── ChatContainer.tsx
    │   │   │   ├── ChatInput.tsx
    │   │   │   ├── MessageList.tsx
    │   │   │   └── MessageItem.tsx
    │   │   └── ui/           # 共通UI
    │   │
    │   └── lib/              # ライブラリ・ユーティリティ
    │       ├── api/          # APIクライアント・Honoアプリ
    │       │   ├── app.ts    # Honoアプリ定義
    │       │   ├── chat.ts   # フロントエンド用APIクライアント
    │       │   ├── errors.ts # エラーコード定義
    │       │   └── middleware/  # ミドルウェア
    │       ├── db/           # Prisma関連
    │       ├── logger/       # 構造化ログ
    │       ├── mastra/       # Mastra Agent設定
    │       ├── session/      # セッション管理
    │       └── storage/      # localStorage操作
    │
    ├── tests/                # テストファイル
    │   ├── unit/             # 単体テスト (Vitest)
    │   └── e2e/              # E2Eテスト (Playwright)
    │
    ├── prisma/
    │   └── schema.prisma     # データベーススキーマ
    │
    ├── scripts/
    │   └── deploy.sh         # デプロイスクリプト
    │
    ├── Dockerfile            # 本番用Dockerイメージ
    ├── docker-compose.yml    # ローカル開発用
    └── cloudbuild.yaml       # Cloud Build設定
```

## 5. 技術スタック

| レイヤー | 技術 | 用途 |
|----------|------|------|
| フロントエンド | Next.js 16 (App Router) | SSR/CSRフレームワーク |
| | React 19 | UIライブラリ |
| | Tailwind CSS | スタイリング |
| | TypeScript | 型安全性 |
| バックエンド | Hono | 軽量APIフレームワーク |
| | Mastra | AIエージェントフレームワーク |
| | Prisma 6 | ORM |
| データベース | MongoDB 7 | ドキュメントDB |
| AI | Claude claude-sonnet-4-20250514 | LLM |
| インフラ | Google Cloud Run | サーバーレスコンテナ |
| | Cloud Scheduler | 定期実行 |
| | Docker | コンテナ化 |
| テスト | Vitest | 単体テスト |
| | Playwright | E2Eテスト |

## 6. セキュリティ

```mermaid
graph LR
    subgraph "セキュリティレイヤー"
        A[セキュリティヘッダー<br/>CSP, X-Frame-Options等]
        B[セッション検証<br/>UUID形式チェック]
        C[入力バリデーション<br/>文字数制限, 形式チェック]
        D[所有権検証<br/>セッション-会話の紐付け]
        E[認証<br/>cleanup API用Bearer Token]
    end

    Request --> A --> B --> C --> D --> Response
    CleanupRequest --> A --> E --> Response
```

| 対策 | 実装 |
|------|------|
| XSS防止 | CSP, X-Content-Type-Options |
| クリックジャッキング防止 | X-Frame-Options |
| セッションハイジャック対策 | UUIDv4による推測困難なID |
| 入力検証 | 最大文字数制限、形式チェック |
| 認可 | セッション所有権の検証 |
