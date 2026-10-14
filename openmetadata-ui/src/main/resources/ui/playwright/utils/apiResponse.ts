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
import { APIRequestContext, APIResponse } from '@playwright/test';

export const assertFulfilled = (results: PromiseSettledResult<unknown>[]) => {
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failures.length) {
    const errors = failures.map((failure) => failure.reason);
    throw new AggregateError(
      errors,
      `Parallel fixture operations failed:\n${errors.map(String).join('\n')}`
    );
  }
};

export const settleAll = async (operations: Iterable<unknown>) => {
  assertFulfilled(await Promise.allSettled(operations));
};

// 401 during teardown means the JWT expired mid-test — the fixture may leak,
// but failing the whole test on a cleanup auth error is worse than warning and
// moving on. 404 is already-gone. 400 covers protected "system entity" records
// the server refuses to hard-delete — same class: fixture leak, not a
// test-correctness issue. 403 stays a hard fail: the token is valid but the
// caller lacks permission, which is a real test-setup bug.
const CLEANUP_TOLERATED_STATUSES = new Set([400, 401, 404]);

/** Cleanup is idempotent, but a real HTTP error must not silently leak a fixture. */
export const deleteFixtureEntity = async (
  apiContext: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext['delete']>[1]
): Promise<APIResponse> => {
  const response = await apiContext.delete(url, options);
  const status = response.status();
  if (!response.ok() && !CLEANUP_TOLERATED_STATUSES.has(status)) {
    throw new Error(
      `Fixture DELETE ${url}: HTTP ${status}: ${await response.text()}`
    );
  }
  if (status === 401 || status === 400) {
    console.warn(
      `Fixture DELETE ${url}: HTTP ${status} during cleanup; fixture may leak`
    );
  }

  return response;
};

/**
 * Read a response body, failing at the request that actually broke.
 *
 * `await response.json()` on its own returns the *error* body for a non-2xx
 * response, so the caller assigns a body with no `id` and nothing throws until
 * much later, somewhere unrelated. Throwing here keeps the blame on the call
 * that failed.
 */
export const okJson = async <T>(
  response: Pick<APIResponse, 'ok' | 'status' | 'text' | 'json'>,
  label: string
): Promise<T> => {
  if (!response.ok()) {
    throw new Error(
      `${label} failed (${response.status()}): ${await response.text()}`
    );
  }

  return (await response.json()) as T;
};
