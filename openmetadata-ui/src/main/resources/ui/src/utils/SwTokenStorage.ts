/*
 *  Copyright 2025 Collate.
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

import { sendMessageToServiceWorker } from './SwMessenger';

class SwTokenStorage {
  private static instance: SwTokenStorage;

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  static getInstance(): SwTokenStorage {
    if (!SwTokenStorage.instance) {
      SwTokenStorage.instance = new SwTokenStorage();
    }

    return SwTokenStorage.instance;
  }

  async setItem(key: string, value: string): Promise<void> {
    await sendMessageToServiceWorker({ type: 'set', key, value });
  }

  async getItem(key: string): Promise<string | null> {
    return (await sendMessageToServiceWorker({ type: 'get', key })) as
      | string
      | null;
  }

  async removeItem(key: string): Promise<string | null> {
    return (await sendMessageToServiceWorker({ type: 'remove', key })) as
      | string
      | null;
  }

  async getAllKeys(): Promise<string[]> {
    return (await sendMessageToServiceWorker({
      type: 'getAllKeys',
    })) as string[];
  }
}

export const swTokenStorage = SwTokenStorage.getInstance();
