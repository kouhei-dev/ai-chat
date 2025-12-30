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

# Cloud Runにデプロイ
log_info "Cloud Runにデプロイ中..."
gcloud run deploy "$SERVICE_NAME" \
    --image "${IMAGE_TAG}:${TIMESTAMP}" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,SESSION_EXPIRY_HOURS=24" \
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
echo "重要: 以下の環境変数をCloud Runで設定してください："
echo "  - DATABASE_URL: MongoDBの接続URL"
echo "  - ANTHROPIC_API_KEY: Anthropic APIキー"
echo ""
echo "設定コマンド:"
echo "  gcloud run services update $SERVICE_NAME \\"
echo "    --region $REGION \\"
echo "    --set-env-vars DATABASE_URL=<your-mongodb-url> \\"
echo "    --set-env-vars ANTHROPIC_API_KEY=<your-api-key>"
echo "================================================"
