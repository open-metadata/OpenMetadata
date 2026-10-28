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
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { worker } from '../msw';

export const GLOSSARY: Glossary = {
  id: '6b1d2e8f-0000-4000-8000-000000000001',
  name: 'PW_Glossary',
  displayName: 'PW Glossary',
  fullyQualifiedName: 'PW_Glossary',
  description: 'Glossary the steward tags with',
  mutuallyExclusive: false,
  termCount: 2,
};

const term = (n: number): GlossaryTerm => ({
  id: `6b1d2e8f-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`,
  name: `PW_Term_${n}`,
  displayName: `PW Term ${n}`,
  fullyQualifiedName: `${GLOSSARY.name}.PW_Term_${n}`,
  description: `Term ${n}`,
  glossary: {
    id: GLOSSARY.id,
    type: 'glossary',
    name: GLOSSARY.name,
    fullyQualifiedName: GLOSSARY.fullyQualifiedName,
  },
  childrenCount: 0,
});

export const GLOSSARY_TERMS = [term(1), term(2)];

const matching = (q: string) => {
  const needle = q.replace(/\*/g, '').toLowerCase();

  return GLOSSARY_TERMS.filter((t) =>
    [t.name, t.displayName ?? '', t.fullyQualifiedName ?? ''].some((v) =>
      v.toLowerCase().includes(needle)
    )
  );
};

/**
 * The glossary picker's three reads: the glossary list, a glossary's terms,
 * and the term search with `getHierarchy=true`, which the server answers with
 * glossaries carrying their matching terms as `children` (not ES hits).
 * Other searches fall through to the test's `serveSearch`.
 */
export const serveGlossary = () =>
  worker.use(
    http.get('/api/v1/glossaries', () =>
      HttpResponse.json({ data: [GLOSSARY], paging: { total: 1 } })
    ),
    http.get('/api/v1/glossaryTerms', ({ request }) => {
      const parent = new URL(request.url).searchParams.get('directChildrenOf');
      const data = parent === GLOSSARY.fullyQualifiedName ? GLOSSARY_TERMS : [];

      return HttpResponse.json({ data, paging: { total: data.length } });
    }),
    http.get('/api/v1/search/query', ({ request }) => {
      const params = new URL(request.url).searchParams;
      if (
        params.get('index') !== 'glossaryTerm' ||
        params.get('getHierarchy') !== 'true'
      ) {
        return undefined;
      }
      const children = matching(params.get('q') ?? '');

      return HttpResponse.json(
        children.length ? [{ ...GLOSSARY, children }] : []
      );
    })
  );
