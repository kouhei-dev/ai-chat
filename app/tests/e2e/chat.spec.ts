import { test, expect } from '@playwright/test';

test.describe('AIチャット', () => {
  test.beforeEach(async ({ page }) => {
    // localStorageをクリア
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // セッションAPIをモック
    await page.route('**/api/session', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sessionId: '550e8400-e29b-41d4-a716-446655440000',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    // セッション検証APIをモック
    await page.route('**/api/session/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    });
  });

  test('ページが正しく読み込まれる', async ({ page }) => {
    await page.goto('/');

    // ヘッダーが表示される
    await expect(page.getByRole('heading', { name: 'AIチャット' })).toBeVisible();

    // 入力フィールドが表示される
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // 送信ボタンが表示される
    await expect(page.getByRole('button', { name: '送信' })).toBeVisible();
  });

  test('初期状態では送信ボタンが無効', async ({ page }) => {
    await page.goto('/');

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // 送信ボタンが無効
    await expect(page.getByRole('button', { name: '送信' })).toBeDisabled();
  });

  test('メッセージ入力後に送信ボタンが有効になる', async ({ page }) => {
    await page.goto('/');

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // メッセージを入力
    await page.getByPlaceholder('メッセージを入力...').fill('テストメッセージ');

    // 送信ボタンが有効になる
    await expect(page.getByRole('button', { name: '送信' })).not.toBeDisabled();
  });

  test('メッセージを送信するとユーザーメッセージとAI応答が表示される', async ({ page }) => {
    // チャットAPIをモック
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'こんにちは！何かお手伝いできることはありますか？',
          conversationId: 'conv-123',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });
    });

    await page.goto('/');

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // メッセージを入力して送信
    await page.getByPlaceholder('メッセージを入力...').fill('こんにちは');
    await page.getByRole('button', { name: '送信' }).click();

    // ユーザーメッセージが表示される（完全一致で検索）
    await expect(page.getByText('こんにちは', { exact: true })).toBeVisible();

    // AI応答が表示される
    await expect(page.getByText('こんにちは！何かお手伝いできることはありますか？')).toBeVisible();

    // 入力フィールドがクリアされる
    await expect(page.getByPlaceholder('メッセージを入力...')).toHaveValue('');
  });

  test('メッセージ送信中はローディング状態になる', async ({ page }) => {
    // 遅延を入れたチャットAPIモック
    await page.route('**/api/chat', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'テスト応答',
          conversationId: 'conv-123',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });
    });

    await page.goto('/');

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // メッセージを入力して送信
    await page.getByPlaceholder('メッセージを入力...').fill('テスト');
    await page.getByRole('button', { name: '送信' }).click();

    // 送信中の表示を確認（ボタンが「送信中...」になる）
    await expect(page.getByText('送信中...')).toBeVisible();

    // 応答後にローディングが終了
    await expect(page.getByText('テスト応答')).toBeVisible();
    await expect(page.getByRole('button', { name: '送信' })).toBeVisible();
  });

  test('Enterキーでメッセージを送信できる', async ({ page }) => {
    // チャットAPIをモック
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Enterで送信されました',
          conversationId: 'conv-123',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });
    });

    await page.goto('/');

    // 初期化完了を待つ
    const textarea = page.getByPlaceholder('メッセージを入力...');
    await expect(textarea).toBeVisible();

    // メッセージを入力してEnterで送信
    await textarea.fill('Enterで送信テスト');
    await textarea.press('Enter');

    // ユーザーメッセージが表示される
    await expect(page.getByText('Enterで送信テスト')).toBeVisible();

    // AI応答が表示される
    await expect(page.getByText('Enterで送信されました')).toBeVisible();
  });

  test('複数のメッセージをやり取りできる', async ({ page }) => {
    let messageCount = 0;
    const responses = ['これは最初の応答です。', 'これは2番目の応答です。'];

    // チャットAPIをモック（呼び出し回数に応じて異なる応答）
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: responses[messageCount++] || 'デフォルト応答',
          conversationId: 'conv-123',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });
    });

    await page.goto('/');

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // 1回目のメッセージ
    await page.getByPlaceholder('メッセージを入力...').fill('最初のメッセージ');
    await page.getByRole('button', { name: '送信' }).click();

    await expect(page.getByText('最初のメッセージ')).toBeVisible();
    await expect(page.getByText('これは最初の応答です。')).toBeVisible();

    // 2回目のメッセージ
    await page.getByPlaceholder('メッセージを入力...').fill('2番目のメッセージ');
    await page.getByRole('button', { name: '送信' }).click();

    await expect(page.getByText('2番目のメッセージ')).toBeVisible();
    await expect(page.getByText('これは2番目の応答です。')).toBeVisible();

    // 全てのメッセージが表示されていることを確認
    await expect(page.getByText('最初のメッセージ')).toBeVisible();
    await expect(page.getByText('これは最初の応答です。')).toBeVisible();
  });

  test('APIエラー時にエラーメッセージが表示される', async ({ page }) => {
    // エラーを返すチャットAPIモック
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'サーバーエラーが発生しました',
        }),
      });
    });

    await page.goto('/');

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // メッセージを入力して送信
    await page.getByPlaceholder('メッセージを入力...').fill('エラーテスト');
    await page.getByRole('button', { name: '送信' }).click();

    // エラーメッセージが表示される
    await expect(page.locator('.bg-red-50')).toBeVisible();
  });

  test('セッションIDがlocalStorageに保存される', async ({ page }) => {
    await page.goto('/');

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // セッションIDがlocalStorageに保存されている
    const sessionId = await page.evaluate(() => localStorage.getItem('ai-chat-session-id'));
    expect(sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  test('ページ再読み込み後もセッションが維持される', async ({ page }) => {
    await page.goto('/');

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // セッションIDを取得
    const sessionId = await page.evaluate(() => localStorage.getItem('ai-chat-session-id'));

    // ページを再読み込み
    await page.reload();

    // 初期化完了を待つ
    await expect(page.getByPlaceholder('メッセージを入力...')).toBeVisible();

    // セッションIDが維持されている
    const sessionIdAfterReload = await page.evaluate(() =>
      localStorage.getItem('ai-chat-session-id')
    );
    expect(sessionIdAfterReload).toBe(sessionId);
  });
});
