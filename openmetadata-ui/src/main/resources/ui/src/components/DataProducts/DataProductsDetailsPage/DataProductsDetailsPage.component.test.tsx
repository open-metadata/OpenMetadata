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

import { render, screen, waitFor } from '@testing-library/react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { showErrorToast } from '../../../utils/ToastUtils';
import DataProductsDetailsPage from './DataProductsDetailsPage.component';
import { DataProductsDetailsPageProps } from './DataProductsDetailsPage.interface';

// The component now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context — see TableDetailsPageV1.test.tsx's setMockPermissions for the
// full rationale (partial-object fidelity, mockReturnValue over mockImplementationOnce, the
// `deleted`-gating blind spot), mirrored here without repeating it. DataProduct carries no
// `deleted` field, so `deleted` is always false here.
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

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => children ?? null),
}));

// Captures the `createPermission` prop directly instead of driving antd's real Dropdown
// portal (async, animated, flaky in jsdom) — a deterministic way to verify the
// editAllPermission → createPermission wiring without simulating a click-and-wait UI flow.
jest.mock(
  '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer',
  () =>
    jest
      .fn()
      .mockImplementation(({ createPermission }) => (
        <div
          data-create-permission={String(Boolean(createPermission))}
          data-testid="announcement-drawer"
        />
      ))
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
  useLocation: jest
    .fn()
    .mockReturnValue({ state: null, pathname: '/data-product/test' }),
}));
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
  showInfoToast: jest.fn(),
  showWarningToast: jest.fn(),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'user-1', name: 'test.user', isAdmin: false },
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
    setMockPermissions(ENTITY_PERMISSIONS);
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

describe('DataProductsDetailsPage — permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions(ENTITY_PERMISSIONS);
    getDataProductClassBase().getRequestDataAccessButton.mockReturnValue(null);
    getDataProductClassBase().getRequestDataAccessBanner.mockReturnValue(null);
  });

  // Guardrail: this component owns the single useEntityPermissions call whose raw
  // `dataProductPermission` prop feeds GenericProvider/dataProductClassBase — see
  // PipelineDetails.test.tsx's afterEach for the general rationale on asserting the
  // (resource, identifier) pair. `identifier` is compared with toEqual, not toBe: the source
  // passes a fresh `{ id: dataProduct.id }` object literal on every render (several effects
  // here trigger state updates — setDataContract, setAssetCount, etc. — so this component,
  // unlike simpler single-render owners, genuinely re-renders during a test), so reference
  // identity isn't meaningful; value equality is what actually matters here.
  afterEach(() => {
    const calls = mockUseEntityPermissions.mock.calls;
    if (calls.length === 0) {
      return;
    }
    const [expectedResource, expectedIdentifier] = calls[0];
    calls.forEach(([resource, identifier]) => {
      expect(resource).toBe(expectedResource);
      expect(identifier).toEqual(expectedIdentifier);
    });
  });

  it('fetches permissions by id, not fqn, with no deleted option (DataProduct has no deleted field)', async () => {
    render(<DataProductsDetailsPage {...defaultProps} />);

    await waitFor(() => {
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.DATA_PRODUCT,
        { id: mockDataProduct.id }
      );
    });
  });

  it('shows the add-asset button when Create permission is granted', async () => {
    setMockPermissions({ ...ENTITY_PERMISSIONS, Create: true });

    render(<DataProductsDetailsPage {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('data-product-details-add-button')
      ).toBeInTheDocument();
    });
  });

  it('hides the add-asset button when Create permission is denied', async () => {
    setMockPermissions({ ...ENTITY_PERMISSIONS, Create: false });

    render(<DataProductsDetailsPage {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.queryByTestId('data-product-details-add-button')
      ).not.toBeInTheDocument();
    });
  });

  // manage-button itself always renders (menu.items unconditionally carries an
  // export-odps-button entry regardless of permissions), so raw `.EditAll`'s replacement
  // (canEditAll) is verified via the AnnouncementDrawer's createPermission prop instead —
  // deterministic, unlike driving antd's real Dropdown portal open/closed.
  it('wires editAllPermission (from canEditAll) into AnnouncementDrawer.createPermission when granted', async () => {
    setMockPermissions({ ...ENTITY_PERMISSIONS, EditAll: true });

    render(<DataProductsDetailsPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('announcement-drawer')).toHaveAttribute(
        'data-create-permission',
        'true'
      );
    });
  });

  it('wires editAllPermission (from canEditAll) into AnnouncementDrawer.createPermission when denied', async () => {
    setMockPermissions({ ...ENTITY_PERMISSIONS, EditAll: false });

    render(<DataProductsDetailsPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('announcement-drawer')).toHaveAttribute(
        'data-create-permission',
        'false'
      );
    });
  });

  it('shows the permission-fetch error toast when the hook reports an error', async () => {
    setMockPermissions(ENTITY_PERMISSIONS, {
      error: new Error('permission fetch failed'),
    });

    render(<DataProductsDetailsPage {...defaultProps} />);

    // Preserved verbatim from the old fetchDataProductPermission catch: a bare
    // showErrorToast(error as AxiosError) call, no translated message/entity interpolation.
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
