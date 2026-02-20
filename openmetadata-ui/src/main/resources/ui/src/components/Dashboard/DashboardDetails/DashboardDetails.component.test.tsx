/*
 *  Copyright 2022 Collate.
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

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import DashboardDetails from './DashboardDetails.component';
import { DashboardDetailsProps } from './DashboardDetails.interface';

const mockDashboardDetails: Dashboard = {
  id: 'test-dashboard-id',
  name: 'test-dashboard',
  displayName: 'Test Dashboard',
  fullyQualifiedName: 'test.dashboard',
  description: 'Test dashboard description',
  version: 0.1,
  updatedAt: 1234567890,
  updatedBy: 'test-user',
  href: 'http://test.com',
  charts: [],
  service: {
    id: 'test-service-id',
    type: 'dashboardService',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    deleted: false,
  },
};

const mockProps: DashboardDetailsProps = {
  dashboardDetails: mockDashboardDetails,
  updateDashboardDetailsState: jest.fn(),
  fetchDashboard: jest.fn(),
  followDashboardHandler: jest.fn(),
  unFollowDashboardHandler: jest.fn(),
  versionHandler: jest.fn(),
  onUpdateVote: jest.fn(),
  onDashboardUpdate: jest.fn(),
  handleToggleDelete: jest.fn(),
  charts: [],
};

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('testEntityName'),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: {
      id: 'testUser',
    },
  }),
}));

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: undefined,
    isLoading: false,
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'test.dashboard',
    entityFqn: 'test.dashboard',
  }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: 'details',
  }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockResolvedValue(DEFAULT_ENTITY_PERMISSION),
  }),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getFeedCounts: jest.fn(),
}));

jest.mock(
  '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn().mockReturnValue(<div>DataAssetsHeader</div>),
  })
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((component) => component),
}));

jest.mock('../../../utils/DashboardDetailsClassBase', () => ({
  __esModule: true,
  default: {
    getDashboardDetailPageTabs: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../../utils/CustomizePage/CustomizePageUtils', () => ({
  getTabLabelMapFromTabs: jest.fn().mockReturnValue({}),
  getDetailsTabWithNewLabel: jest.fn().mockReturnValue([]),
  checkIfExpandViewSupported: jest.fn().mockReturnValue(false),
}));

describe('DashboardDetails component', () => {
  it('should render successfully', () => {
    const { container } = render(<DashboardDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(container).toBeInTheDocument();
  });

  it('should pass entity name as pageTitle to PageLayoutV1', () => {
    render(<DashboardDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(PageLayoutV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'testEntityName',
      }),
      expect.anything()
    );
  });
});
