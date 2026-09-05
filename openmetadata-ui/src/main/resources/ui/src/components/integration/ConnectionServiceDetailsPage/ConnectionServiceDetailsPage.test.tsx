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
import { getServiceByFQN } from '../../../rest/serviceAPI';
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
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      EditAll: true,
      Delete: true,
      ViewAll: true,
    }),
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
    handlePagingChange: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useTableFilters', () => ({
  useTableFilters: () => ({
    filters: { showDeletedTables: false },
    setFilters: jest.fn(),
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
  };
});

jest.mock('../../common/HeaderShell/HeaderShell.component', () => ({
  __esModule: true,
  default: ({
    leading,
    title,
    meta,
    actions,
    footer,
    breadcrumb,
  }: {
    leading?: React.ReactNode;
    title?: React.ReactNode;
    meta?: React.ReactNode;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    breadcrumb?: React.ReactNode;
  }) => (
    <div data-testid="service-header">
      {breadcrumb}
      {leading}
      {title}
      {meta}
      {actions}
      {footer}
    </div>
  ),
}));

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
  default: () => <div data-testid="data-assets-tab" />,
}));

// Exercises the owner/domain/tier editing UI on its own OSS primitives (DomainSelectableList,
// OwnerLabel, TierCard, UserTeamSelectableList) — out of scope for this frame test, and rendering
// it for real here would pull in every icon those primitives import.
jest.mock('./DataAssetHeaderDetailsRow/DataAssetHeaderDetailsRow', () => ({
  __esModule: true,
  default: () => <div data-testid="entity-meta-strip" />,
}));

jest.mock('@untitledui/icons', () => ({
  Settings01: () => null,
}));

jest.mock('../../../constants/constants', () => ({
  INITIAL_TABLE_FILTERS: { showDeletedTables: false },
  pagingObject: {},
}));

jest.mock('fast-json-patch', () => ({ compare: jest.fn(() => []) }));

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
