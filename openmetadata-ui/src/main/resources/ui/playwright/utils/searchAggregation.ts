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
import { Page, Response } from '@playwright/test';

const AGGREGATE_PATH = '/api/v1/search/aggregate';

/**
 * A dropdown aggregates the same field twice — once on open, once per typed
 * search — so `value` is what tells the two apart and is therefore required.
 */
export type AggregationWait = {
  /** Aggregated field, e.g. `domains.displayName.keyword`. Omit to match any. */
  field?: string;
  /** Typed search text; `null` or `''` for the request fired on open. */
  value: string | null;
  /** Match only when the request carries this `deleted` flag. */
  deleted?: boolean;
};

const WRAPPED_SEARCH_TEXT = /^\.\*(.*)\.\*$/;

// The API escapes ES reserved characters, so `service-name` arrives as
// `service\-name`; dropping the backslashes keeps those values comparable.
const normalize = (text: string): string =>
  text.toLowerCase().replace(/\\/g, '');

const matches = (response: Response, wait: AggregationWait): boolean => {
  const url = new URL(response.url());

  if (!url.pathname.endsWith(AGGREGATE_PATH)) {
    return false;
  }

  const params = url.searchParams;

  if (wait.field && params.get('field') !== wait.field) {
    return false;
  }

  if (
    wait.deleted !== undefined &&
    params.get('deleted') !== String(wait.deleted)
  ) {
    return false;
  }

  const value = params.get('value');

  // The API sends `.*` when there is no search text, which is the open request.
  if (!wait.value) {
    return value === null || value === '.*';
  }

  const searchText = value?.match(WRAPPED_SEARCH_TEXT)?.[1];

  // Exact, not substring: a wait for `service` must not resolve on an in-flight
  // response for `service-name`.
  if (searchText !== undefined) {
    return normalize(searchText) === normalize(wait.value);
  }

  // Unwrapped value: outside the documented shape, so stay permissive.
  return normalize(value ?? '').includes(normalize(wait.value));
};

/** Arm before the action that triggers the request, as with `waitForResponse`. */
export const waitForAggregation = (page: Page, wait: AggregationWait) =>
  page.waitForResponse((response) => matches(response, wait));
