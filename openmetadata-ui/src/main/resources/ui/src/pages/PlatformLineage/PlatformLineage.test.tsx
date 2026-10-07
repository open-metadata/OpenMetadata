/*
 *  Copyright 2025 Collate.
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { PipelineViewMode } from '../../generated/configuration/lineageSettings';
import { AppPreferences } from '../../interface/store.interface';
import {
  MOCK_APP_PREFERENCES,
  MOCK_PERMISSIONS_FULL_ACCESS,
  MOCK_PERMISSIONS_LINEAGE_EDIT,
  MOCK_PERMISSIONS_VIEW_ONLY,
  MOCK_TABLE_ENTITY,
} from './mocks/PlatformLineage.mock';
import PlatformLineage from './PlatformLineage';

// PlatformLineage now fetches its own permissions via useEntityPermissions (Task 8
// batch-final) instead of a manual getEntityPermissionByFqn + getOperationPermissions
// call — both of those still live inside the hook itself, so the existing REST-layer mocks
// below continue to drive it; only a real QueryClientProvider needs to be added around each
// render (useEntityPermissions.test.tsx precedent), no mock rewrites required.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const QueryClientProviderWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const mockNavigate = jest.fn();
const mockGetEntityAPIfromSource = jest.fn();
const mockGetEntityPermissionByFqn = jest.fn();
const mockShowErrorToast = jest.fn();
const mockShowModal = jest.fn();
const mockGetOperationPermissions = jest.fn();
const mockSetLineageConfig = jest.fn();

// Captures the last props LineageConfigModal was rendered with so tests can
// exercise its onSave/onCancel callbacks — enough to prove the modal is wired
// to the store setter (the fix) without depending on antd's real modal DOM.
let lastLineageConfigModalProps:
  | {
      config: unknown;
      visible: boolean;
      onSave: (config: unknown) => void;
      onCancel: () => void;
    }
  | undefined;

let mockFqn = 'test.fqn';
let mockEntityType = EntityType.TABLE;
let mockLocationSearch = '';
let mockAppPreferences = MOCK_APP_PREFERENCES;
let mockStoreLineageConfig: {
  upstreamDepth: number;
  downstreamDepth: number;
  nodesPerLayer: number;
  pipelineViewMode: PipelineViewMode;
} = {
  upstreamDepth: 3,
  downstreamDepth: 3,
  nodesPerLayer: 50,
  pipelineViewMode: PipelineViewMode.Node,
};

jest.mock('@openmetadata/ui-core-components', () => {
  type GridProps = { children?: React.ReactNode };

  type GridMockType = jest.Mock<JSX.Element, [GridProps]> & {
    Item: jest.Mock<JSX.Element, [GridProps]>;
  };
  const GridMock = jest.fn(({ children }: GridProps) => (
    <div>{children}</div>
  )) as GridMockType;

  GridMock.Item = jest.fn(({ children }: GridProps) => <div>{children}</div>);
  const CardMock = jest.fn(({ children }: GridProps) => (
    <div>{children}</div>
  )) as GridMockType & { Content: GridMockType['Item'] };
  CardMock.Content = jest.fn(({ children }: GridProps) => (
    <div>{children}</div>
  ));

  return {
    Grid: GridMock,
    Card: CardMock,
    Tooltip: jest
      .fn()
      .mockImplementation(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
    TooltipTrigger: jest
      .fn()
      .mockImplementation(({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
      )),
    ButtonUtility: jest
      .fn()
      .mockImplementation(({ children, onClick, 'data-testid': testId }) => (
        <button data-testid={testId} onClick={onClick}>
          {children}
        </button>
      )),
  };
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    pathname: '/lineage/table/test.fqn',
    search: mockLocationSearch,
  })),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({
    entityType: mockEntityType,
  })),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    fqn: mockFqn,
  })),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    appPreferences: mockAppPreferences,
  })),
}));

jest.mock('../../hooks/useLineageStore', () => ({
  // Zustand selector-hook shape: called with `(state) => state.field`.
  useLineageStore: jest.fn((selector: (state: unknown) => unknown) =>
    selector({
      lineageConfig: mockStoreLineageConfig,
      setLineageConfig: mockSetLineageConfig,
    })
  ),
}));

jest.mock('../../utils/Assets/AssetsUtils', () => ({
  getEntityAPIfromSource: jest.fn(() => mockGetEntityAPIfromSource),
}));

jest.mock('../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn((...args) =>
    mockGetEntityPermissionByFqn(...args)
  ),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((error) => mockShowErrorToast(error)),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  // useEntityPermissions also imports DEFAULT_ENTITY_PERMISSION (and PermissionDerivation
  // imports getPrioritizedEditPermission/getPrioritizedViewPermission) from this same
  // module — a mock that only exports getOperationPermissions would silently undefine those,
  // crashing getDerivedPermissionFlags. Spread the real module and override only the one
  // function this suite needs to control.
  ...jest.requireActual('../../utils/PermissionsUtils'),
  getOperationPermissions: jest.fn((perms) =>
    mockGetOperationPermissions(perms)
  ),
}));

jest.mock('../../utils/EntityLineagePureUtils', () => ({
  getLineageEntityExclusionFilter: jest.fn(() => ({ mustNot: [] })),
}));

jest.mock('../../utils/EntityLineageLayoutUtils', () => ({
  getViewportForLineageExport: jest.fn(() => ({ x: 0, y: 0, zoom: 1 })),
}));

jest.mock('../../utils/StringUtils', () => ({
  getEncodedFqn: jest.fn((val) => encodeURIComponent(val)),
}));

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  getCurrentISODate: jest.fn(() => '2025-03-05'),
}));

jest.mock(
  '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn(() => ({
      showModal: mockShowModal,
    })),
  })
);

jest.mock('../../components/Lineage/Lineage.component', () => ({
  __esModule: true,
  default: jest.fn(() => <div>Lineage</div>),
}));

jest.mock('../../components/Lineage/Lineage/Lineage', () => ({
  Lineage: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
}));

const mockLineage = require('../../components/Lineage/Lineage.component')
  .default as jest.Mock;
const mockLineageWrapper = require('../../components/Lineage/Lineage/Lineage')
  .Lineage as jest.Mock;
const mockPageLayoutV1 = require('../../components/PageLayoutV1/PageLayoutV1')
  .default as jest.Mock;
const mockDataAssetAsyncSelectList =
  require('../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList')
    .default as jest.Mock;

jest.mock('../../components/Entity/EntityLineage/LineageConfigModal', () => ({
  __esModule: true,
  default: jest.fn((props: typeof lastLineageConfigModalProps) => {
    lastLineageConfigModalProps = props;

    return <div data-testid="lineage-config-modal">Config Modal</div>;
  }),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="loader">Loading</div>),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div>Breadcrumb</div>),
  })
);

jest.mock('../../components/PageHeader/PageHeader.component', () => ({
  __esModule: true,
  default: jest.fn(() => <div>PageHeader</div>),
}));

jest.mock(
  '../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div>DataAssetAsyncSelectList</div>),
  })
);

jest.mock('../../assets/svg/ic-download.svg', () => ({
  ReactComponent: () => <div>DownloadIcon</div>,
}));

jest.mock('../../assets/svg/ic-settings-gear.svg', () => ({
  ReactComponent: () => <div>SettingsIcon</div>,
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Expand05: () => <div>Expand05</div>,
  Home02: () => <div>Home02</div>,
  Minimize02: () => <div>Minimize02</div>,
}));

describe('PlatformLineage Component Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fresh cache per test — the permission query key is keyed only by resource/fqn (both
    // reset to the same defaults below across most tests), so a shared cache would silently
    // serve a prior test's cached response instead of exercising a test's own mock override.
    queryClient.clear();
    mockFqn = 'test.fqn';
    mockEntityType = EntityType.TABLE;
    mockLocationSearch = '';
    mockAppPreferences = MOCK_APP_PREFERENCES;
    mockStoreLineageConfig = {
      upstreamDepth: 3,
      downstreamDepth: 3,
      nodesPerLayer: 50,
      pipelineViewMode: PipelineViewMode.Node,
    };
    lastLineageConfigModalProps = undefined;
    mockGetEntityAPIfromSource.mockResolvedValue(MOCK_TABLE_ENTITY);
    mockGetEntityPermissionByFqn.mockResolvedValue({
      permissions: ['ViewAll', 'EditLineage'],
    });
    mockGetOperationPermissions.mockReturnValue(MOCK_PERMISSIONS_FULL_ACCESS);
    // `jest.clearAllMocks` above clears calls but keeps implementations, so
    // these have to be restored per test or one test's override leaks on.
    mockDataAssetAsyncSelectList.mockImplementation(() => (
      <div>DataAssetAsyncSelectList</div>
    ));
    mockLineage.mockImplementation(() => <div>Lineage</div>);
    mockLineageWrapper.mockImplementation(
      ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    );
    mockPageLayoutV1.mockImplementation(
      ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    );
  });

  describe('Data Fetching Logic', () => {
    it('should fetch entity data on mount when fqn and entityType are provided', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockGetEntityAPIfromSource).toHaveBeenCalledWith('test.fqn');
      });
    });

    it('should fetch permissions on mount when fqn and entityType are provided', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
          EntityType.TABLE,
          'test.fqn'
        );
      });
    });

    it('should not fetch data when fqn is undefined', async () => {
      mockFqn = '';

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockGetEntityAPIfromSource).not.toHaveBeenCalled();
        expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
      });
    });

    it('should not fetch data when entityType is undefined', async () => {
      mockEntityType = '' as EntityType;

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockGetEntityAPIfromSource).not.toHaveBeenCalled();
        expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
      });
    });

    it('should continue loading when permission fetch fails', async () => {
      mockGetEntityPermissionByFqn.mockRejectedValue(
        new Error('Permission error')
      );

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockGetEntityAPIfromSource).toHaveBeenCalled();
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should process permissions when fetch succeeds', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue({
        permissions: ['EditAll'],
      });

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockGetOperationPermissions).toHaveBeenCalledWith({
          permissions: ['EditAll'],
        });
      });
    });
  });

  describe('Lineage Configuration State', () => {
    it('should initialize lineage config from app preferences', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: expect.any(Object),
          }),
          expect.anything()
        );
      });
    });

    it('should use default config when app preferences are not available', async () => {
      mockAppPreferences = {} as AppPreferences;

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should use default downstream depth of 1 when not in preferences', async () => {
      mockAppPreferences = { lineageConfig: {} } as unknown as AppPreferences;

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should use default upstream depth of 1 when not in preferences', async () => {
      mockAppPreferences = { lineageConfig: {} } as unknown as AppPreferences;

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should use default pipeline view mode when not in preferences', async () => {
      mockAppPreferences = { lineageConfig: {} } as unknown as AppPreferences;

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should respect custom downstream depth from preferences', async () => {
      mockAppPreferences = {
        lineageConfig: {
          downstreamDepth: 5,
          upstreamDepth: 1,
        },
      } as unknown as AppPreferences;

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should respect custom pipeline view mode from preferences', async () => {
      mockAppPreferences = {
        lineageConfig: {
          pipelineViewMode: PipelineViewMode.Node,
        },
      } as unknown as AppPreferences;

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });
  });

  describe('Search Functionality', () => {
    // The search box only renders inside the header the page hands to Lineage.
    const renderWithHeader = async () => {
      mockLineage.mockImplementation(
        ({ platformHeader }: { platformHeader: React.ReactNode }) => (
          <div>{platformHeader}</div>
        )
      );
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockDataAssetAsyncSelectList).toHaveBeenCalled();
      });

      return () => mockDataAssetAsyncSelectList.mock.calls.at(-1)[0];
    };

    it('searches data assets, domains and services without the excluded lineage entities', async () => {
      const getProps = await renderWithHeader();

      expect(getProps()).toEqual(
        expect.objectContaining({
          autoFocus: false,
          searchIndex: [
            SearchIndex.DATA_ASSET,
            SearchIndex.DOMAIN,
            SearchIndex.SERVICE,
          ],
          queryFilter: { mustNot: [] },
        })
      );
    });

    it('shows the current entity as the placeholder so the list still opens on click', async () => {
      const getProps = await renderWithHeader();

      await waitFor(() => {
        expect(getProps().placeholder).toBe('Customer Dimension');
      });

      expect(getProps().value).toBeUndefined();
      expect(getProps().initialOptions).toBeUndefined();
    });

    it('prompts for a search on the platform root', async () => {
      mockFqn = '';
      const getProps = await renderWithHeader();

      expect(getProps().placeholder).toBe('label.search-entity-for-lineage');
      expect(getProps().value).toBeUndefined();
    });
  });

  describe('Export Functionality', () => {
    it('should pass export callback in platformHeader', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });

      const lineageCall = mockLineage.mock.calls.at(-1);
      const platformHeader = lineageCall[0].platformHeader;

      expect(platformHeader).toBeDefined();
    });
  });

  describe('Fullscreen Mode Logic', () => {
    it('should parse fullscreen from query params', async () => {
      mockLocationSearch = '?fullscreen=true';

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should default to false when fullscreen param is not present', async () => {
      mockLocationSearch = '';

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });
  });

  describe('Platform View Query Parameter', () => {
    it('should default to Service view when not specified', async () => {
      mockLocationSearch = '';

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should parse platformView from query params', async () => {
      mockLocationSearch = '?platformView=Domain';

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should handle DataProduct platform view', async () => {
      mockLocationSearch = '?platformView=DataProduct';

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });
  });

  describe('Props Passed to Lineage Component', () => {
    it('should pass isPlatformLineage=true', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            isPlatformLineage: true,
          }),
          expect.anything()
        );
      });
    });

    it('should pass fetched entity', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: MOCK_TABLE_ENTITY,
          }),
          expect.anything()
        );
      });
    });

    it('should pass entityType from params', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: EntityType.TABLE,
          }),
          expect.anything()
        );
      });
    });

    it('should pass hasEditAccess=true when EditAll permission exists', async () => {
      mockGetOperationPermissions.mockReturnValue(MOCK_PERMISSIONS_FULL_ACCESS);

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            hasEditAccess: true,
          }),
          expect.anything()
        );
      });
    });

    it('should pass hasEditAccess=true when EditLineage permission exists', async () => {
      mockGetOperationPermissions.mockReturnValue(
        MOCK_PERMISSIONS_LINEAGE_EDIT
      );

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            hasEditAccess: true,
          }),
          expect.anything()
        );
      });
    });

    it('should pass hasEditAccess=false when no edit permissions', async () => {
      mockGetOperationPermissions.mockReturnValue(MOCK_PERMISSIONS_VIEW_ONLY);

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            hasEditAccess: false,
          }),
          expect.anything()
        );
      });
    });

    it('should pass platformHeader prop', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            platformHeader: expect.anything(),
          }),
          expect.anything()
        );
      });
    });
  });

  describe('Conditional Rendering Logic', () => {
    it('should render loader while loading=true', async () => {
      mockGetEntityAPIfromSource.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(MOCK_TABLE_ENTITY), 100);
          })
      );

      const { container } = render(<PlatformLineage />, {
        wrapper: QueryClientProviderWrapper,
      });

      expect(container.querySelector('[data-testid="loader"]')).toBeTruthy();
    });

    it('should render loader while loading=true', async () => {
      mockGetEntityAPIfromSource.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(MOCK_TABLE_ENTITY), 100);
          })
      );

      const { container } = render(<PlatformLineage />, {
        wrapper: QueryClientProviderWrapper,
      });

      expect(container.querySelector('[data-testid="loader"]')).toBeTruthy();

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should render Lineage after data loads', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should wrap Lineage in the Lineage provider component', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockLineageWrapper).toHaveBeenCalled();
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it.each(['', '?fullscreen=true'])(
      'renders the page header and no breadcrumb for search %j',
      async (search) => {
        mockLocationSearch = search;

        const { container } = render(<PlatformLineage />, {
          wrapper: QueryClientProviderWrapper,
        });

        await waitFor(() => {
          expect(container.textContent).toContain('PageHeader');
        });

        expect(container.textContent).not.toContain('Breadcrumb');
      }
    );
  });

  describe('Navigation Logic', () => {
    const selectFromSearch = async (option?: unknown) => {
      mockLineage.mockImplementation(
        ({ platformHeader }: { platformHeader: React.ReactNode }) => (
          <div>{platformHeader}</div>
        )
      );
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(mockDataAssetAsyncSelectList).toHaveBeenCalled();
      });

      act(() => {
        mockDataAssetAsyncSelectList.mock.calls.at(-1)[0].onChange(option);
      });
    };

    it('navigates to the picked entity lineage with an encoded fqn', async () => {
      await selectFromSearch({
        displayName: 'orders',
        value: 'svc.db."orders & returns"',
        reference: {
          id: 'orders-id',
          type: EntityType.TABLE,
          fullyQualifiedName: 'svc.db."orders & returns"',
        },
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        `/lineage/table/${encodeURIComponent('svc.db."orders & returns"')}`
      );
    });

    it('stays on the current lineage when the selection is cleared', async () => {
      await selectFromSearch(undefined);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // Regression: on /lineage the settings modal used to write into local
  // page state instead of the shared Zustand store the LineageProvider fetch
  // effect listens to, so upstream/downstream depth changes silently produced
  // no network call. These tests pin PlatformLineage to the store's
  // lineageConfig / setLineageConfig so the wiring can't drift back.
  describe('Lineage Store Integration', () => {
    it('should pass the store lineageConfig to LineageConfigModal', async () => {
      mockStoreLineageConfig = {
        upstreamDepth: 5,
        downstreamDepth: 7,
        nodesPerLayer: 42,
        pipelineViewMode: PipelineViewMode.Node,
      };

      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(lastLineageConfigModalProps).toBeDefined();
      });

      expect(lastLineageConfigModalProps?.config).toEqual({
        upstreamDepth: 5,
        downstreamDepth: 7,
        nodesPerLayer: 42,
        pipelineViewMode: PipelineViewMode.Node,
      });
    });

    it('should call store setLineageConfig when modal onSave is invoked', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(lastLineageConfigModalProps).toBeDefined();
      });

      const newConfig = {
        upstreamDepth: 4,
        downstreamDepth: 4,
        nodesPerLayer: 50,
        pipelineViewMode: PipelineViewMode.Node,
      };
      lastLineageConfigModalProps?.onSave(newConfig);

      expect(mockSetLineageConfig).toHaveBeenCalledTimes(1);
      expect(mockSetLineageConfig).toHaveBeenCalledWith(newConfig);
    });

    it('should not call store setLineageConfig when modal is cancelled', async () => {
      render(<PlatformLineage />, { wrapper: QueryClientProviderWrapper });

      await waitFor(() => {
        expect(lastLineageConfigModalProps).toBeDefined();
      });

      lastLineageConfigModalProps?.onCancel();

      expect(mockSetLineageConfig).not.toHaveBeenCalled();
    });
  });
});
