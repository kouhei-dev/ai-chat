# AIチャット - Makefile
# 使用方法: make [target]

.PHONY: help init dev test test-e2e lint format db-up db-down db-studio deploy clean

# デフォルトターゲット
help:
	@echo "利用可能なコマンド:"
	@echo ""
	@echo "  初期化・セットアップ:"
	@echo "    make init          - 初期セットアップ（依存関係インストール、DB起動、Prisma設定）"
	@echo "    make install       - npm依存関係のインストール"
	@echo ""
	@echo "  開発:"
	@echo "    make dev           - 開発サーバー起動"
	@echo ""
	@echo "  テスト:"
	@echo "    make test          - 単体テスト実行"
	@echo "    make test-e2e      - E2Eテスト実行"
	@echo "    make test-all      - 全テスト実行"
	@echo ""
	@echo "  コード品質:"
	@echo "    make lint          - ESLintチェック"
	@echo "    make format        - Prettier整形"
	@echo "    make check         - lint + format チェック"
	@echo ""
	@echo "  データベース:"
	@echo "    make db-up         - MongoDB起動"
	@echo "    make db-down       - MongoDB停止"
	@echo "    make db-studio     - Prisma Studio起動"
	@echo "    make db-push       - スキーマをDBに反映"
	@echo ""
	@echo "  デプロイ:"
	@echo "    make deploy        - Cloud Runにデプロイ（PROJECT_ID必須）"
	@echo ""
	@echo "  その他:"
	@echo "    make clean         - ビルド成果物を削除"

# ===========================================
# 初期化・セットアップ
# ===========================================

# 完全な初期セットアップ
init: install db-up db-wait db-generate db-push
	@echo "✅ 初期セットアップが完了しました"
	@echo "👉 'make dev' で開発サーバーを起動できます"

# npm依存関係のインストール
install:
	npm install

# ===========================================
# 開発
# ===========================================

# 開発サーバー起動
dev:
	npm run dev

# ===========================================
# テスト
# ===========================================

# 単体テスト（ウォッチモード）
test:
	npm run test

# 単体テスト（1回実行）
test-run:
	npm run test:run

# E2Eテスト
test-e2e:
	npm run test:e2e

# 全テスト実行
test-all: test-run test-e2e

# ===========================================
# コード品質
# ===========================================

# ESLintチェック
lint:
	npm run lint

# ESLint自動修正
lint-fix:
	npm run lint:fix

# Prettier整形
format:
	npm run format

# Prettier整形チェック
format-check:
	npm run format:check

# lint + format チェック
check: lint format-check

# ===========================================
# データベース
# ===========================================

# MongoDB起動
db-up:
	docker compose up -d mongodb

# MongoDB停止
db-down:
	docker compose down

# MongoDBの起動待機
db-wait:
	@echo "MongoDBの起動を待機中..."
	@until docker compose ps mongodb | grep -q "healthy"; do \
		echo "  waiting..."; \
		sleep 5; \
	done
	@echo "MongoDBが起動しました"

# Prismaクライアント生成
db-generate:
	npm run db:generate

# スキーマをDBに反映
db-push:
	npm run db:push

# Prisma Studio起動
db-studio:
	npm run db:studio

# データベース接続テスト
db-test:
	npm run db:test

# ===========================================
# デプロイ
# ===========================================

# Cloud Runにデプロイ
# 使用方法: make deploy PROJECT_ID=your-project-id
deploy:
ifndef PROJECT_ID
	$(error PROJECT_ID is required. Usage: make deploy PROJECT_ID=your-project-id)
endif
	./scripts/deploy.sh $(PROJECT_ID)

# ===========================================
# その他
# ===========================================

# ビルド成果物を削除
clean:
	rm -rf .next
	rm -rf node_modules/.cache
	@echo "✅ ビルド成果物を削除しました"

# node_modulesも含めて完全削除
clean-all: clean
	rm -rf node_modules
	@echo "✅ node_modulesを削除しました"
	@echo "👉 'make install' で再インストールしてください"
