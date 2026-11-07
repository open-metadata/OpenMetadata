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
  DRIVE_SERVICE,
  serveEmptyLists,
  serveEntities,
} from '../../test/browser/fixtures/hierarchy';
import { describePaginatedList } from '../../test/browser/paginationContract';

const items = many(40, (i) =>
  named('spreadsheet', i, DRIVE_SERVICE.fullyQualifiedName)
);

describePaginatedList({
  name: 'Drive service › Spreadsheets',
  route: `/service/driveServices/${DRIVE_SERVICE.name}/spreadsheets`,
  query: { showDeletedTables: 'false' },
  listPath: '/api/v1/drives/spreadsheets',
  // Pages also request limit=0 just to read totals for tab badges.
  isPageRequest: (url) => url.searchParams.get('limit') !== '0',
  items,
  itemLabel: (item) => item.displayName,
  search: { index: 'spreadsheet', urlParam: 'spreadsheet', term: 'pw' },
  deletedToggleTestId: 'show-deleted',
  setup: () => {
    serveEntities([['/api/v1/services/driveServices', DRIVE_SERVICE]]);
    // Sibling tabs only need their counts here.
    serveEmptyLists(['/api/v1/drives/directories', '/api/v1/drives/files']);
  },
});
