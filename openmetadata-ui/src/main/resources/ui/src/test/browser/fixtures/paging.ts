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
import { http, HttpResponse } from 'msw';
import { worker } from '../msw';

/**
 * Server-shaped list and search responses, so pages under test paginate the
 * way they do against a real backend:
 * - list endpoints: EntityRepository cursor paging, paging.after / paging.before
 *   are opaque strings and either is absent at the matching end;
 * - /search/query: Elasticsearch hits with from/size and hits.total.value.
 */

export const encodeCursor = (offset: number) => btoa(`offset:${offset}`);
const decode = (cursor: string | null) =>
  cursor ? Number(atob(cursor).split(':')[1]) : undefined;

export const cursorPage = <T>(items: T[], url: URL) => {
  const limit = Number(url.searchParams.get('limit') ?? 10);
  const after = decode(url.searchParams.get('after'));
  const before = decode(url.searchParams.get('before'));
  const start =
    after ?? (before === undefined ? 0 : Math.max(0, before - limit));
  const end = Math.min(start + limit, items.length);

  return {
    data: items.slice(start, end),
    paging: {
      total: items.length,
      ...(start > 0 ? { before: encodeCursor(start) } : {}),
      ...(end < items.length ? { after: encodeCursor(end) } : {}),
    },
  };
};

const matches = (item: unknown, q: string) => {
  const term = q.replaceAll('*', '').toLowerCase();

  return !term || JSON.stringify(item).toLowerCase().includes(term);
};

export const searchPage = <T>(items: T[], url: URL) => {
  const from = Number(url.searchParams.get('from') ?? 0);
  const size = Number(url.searchParams.get('size') ?? 10);
  const hits = items.filter((i) => matches(i, url.searchParams.get('q') ?? ''));

  return {
    hits: {
      total: { value: hits.length, relation: 'eq' },
      hits: hits.slice(from, from + size).map((source, idx) => ({
        _index: url.searchParams.get('index') ?? '',
        _id: String(from + idx),
        _source: source,
      })),
    },
    aggregations: {},
  };
};

export type RecordedCall = URL;

/** GET handler that serves a cursor-paged list and records every request. */
export const serveList = <T>(
  path: string,
  items: T[],
  isPageRequest: (url: URL) => boolean = () => true
) => {
  const calls: RecordedCall[] = [];
  worker.use(
    http.get(path, ({ request }) => {
      const url = new URL(request.url);
      if (isPageRequest(url)) {
        calls.push(url);
      }

      return HttpResponse.json(cursorPage(items, url));
    })
  );

  return calls;
};

/** /api/v1/search/query handler for one index; other indexes fall through. */
export const serveSearch = <T>(indexIncludes: string, items: T[]) => {
  const calls: RecordedCall[] = [];
  worker.use(
    http.get('/api/v1/search/query', ({ request }) => {
      const url = new URL(request.url);
      if (!(url.searchParams.get('index') ?? '').includes(indexIncludes)) {
        return undefined;
      }
      calls.push(url);

      return HttpResponse.json(searchPage(items, url));
    })
  );

  return calls;
};
