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

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

type PendingEntry = {
  config: AxiosRequestConfig;
  resolve: (value: AxiosResponse) => void;
  reject: (reason: unknown) => void;
};

export class RefreshQueue {
  private readonly pending: PendingEntry[] = [];

  enqueue(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return new Promise((resolve, reject) => {
      this.pending.push({ config, resolve, reject });
    });
  }

  size(): number {
    return this.pending.length;
  }

  hasPending(): boolean {
    return this.pending.length > 0;
  }

  async drain(freshToken: string | null, axios: AxiosInstance): Promise<void> {
    const entries = this.pending.splice(0, this.pending.length);
    if (freshToken === null) {
      for (const entry of entries) {
        entry.reject(new Error('Token refresh failed'));
      }

      return;
    }
    await Promise.all(
      entries.map(async (entry) => {
        const config = {
          ...entry.config,
          headers: {
            ...(entry.config.headers ?? {}),
            Authorization: `Bearer ${freshToken}`,
          },
        };
        try {
          entry.resolve((await axios.request(config)) as AxiosResponse);
        } catch (err) {
          entry.reject(err);
        }
      })
    );
  }
}
