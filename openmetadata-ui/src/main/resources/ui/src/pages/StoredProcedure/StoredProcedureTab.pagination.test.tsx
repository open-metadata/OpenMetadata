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
import { act, fireEvent, screen } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { searchQuery } from '../../rest/searchAPI';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
  expectSearchPaging,
  PAGE_ONE_ROW,
  PAGE_TWO_ROW,
  renderPageAt,
  SEARCH_TERM,
  searchQueryPage,
} from '../../test/unit/pagingScenarios';
import StoredProcedureTab from './StoredProcedureTab';

// The E2E ran with router transitions off (AppRoot: useTransitions={!isPlaywrightEnv()}).
// With them on, the tab's URL->currentPage sync effect sees the new page before the URL
// transition commits and snaps the indicator back to page 1.
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');

  return {
    ...actual,
    BrowserRouter: (props: Record<string, unknown>) => (
      <actual.BrowserRouter {...props} useTransitions={false} />
    ),
  };
});

jest.mock(
  '../../components/common/Table/TableV2',
  () => jest.requireActual('../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'service.db.schema' }),
}));

jest.mock('../../rest/storedProceduresAPI', () => ({
  getStoredProceduresList: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockGetStoredProceduresList = getStoredProceduresList as jest.Mock;
const mockSearchQuery = searchQuery as jest.Mock;

const lastListRequest = () =>
  mockGetStoredProceduresList.mock.calls.at(-1)?.[0] as
    | CursorRequest
    | undefined;

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

// Navigates the way DatabaseSchemaPage's activeTabHandler does: pathname only, query dropped.
const SchemaTabs = () => {
  const navigate = useNavigate();
  const goTo = (tab: string) =>
    navigate(
      { pathname: `/databaseSchema/service.db.schema/${tab}` },
      { replace: true }
    );

  return (
    <>
      <button data-testid="table" onClick={() => goTo('table')}>
        table
      </button>
      <button
        data-testid="stored_procedure"
        onClick={() => goTo('stored_procedure')}>
        stored_procedure
      </button>
    </>
  );
};

describe('StoredProcedureTab pagination', () => {
  beforeEach(() => {
    mockGetStoredProceduresList.mockImplementation(async (req: CursorRequest) =>
      cursorPage(req)
    );
    mockSearchQuery.mockImplementation(
      async ({ pageNumber }: { pageNumber: number }) =>
        searchQueryPage(pageNumber)
    );
  });

  it('pages stored procedures by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/databaseSchema/service.db.schema/stored_procedure?pageSize=15',
      ui: <StoredProcedureTab />,
      lastListRequest,
    });
  });

  it('is back on page 1 after switching to the table tab and back', async () => {
    renderPageAt(
      '/databaseSchema/service.db.schema/stored_procedure?pageSize=15',
      <>
        <SchemaTabs />
        <StoredProcedureTab />
      </>
    );

    expect(await screen.findByText(PAGE_ONE_ROW)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });

    expect(await screen.findByText(PAGE_TWO_ROW)).toBeInTheDocument();
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      /\b2 label\.of \d+/
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('table'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('stored_procedure'));
    });

    expect(await screen.findByText(PAGE_ONE_ROW)).toBeInTheDocument();
    expect(lastListRequest()?.after).toBeUndefined();
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      /\b1 label\.of \d+/
    );
  });

  it('switches to numbered search paging and back to page 1 on toggling deleted', async () => {
    await expectSearchPaging({
      url: '/databaseSchema/service.db.schema/stored_procedure?pageSize=15',
      ui: <StoredProcedureTab />,
      lastListRequest,
      lastSearchRequest,
      searchRequestCount: () => mockSearchQuery.mock.calls.length,
      searchParamName: 'schema',
      deleteToggleTestId: 'show-deleted-stored-procedure',
    });
  });
});
