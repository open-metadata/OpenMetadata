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
  SCHEMA,
  serveEmptyLists,
  serveEntities,
} from '../../test/browser/fixtures/hierarchy';
import { describePaginatedList } from '../../test/browser/paginationContract';

const items = many(40, (i) =>
  named('stored_procedure', i, SCHEMA.fullyQualifiedName)
);

describePaginatedList({
  name: 'Database schema › Stored procedures',
  route: `/databaseSchema/${SCHEMA.fullyQualifiedName}/stored_procedure`,
  query: {},
  listPath: '/api/v1/storedProcedures',
  // Pages also request limit=0 just to read totals for tab badges.
  isPageRequest: (url) => url.searchParams.get('limit') !== '0',
  items,
  itemLabel: (item) => item.displayName,
  search: { index: 'storedProcedure', urlParam: 'schema', term: 'pw' },
  deletedToggleTestId: 'show-deleted',
  setup: () => {
    serveEntities([
      ['/api/v1/databaseSchemas', SCHEMA],
      ['/api/v1/databases', DATABASE],
      ['/api/v1/services/databaseServices', DB_SERVICE],
    ]);
    serveEmptyLists(['/api/v1/tables']);
  },
  knownIssues: {
    failing: {
      navigation:
        'StoredProcedureTab URL-sync effect resets currentPage to 1 under router transitions',
      search:
        'StoredProcedureTab URL-sync effect keeps the old page, so search starts at page 2',
    },
  },
});
