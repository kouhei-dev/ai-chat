# AIチャット

エンターテイメント用AIチャットボット。Claude-4-sonnetを使用した、気軽に会話を楽しめるWebアプリケーションです。

## 技術スタック

- **フロントエンド**: Next.js (App Router) + React + Tailwind CSS
- **バックエンド**: Hono + Prisma + Mastra
- **データベース**: MongoDB
- **AIモデル**: Claude-4-sonnet (Anthropic)
- **テスト**: Vitest + Playwright
- **デプロイ**: Google Cloud Run

## クイックスタート

### 前提条件

- Node.js 20以上
- Docker / Docker Compose
- Anthropic APIキー

### セットアップ

```bash
# appディレクトリに移動
cd app

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .envを編集してANTHROPIC_API_KEYを設定

# MongoDB起動
docker compose up -d

# MongoDBが起動するまで待機（約30秒）
docker compose ps  # STATUS: healthy になるまで待つ

# データベース初期化
npm run db:generate
npm run db:push

# 開発サーバー起動
npm run dev
```

http://localhost:3000 でアプリにアクセスできます。

## 使い方

1. ブラウザでアプリにアクセス
2. メッセージ入力欄にテキストを入力
3. 送信ボタン（またはEnterキー）で送信
4. AIからの応答を待つ

セッションは24時間有効です。ブラウザを閉じても会話履歴は保持されます。

## 開発コマンド

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run lint:fix` | ESLint自動修正 |
| `npm run format` | Prettier整形 |
| `npm run test` | 単体テスト（ウォッチモード） |
| `npm run test:run` | 単体テスト（1回実行） |
| `npm run test:e2e` | E2Eテスト |
| `npm run db:studio` | Prisma Studio（DBブラウザ） |

## テスト

```bash
# 単体テスト
npm run test:run

# E2Eテスト（事前にMongoDBが起動している必要があります）
npm run test:e2e
```

E2Eテスト実行前に以下が必要です：
```bash
npx playwright install chromium
sudo npx playwright install-deps chromium  # Linux
```

## デプロイ

Google Cloud Runへのデプロイ：

```bash
./scripts/deploy.sh YOUR_PROJECT_ID
```

デプロイ後、環境変数（DATABASE_URL, ANTHROPIC_API_KEY）の設定が必要です。
詳細は[CLAUDE.md](CLAUDE.md)のデプロイ手順を参照してください。

## ドキュメント

詳細な仕様・設計については[CLAUDE.md](CLAUDE.md)を参照してください。
