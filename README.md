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

# 環境変数設定
cp .env.example .env
# .envを編集してANTHROPIC_API_KEYを設定

# 初期セットアップ（依存関係インストール、MongoDB起動、DB初期化）
make init

# 開発サーバー起動
make dev
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
| `make dev` | 開発サーバー起動 |
| `make test` | 単体テスト（ウォッチモード） |
| `make test-e2e` | E2Eテスト |
| `make lint-fix` | ESLint自動修正 |
| `make format` | Prettier整形 |
| `make db-studio` | Prisma Studio（DBブラウザ） |
| `make help` | 全コマンド一覧 |

## テスト

```bash
# 単体テスト
make test

# E2Eテスト（事前にMongoDBが起動している必要があります）
make test-e2e
```

E2Eテスト実行前に以下が必要です：
```bash
npx playwright install chromium
sudo npx playwright install-deps chromium  # Linux
```

## デプロイ

Google Cloud Runへのデプロイ：

```bash
make deploy PROJECT_ID=your-project-id
```

デプロイ後、環境変数（DATABASE_URL, ANTHROPIC_API_KEY）の設定が必要です。
詳細は[CLAUDE.md](CLAUDE.md)のデプロイ手順を参照してください。

## ドキュメント

詳細な仕様・設計については[CLAUDE.md](CLAUDE.md)を参照してください。
