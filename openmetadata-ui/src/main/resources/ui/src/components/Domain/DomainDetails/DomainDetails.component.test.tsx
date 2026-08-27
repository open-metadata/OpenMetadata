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
import { MemoryRouter } from 'react-router-dom';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { MOCK_DOMAIN } from '../../../mocks/Domains.mock';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { showErrorToast } from '../../../utils/ToastUtils';
import DomainDetails from './DomainDetails.component';

// DomainDetails.component.tsx had ZERO existing test coverage before this conversion (Task 8
// Batch 1). This is a minimal permission-focused characterization suite, not a full render
// suite for the component's many other features (announcements, style modal, delete modal,
// sub-domain/data-product drawers, voting, asset search, tabs) — see task-8B1-report.md for
// the RED/GREEN evidence and the full mock-surface rationale.
//
// `useCustomPages` is mocked with `isLoading: true` for the identifier/error-toast tests —
// the component's own `if (isLoading) return <Loader />;` gate sits AFTER every hook call and
// permission-derived useMemo in the function body (React executes the whole function body
// top-to-bottom every render regardless of where an early return lands), so this reliably
// exercises the permission hook and its error-toast effect while skipping the large
// `content` JSX tree — without needing to mock every unrelated child component. The
// button-visibility tests instead use `isLoading: false` with `domainClassBase` stubbed to
// return zero tabs and every other heavy child component (EntityHeader, GenericProvider,
// modals/drawers) stubbed to a trivial passthrough, isolating the two inline,
// permission-gated affordances (`domain-details-add-button`, `manage-button`) that live
// directly in this file rather than in a child.

const mockOnUpdate = jest.fn();
const mockOnDelete = jest.fn();

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

// Resource-level `permissions.dataProduct.Create` check — unrelated to the entity-permission
// conversion (see the source's inline comment); grant-all-false here so the "Add" dropdown's
// visibility in tests is driven entirely by the entity-level `canCreate` flag under test.
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: { dataProduct: { Create: false } },
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockReturnValue({ currentUser: { id: 'user-1' } }),
}));

const mockMarketplaceState = {
  isMarketplace: false,
  domainBasePath: '/domain',
  dataProductBasePath: '/dataProduct',
};

// `getDomainPath` (utils/RouterUtils.ts) reads `useMarketplaceStore.getState()` directly
// (zustand static access, not the hook form), so the mock needs that static method too.
// mockImplementation (not mockReturnValue) — mockReturnValue would read `mockMarketplaceState`
// eagerly, at factory-execution time, which (per jest's mock-hoisting) runs before this
// file's own top-level `const` statements — a lazy closure avoids the TDZ crash.
jest.mock('../../../hooks/useMarketplaceStore', () => ({
  useMarketplaceStore: Object.assign(
    jest.fn().mockImplementation(() => mockMarketplaceState),
    { getState: jest.fn().mockImplementation(() => mockMarketplaceState) }
  ),
}));

let mockCustomPagesReturn = { customizedPage: null, isLoading: true };
jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn(() => mockCustomPagesReturn),
}));

jest.mock('../../../utils/Domain/DomainClassBase', () => ({
  __esModule: true,
  default: { getDomainDetailPageTabs: jest.fn().mockReturnValue([]) },
}));

jest.mock('../../../rest/announcementsAPI', () => ({
  getActiveAnnouncements: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { total: { value: 0 } } }),
}));
jest.mock('../../../utils/FeedUtilsPure', () => ({
  fetchEntityTaskCountsInto: jest.fn(),
  fetchEntityActivityCountInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));

jest.mock('../../common/atoms/drawer', () => ({
  useFormDrawerWithHook: jest.fn().mockReturnValue({
    formDrawer: null,
    openDrawer: jest.fn(),
    closeDrawer: jest.fn(),
  }),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../../components/Entity/EntityHeader/EntityHeader.component', () => ({
  EntityHeader: jest.fn().mockReturnValue(<div>EntityHeader</div>),
}));

jest.mock('../../common/HeaderBreadcrumb/HeaderBreadcrumb.component', () => {
  return jest.fn().mockReturnValue(<div>HeaderBreadcrumb</div>);
});

jest.mock('../../common/CoverImage/CoverImage.component', () => ({
  CoverImage: jest.fn().mockReturnValue(<div>CoverImage</div>),
}));

jest.mock('../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer', () => ({
  AssetSelectionDrawer: jest.fn().mockReturnValue(null),
}));

jest.mock('../../common/DeleteModal/DeleteModal', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../Modals/EntityNameModal/EntityNameModal.component', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../Modals/StyleModal/StyleModal.component', () =>
  jest.fn().mockReturnValue(null)
);

// Captures the `createPermission` prop directly instead of driving antd's real Dropdown
// portal — same technique as DataProductsDetailsPage.component.test.tsx (same batch).
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

jest.mock(
  '../../common/EntityPageInfos/AnnouncementCard/AnnouncementCard',
  () => jest.fn().mockReturnValue(null)
);

const defaultProps = {
  domain: MOCK_DOMAIN,
  onUpdate: mockOnUpdate,
  onDelete: mockOnDelete,
};

const renderComponent = (props = {}) =>
  render(<DomainDetails {...defaultProps} {...props} />, {
    wrapper: MemoryRouter,
  });

describe('DomainDetails permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions(ENTITY_PERMISSIONS);
    mockCustomPagesReturn = { customizedPage: null, isLoading: true };
  });

  // Guardrail: this component owns the single useEntityPermissions call whose raw
  // `domainPermission` prop feeds GenericProvider/domainClassBase — see
  // PipelineDetails.test.tsx's afterEach for the general rationale on asserting the
  // (resource, identifier) pair. `identifier` uses toEqual, not toBe: the source passes a
  // fresh `{ id: domain.id }` object literal on every render, and several effects here
  // (fetchDomainAssets/fetchDataProducts/fetchSubDomainsCount, all mocked to resolve) trigger
  // state updates that cause genuine re-renders during a test — see the identical rationale
  // in DataProductsDetailsPage.component.test.tsx (same batch).
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

  it('fetches permissions by id, not fqn, with no deleted option (Domain has no deleted field)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.DOMAIN,
        { id: MOCK_DOMAIN.id }
      );
    });
  });

  it('shows the permission-fetch error toast when the hook reports an error', async () => {
    setMockPermissions(ENTITY_PERMISSIONS, {
      error: new Error('permission fetch failed'),
    });

    renderComponent();

    // Preserved verbatim from the old fetchDomainPermission catch: a bare
    // showErrorToast(error as AxiosError) call, no translated message/entity interpolation —
    // same distinctive shape as DataProductsDetailsPage (same batch) and APICollectionPage
    // (Task 7C, File 3).
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('rendered affordances (isLoading: false)', () => {
    beforeEach(() => {
      mockCustomPagesReturn = { customizedPage: null, isLoading: false };
    });

    it('shows the Add dropdown when Create permission is granted', async () => {
      setMockPermissions({ ...ENTITY_PERMISSIONS, Create: true });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('domain-details-add-button')
        ).toBeInTheDocument();
      });
    });

    it('hides the Add dropdown when Create permission is denied (and user is not an owner)', async () => {
      setMockPermissions({ ...ENTITY_PERMISSIONS, Create: false });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('EntityHeader')).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId('domain-details-add-button')
      ).not.toBeInTheDocument();
    });

    it('shows the manage-entity dropdown when any manage-gating permission is granted', async () => {
      setMockPermissions({ ...ENTITY_PERMISSIONS, EditAll: true });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('manage-button')).toBeInTheDocument();
      });
    });

    it('hides the manage-entity dropdown when every manage-gating permission is denied', async () => {
      setMockPermissions({});

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('EntityHeader')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
    });

    it('wires editAllPermission (from canEditAll) into AnnouncementDrawer.createPermission', async () => {
      setMockPermissions({ ...ENTITY_PERMISSIONS, EditAll: true });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('announcement-drawer')).toHaveAttribute(
          'data-create-permission',
          'true'
        );
      });
    });
  });
});
