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

import type { StateStore } from 'oidc-client';

import { swTokenStorage } from './SwTokenStorage';
import { isServiceWorkerAvailable } from './SwTokenStorageUtils';

class OidcTokenStorage implements StateStore {
  private static instance: OidcTokenStorage;

  static getInstance(): OidcTokenStorage {
    if (!OidcTokenStorage.instance) {
      OidcTokenStorage.instance = new OidcTokenStorage();
    }

    return OidcTokenStorage.instance;
  }

  // StateStore interface implementation - delegates to generic SwTokenStorage
  async set(key: string, value: string): Promise<void> {
    if (isServiceWorkerAvailable()) {
      await swTokenStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (isServiceWorkerAvailable()) {
      return await swTokenStorage.getItem(key);
    } else {
      return localStorage.getItem(key);
    }
  }

  async remove(key: string): Promise<string | null> {
    if (isServiceWorkerAvailable()) {
      return await swTokenStorage.removeItem(key);
    } else {
      const value = localStorage.getItem(key);
      localStorage.removeItem(key);

      return value;
    }
  }

  async getAllKeys(): Promise<string[]> {
    if (isServiceWorkerAvailable()) {
      return await swTokenStorage.getAllKeys();
    } else {
      return Object.keys(localStorage);
    }
  }
}

export const oidcTokenStorage = OidcTokenStorage.getInstance();
