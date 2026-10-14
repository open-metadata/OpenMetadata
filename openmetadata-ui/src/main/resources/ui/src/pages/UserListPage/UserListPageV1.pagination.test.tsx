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
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { searchQuery } from '../../rest/searchAPI';
import { getUsers } from '../../rest/userAPI';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
  expectSearchPaging,
  SEARCH_TERM,
  searchQueryPage,
} from '../../test/unit/pagingScenarios';
import UserListPageV1 from './UserListPageV1';

jest.mock(
  '../../components/common/Table/TableV2',
  () => jest.requireActual('../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockReturnValue(null)
);

jest.mock('../../components/PageHeader/PageHeader.component', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../hoc/LimitWrapper', () =>
  jest.fn().mockImplementation(({ children }) => <>{children}</>)
);

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest
    .fn()
    .mockReturnValue({ tab: GlobalSettingOptions.USERS }),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../rest/userAPI', () => ({
  getUsers: jest.fn(),
  restoreUser: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockGetUsers = getUsers as jest.Mock;
const mockSearchQuery = searchQuery as jest.Mock;

const lastListRequest = () =>
  mockGetUsers.mock.calls.at(-1)?.[0] as CursorRequest | undefined;

const lastSearchRequest = () => {
  const request = mockSearchQuery.mock.calls.at(-1)?.[0];

  return (
    request && {
      term: request.query === `*${SEARCH_TERM}*` ? SEARCH_TERM : undefined,
      page: request.pageNumber,
    }
  );
};

describe('UserListPageV1 pagination', () => {
  beforeEach(() => {
    mockGetUsers.mockImplementation(async (req: CursorRequest) =>
      cursorPage(req)
    );
    mockSearchQuery.mockImplementation(
      async ({ pageNumber }: { pageNumber: number }) =>
        searchQueryPage(pageNumber)
    );
  });

  it('pages users by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/settings/members/users',
      ui: <UserListPageV1 />,
      lastListRequest,
    });
  });

  it('switches to numbered search paging and back to page 1 on toggling deleted', async () => {
    await expectSearchPaging({
      url: '/settings/members/users',
      ui: <UserListPageV1 />,
      lastListRequest,
      lastSearchRequest,
      searchRequestCount: () => mockSearchQuery.mock.calls.length,
      searchParamName: 'user',
    });
  });
});
