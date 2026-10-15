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
import { Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { getDashboards } from '../../rest/dashboardAPI';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
} from '../../test/unit/pagingScenarios';
import ServiceVersionPage from './ServiceVersionPage';

jest.mock(
  '../../components/common/Table/TableV2',
  () => jest.requireActual('../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () => jest.fn().mockReturnValue(null)
);

jest.mock(
  '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () => jest.fn().mockReturnValue(null)
);

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../components/common/EntityDescription/Description', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../utils/ServiceMainTabContentUtils', () => ({
  getServiceMainTabColumns: jest.fn().mockReturnValue([]),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: { dashboard: { ViewAll: true, ViewBasic: true } },
  }),
}));

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: jest.fn().mockReturnValue({
    isLoading: false,
    error: null,
    hasViewAccess: true,
  }),
}));

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn().mockResolvedValue({ id: 'service-id' }),
  getServiceVersions: jest.fn().mockResolvedValue({ versions: [] }),
  getServiceVersionData: jest.fn().mockResolvedValue({
    id: 'service-id',
    name: 'svc',
    fullyQualifiedName: 'svc',
    version: 0.1,
  }),
}));

jest.mock('../../rest/dashboardAPI', () => ({
  getDashboards: jest.fn(),
}));

const mockGetDashboards = getDashboards as jest.Mock;

const lastListRequest = () =>
  mockGetDashboards.mock.calls.at(-1)?.[2] as CursorRequest | undefined;

describe('ServiceVersionPage pagination', () => {
  beforeEach(() => {
    mockGetDashboards.mockImplementation(
      async (_fqn: string, _fields: string, paging: CursorRequest = {}) =>
        cursorPage(paging)
    );
  });

  it('pages the service children by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/service/dashboardServices/svc/versions/0.1?pageSize=15',
      ui: (
        <Routes>
          <Route
            element={<ServiceVersionPage />}
            path={ROUTES.SERVICE_VERSION}
          />
        </Routes>
      ),
      lastListRequest,
      // The version page's table offers no page-size picker.
      hasPageSizePicker: false,
    });
  });
});
