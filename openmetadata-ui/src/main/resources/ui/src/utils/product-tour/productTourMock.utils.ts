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
import {
  TOUR_PASS_THROUGH_PATHS,
  TOUR_VOLATILE_QUERY_PARAMS,
  TOUR_VOLATILE_TIMESTAMP_PATTERN,
} from '../../constants/product-tour/productTour.constants';
import type { ProductTourFixture } from '../../interface/product-tour/productTour.interface';

/** A request as the tour matches it: method, path under the API base, query, body. */
export interface TourRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body?: string;
}

/** Recorded fixtures, by exact request and by method and path alone. */
export interface TourFixtureIndex {
  byRequest: Map<string, ProductTourFixture>;
  byPath: Map<string, ProductTourFixture>;
}

const VOLATILE_PARAMS = new Set<string>(TOUR_VOLATILE_QUERY_PARAMS);

const getPathKey = (method: string, path: string) =>
  `${method.toLowerCase()} ${path}`;

const withoutTimestamps = (value: string) =>
  value.replace(TOUR_VOLATILE_TIMESTAMP_PATTERN, 'T');

/**
 * Drops volatile parameters, blanks timestamps in the rest and orders them,
 * so the same request compares equal on any day.
 */
export const normalizeTourQuery = (
  query: Record<string, string> = {}
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([key]) => !VOLATILE_PARAMS.has(key))
      .map(([key, value]): [string, string] => [key, withoutTimestamps(value)])
      .sort(([a], [b]) => a.localeCompare(b))
  );

/** Requests the tour always leaves to the server; see TOUR_PASS_THROUGH_PATHS. */
export const isTourPassThroughPath = (path: string) =>
  TOUR_PASS_THROUGH_PATHS.some((pattern) => pattern.test(path));

export const getTourRequestKey = ({ method, path, query, body }: TourRequest) =>
  `${getPathKey(method, path)}?${new URLSearchParams(
    normalizeTourQuery(query)
  ).toString()}${body ? ` ${withoutTimestamps(body)}` : ''}`;

/** A request body as text, so a recorded body and a sent one compare equal. */
export const toTourRequestBody = (data: unknown): string | undefined => {
  if (data === undefined || data === null || data === '') {
    return undefined;
  }

  return typeof data === 'string' ? data : JSON.stringify(data);
};

/**
 * The request as it goes on the wire: the URL with its query already
 * serialised by the client, so a recorded request matches the live one
 * however its parameters were serialised. A repeated key keeps every value.
 */
export const toTourRequest = (
  method: string,
  url: string,
  apiBasePath: string,
  data?: unknown
): TourRequest => {
  const parsed = new URL(url, 'https://tour.local');
  const path = parsed.pathname.startsWith(apiBasePath)
    ? parsed.pathname.slice(apiBasePath.length) || '/'
    : parsed.pathname;
  const query: Record<string, string> = Object.fromEntries(
    [...new Set(parsed.searchParams.keys())].map((key) => [
      key,
      parsed.searchParams.getAll(key).join(','),
    ])
  );

  return {
    method: method.toLowerCase(),
    path,
    query,
    body: toTourRequestBody(data),
  };
};

export const buildTourFixtureIndex = (
  fixtures: ProductTourFixture[]
): TourFixtureIndex => {
  const index: TourFixtureIndex = { byRequest: new Map(), byPath: new Map() };
  fixtures.forEach((fixture) => {
    const request = {
      method: fixture.method,
      path: fixture.path,
      query: fixture.query ?? {},
      body: fixture.body,
    };
    index.byRequest.set(getTourRequestKey(request), fixture);
    const pathKey = getPathKey(fixture.method, fixture.path);
    if (!index.byPath.has(pathKey)) {
      index.byPath.set(pathKey, fixture);
    }
  });

  return index;
};

/**
 * The fixture for a request: the one recorded with the same query, else the
 * first recorded for its method and path, so a page asking for a different
 * page size or sort still gets data.
 */
export const findTourFixture = (
  index: TourFixtureIndex,
  request: TourRequest
): ProductTourFixture | undefined =>
  index.byRequest.get(getTourRequestKey(request)) ??
  index.byPath.get(getPathKey(request.method, request.path));
