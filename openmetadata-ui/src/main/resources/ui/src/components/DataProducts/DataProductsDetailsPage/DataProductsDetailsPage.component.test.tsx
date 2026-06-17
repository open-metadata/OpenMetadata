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

import { render } from '@testing-library/react';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import DataProductsDetailsPage from './DataProductsDetailsPage.component';
import { DataProductsDetailsPageProps } from './DataProductsDetailsPage.interface';

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => children ?? null),
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
    getRequestDataAccessButton: jest.fn().mockReturnValue(null),
    getRequestDataAccessBanner: jest.fn().mockReturnValue(null),
    getDataProductDetailPageTabs: jest.fn().mockReturnValue([]),
  },
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

describe('DataProductsDetailsPage — Request Data Access delegation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDataProductClassBase().getRequestDataAccessButton.mockReturnValue(null);
    getDataProductClassBase().getRequestDataAccessBanner.mockReturnValue(null);
  });

  it('delegates the DAR button to dataProductClassBase', () => {
    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(
      getDataProductClassBase().getRequestDataAccessButton
    ).toHaveBeenCalled();
  });

  it('delegates the DAR banner to dataProductClassBase', () => {
    render(<DataProductsDetailsPage {...defaultProps} />);

    expect(
      getDataProductClassBase().getRequestDataAccessBanner
    ).toHaveBeenCalled();
  });

  it('renders the node returned by getRequestDataAccessButton', () => {
    const mockButton = <button data-testid="mock-dar-button">Request</button>;
    getDataProductClassBase().getRequestDataAccessButton.mockReturnValue(
      mockButton
    );

    const { getByTestId } = render(
      <DataProductsDetailsPage {...defaultProps} />
    );

    expect(getByTestId('mock-dar-button')).toBeInTheDocument();
  });

  it('renders the node returned by getRequestDataAccessBanner', () => {
    const mockBanner = <div data-testid="mock-dar-banner">Banner</div>;
    getDataProductClassBase().getRequestDataAccessBanner.mockReturnValue(
      mockBanner
    );

    const { getByTestId } = render(
      <DataProductsDetailsPage {...defaultProps} />
    );

    expect(getByTestId('mock-dar-banner')).toBeInTheDocument();
  });
});
