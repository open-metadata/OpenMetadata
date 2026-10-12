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

const KEYWORD_SUFFIX = /\.keyword$/;
const WRAPPED_SEARCH_TEXT = /^\.\*(.*)\.\*$/;

// The API escapes ES reserved characters, so `service-name` arrives as
// `service\-name`. Unescaping (rather than stripping backslashes from both
// sides) keeps `foo\bar` distinguishable from `foobar`.
const unescapeReserved = (text: string): string =>
  text.replace(/\\(.)/g, '$1').toLowerCase();

// Specs name a field either way — `entityType` in one, the `entityType.keyword`
// sub-field the request carries in another — and both mean the same field, so
// the suffix is not a discriminator.
const isSameField = (requested: string | null, expected: string): boolean =>
  requested?.replace(KEYWORD_SUFFIX, '') ===
  expected.replace(KEYWORD_SUFFIX, '');

type AggregationRequest = {
  field: string | null;
  value: string | null;
  deleted: string | null;
};

// Independent filters (lineage) POST the aggregation with the same field,
// wrapped value and deleted flag in a JSON body instead of the query string.
const readRequest = (response: Response): AggregationRequest => {
  const request = response.request();

  if (request.method() === 'POST') {
    const body = (request.postDataJSON() ?? {}) as {
      fieldName?: string;
      fieldValue?: string;
      deleted?: boolean;
    };

    return {
      field: body.fieldName ?? null,
      value: body.fieldValue ?? null,
      deleted: body.deleted === undefined ? null : String(body.deleted),
    };
  }

  const params = new URL(response.url()).searchParams;

  return {
    field: params.get('field'),
    value: params.get('value'),
    deleted: params.get('deleted'),
  };
};

/** For a `waitForResponse` predicate that also accepts other responses. */
export const isAggregationResponse = (
  response: Response,
  wait: AggregationWait
): boolean => {
  if (!new URL(response.url()).pathname.endsWith(AGGREGATE_PATH)) {
    return false;
  }

  const { field, value, deleted } = readRequest(response);

  if (wait.field && !isSameField(field, wait.field)) {
    return false;
  }

  if (wait.deleted !== undefined && deleted !== String(wait.deleted)) {
    return false;
  }

  // The API sends `.*` when there is no search text, which is the open request.
  if (!wait.value) {
    return value === null || value === '.*';
  }

  const searchText = value?.match(WRAPPED_SEARCH_TEXT)?.[1];

  // Exact, not substring: a wait for `service` must not resolve on an in-flight
  // response for `service-name`.
  if (searchText !== undefined) {
    return unescapeReserved(searchText) === wait.value.toLowerCase();
  }

  // Unwrapped value: outside the documented shape, so stay permissive.
  return unescapeReserved(value ?? '').includes(wait.value.toLowerCase());
};

/** Arm before the action that triggers the request, as with `waitForResponse`. */
export const waitForAggregation = (
  page: Page,
  wait: AggregationWait,
  options?: { timeout?: number }
) =>
  page.waitForResponse(
    (response) => isAggregationResponse(response, wait),
    options
  );
