/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { StorageProvider } from '@okta/okta-auth-js';
import { swTokenStorage } from './SwTokenStorage';
import { isServiceWorkerAvailable } from './SwTokenStorageUtils';

const OKTA_TOKENS_KEY = 'okta_tokens';

export class OktaCustomStorage implements StorageProvider {
  private memoryCache: Record<string, string> = {};
  private isServiceWorkerAvailable: boolean;
  private initPromise: Promise<void>;

  constructor() {
    this.isServiceWorkerAvailable = isServiceWorkerAvailable();
    this.initPromise = this.initializeFromStorage();
  }

  private async initializeFromStorage() {
    try {
      if (this.isServiceWorkerAvailable) {
        const stored = await swTokenStorage.getItem(OKTA_TOKENS_KEY);
        if (stored) {
          this.memoryCache = JSON.parse(stored);
        }
      } else {
        const stored = localStorage.getItem(OKTA_TOKENS_KEY);
        if (stored) {
          this.memoryCache = JSON.parse(stored);
        }
      }
    } catch {
      this.memoryCache = {};
    }
  }

  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  private async persistToStorage() {
    try {
      const serialized = JSON.stringify(this.memoryCache);
      if (this.isServiceWorkerAvailable) {
        await swTokenStorage.setItem(OKTA_TOKENS_KEY, serialized);
      } else {
        localStorage.setItem(OKTA_TOKENS_KEY, serialized);
      }
    } catch {
      // Silently fail
    }
  }

  getItem(key: string): string | null {
    return this.memoryCache[key] || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.memoryCache[key] = value;
    await this.persistToStorage();
  }

  removeItem(key: string): void {
    delete this.memoryCache[key];
    this.persistToStorage();
  }

  clear(): void {
    this.memoryCache = {};
    this.persistToStorage();
  }

  getStorage(): Record<string, string> {
    return { ...this.memoryCache };
  }

  setStorage(obj: Record<string, string>): void {
    this.memoryCache = { ...this.memoryCache, ...obj };
    this.persistToStorage();
  }

  updateStorage(key: string, value: string): void {
    this.memoryCache[key] = value;
    this.persistToStorage();
  }

  clearStorage(): void {
    this.memoryCache = {};
    this.persistToStorage();
  }
}
