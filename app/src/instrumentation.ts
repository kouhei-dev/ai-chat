/**
 * Next.js Instrumentation
 * サーバー起動時に実行される処理を定義
 */

/**
 * 必須環境変数の検証
 * 環境変数が設定されていない場合はコンソールに警告を出力
 */
function validateEnvironmentVariables(): void {
  // テスト環境では検証をスキップ
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const requiredEnvVars = [
    {
      name: 'ANTHROPIC_API_KEY',
      description: 'Anthropic API key for Claude',
      validate: (value: string) => {
        if (!value.startsWith('sk-')) {
          return "Invalid format (should start with 'sk-')";
        }
        return null;
      },
    },
    {
      name: 'DATABASE_URL',
      description: 'MongoDB connection string',
      validate: (value: string) => {
        if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
          return 'Invalid format (should start with mongodb:// or mongodb+srv://)';
        }
        return null;
      },
    },
  ];

  const missingVars: string[] = [];
  const warnings: string[] = [];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    if (!value) {
      missingVars.push(`  - ${envVar.name}: ${envVar.description}`);
    } else if (envVar.validate) {
      const error = envVar.validate(value);
      if (error) {
        warnings.push(`  - ${envVar.name}: ${error}`);
      }
    }
  }

  if (missingVars.length > 0) {
    console.error('\n⚠️  Missing required environment variables:');
    console.error(missingVars.join('\n'));
    console.error('\nPlease set these variables in your .env file or environment.\n');
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment variable warnings:');
    console.warn(warnings.join('\n'));
    console.warn('');
  }

  // 全ての必須変数が設定されている場合は成功メッセージ
  if (missingVars.length === 0 && warnings.length === 0) {
    console.log('✅ All required environment variables are configured');
  }
}

/**
 * Next.js Instrumentation register function
 * サーバー起動時に1回だけ呼ばれる
 */
export async function register(): Promise<void> {
  // サーバーサイドでのみ実行（エッジランタイムでは実行しない）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('\n🚀 Starting AI Chat application...');
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

    // 環境変数の検証
    validateEnvironmentVariables();

    console.log('');
  }
}
