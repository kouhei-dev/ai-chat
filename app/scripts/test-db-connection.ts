/**
 * データベース接続テストスクリプト
 *
 * 実行方法: npx tsx scripts/test-db-connection.ts
 *
 * テスト内容:
 * 1. MongoDBへの接続確認
 * 2. CRUD操作の動作確認（テストデータの作成・取得・削除）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('=== データベース接続テスト開始 ===\n');

  try {
    // 1. 接続テスト
    console.log('1. MongoDBへの接続確認...');
    await prisma.$connect();
    console.log('✅ MongoDB接続成功\n');

    // 2. セッション作成テスト
    console.log('2. セッション作成テスト...');
    const testSessionId = `test-${Date.now()}`;
    const session = await prisma.session.create({
      data: {
        sessionId: testSessionId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間後
      },
    });
    console.log('✅ セッション作成成功:', session.sessionId);

    // 3. 会話作成テスト
    console.log('\n3. 会話作成テスト...');
    const conversation = await prisma.conversation.create({
      data: {
        sessionId: session.id,
      },
    });
    console.log('✅ 会話作成成功:', conversation.id);

    // 4. メッセージ作成テスト
    console.log('\n4. メッセージ作成テスト...');
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: 'こんにちは',
      },
    });
    console.log('✅ ユーザーメッセージ作成成功:', userMessage.content);

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: 'こんにちは！何かお手伝いできることはありますか？',
      },
    });
    console.log('✅ アシスタントメッセージ作成成功:', assistantMessage.content);

    // 5. データ取得テスト（リレーション含む）
    console.log('\n5. データ取得テスト（リレーション含む）...');
    const fetchedSession = await prisma.session.findUnique({
      where: { sessionId: testSessionId },
      include: {
        conversations: {
          include: {
            messages: true,
          },
        },
      },
    });
    console.log('✅ セッション取得成功');
    console.log('   会話数:', fetchedSession?.conversations.length);
    console.log('   メッセージ数:', fetchedSession?.conversations[0]?.messages.length);

    // 6. データ削除テスト（クリーンアップ）
    console.log('\n6. テストデータ削除...');
    await prisma.message.deleteMany({
      where: { conversationId: conversation.id },
    });
    console.log('✅ メッセージ削除成功');

    await prisma.conversation.delete({
      where: { id: conversation.id },
    });
    console.log('✅ 会話削除成功');

    await prisma.session.delete({
      where: { id: session.id },
    });
    console.log('✅ セッション削除成功');

    console.log('\n=== すべてのテストが成功しました ===');
  } catch (error) {
    console.error('\n❌ テスト失敗:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
