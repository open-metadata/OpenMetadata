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
import { getDatabaseSchemas } from '../../../../rest/databaseAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
  expectSearchPaging,
  searchQueryPage,
  SEARCH_TERM,
} from '../../../../test/unit/pagingScenarios';
import { DatabaseSchemaTable } from './DatabaseSchemaTable';

jest.mock(
  '../../../common/Table/TableV2',
  () => jest.requireActual('../../../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'service.db' }),
}));

jest.mock('../../../../rest/databaseAPI', () => ({
  getDatabaseSchemas: jest.fn(),
  patchDatabaseSchemaDetails: jest.fn(),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../utils/TableColumn.util', () => ({
  certificationTableObject: jest.fn().mockReturnValue([]),
  dataProductTableObject: jest.fn().mockReturnValue([]),
  descriptionTableObject: jest.fn().mockReturnValue([]),
  domainTableObject: jest.fn().mockReturnValue([]),
  ownerTableObject: jest.fn().mockReturnValue([]),
  tagTableObject: jest.fn().mockReturnValue([]),
  tierTableObject: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: { databaseSchema: { ViewAll: true, ViewBasic: true } },
  }),
}));

jest.mock('../../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockReturnValue({
    data: { fullyQualifiedName: 'service.db', deleted: false },
  }),
}));

const mockGetDatabaseSchemas = getDatabaseSchemas as jest.Mock;
const mockSearchQuery = searchQuery as jest.Mock;

const lastListRequest = () =>
  mockGetDatabaseSchemas.mock.calls.at(-1)?.[0] as CursorRequest | undefined;

const lastSearchRequest = () => {
  const request = mockSearchQuery.mock.calls.at(-1)?.[0];

  return (
    request && {
      term: JSON.stringify(request.queryFilter).includes(SEARCH_TERM)
        ? SEARCH_TERM
        : undefined,
      page: request.pageNumber,
    }
  );
};

describe('DatabaseSchemaTable pagination', () => {
  beforeEach(() => {
    mockGetDatabaseSchemas.mockImplementation(async (req: CursorRequest) =>
      cursorPage(req)
    );
    mockSearchQuery.mockImplementation(
      async ({ pageNumber }: { pageNumber: number }) =>
        searchQueryPage(pageNumber)
    );
  });

  it('pages schemas by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/database/service.db?pageSize=15',
      ui: <DatabaseSchemaTable />,
      lastListRequest,
    });
  });

  it('switches to numbered search paging and back to page 1 on toggling deleted', async () => {
    await expectSearchPaging({
      url: '/database/service.db?showDeletedTables=false',
      ui: <DatabaseSchemaTable />,
      lastListRequest,
      lastSearchRequest,
      searchRequestCount: () => mockSearchQuery.mock.calls.length,
      searchParamName: 'schema',
    });
  });
});
