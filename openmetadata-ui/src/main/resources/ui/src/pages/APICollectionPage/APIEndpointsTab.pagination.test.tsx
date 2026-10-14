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
import { getApiEndPoints } from '../../rest/apiEndpointsAPI';
import { searchQuery } from '../../rest/searchAPI';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
  expectSearchPaging,
  searchQueryPage,
  SEARCH_TERM,
} from '../../test/unit/pagingScenarios';
import APIEndpointsTab from './APIEndpointsTab';

jest.mock(
  '../../components/common/Table/TableV2',
  () => jest.requireActual('../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'service.collection' }),
}));

jest.mock('../../rest/apiEndpointsAPI', () => ({
  getApiEndPoints: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock(
  '../../components/Customization/GenericProvider/GenericContext',
  () => ({
    useGenericContext: jest.fn().mockReturnValue({
      data: {
        fullyQualifiedName: 'service.collection',
        service: { fullyQualifiedName: 'service' },
      },
    }),
  })
);

const mockGetApiEndPoints = getApiEndPoints as jest.Mock;
const mockSearchQuery = searchQuery as jest.Mock;

const lastListRequest = () =>
  mockGetApiEndPoints.mock.calls.at(-1)?.[0]?.paging as
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

describe('APIEndpointsTab pagination', () => {
  beforeEach(() => {
    mockGetApiEndPoints.mockImplementation(
      async ({ paging }: { paging: CursorRequest }) => cursorPage(paging)
    );
    mockSearchQuery.mockImplementation(
      async ({ pageNumber }: { pageNumber: number }) =>
        searchQueryPage(pageNumber)
    );
  });

  it('pages endpoints by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/apiCollection/service.collection?pageSize=15',
      ui: <APIEndpointsTab />,
      lastListRequest,
    });
  });

  it('switches to numbered search paging and back to page 1 on toggling deleted', async () => {
    await expectSearchPaging({
      url: '/apiCollection/service.collection?showDeletedEndpoints=false',
      ui: <APIEndpointsTab />,
      lastListRequest,
      lastSearchRequest,
      searchRequestCount: () => mockSearchQuery.mock.calls.length,
      searchParamName: 'endpoint',
    });
  });
});
