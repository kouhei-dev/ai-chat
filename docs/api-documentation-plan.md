# APIドキュメント対応計画

## 概要

本ドキュメントは、AIチャットプロジェクトにおけるAPIドキュメント（OpenAPI/Swagger）対応の調査結果と実装計画をまとめたものです。

**作成日**: 2026-01-07
**ステータス**: 将来対応予定

---

## 1. OpenAPI/Swagger対応

### 1.1 推奨ライブラリ

**`@hono/zod-openapi`** を使用することで、HonoアプリケーションにOpenAPI対応を追加できます。

- **公式ドキュメント**: https://hono.dev/examples/zod-openapi
- **特徴**: Zodでバリデーションしながら、OpenAPIドキュメントを自動生成

### 1.2 実装方法

#### パッケージのインストール

```bash
npm install @hono/zod-openapi
```

#### アプリケーションの変更

**現在の実装:**

```typescript
import { Hono } from 'hono';

export const app = new Hono().basePath('/api');

app.post('/chat', async (c) => {
  // 手動でバリデーション
  const body = await c.req.json();
  // ...
});
```

**OpenAPI対応後:**

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

export const app = new OpenAPIHono().basePath('/api');

// スキーマ定義
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(400).openapi({
    example: 'こんにちは',
    description: 'ユーザーのメッセージ（1-400文字）',
  }),
  sessionId: z.string().uuid().openapi({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'セッションID（UUIDv4形式）',
  }),
  conversationId: z.string().optional().openapi({
    example: '507f1f77bcf86cd799439011',
    description: '会話ID（MongoDB ObjectId形式、省略可）',
  }),
});

const ChatResponseSchema = z.object({
  response: z.string().openapi({
    example: 'こんにちは！何かお手伝いできることはありますか？',
  }),
  conversationId: z.string(),
  sessionId: z.string(),
}).openapi('ChatResponse');

// ルート定義
const chatRoute = createRoute({
  method: 'post',
  path: '/chat',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ChatResponseSchema,
        },
      },
      description: 'AI応答を返す',
    },
    400: {
      description: 'リクエストが不正',
    },
    401: {
      description: 'セッションが無効',
    },
  },
});

// ルート登録
app.openapi(chatRoute, async (c) => {
  const { message, sessionId, conversationId } = c.req.valid('json');
  // 処理...
});

// OpenAPIドキュメントエンドポイント
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'AIチャット API',
    description: 'エンターテイメント用AIチャットボットのAPI',
  },
});
```

#### Swagger UI の追加

```typescript
import { swaggerUI } from '@hono/swagger-ui';

// Swagger UI エンドポイント
app.get('/ui', swaggerUI({ url: '/api/doc' }));
```

### 1.3 対象エンドポイント

| エンドポイント | メソッド | 説明 |
|----------------|----------|------|
| `/api/health` | GET | ヘルスチェック |
| `/api/session` | POST | セッション作成 |
| `/api/session/:sessionId` | GET | セッション検証 |
| `/api/chat` | POST | チャットメッセージ送信 |
| `/api/conversations` | GET | 会話履歴取得 |
| `/api/cleanup` | POST | 期限切れセッション削除（認証必須） |

### 1.4 必要な作業

| No. | 作業項目 | 工数 | 詳細 |
|-----|----------|------|------|
| 1 | パッケージインストール | 小 | `@hono/zod-openapi`, `@hono/swagger-ui` |
| 2 | app.ts の置換 | 中 | `Hono` → `OpenAPIHono` に変更 |
| 3 | スキーマ定義 | 大 | 6エンドポイント分のZodスキーマ作成 |
| 4 | ルート定義の書き換え | 大 | `createRoute` 形式への変換 |
| 5 | Swagger UI 設定 | 小 | `/api/ui` でドキュメント閲覧可能に |
| 6 | テスト修正 | 中 | 既存テストの調整 |

**総工数見積もり**: 1-2日

### 1.5 メリット・デメリット

#### メリット

- **自動ドキュメント生成**: コードとドキュメントの乖離を防止
- **型安全性向上**: Zodによるランタイムバリデーション
- **対話的なAPI試行**: Swagger UIでAPIを直接テスト可能
- **クライアント生成**: OpenAPI仕様からSDKを自動生成可能

#### デメリット

- **既存コードの大幅変更**: 全エンドポイントの書き換えが必要
- **学習コスト**: Zod OpenAPIの記法習得が必要
- **過剰な場合も**: 小規模プロジェクトには機能過多

### 1.6 対応方針

**現時点では対応を見送り、以下の条件で再検討する:**

1. API利用者（外部開発者など）が増えた場合
2. エンドポイント数が大幅に増加した場合
3. クライアントSDKの自動生成が必要になった場合

---

## 2. アーキテクチャ図

### 2.1 対応方針

**対応する** - 工数が小さく、プロジェクト理解の助けになるため。

### 2.2 作成する図

1. **システム構成図**: 全体のコンポーネント構成
2. **データフロー図**: リクエスト/レスポンスの流れ
3. **データモデル図**: MongoDB のコレクション構造

### 2.3 記法

Mermaid記法を使用し、README.mdまたは別ファイルに追加。

---

## 3. 参考資料

- [Hono Zod OpenAPI Example](https://hono.dev/examples/zod-openapi)
- [Hono OpenAPI Middleware](https://hono.dev/examples/hono-openapi)
- [@hono/zod-openapi GitHub](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)
- [Swagger UI for Hono](https://github.com/honojs/middleware/tree/main/packages/swagger-ui)
