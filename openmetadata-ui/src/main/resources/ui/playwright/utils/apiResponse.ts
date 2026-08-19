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

/**
 * Read a response body, failing at the request that actually broke.
 *
 * `await response.json()` on its own returns the *error* body for a non-2xx
 * response, and support classes assign that straight onto `responseData`. The
 * entity's `id` and `fullyQualifiedName` disappear, nothing throws, and the run
 * only breaks much later somewhere unrelated — a failed PATCH has been observed
 * surfacing as a 30s `waitForResponse` timeout several steps downstream.
 * Throwing here keeps the blame on the call that failed.
 */
export const okJson = async <T = any>(
  response: APIResponse,
  label: string
): Promise<T> => {
  if (!response.ok()) {
    throw new Error(
      `${label} failed (${response.status()}): ${await response.text()}`
    );
  }

  return (await response.json()) as T;
};

/**
 * Quote an FQN segment that contains the separator.
 *
 * `.` separates FQN segments, so a name like `PW%domain.1e518933` is read as two
 * segments and a lookup for the literal name 404s. The quoted form resolves.
 * Confirmed against a running server: unquoted 404, quoted 200.
 */
export const quoteFqnSegment = (name: string): string =>
  /["."]/.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name;

/**
 * POST that treats "already exists" as success.
 *
 * The nightly topology runs many Playwright processes against a single server,
 * so two workers can race to create the same fixture. A 409 there does not mean
 * the test cannot proceed — the entity the caller asked for exists — so fetch it
 * by name and carry on. Any other failure still throws via {@link okJson}.
 *
 * `fetchPath` defaults to the conventional `<createPath>/name` lookup; pass it
 * explicitly for the few collections that do not follow that convention.
 *
 * Pass `fields` whenever the caller applies relationship mutations after create.
 * The API returns `null` for any field not asked for, so a bare lookup reports
 * `domains: null` on an entity that already has a domain, and a caller that then
 * re-applies its own `add /domains/0` is rejected with `RULE_VIOLATION: Multiple
 * Domains are not allowed`. Only request fields the collection actually declares
 * — `policies` and `roles`, for instance, do not accept `domains` and answer an
 * unknown field with a 400.
 */
export const createOrFetch = async <T = any>(
  apiContext: APIRequestContext,
  options: {
    label: string;
    createPath: string;
    entityFqn: string;
    data: object;
    fetchPath?: string;
    fields?: string;
  }
): Promise<T> => {
  const { label, createPath, entityFqn, data, fetchPath, fields } = options;
  const createResponse = await apiContext.post(createPath, { data });

  if (createResponse.status() === 409) {
    const lookupPath = fetchPath ?? `${createPath}/name`;
    const query = fields ? `?fields=${encodeURIComponent(fields)}` : '';
    const getResponse = await apiContext.get(
      `${lookupPath}/${encodeURIComponent(entityFqn)}${query}`
    );

    return await okJson<T>(
      getResponse,
      `${label}: fetch existing "${entityFqn}"`
    );
  }

  return await okJson<T>(createResponse, label);
};
