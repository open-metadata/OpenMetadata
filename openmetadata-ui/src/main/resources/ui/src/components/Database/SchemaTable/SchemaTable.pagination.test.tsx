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
import {
  getTableColumnsByFQN,
  searchTableColumnsByFQN,
} from '../../../rest/tableAPI';
import {
  AFTER_CURSOR,
  CursorRequest,
  expectCursorPaging,
  expectSearchPaging,
  PAGE_ONE_ROW,
  PAGE_TWO_ROW,
  pagingRow,
  RESIZED_PAGE_ROW,
  SearchRequestSummary,
  searchPageRow,
  TOTAL,
} from '../../../test/unit/pagingScenarios';
import SchemaTable from './SchemaTable.component';

const TABLE_FQN = 'service.db.schema.table';

jest.mock(
  '../../common/Table/TableV2',
  () => jest.requireActual('../../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'service.db.schema.table',
    entityFqn: 'service.db.schema.table',
    columnFqn: '',
  }),
}));

jest.mock('../../../rest/tableAPI', () => ({
  getTableColumnsByFQN: jest.fn(),
  searchTableColumnsByFQN: jest.fn(),
  updateTableColumn: jest.fn(),
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockReturnValue({
    data: { fullyQualifiedName: 'service.db.schema.table', columns: [] },
    permissions: { ViewAll: true },
    openColumnDetailPanel: jest.fn(),
    setDisplayedColumns: jest.fn(),
  }),
}));

interface OffsetRequest {
  q?: string;
  offset: number;
  limit: number;
}

// Columns page by offset; like TableRepository, the paging cursors are the neighbouring offsets,
// and the second page's offset stands in for the shared scenarios' `after` cursor.
const columnsPage = ({ offset, limit }: OffsetRequest) => {
  let row = PAGE_ONE_ROW;
  if (offset > 0) {
    row = PAGE_TWO_ROW;
  } else if (limit === 25) {
    row = RESIZED_PAGE_ROW;
  }

  return {
    data: [pagingRow(row)],
    paging: {
      before: offset > 0 ? String(Math.max(0, offset - limit)) : undefined,
      after: offset + limit < TOTAL ? String(offset + limit) : undefined,
      total: TOTAL,
    },
  };
};

const columnSearchPage = ({ offset, limit }: OffsetRequest) => ({
  data: [searchPageRow(offset / limit + 1)],
  paging: { total: TOTAL },
});

const mockGetColumns = getTableColumnsByFQN as jest.Mock;
const mockSearchColumns = searchTableColumnsByFQN as jest.Mock;

const lastListRequest = (): CursorRequest | undefined => {
  const request: OffsetRequest | undefined =
    mockGetColumns.mock.calls.at(-1)?.[1];

  return (
    request && {
      after: request.offset === request.limit ? AFTER_CURSOR : undefined,
      limit: request.limit,
    }
  );
};

const lastSearchRequest = (): SearchRequestSummary | undefined => {
  const request: OffsetRequest | undefined =
    mockSearchColumns.mock.calls.at(-1)?.[1];

  return (
    request && { term: request.q, page: request.offset / request.limit + 1 }
  );
};

describe('SchemaTable column pagination', () => {
  beforeEach(() => {
    mockGetColumns.mockImplementation(async (_fqn, req: OffsetRequest) =>
      columnsPage(req)
    );
    mockSearchColumns.mockImplementation(async (_fqn, req: OffsetRequest) =>
      columnSearchPage(req)
    );
  });

  it('pages columns by offset and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: `/table/${TABLE_FQN}?pageSize=15`,
      ui: <SchemaTable />,
      lastListRequest,
      validateUrl: false,
    });
  });

  it('switches to the column search endpoint with numbered paging', async () => {
    await expectSearchPaging({
      url: `/table/${TABLE_FQN}?pageSize=15`,
      ui: <SchemaTable />,
      lastListRequest,
      lastSearchRequest,
      searchRequestCount: () => mockSearchColumns.mock.calls.length,
      searchParamName: 'columnSearch',
    });
  });
});
