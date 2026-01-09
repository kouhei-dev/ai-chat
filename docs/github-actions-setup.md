# GitHub Actions セットアップガイド

このプロジェクトではGitHub Actionsを使用してCI/CDパイプラインを実装しています。

## 概要

2つのワークフローがあります：

1. **CI (`.github/workflows/ci.yaml`)**: PRとpush時に自動実行
   - リント、フォーマットチェック
   - 単体テスト
   - E2Eテスト
   - ビルド確認

2. **Deploy (`.github/workflows/deploy.yaml`)**: mainブランチへのpush時に自動デプロイ
   - Dockerイメージビルド
   - Artifact Registryへプッシュ
   - Cloud Runへデプロイ

## 初期セットアップ

### 1. Workload Identity連携の設定

GitHub ActionsからGoogle Cloudへの認証にWorkload Identityを使用します。

#### 1.1. Workload Identity Poolの作成

```bash
# プロジェクトIDを設定
export PROJECT_ID="your-project-id"
export PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")

# Workload Identity Poolを作成
gcloud iam workload-identity-pools create "github-actions-pool" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Pool IDを取得
export WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe "github-actions-pool" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --format="value(name)")
```

#### 1.2. Workload Identity Providerの作成

```bash
# GitHubリポジトリ情報を設定（ご自身のリポジトリに変更してください）
export GITHUB_REPO="your-username/ai-chat"
export GITHUB_ORG="your-username"  # GitHubのユーザー名または組織名

# Providerを作成
# 重要: attribute-conditionで参照する属性は、attribute-mappingで先にマップする必要があります
gcloud iam workload-identity-pools providers create-oidc "github-actions-provider" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-actions-pool" \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == '${GITHUB_ORG}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

**重要なセキュリティ設定:**
- `attribute-mapping`: GitHubのOIDCトークンからGoogle Cloudの属性へのマッピング
  - `google.subject`: 必須のマッピング（トークンのsubject）
  - `attribute.repository_owner`: GitHubのorganization/ユーザー名をマップ
- `attribute-condition`: アクセス制限の条件式（CEL式）
  - 特定のGitHub organizationからのアクセスのみを許可
  - **この設定により、他のGitHub repositoryからの不正アクセスを防止**

#### 1.3. サービスアカウントの作成と権限付与

```bash
# サービスアカウントを作成
gcloud iam service-accounts create github-actions-sa \
  --project="${PROJECT_ID}" \
  --display-name="GitHub Actions Service Account"

# 必要な権限を付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Workload Identity連携を設定
gcloud iam service-accounts add-iam-policy-binding "github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_REPO}"
```

#### 1.4. Artifact Registryリポジトリの作成

```bash
gcloud artifacts repositories create ai-chat \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="AI Chat application images" \
  --project="${PROJECT_ID}"
```

### 2. GitHub Secretsの設定

GitHubリポジトリの Settings > Secrets and variables > Actions で以下のシークレットを設定します。

#### 必須シークレット

| シークレット名 | 説明 | 使用先 | 例 |
|---------------|------|--------|-----|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider ID | Deployワークフロー | `projects/123456789/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider` |
| `GCP_SERVICE_ACCOUNT` | サービスアカウントメール | Deployワークフロー | `github-actions-sa@your-project-id.iam.gserviceaccount.com` |
| `DATABASE_URL` | MongoDB接続URL（本番環境） | Deployワークフロー | `mongodb+srv://user:pass@cluster.mongodb.net/ai-chat` |
| `ANTHROPIC_API_KEY` | Anthropic APIキー | Deployワークフロー | `sk-ant-api03-xxxxx` |
| `CLEANUP_SECRET` | クリーンアップAPI認証トークン | Deployワークフロー | ランダムな強力な文字列 |

**注意**: CIワークフロー（テスト実行）では、これらのシークレットは不要です。E2EテストではAPIレスポンスをモック化しているため、実際のAPIキーは使用しません。

#### オプショナルシークレット

| シークレット名 | 説明 | デフォルト値 |
|---------------|------|-------------|
| `SESSION_EXPIRY_HOURS` | セッション有効期限（時間） | `24` |

#### Workload Identity Provider IDの取得方法

```bash
gcloud iam workload-identity-pools providers describe "github-actions-provider" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-actions-pool" \
  --format="value(name)"
```

出力例:
```
projects/123456789/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
```

#### CLEANUP_SECRETの生成方法

```bash
openssl rand -hex 32
```

## ワークフローの実行

### CI ワークフロー

以下のタイミングで自動実行されます：

- Pull Request作成時・更新時（main, developブランチ宛て）
- main, developブランチへのpush時

手動実行はできません。

### Deploy ワークフロー

以下のタイミングで自動実行されます：

- mainブランチへのpush時

手動実行も可能です：

1. GitHub の Actions タブを開く
2. "Deploy to Cloud Run" ワークフローを選択
3. "Run workflow" ボタンをクリック
4. デプロイ先環境を選択（production / staging）
5. "Run workflow" を実行

## トラブルシューティング

### Workload Identity認証エラー

エラー: `Failed to generate Google Cloud access token`

**原因**: Workload Identity連携の設定が不正

**解決方法**:
1. `GCP_WORKLOAD_IDENTITY_PROVIDER` と `GCP_SERVICE_ACCOUNT` の値を確認
2. サービスアカウントにWorkload Identity Userロールが付与されているか確認
3. リポジトリ名が正しく設定されているか確認

```bash
# 設定確認
gcloud iam service-accounts get-iam-policy \
  github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com
```

### Docker push時の権限エラー

エラー: `Permission denied: Artifact Registry`

**解決方法**:
```bash
# Artifact Registry書き込み権限を再付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### Cloud Runデプロイ時の権限エラー

エラー: `Permission denied: Cloud Run`

**解決方法**:
```bash
# Cloud Run管理者権限を再付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Workload Identity Provider作成時のエラー

エラー: `INVALID_ARGUMENT: The attribute condition must reference one of the provider's claims`

**原因**: `attribute-condition`で参照している属性が`attribute-mapping`で定義されていない

**解決方法**:
1. `attribute-condition`で使用する属性は、必ず`attribute-mapping`で先にマップする
2. 例: `assertion.repository_owner`を条件で使う場合は、`attribute.repository_owner=assertion.repository_owner`をマッピングに含める

```bash
# 正しい例
gcloud iam workload-identity-pools providers create-oidc "github-actions-provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == 'your-org'"

# NGな例（repository_ownerがマッピングされていない）
gcloud iam workload-identity-pools providers create-oidc "github-actions-provider" \
  --attribute-mapping="google.subject=assertion.sub" \
  --attribute-condition="assertion.repository_owner == 'your-org'"  # エラー！
```

## セキュリティのベストプラクティス

1. **Workload Identity Federationの制限**
   - **必ず`attribute-condition`を設定**して、特定のGitHub organizationからのアクセスのみを許可
   - 条件で参照する属性は、`attribute-mapping`で事前にマップが必要
   - 推奨: `assertion.repository_owner == 'your-org'` でorganizationを制限
   - より厳密に: `assertion.repository == 'your-org/your-repo'` で特定リポジトリのみに制限
   - ブランチ制限も可能: `assertion.ref == 'refs/heads/main'` でmainブランチのみに制限

2. **シークレットの管理**
   - GitHub Secretsに保存された値は暗号化されます
   - ワークフローログには表示されません（`***`でマスクされます）

3. **最小権限の原則**
   - サービスアカウントには必要最小限の権限のみを付与
   - Workload Identity連携で特定のリポジトリのみに制限

4. **定期的なローテーション**
   - CLEANUP_SECRETは定期的に再生成することを推奨
   - サービスアカウントキーは使用していません（Workload Identity使用）

## 参考リンク

- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)
- [Workload Identity 連携](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Cloud Run デプロイ](https://cloud.google.com/run/docs/deploying)
