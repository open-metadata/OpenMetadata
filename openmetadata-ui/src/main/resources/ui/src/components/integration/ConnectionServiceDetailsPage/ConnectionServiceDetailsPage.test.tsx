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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { getDatabases } from '../../../rest/databaseAPI';
import { getServiceByFQN } from '../../../rest/serviceAPI';
import { getTopics } from '../../../rest/topicsAPI';
import { EXTENSION_POINTS } from '../../../utils/ExtensionPointTypes';
import ConnectionServiceDetailsPage from './ConnectionServiceDetailsPage';

// ── Mock Data ─────────────────────────────────────────────────────────────

const MOCK_SERVICE = {
  id: 'svc-1',
  name: 'test-service',
  fullyQualifiedName: 'test-service',
  serviceType: 'Mysql',
  connection: { config: {} },
};

// ── Mocks ────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
let mockTabParam: string | undefined = undefined;
let mockServiceCategory = 'databaseServices';
const mockPermissions: { database: Record<string, boolean> } = { database: {} };
const FULL_SERVICE_PERMISSION = { EditAll: true, Delete: true, ViewAll: true };
let mockServicePermission: Record<string, boolean> = FULL_SERVICE_PERMISSION;
const mockTableFilters: { showDeletedTables: boolean; schema?: string } = {
  showDeletedTables: false,
};
const mockSetFilters = jest.fn();
const mockPagingCursor: { cursorType?: string; cursorValue?: string } = {};
const mockHandlePageChange = jest.fn();
// Stable like the real hook's `setPaging`: a fresh function per render would refetch forever.
const mockHandlePagingChange = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({
    serviceCategory: mockServiceCategory,
    fqn: 'test-service',
    tab: mockTabParam,
  }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: mockPermissions,
    getEntityPermissionByFqn: jest.fn(() =>
      Promise.resolve(mockServicePermission)
    ),
  }),
}));

const contributionsByPoint: Record<string, unknown[]> = {};

const mockGetContributions = jest.fn(
  (extensionPointId: string) => contributionsByPoint[extensionPointId] ?? []
);

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: mockGetContributions },
    }),
  })
);

// jest.mock factories are hoisted above module-scope const declarations, so the mock service
// object is inlined here rather than shared with the MOCK_SERVICE const used later in assertions.
jest.mock('../../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn().mockResolvedValue({
    id: 'svc-1',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    serviceType: 'Mysql',
    connection: { config: {} },
    owners: [],
    tags: [],
  }),
  patchService: jest.fn().mockResolvedValue({
    id: 'svc-1',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    serviceType: 'Mysql',
    connection: { config: {} },
  }),
  restoreService: jest.fn().mockResolvedValue({
    id: 'svc-1',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    serviceType: 'Mysql',
    connection: { config: {} },
  }),
  exportDatabaseServiceDetailsInCSV: jest.fn(),
}));

jest.mock('../../../rest/databaseAPI', () => ({
  getDatabases: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../rest/topicsAPI', () => ({
  getTopics: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../rest/dashboardAPI', () => ({
  getDashboards: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../rest/pipelineAPI', () => ({
  getPipelines: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../rest/mlModelAPI', () => ({
  getMlModels: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../rest/storageAPI', () => ({
  getContainers: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../rest/SearchIndexAPI', () => ({
  getSearchIndexes: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../rest/apiCollectionsAPI', () => ({
  getApiCollections: jest.fn().mockResolvedValue({ data: [], paging: {} }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/EntityDisplayUtils', () => ({
  getServiceLogo: jest.fn(() => null),
}));

jest.mock('../../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getEditConnectionPath: jest.fn(() => '/edit-connection'),
  },
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: () => ({
    paging: { total: 0 },
    pageSize: 15,
    currentPage: 1,
    handlePagingChange: mockHandlePagingChange,
    handlePageChange: mockHandlePageChange,
    pagingCursor: mockPagingCursor,
  }),
}));

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: () => ({
    filters: mockTableFilters,
    setFilters: mockSetFilters,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const TabSelect = React.createContext<(key: string) => void>(() => undefined);

  const Tabs = Object.assign(
    ({
      children,
      onSelectionChange,
    }: {
      children: React.ReactNode;
      onSelectionChange?: (key: string) => void;
    }) => (
      <TabSelect.Provider value={onSelectionChange ?? (() => undefined)}>
        {children}
      </TabSelect.Provider>
    ),
    {
      List: ({ children }: { children: React.ReactNode }) => (
        <div role="tablist">{children}</div>
      ),
      Item: ({
        id,
        label,
        badge,
      }: {
        id: string;
        label: React.ReactNode;
        badge?: number;
      }) => {
        const onSelect = React.useContext(TabSelect);

        return (
          <button type="button" onClick={() => onSelect(id)}>
            {label}
            {badge ? (
              <span data-testid={`tab-badge-${id}`}>{badge}</span>
            ) : null}
          </button>
        );
      },
      Panel: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }
  );

  return {
    Badge: ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <span data-testid={testId}>{children}</span>,
    Button: ({
      children,
      isDisabled,
      onClick,
      onPress,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      isDisabled?: boolean;
      onClick?: () => void;
      onPress?: () => void;
      'data-testid'?: string;
    }) => (
      <button
        data-testid={testId}
        disabled={isDisabled}
        type="button"
        onClick={onClick ?? onPress}>
        {children}
      </button>
    ),
    Dropdown: {
      Root: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Popover: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Menu: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Item: ({ label }: { label: string }) => <div>{label}</div>,
    },
    Typography: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
    FeaturedIcon: ({ icon }: { icon?: React.ReactNode }) => <div>{icon}</div>,
    Tabs,
    PageLayout: Object.assign(
      ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      {
        PageHeader: ({
          icon,
          title,
          meta,
          actions,
          subtitle,
          footer,
        }: {
          icon?: React.ReactNode;
          title?: React.ReactNode;
          meta?: React.ReactNode;
          actions?: React.ReactNode;
          subtitle?: React.ReactNode;
          footer?: React.ReactNode;
        }) => (
          <div data-testid="service-header">
            {icon}
            {title}
            {meta}
            {actions}
            {subtitle}
            {footer}
          </div>
        ),
        Content: ({ children }: { children: React.ReactNode }) => (
          <div>{children}</div>
        ),
      }
    ),
  };
});

jest.mock('../../common/HeaderBreadcrumb/HeaderBreadcrumb.component', () => ({
  __esModule: true,
  default: () => <nav data-testid="breadcrumb" />,
}));

jest.mock('../../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('../../common/DeleteWidget/DeleteEntityModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock(
  '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer',
  () => ({ __esModule: true, default: () => null })
);

jest.mock('../../common/TestConnection/TestConnection', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../Modals/EntityNameModal/EntityNameModal.component', () => ({
  __esModule: true,
  default: () => null,
}));

const mockServiceConnectionDetails = jest.fn();

jest.mock(
  '../../Settings/Services/ServiceConnectionDetails/ServiceConnectionDetails.component',
  () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockServiceConnectionDetails(props);

      return null;
    },
  })
);

jest.mock('./DataAssetsTab', () => ({
  __esModule: true,
  default: ({
    data,
    onShowDeletedChange,
  }: {
    data: { name: string }[];
    onShowDeletedChange: (value: boolean) => void;
  }) => (
    <div data-testid="data-assets-tab">
      <button onClick={() => onShowDeletedChange(true)}>show-deleted</button>
      {data.map(({ name }) => (
        <span key={name}>{name}</span>
      ))}
    </div>
  ),
}));

// Exercises the owner/domain/tier editing UI on its own OSS primitives (DomainSelectableList,
// OwnerLabel, TierCard, UserTeamSelectableList) — out of scope for this frame test, and rendering
// it for real here would pull in every icon those primitives import.
jest.mock('./DataAssetHeaderDetailsRow/DataAssetHeaderDetailsRow', () => ({
  __esModule: true,
  default: ({
    canEditDomains,
    canEditOwners,
    canEditTier,
  }: Record<'canEditDomains' | 'canEditOwners' | 'canEditTier', boolean>) => (
    <div
      data-can-edit-domains={String(canEditDomains)}
      data-can-edit-owners={String(canEditOwners)}
      data-can-edit-tier={String(canEditTier)}
      data-testid="entity-meta-strip"
    />
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Settings01: () => null,
}));

jest.mock('../../../constants/constants', () => ({
  INITIAL_PAGING_VALUE: 1,
  INITIAL_TABLE_FILTERS: { showDeletedTables: false },
  pagingObject: {},
}));

jest.mock('fast-json-patch', () => ({ compare: jest.fn(() => []) }));

// Holds each list request open until the test resolves it — by index, in request order — so a
// request can be made to resolve after the one that followed it.
type ResolveList = (names: string[]) => void;

const toListResponse = (names: string[]) => ({
  data: names.map((name) => ({ name })),
  paging: {},
});

const deferListResponses = (count: number): ResolveList[] => {
  const resolvers: ResolveList[] = [];
  const deferred = () =>
    new Promise((resolve) => {
      resolvers.push((names) => resolve(toListResponse(names)));
    });
  for (let i = 0; i < count; i++) {
    (getDatabases as jest.Mock).mockImplementationOnce(deferred);
  }

  return resolvers;
};

// ── Tests ─────────────────────────────────────────────────────────────────

const CONTRIBUTED_TAB = {
  key: 'sql-studio',
  label: 'SQL Studio',
  component: () => <div data-testid="sql-studio-tab" />,
  condition: () => true,
};

describe('ConnectionServiceDetailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabParam = undefined;
    mockServiceCategory = 'databaseServices';
    mockPermissions.database = {};
    mockServicePermission = FULL_SERVICE_PERMISSION;
    mockTableFilters.showDeletedTables = false;
    delete mockTableFilters.schema;
    delete mockPagingCursor.cursorType;
    delete mockPagingCursor.cursorValue;
    Object.keys(contributionsByPoint).forEach(
      (key) => delete contributionsByPoint[key]
    );
  });

  it('resolves a soft-deleted service instead of 404ing on it', async () => {
    await act(async () => {
      render(<ConnectionServiceDetailsPage />);
    });

    // The default include is NonDeleted, which makes a deleted service unfetchable — the page
    // then renders nothing but an error toast, even though its description, owners, tags and
    // data assets all still exist. Classic service details fetches with All for the same reason.
    expect(getServiceByFQN).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ include: 'all' })
    );
  });

  it('defaults to the dataAssets tab when nothing is contributed and there is no tab param', async () => {
    await act(async () => {
      render(<ConnectionServiceDetailsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-tab')).toBeInTheDocument();
    });
  });

  it('falls back to the default tab for an invalid tab param', async () => {
    mockTabParam = 'nonexistent';

    await act(async () => {
      render(<ConnectionServiceDetailsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-tab')).toBeInTheDocument();
    });
  });

  it('switches to the connection tab and updates the URL', async () => {
    await act(async () => {
      render(<ConnectionServiceDetailsPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('data-assets-tab')).toBeInTheDocument();
    });

    // i18n returns literal keys in test env — tab label is "label.connection"
    const connectionBtn = screen.getByRole('button', {
      name: /label\.connection/i,
    });

    fireEvent.click(connectionBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/connections/databaseServices/test-service/connection'
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-connection-button')).toBeInTheDocument();
    });
  });

  describe('read-only user', () => {
    beforeEach(() => {
      mockServicePermission = { ViewAll: true, ViewBasic: true };
    });

    // The tab shows the connection config; classic keeps it to those who may edit it.
    it('does not offer the connection tab', async () => {
      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() =>
        expect(screen.getByTestId('data-assets-tab')).toBeInTheDocument()
      );

      expect(
        screen.queryByRole('button', { name: /label\.connection/i })
      ).not.toBeInTheDocument();
    });

    it('lands a connection deep link on the default tab without showing the config', async () => {
      mockTabParam = 'connection';

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() =>
        expect(screen.getByTestId('data-assets-tab')).toBeInTheDocument()
      );

      expect(
        screen.queryByTestId('edit-connection-button')
      ).not.toBeInTheDocument();
    });
  });

  describe('header edits', () => {
    const renderHeader = async () => {
      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      return screen.findByTestId('entity-meta-strip');
    };

    it('lets a user who may edit the service change its domain, owners and tier', async () => {
      const header = await renderHeader();

      await waitFor(() =>
        expect(header).toHaveAttribute('data-can-edit-owners', 'true')
      );

      expect(header).toHaveAttribute('data-can-edit-domains', 'true');
      expect(header).toHaveAttribute('data-can-edit-tier', 'true');
    });

    it('gates each field on its own permission', async () => {
      mockServicePermission = { ViewAll: true, EditOwners: true };
      const header = await renderHeader();

      await waitFor(() =>
        expect(header).toHaveAttribute('data-can-edit-owners', 'true')
      );

      expect(header).toHaveAttribute('data-can-edit-domains', 'false');
      expect(header).toHaveAttribute('data-can-edit-tier', 'false');
    });

    it('allows no edits on a soft-deleted service', async () => {
      (getServiceByFQN as jest.Mock).mockResolvedValueOnce({
        ...MOCK_SERVICE,
        deleted: true,
      });
      const header = await renderHeader();

      await waitFor(() =>
        expect(screen.getByTestId('deleted-badge')).toBeInTheDocument()
      );

      expect(header).toHaveAttribute('data-can-edit-domains', 'false');
      expect(header).toHaveAttribute('data-can-edit-owners', 'false');
      expect(header).toHaveAttribute('data-can-edit-tier', 'false');
    });
  });

  it('identifies the connection schema by service type, not by FQN', async () => {
    mockTabParam = 'connection';

    await act(async () => {
      render(<ConnectionServiceDetailsPage />);
    });

    await waitFor(() => {
      expect(mockServiceConnectionDetails).toHaveBeenCalledWith(
        expect.objectContaining({ serviceFQN: MOCK_SERVICE.serviceType })
      );
    });

    // The prop is named serviceFQN but feeds the schema-type lookup, so passing the FQN silently
    // resolves no schema and leaves the tab blank.
    expect(mockServiceConnectionDetails).not.toHaveBeenCalledWith(
      expect.objectContaining({
        serviceFQN: MOCK_SERVICE.fullyQualifiedName,
      })
    );
  });

  it('offers delete and not restore on a live service', async () => {
    await act(async () => {
      render(<ConnectionServiceDetailsPage />);
    });

    expect(screen.getByText('label.delete')).toBeInTheDocument();
    expect(screen.queryByText('label.restore')).not.toBeInTheDocument();
  });

  describe('data assets fetch', () => {
    // The table renders owner, domain, data product, tag, tier and certification columns;
    // requesting no fields left every one of them empty.
    const ASSET_FIELDS = 'tags,owners,domains,dataProducts,certification';

    it('requests the fields the databases table renders', async () => {
      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      expect(getDatabases).toHaveBeenCalledWith(
        'test-service',
        ASSET_FIELDS,
        expect.anything(),
        'non-deleted'
      );
    });

    it('also requests usage when the user may view it', async () => {
      mockPermissions.database = { ViewUsage: true };

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      expect(getDatabases).toHaveBeenCalledWith(
        'test-service',
        `${ASSET_FIELDS},usageSummary`,
        expect.anything(),
        'non-deleted'
      );
    });

    it('requests the same fields for other service categories', async () => {
      mockServiceCategory = 'messagingServices';

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      expect(getTopics).toHaveBeenCalledWith(
        'test-service',
        ASSET_FIELDS,
        expect.anything(),
        'non-deleted'
      );
    });

    it('lists the soft-deleted children of a soft-deleted service', async () => {
      (getServiceByFQN as jest.Mock).mockResolvedValueOnce({
        ...MOCK_SERVICE,
        deleted: true,
      });

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      expect(getDatabases).toHaveBeenCalledWith(
        'test-service',
        ASSET_FIELDS,
        expect.anything(),
        'deleted'
      );
    });

    it('lists deleted children of a live service when the deleted switch is on', async () => {
      mockTableFilters.showDeletedTables = true;

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      expect(getDatabases).toHaveBeenCalledWith(
        'test-service',
        ASSET_FIELDS,
        expect.anything(),
        'deleted'
      );
    });

    it('returns to the first page when the deleted switch flips', async () => {
      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      fireEvent.click(await screen.findByText('show-deleted'));

      expect(mockSetFilters).toHaveBeenCalledWith({
        showDeletedTables: 'true',
      });
      expect(mockHandlePageChange).toHaveBeenCalledWith(1, {
        cursorType: null,
        cursorValue: undefined,
      });
    });

    it('fetches the page the URL cursor points at', async () => {
      mockPagingCursor.cursorType = 'after';
      mockPagingCursor.cursorValue = 'cursor-2';

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      // Without this the pager advanced the page number while the rows stayed on page one.
      expect(getDatabases).toHaveBeenCalledWith(
        'test-service',
        ASSET_FIELDS,
        { after: 'cursor-2', limit: 15 },
        'non-deleted'
      );
    });

    it('leaves the list to the search while one is active', async () => {
      mockTableFilters.schema = 'sales';

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      expect(getDatabases).not.toHaveBeenCalled();
    });

    it('keeps the latest page when an earlier request resolves after it', async () => {
      const pendingPages = deferListResponses(2);
      const { rerender } = render(<ConnectionServiceDetailsPage />);
      await waitFor(() => expect(getDatabases).toHaveBeenCalledTimes(1));

      mockPagingCursor.cursorType = 'after';
      mockPagingCursor.cursorValue = 'cursor-2';
      rerender(<ConnectionServiceDetailsPage />);
      await waitFor(() => expect(getDatabases).toHaveBeenCalledTimes(2));

      await act(async () => pendingPages[1](['page-two']));
      await act(async () => pendingPages[0](['page-one']));

      expect(screen.getByText('page-two')).toBeInTheDocument();
      expect(screen.queryByText('page-one')).not.toBeInTheDocument();
    });

    it('drops a list request still in flight once a search takes over', async () => {
      const pendingLists = deferListResponses(1);
      const { rerender } = render(<ConnectionServiceDetailsPage />);
      await waitFor(() => expect(getDatabases).toHaveBeenCalledTimes(1));

      mockTableFilters.schema = 'sales';
      rerender(<ConnectionServiceDetailsPage />);
      await act(async () => pendingLists[0](['unfiltered']));

      expect(screen.getByTestId('data-assets-tab')).toBeInTheDocument();
      expect(screen.queryByText('unfiltered')).not.toBeInTheDocument();
    });
  });

  describe('deleted service', () => {
    const renderDeleted = async () => {
      (getServiceByFQN as jest.Mock).mockResolvedValueOnce({
        ...MOCK_SERVICE,
        deleted: true,
        owners: [],
        tags: [],
      });

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });
    };

    it('marks the service as deleted in the header', async () => {
      await renderDeleted();

      await waitFor(() =>
        expect(screen.getByTestId('deleted-badge')).toBeInTheDocument()
      );
    });

    it('offers restore instead of delete', async () => {
      await renderDeleted();

      await waitFor(() =>
        expect(screen.getByTestId('deleted-badge')).toBeInTheDocument()
      );

      // A soft delete is meant to be reversible; without restore the page is a dead end.
      expect(screen.getByText('label.restore')).toBeInTheDocument();
      expect(screen.queryByText('label.delete')).not.toBeInTheDocument();
    });

    it('has no deleted badge on a live service', async () => {
      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      expect(screen.queryByTestId('deleted-badge')).not.toBeInTheDocument();
    });
  });

  describe('SERVICE_DETAILS_TABS contributions', () => {
    it('renders a contributed tab from the registry', async () => {
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_TABS] = [
        CONTRIBUTED_TAB,
      ];

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /SQL Studio/i })
        ).toBeInTheDocument();
      });
    });

    it('activates a deep-linked contributed tab whose condition depends on the loaded service', async () => {
      // Mirrors QueryRunner: the tab only qualifies once serviceDetails (and its
      // serviceType) have loaded. The deep-link must not get stranded on the default tab.
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_TABS] = [
        {
          ...CONTRIBUTED_TAB,
          condition: (ctx: { serviceDetails?: { serviceType?: string } }) =>
            ctx.serviceDetails?.serviceType === 'Mysql',
        },
      ];
      mockTabParam = 'sql-studio';

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('sql-studio-tab')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('data-assets-tab')).not.toBeInTheDocument();
    });

    it('renders a single contributed tab when the registry returns duplicates', async () => {
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_TABS] = [
        CONTRIBUTED_TAB,
        CONTRIBUTED_TAB,
        CONTRIBUTED_TAB,
      ];

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /SQL Studio/i })
        ).toHaveLength(1);
      });
    });

    it('does not render a contributed tab whose condition fails', async () => {
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_TABS] = [
        { ...CONTRIBUTED_TAB, condition: () => false },
      ];

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-assets-tab')).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('button', { name: /SQL Studio/i })
      ).not.toBeInTheDocument();
    });

    it('sorts a low-order contribution ahead of the dataAssets built-in and makes it the default', async () => {
      // dataAssets is order 40; a contribution ordered 10 (as Collate's future summary tab will be)
      // must land first and become the tab shown when there is no tab param.
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_TABS] = [
        { ...CONTRIBUTED_TAB, order: 10 },
      ];

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('sql-studio-tab')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('data-assets-tab')).not.toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      const sqlStudioIndex = buttons.findIndex((button) =>
        /SQL Studio/i.test(button.textContent ?? '')
      );
      const dataAssetsIndex = buttons.findIndex((button) =>
        /label\.database-plural/i.test(button.textContent ?? '')
      );

      expect(sqlStudioIndex).toBeGreaterThanOrEqual(0);
      expect(dataAssetsIndex).toBeGreaterThan(sqlStudioIndex);
    });
  });

  describe('SERVICE_DETAILS_ACTIONS contributions', () => {
    it('renders a contributed action in the header and invokes it with the page context', async () => {
      const onClick = jest.fn();
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_ACTIONS] = [
        {
          key: 'trigger-autopilot',
          label: 'Trigger AutoPilot',
          onClick,
        },
      ];

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      const actionButton = await screen.findByRole('button', {
        name: 'Trigger AutoPilot',
      });

      fireEvent.click(actionButton);

      expect(onClick).toHaveBeenCalledWith(
        expect.objectContaining({ serviceCategory: 'databaseServices' })
      );
    });

    it('renders a self-rendered action component (with the page context) instead of the default button', async () => {
      const onClick = jest.fn();
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_ACTIONS] = [
        {
          key: 'trigger-autopilot',
          label: 'Trigger AutoPilot',
          onClick,
          component: (context: { serviceCategory?: string }) => (
            <div data-testid="autopilot-action-slot">
              {context.serviceCategory}
            </div>
          ),
        },
      ];

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      const slot = await screen.findByTestId('autopilot-action-slot');

      // The component renders with the page context…
      expect(slot).toHaveTextContent('databaseServices');
      // …and the default label/onClick button is not rendered alongside it.
      expect(
        screen.queryByRole('button', { name: 'Trigger AutoPilot' })
      ).not.toBeInTheDocument();
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not render a contributed action whose condition fails', async () => {
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_ACTIONS] = [
        {
          key: 'trigger-autopilot',
          label: 'Trigger AutoPilot',
          onClick: jest.fn(),
          condition: () => false,
        },
      ];

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-assets-tab')).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('button', { name: 'Trigger AutoPilot' })
      ).not.toBeInTheDocument();
    });
  });

  describe('SERVICE_DETAILS_FOOTER contributions', () => {
    it('renders nothing in the footer region when no plugin contributes one', async () => {
      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      expect(mockGetContributions).toHaveBeenCalledWith(
        EXTENSION_POINTS.SERVICE_DETAILS_FOOTER
      );
      expect(
        screen.queryByTestId('service-details-footer-slot')
      ).not.toBeInTheDocument();
    });

    it('renders a plugin-contributed footer in the reserved region', async () => {
      contributionsByPoint[EXTENSION_POINTS.SERVICE_DETAILS_FOOTER] = [
        {
          key: 'ai-composer',
          component: () => (
            <div data-testid="service-details-footer-slot">composer</div>
          ),
        },
      ];

      await act(async () => {
        render(<ConnectionServiceDetailsPage />);
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('service-details-footer-slot')
        ).toBeInTheDocument();
      });
    });
  });
});
