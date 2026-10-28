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
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { many, named } from '../../test/browser/fixtures/entities';
import { worker } from '../../test/browser/msw';
import { describePaginatedList } from '../../test/browser/paginationContract';

const classification: Classification = {
  id: '00000000-0000-4000-8000-0000000000c1',
  name: 'PwPagination',
  fullyQualifiedName: 'PwPagination',
  description: 'Classification for pagination tests',
  mutuallyExclusive: false,
  termCount: 40,
};

const tags: Tag[] = many(40, (i) => ({
  ...named('tag', i, classification.name),
  description: `Tag ${i}`,
  classification: {
    id: classification.id,
    type: 'classification',
    name: classification.name,
    fullyQualifiedName: classification.name,
  },
}));

describePaginatedList({
  name: 'Classification › Tags',
  route: `/tags/${classification.name}`,
  listPath: '/api/v1/tags',
  items: tags,
  itemLabel: (t) => t.displayName ?? t.name,
  setup: () =>
    worker.use(
      http.get('/api/v1/classifications', () =>
        HttpResponse.json({
          data: [classification],
          paging: { total: 1 },
        })
      ),
      http.get('/api/v1/classifications/name/:name', () =>
        HttpResponse.json(classification)
      )
    ),
  knownIssues: {
    duplicateFetchOnPageChange:
      'ClassificationDetails.handlePageChange fetches, then the URL effect fetches again',
  },
});
