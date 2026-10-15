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
import { many, named } from '../../test/browser/fixtures/entities';
import {
  API_COLLECTION,
  API_SERVICE,
  serveEntities,
} from '../../test/browser/fixtures/hierarchy';
import { describePaginatedList } from '../../test/browser/paginationContract';

const items = many(40, (i) =>
  named('endpoint', i, API_COLLECTION.fullyQualifiedName)
);

describePaginatedList({
  name: 'API collection › Endpoints',
  route: `/apiCollection/${API_COLLECTION.fullyQualifiedName}`,
  query: { showDeletedEndpoints: 'false' },
  listPath: '/api/v1/apiEndpoints',
  // Pages also request limit=0 just to read totals for tab badges.
  isPageRequest: (url) => url.searchParams.get('limit') !== '0',
  items,
  itemLabel: (item) => item.displayName,
  search: { index: 'apiEndpoint', urlParam: 'endpoint', term: 'pw' },
  deletedToggleTestId: 'show-deleted',
  setup: () => {
    serveEntities([
      ['/api/v1/apiCollections', API_COLLECTION],
      ['/api/v1/services/apiServices', API_SERVICE],
    ]);
  },
});
