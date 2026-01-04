#!/bin/bash

# AIチャット - Google Cloud Runデプロイスクリプト
# 使用方法: ./scripts/deploy.sh [PROJECT_ID]

set -e

# 色付きログ出力
log_info() { echo -e "\033[34m[INFO]\033[0m $1"; }
log_success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
log_error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

# 設定
PROJECT_ID="${1:-$GOOGLE_CLOUD_PROJECT}"
REGION="asia-northeast1"
REPOSITORY="ai-chat"
IMAGE_NAME="ai-chat-app"
SERVICE_NAME="ai-chat"
ENV_FILE=".env.production"

# .env.productionの存在チェック
if [ ! -f "$ENV_FILE" ]; then
    log_error "$ENV_FILE が見つかりません"
    echo ".env.production.example をコピーして設定してください："
    echo "  cp .env.production.example .env.production"
    echo "  # .env.production を編集して値を設定"
    exit 1
fi

# .env.productionを読み込み
log_info "$ENV_FILE を読み込んでいます..."
set -a
source "$ENV_FILE"
set +a

# 必須環境変数のチェック
MISSING_VARS=""
[ -z "$DATABASE_URL" ] && MISSING_VARS="$MISSING_VARS DATABASE_URL"
[ -z "$ANTHROPIC_API_KEY" ] && MISSING_VARS="$MISSING_VARS ANTHROPIC_API_KEY"
[ -z "$CLEANUP_SECRET" ] && MISSING_VARS="$MISSING_VARS CLEANUP_SECRET"

if [ -n "$MISSING_VARS" ]; then
    log_error "必須環境変数が $ENV_FILE に設定されていません:$MISSING_VARS"
    exit 1
fi

# プロジェクトIDチェック
if [ -z "$PROJECT_ID" ]; then
    log_error "PROJECT_IDが指定されていません"
    echo "使用方法: ./scripts/deploy.sh [PROJECT_ID]"
    echo "または環境変数 GOOGLE_CLOUD_PROJECT を設定してください"
    exit 1
fi

log_info "デプロイを開始します..."
log_info "プロジェクト: $PROJECT_ID"
log_info "リージョン: $REGION"

# gcloud認証チェック
if ! gcloud auth print-identity-token &>/dev/null; then
    log_error "gcloudの認証が必要です。'gcloud auth login' を実行してください"
    exit 1
fi

# プロジェクト設定
log_info "プロジェクトを設定中..."
gcloud config set project "$PROJECT_ID"

# Artifact Registry リポジトリ作成（存在しない場合）
log_info "Artifact Registryリポジトリを確認中..."
if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" &>/dev/null; then
    log_info "リポジトリを作成中..."
    gcloud artifacts repositories create "$REPOSITORY" \
        --repository-format=docker \
        --location="$REGION" \
        --description="AI Chat application images"
fi

# イメージタグ
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Dockerイメージビルド
log_info "Dockerイメージをビルド中..."
docker build -t "${IMAGE_TAG}:${TIMESTAMP}" -t "${IMAGE_TAG}:latest" .

# Artifact Registryへプッシュ
log_info "イメージをArtifact Registryにプッシュ中..."
docker push "${IMAGE_TAG}:${TIMESTAMP}"
docker push "${IMAGE_TAG}:latest"

# 環境変数の準備
SESSION_EXPIRY_HOURS="${SESSION_EXPIRY_HOURS:-24}"
ENV_VARS="NODE_ENV=production"
ENV_VARS="${ENV_VARS},SESSION_EXPIRY_HOURS=${SESSION_EXPIRY_HOURS}"
ENV_VARS="${ENV_VARS},DATABASE_URL=${DATABASE_URL}"
ENV_VARS="${ENV_VARS},ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
ENV_VARS="${ENV_VARS},CLEANUP_SECRET=${CLEANUP_SECRET}"

# オプション: Sentryエラー追跡
if [ -n "$SENTRY_DSN" ]; then
    log_info "Sentryエラー追跡: 有効"
    ENV_VARS="${ENV_VARS},SENTRY_DSN=${SENTRY_DSN}"
else
    log_info "Sentryエラー追跡: 無効（SENTRY_DSN未設定）"
fi

# Cloud Runにデプロイ
log_info "Cloud Runにデプロイ中..."
gcloud run deploy "$SERVICE_NAME" \
    --image "${IMAGE_TAG}:${TIMESTAMP}" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "$ENV_VARS" \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10

# デプロイ完了
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')
log_success "デプロイが完了しました！"
log_success "URL: $SERVICE_URL"

echo ""
echo "================================================"
echo "【初回のみ】Cloud Scheduler設定（期限切れセッション削除の定期実行）:"
echo ""
echo "  gcloud scheduler jobs create http cleanup-sessions \\"
echo "    --location $REGION \\"
echo "    --schedule \"0 3 * * *\" \\"
echo "    --uri \"$SERVICE_URL/api/cleanup\" \\"
echo "    --http-method POST \\"
echo "    --headers \"Authorization=Bearer \$CLEANUP_SECRET\""
echo ""
echo "※ CLEANUP_SECRET は .env.production に設定した値を使用してください"
echo "================================================"
