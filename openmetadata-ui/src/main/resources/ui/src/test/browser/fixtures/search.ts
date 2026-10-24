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

type Doc = { id: string; name: string; displayName?: string } & Record<
  string,
  unknown
>;

/** Index alias as the UI sends it (`SearchIndex`, e.g. `user`, `team`) → documents. */
export type SearchCorpus = Partial<Record<string, Doc[]>>;

const matches = (doc: Doc, q: string) => {
  const term = q.replace(/\*/g, '').toLowerCase();

  return (
    !term ||
    doc.name.toLowerCase().includes(term) ||
    (doc.displayName ?? '').toLowerCase().includes(term)
  );
};

/**
 * Answers `GET /api/v1/search/query` like Elasticsearch does for the pickers:
 * filters the index's documents by `q` and wraps them in hits. Indexes not in
 * the corpus return no hits.
 */
export const serveSearch = (corpus: SearchCorpus) => {
  const queries: URLSearchParams[] = [];

  worker.use(
    http.get('/api/v1/search/query', ({ request }) => {
      const params = new URL(request.url).searchParams;
      queries.push(params);
      const index = (params.get('index') ?? '').replace(/_search_index$/, '');
      const docs = (corpus[index] ?? []).filter((doc) =>
        matches(doc, params.get('q') ?? '')
      );

      return HttpResponse.json({
        hits: {
          total: { value: docs.length },
          hits: docs.map((doc) => ({
            _index: params.get('index'),
            _id: doc.id,
            _source: doc,
          })),
        },
        aggregations: {},
      });
    })
  );

  return queries;
};
