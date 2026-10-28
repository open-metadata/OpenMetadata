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
  DATABASE,
  DB_SERVICE,
  serveEntities,
} from '../../test/browser/fixtures/hierarchy';
import { describePaginatedList } from '../../test/browser/paginationContract';

const items = many(40, (i) => named('schema', i, DATABASE.fullyQualifiedName));

describePaginatedList({
  name: 'Database › Schemas',
  route: `/database/${DATABASE.fullyQualifiedName}`,
  query: { showDeletedTables: 'false' },
  listPath: '/api/v1/databaseSchemas',
  // Pages also request limit=0 just to read totals for tab badges.
  isPageRequest: (url) => url.searchParams.get('limit') !== '0',
  items,
  itemLabel: (item) => item.displayName,
  search: { index: 'databaseSchema', urlParam: 'schema', term: 'pw' },
  deletedToggleTestId: 'show-deleted',
  setup: () => {
    serveEntities([
      ['/api/v1/databases', DATABASE],
      ['/api/v1/services/databaseServices', DB_SERVICE],
    ]);
  },
});
