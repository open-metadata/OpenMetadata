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
 * Fallback for the response body when a caller does not name a type.
 *
 * Prefer passing one — `okJson<ResponseDataType>(res, label)` — and the support
 * classes now do at every site where the value escapes the method. This alias
 * exists for the remaining callers that read a field straight off the body:
 * `APIResponse.json()` is itself `Promise<any>`, and the generated response types
 * declare `id` and `fullyQualifiedName` optional, so a stricter default makes
 * specs that legitimately rely on them fail to compile. Naming the escape hatch
 * keeps it deliberate and greppable rather than an implicit `any` per call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseBody = any;

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
export const okJson = async <T = ResponseBody>(
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
 * Mirrors `FullyQualifiedName.needsQuoting` on the server: a segment has to be
 * quoted when it contains the separator or a quote of its own.
 */
const needsQuoting = (name: string): boolean =>
  name.includes('.') || name.includes('"');

/**
 * Quote one raw name the way the server's `FullyQualifiedName.quoteName` does —
 * note the escape doubles the quote (`"` becomes `""`), it does not backslash it.
 *
 * `.` separates FQN segments, so the name `PW%domain.1e518933` reads as two
 * segments and a lookup for it 404s while the quoted form returns 200 (checked
 * against a running server). Names are generated per fixture, so treat any
 * segment as capable of carrying a separator rather than auditing them one by one.
 */
export const quoteFqnSegment = (name: string): string =>
  needsQuoting(name) ? `"${name.replace(/"/g, '""')}"` : name;

/**
 * Build an FQN from raw name segments, quoting each one.
 *
 * Callers pass the parts they already hold — `[service, database, schema, table]`
 * — instead of interpolating them into a string themselves, so a separator
 * appearing in any future fixture name is handled here rather than silently
 * producing a lookup for an FQN that does not exist.
 */
export const buildFqn = (...segments: string[]): string =>
  segments.map(quoteFqnSegment).join('.');

/**
 * A dependency committed moments earlier can still be invisible to the create
 * that references it. A nightly AUT run recorded `POST /policies` answering 201,
 * `POST /roles` referencing that exact id answering 404 `policy instance ... not
 * found` 15ms later, and a `DELETE` of the same id answering 200 a further 58ms
 * on — so the row was committed the whole time and only the reference lookup
 * lagged. Retry briefly instead of losing the try; a reference that is genuinely
 * wrong still fails, just ~1.8s later.
 */
const NOT_FOUND_RETRY_ATTEMPTS = 3;
const NOT_FOUND_RETRY_BASE_DELAY_MS = 300;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Re-send a request while the server answers 404.
 *
 * A 404 means the request was rejected outright, so nothing was partially
 * applied and re-sending is safe. This covers the mirror image of the 409 race:
 * a nightly shard recorded `ApiServiceClass.patch failed (404): apiService
 * instance ... not found` against the very id its own create had just returned.
 * Callers keep their own {@link okJson} handling — this only decides whether the
 * request is worth sending again.
 */
export const withNotFoundRetry = async (
  send: () => Promise<APIResponse>
): Promise<APIResponse> => {
  let response = await send();

  for (
    let attempt = 1;
    attempt <= NOT_FOUND_RETRY_ATTEMPTS && response.status() === 404;
    attempt++
  ) {
    await sleep(NOT_FOUND_RETRY_BASE_DELAY_MS * attempt);
    response = await send();
  }

  return response;
};

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
 *
 * `fqnSegments` are the entity's raw name parts, outermost first. They are quoted
 * and joined here so no call site has to know the FQN escaping rules.
 */
export const createOrFetch = async <T = ResponseBody>(
  apiContext: APIRequestContext,
  options: {
    label: string;
    createPath: string;
    fqnSegments: string[];
    data: object;
    fetchPath?: string;
    fields?: string;
  }
): Promise<T> => {
  const { label, createPath, fqnSegments, data, fetchPath, fields } = options;
  let createResponse = await apiContext.post(createPath, { data });

  // 404 and 5xx are both "the server did not apply this", so re-sending is
  // safe in either case — nothing was partially written. The 5xx arm covers a
  // create whose parent reference is not resolvable yet: DashboardDataModelClass
  // carried its own copy of this loop for exactly that, and can now drop it.
  // A genuine failure still surfaces, just after the bounded retries.
  for (
    let attempt = 1;
    attempt <= NOT_FOUND_RETRY_ATTEMPTS &&
    (createResponse.status() === 404 || createResponse.status() >= 500);
    attempt++
  ) {
    await sleep(NOT_FOUND_RETRY_BASE_DELAY_MS * attempt);
    createResponse = await apiContext.post(createPath, { data });
  }

  if (createResponse.status() === 409) {
    const entityFqn = buildFqn(...fqnSegments);
    const lookupPath = fetchPath ?? `${createPath}/name`;
    // include=all so a soft-deleted entity is still found. It keeps its name, so the
    // create really does conflict, but the default lookup hides it and the recovery
    // would fail with a 404 that reads as though the conflict never happened.
    const params = [`include=all`];
    if (fields) {
      params.push(`fields=${encodeURIComponent(fields)}`);
    }
    const getResponse = await apiContext.get(
      `${lookupPath}/${encodeURIComponent(entityFqn)}?${params.join('&')}`
    );

    return await okJson<T>(
      getResponse,
      `${label}: fetch existing "${entityFqn}"`
    );
  }

  return await okJson<T>(createResponse, label);
};
