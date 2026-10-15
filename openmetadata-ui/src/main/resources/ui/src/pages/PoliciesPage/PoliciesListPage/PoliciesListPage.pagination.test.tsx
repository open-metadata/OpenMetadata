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
import { getPolicies } from '../../../rest/rolesAPIV1';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
} from '../../../test/unit/pagingScenarios';
import PoliciesListPage from './PoliciesListPage';

jest.mock(
  '../../../components/common/Table/TableV2',
  () => jest.requireActual('../../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../../components/Learning/LearningIcon/LearningIcon.component',
  () => ({ LearningIcon: jest.fn().mockReturnValue(null) })
);

jest.mock('../../../rest/rolesAPIV1', () => ({
  getPolicies: jest.fn(),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({ permissions: {} }),
}));

const mockGetPolicies = getPolicies as jest.Mock;

// getPolicies(fields, after, before, limit)
const lastListRequest = (): CursorRequest | undefined => {
  const args = mockGetPolicies.mock.calls.at(-1);

  return args && { after: args[1], limit: args[3] };
};

describe('PoliciesListPage pagination', () => {
  beforeEach(() => {
    mockGetPolicies.mockImplementation(
      async (
        _fields: string,
        after?: string,
        _before?: string,
        limit?: number
      ) => cursorPage({ after, limit })
    );
  });

  it('pages policies by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/settings/access/policies?pageSize=15',
      ui: <PoliciesListPage />,
      lastListRequest,
    });
  });
});
