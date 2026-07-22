/*
 *  Copyright 2026 Collate.
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

import { APIRequestContext, test as base } from '@playwright/test';
import {
  disposeWorkerAdminAPIContext,
  getWorkerAdminAPIContext,
} from '../utils/common';

type Cleanup = () => Promise<void>;

export class TestNamespace {
  private readonly cleanups: Cleanup[] = [];

  constructor(readonly prefix: string) {}

  name(suffix: string) {
    return `${this.prefix}-${suffix}`;
  }

  registerCleanup(cleanup: Cleanup) {
    this.cleanups.push(cleanup);
  }

  async cleanup() {
    const errors: unknown[] = [];
    for (const cleanup of this.cleanups.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, `Failed to clean ${this.prefix}`);
    }
  }
}

type NamespaceFixtures = {
  testNamespace: TestNamespace;
};

type WorkerFixtures = {
  adminApiContext: APIRequestContext;
};

export const test = base.extend<NamespaceFixtures, WorkerFixtures>({
  adminApiContext: [
    async (_workerFixtures, use) => {
      await use(await getWorkerAdminAPIContext());
      await disposeWorkerAdminAPIContext();
    },
    { scope: 'worker' },
  ],
  testNamespace: async (_fixtures, use, testInfo) => {
    const runId = process.env.GITHUB_RUN_ID ?? 'local';
    const shardId = process.env.PW_SHARD_ID ?? 'local';
    const testId = testInfo.testId.replaceAll(/[^a-zA-Z0-9]+/g, '-').slice(-32);
    const namespace = new TestNamespace(
      `pw-${runId}-${shardId}-${testInfo.workerIndex}-${testId}`
    );
    await use(namespace);
    await namespace.cleanup();
  },
});

export { expect } from '@playwright/test';
