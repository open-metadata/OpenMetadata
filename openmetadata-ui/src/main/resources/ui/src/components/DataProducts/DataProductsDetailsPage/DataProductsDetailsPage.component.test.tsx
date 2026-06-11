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

import { render, screen } from '@testing-library/react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDataAccessRequest } from '../../../hooks/useDataAccessRequest';
import DataProductsDetailsPage from './DataProductsDetailsPage.component';
import { DataProductsDetailsPageProps } from './DataProductsDetailsPage.interface';

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest.fn().mockReturnValue(null),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
  useLocation: jest
    .fn()
    .mockReturnValue({ state: null, pathname: '/data-product/test' }),
}));
jest.mock('notistack', () => ({
  useSnackbar: jest.fn().mockReturnValue({ enqueueSnackbar: jest.fn() }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'user-1', name: 'test.user', isAdmin: false },
  }),
}));
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockResolvedValue({}),
    permissions: { task: { Create: true } },
  }),
}));
jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test Data Product'),
}));

jest.mock('../../../utils/EntityVoteUtils', () => ({
  getEntityVoteStatus: jest.fn().mockReturnValue('unVoted'),
}));

jest.mock('../../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/DataProduct/DataProductClassBase', () => ({
  __esModule: true,
  default: {
    getShowRequestDataAccess: jest.fn().mockReturnValue(false),
    getRequestDataAccessDrawer: jest.fn().mockReturnValue(null),
    getDataProductDetailPageTabs: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../../hooks/useDataAccessRequest', () => ({
  useDataAccessRequest: jest.fn().mockReturnValue({
    isDarDisabled: false,
    isDarAwaitingGrant: false,
    isDarGranted: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../../utils/TasksUtils', () => ({
  getDarButtonTooltip: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    shouldShowEntityStatus: jest.fn().mockReturnValue(false),
    getFormattedEntityType: jest.fn().mockReturnValue('Data Product'),
  },
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test.dataproduct' }),
}));
jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest
    .fn()
    .mockReturnValue({ tab: 'documentation', version: undefined }),
}));
jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest
    .fn()
    .mockReturnValue({ customizedPage: null, isLoading: false }),
}));
jest.mock('../../../hooks/useMarketplaceStore', () => ({
  useMarketplaceStore: jest.fn().mockReturnValue({
    isMarketplace: false,
    dataProductBasePath: '/data-product',
  }),
}));
jest.mock('../../../rest/dataProductAPI', () => ({
  getDataProductPortsView: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../../rest/contractAPI', () => ({
  getContractByEntityId: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../rest/announcementsAPI', () => ({
  getActiveAnnouncements: jest.fn().mockResolvedValue({ data: [] }),
}));

const mockDataProduct: DataProduct = {
  id: 'dp-id',
  name: 'test-data-product',
  displayName: 'Test Data Product',
  fullyQualifiedName: 'test.dataproduct',
  description: 'Test description',
  domains: [],
  owners: [],
  version: 0.1,
  updatedAt: 1_700_000_000,
  updatedBy: 'test.user',
};

const defaultProps: DataProductsDetailsPageProps = {
  dataProduct: mockDataProduct,
  onUpdate: jest.fn(),
  onDelete: jest.fn(),
};

function getDataProductClassBase() {
  return jest.requireMock('../../../utils/DataProduct/DataProductClassBase')
    .default;
}

function enableRequestDataAccess() {
  getDataProductClassBase().getShowRequestDataAccess.mockReturnValue(true);
}

describe('DataProductsDetailsPage — Request Data Access button', () => {
  beforeEach(() => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      currentUser: { id: 'user-1', name: 'test.user', isAdmin: false },
    });
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermission: jest.fn().mockResolvedValue({}),
      permissions: { task: { Create: true } },
    });
    getDataProductClassBase().getShowRequestDataAccess.mockReturnValue(false);
  });

  it('does not render when the feature flag is off (OSS default)', () => {
    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(
      screen.queryByTestId('request-data-access-button')
    ).not.toBeInTheDocument();
  });

  it('does not render for admin without task-Create permission', () => {
    enableRequestDataAccess();
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      currentUser: { id: 'admin-1', name: 'admin', isAdmin: true },
    });
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermission: jest.fn().mockResolvedValue({}),
      permissions: { task: { Create: false } },
    });

    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(
      screen.queryByTestId('request-data-access-button')
    ).not.toBeInTheDocument();
  });

  it('renders and is enabled for an admin with task-Create permission', () => {
    enableRequestDataAccess();
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      currentUser: { id: 'admin-1', name: 'admin', isAdmin: true },
    });

    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(screen.getByTestId('request-data-access-button')).toBeEnabled();
  });

  it('renders for entity owner with task-Create permission', () => {
    enableRequestDataAccess();

    render(
      <DataProductsDetailsPage
        {...defaultProps}
        dataProduct={{
          ...mockDataProduct,
          owners: [{ id: 'user-1', type: 'user' }],
        }}
      />
    );

    expect(screen.getByTestId('request-data-access-button')).toBeEnabled();
  });

  it('does not render when the user lacks task-Create permission', () => {
    enableRequestDataAccess();
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermission: jest.fn().mockResolvedValue({}),
      permissions: { task: { Create: false } },
    });

    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(
      screen.queryByTestId('request-data-access-button')
    ).not.toBeInTheDocument();
  });

  it('does not render in versions-history view', () => {
    enableRequestDataAccess();

    render(<DataProductsDetailsPage {...defaultProps} isVersionsView />);

    expect(
      screen.queryByTestId('request-data-access-button')
    ).not.toBeInTheDocument();
  });

  it('renders and is enabled for a regular user with task-Create permission', () => {
    enableRequestDataAccess();

    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(screen.getByTestId('request-data-access-button')).toBeEnabled();
  });
});

describe('DataProductsDetailsPage — awaiting-grant banner', () => {
  beforeEach(() => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      currentUser: { id: 'user-1', name: 'test.user', isAdmin: false },
    });
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermission: jest.fn().mockResolvedValue({}),
      permissions: { task: { Create: true } },
    });
    getDataProductClassBase().getShowRequestDataAccess.mockReturnValue(true);
    (useDataAccessRequest as jest.Mock).mockReturnValue({
      isDarDisabled: false,
      isDarAwaitingGrant: true,
      isDarGranted: false,
      refetch: jest.fn(),
    });
  });

  it('shows the banner when the DAR is approved but not yet granted', () => {
    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(screen.getByTestId('dar-awaiting-grant-banner')).toBeInTheDocument();
  });

  it('does not show the banner when there are no active DARs', () => {
    (useDataAccessRequest as jest.Mock).mockReturnValue({
      isDarDisabled: false,
      isDarAwaitingGrant: false,
      isDarGranted: false,
      refetch: jest.fn(),
    });

    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(
      screen.queryByTestId('dar-awaiting-grant-banner')
    ).not.toBeInTheDocument();
  });
});
