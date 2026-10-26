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
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { worker } from '../msw';

const id = (n: number) =>
  `8e3f4a5b-0000-4000-8000-${String(n).padStart(12, '0')}`;

const domain = (n: number): Domain => ({
  id: id(n),
  name: `PW_Domain_${n}`,
  displayName: `PW Domain ${n}`,
  fullyQualifiedName: `PW_Domain_${n}`,
  description: `Domain ${n}`,
  domainType: DomainType.Aggregate,
  childrenCount: 0,
});

export const DOMAINS = [domain(1), domain(2)];

const dataProduct = (n: number, parent: Domain): DataProduct => ({
  id: id(100 + n),
  name: `PW_DataProduct_${n}`,
  displayName: `PW Data Product ${n}`,
  fullyQualifiedName: `PW_DataProduct_${n}`,
  description: `Data product ${n}`,
  domains: [
    {
      id: parent.id,
      type: 'domain',
      name: parent.name,
      fullyQualifiedName: parent.fullyQualifiedName,
    },
  ],
});

/** The spec's three: two in the first domain, one in the second. */
export const DATA_PRODUCTS = [
  dataProduct(1, DOMAINS[0]),
  dataProduct(2, DOMAINS[0]),
  dataProduct(3, DOMAINS[1]),
];

/**
 * The domain picker's two reads: the root listing (`/domains/hierarchy`) and
 * the term search with `getHierarchy=true`, which the server answers with
 * matching domains as a plain array (not ES hits). Data products are found
 * through the generic search; pass `DATA_PRODUCTS` to `serveSearch`.
 */
export const serveDomains = () =>
  worker.use(
    http.get('/api/v1/domains/hierarchy', () =>
      HttpResponse.json({ data: DOMAINS, paging: { total: DOMAINS.length } })
    ),
    http.get('/api/v1/search/query', ({ request }) => {
      const params = new URL(request.url).searchParams;
      if (
        params.get('index') !== 'domain' ||
        params.get('getHierarchy') !== 'true'
      ) {
        return undefined;
      }
      const term = (params.get('q') ?? '').replace(/\*/g, '').toLowerCase();

      return HttpResponse.json(
        DOMAINS.filter((d) =>
          [d.name, d.displayName ?? ''].some((v) =>
            v.toLowerCase().includes(term)
          )
        )
      );
    })
  );
