# syntax=docker/dockerfile:1

# ベースイメージ
FROM node:20-alpine AS base

# 依存関係インストール用ステージ
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# パッケージファイルをコピー
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# 依存関係をインストール
RUN npm ci

# Prismaクライアントを生成
RUN npx prisma generate

# ビルド用ステージ
FROM base AS builder
WORKDIR /app

# 依存関係をコピー
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 環境変数（ビルド時に必要な場合）
ENV NEXT_TELEMETRY_DISABLED=1

# アプリケーションをビルド
RUN npm run build

# 本番用ステージ
FROM base AS runner
WORKDIR /app

# 本番環境設定
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# セキュリティ: 非rootユーザーで実行
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# publicフォルダをコピー
COPY --from=builder /app/public ./public

# standaloneとstaticファイルをコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prismaクライアントをコピー（実行時に必要）
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

# ポート設定
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# アプリケーション起動
CMD ["node", "server.js"]
