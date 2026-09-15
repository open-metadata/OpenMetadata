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

import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import dashboardDetailsClassBase from '../../../utils/DashboardDetailsClassBase';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import DashboardDetails from './DashboardDetails.component';
import { DashboardDetailsProps } from './DashboardDetails.interface';

// The component now reads its own permissions via useEntityPermissions rather than the raw
// PermissionProvider context, so mocking that hook (instead of the old getEntityPermission
// REST boundary) drives its permission-derived behavior in these tests — same approach as
// TableDetailsPageV1.test.tsx.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
  {
    isLoading = false,
    error = null as unknown,
  }: { isLoading?: boolean; error?: unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

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

jest.mock('../../../utils/EntityNameUtils', () => ({
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

jest.mock('../../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
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

jest.mock('../../../utils/CustomizePage/CustomizePageEntityTabUtils', () => ({
  getTabLabelMapFromTabs: jest.fn().mockReturnValue({}),
  getDetailsTabWithNewLabel: jest.fn().mockReturnValue([]),
  checkIfExpandViewSupported: jest.fn().mockReturnValue(false),
}));

describe('DashboardDetails component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({
      ViewAll: true,
      EditCustomFields: true,
      EditLineage: true,
      ViewCustomFields: true,
    });
  });

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

  it('fetches its own permissions by the dashboard id', () => {
    render(<DashboardDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      'dashboard',
      { id: 'test-dashboard-id' },
      expect.objectContaining({ deleted: false })
    );
  });

  it('passes the derived permission flags through to getDashboardDetailPageTabs', () => {
    render(<DashboardDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(
      dashboardDetailsClassBase.getDashboardDetailPageTabs
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        editLineagePermission: true,
        editCustomAttributePermission: true,
        viewAllPermission: true,
        viewCustomPropertiesPermission: true,
      })
    );
  });

  it('denies view-custom-fields when ViewCustomFields is explicitly false, even with no ViewAll grant', async () => {
    setMockPermissions({ ViewAll: true, ViewCustomFields: false });

    render(<DashboardDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    await waitFor(() => {
      expect(
        dashboardDetailsClassBase.getDashboardDetailPageTabs
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          viewCustomPropertiesPermission: false,
        })
      );
    });
  });
});
