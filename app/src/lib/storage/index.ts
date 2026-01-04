/**
 * localStorage操作のエラーハンドリングユーティリティ
 * quota超過やプライベートモードでの例外を適切に処理
 */

/**
 * localStorageから安全に値を取得する
 * @param key ストレージキー
 * @returns 保存されている値、またはエラー/未設定の場合はnull
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`localStorage.getItem failed for key "${key}":`, error);
    return null;
  }
}

/**
 * localStorageに安全に値を保存する
 * @param key ストレージキー
 * @param value 保存する値
 * @returns 保存に成功した場合はtrue、失敗した場合はfalse
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // QuotaExceededError（容量超過）やSecurityError（プライベートモード）をハンドリング
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        console.error(`localStorage quota exceeded for key "${key}"`);
      } else if (error.name === 'SecurityError') {
        console.error(`localStorage access denied (private mode?) for key "${key}"`);
      } else {
        console.error(`localStorage.setItem failed for key "${key}":`, error);
      }
    }
    return false;
  }
}

/**
 * localStorageから安全に値を削除する
 * @param key ストレージキー
 * @returns 削除に成功した場合はtrue、失敗した場合はfalse
 */
export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`localStorage.removeItem failed for key "${key}":`, error);
    return false;
  }
}
