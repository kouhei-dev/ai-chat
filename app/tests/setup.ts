import '@testing-library/jest-dom';
import { vi } from 'vitest';

// localStorageのモック
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// fetchのモック
global.fetch = vi.fn();

// scrollIntoViewのモック
Element.prototype.scrollIntoView = vi.fn();
