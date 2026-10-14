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
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { getDashboards, getDataModels } from '../../rest/dashboardAPI';
import { getDatabases } from '../../rest/databaseAPI';
import { getDriveAssets } from '../../rest/driveAPI';
import { searchQuery } from '../../rest/searchAPI';
import {
  AFTER_CURSOR,
  cursorPage,
  CursorRequest,
  expectCursorPaging,
  expectSearchPaging,
  PAGE_ONE_ROW,
  PAGE_TWO_ROW,
  renderPageAt,
  searchQueryPage,
  SEARCH_TERM,
} from '../../test/unit/pagingScenarios';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import ServiceDetailsPage from './ServiceDetailsPage';

// The E2E ran with router transitions off (AppRoot: useTransitions={!isPlaywrightEnv()}).
// With them on, DataModelsTable's URL->currentPage sync effect sees the new page before the
// URL transition commits and snaps the indicator back to page 1.
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');

  return {
    ...actual,
    BrowserRouter: (props: Record<string, unknown>) => (
      <actual.BrowserRouter {...props} useTransitions={false} />
    ),
  };
});

jest.mock(
  '../../components/common/Table/TableV2',
  () => jest.requireActual('../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ))
);

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({ DataAssetsHeader: jest.fn().mockReturnValue(null) })
);

jest.mock('../../components/ServiceInsights/ServiceInsightsTab', () =>
  jest.fn().mockReturnValue(<div data-testid="service-insights-tab" />)
);

jest.mock(
  '../../components/Settings/Services/Ingestion/Ingestion.component',
  () => jest.fn().mockReturnValue(null)
);

jest.mock('../../components/ServiceAgents/hooks/useMetadataAgents', () => ({
  useMetadataAgents: jest
    .fn()
    .mockReturnValue({ agents: [], discoveredCount: 0 }),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest
    .fn()
    .mockImplementation(
      ({ firstPanel }: { firstPanel: { children: ReactNode } }) => (
        <div>{firstPanel.children}</div>
      )
    )
);

jest.mock('../../components/common/EntityDescription/Description', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../../utils/ServiceMainTabContentUtils', () => ({
  getServiceMainTabColumns: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  getAgentsTabWidgets: jest.fn().mockReturnValue({}),
  getServiceExtraInfo: jest.fn().mockReturnValue({}),
  getExtraInfo: jest.fn(),
}));

// LocalUtil's `t` is mocked to echo keys, which would turn the entity tab key into
// `label.database-plural` instead of the `databases` segment the routes use.
jest.mock('../../utils/ServicePureUtils', () => ({
  ...jest.requireActual('../../utils/ServicePureUtils'),
  getCountLabel: jest.fn().mockImplementation(
    (category: string) =>
      ({
        databaseServices: 'Databases',
        dashboardServices: 'Dashboards',
        driveServices: 'Directories',
      }[category])
  ),
}));

jest.mock(
  '../../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: jest.fn().mockReturnValue([]) },
    }),
  })
);

jest.mock('../../context/AirflowStatusProvider/AirflowStatusProvider', () => ({
  useAirflowStatus: jest.fn().mockReturnValue({ isAirflowAvailable: false }),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => {
  const allowed = { ViewAll: true, ViewBasic: true, EditAll: true };

  return {
    usePermissionProvider: jest.fn().mockReturnValue({
      getEntityPermissionByFqn: jest.fn().mockResolvedValue(allowed),
      permissions: { database: allowed, dashboard: allowed },
    }),
  };
});

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn().mockResolvedValue({
    id: 'service-id',
    name: 'svc',
    fullyQualifiedName: 'svc',
    deleted: false,
  }),
}));

jest.mock('../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
  getPipelineServiceHostIp: jest.fn(),
}));

jest.mock('../../rest/applicationAPI', () => ({
  getAiAutomationsByService: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../rest/workflowAPI', () => ({
  getWorkflowInstancesForApplication: jest.fn().mockResolvedValue({ data: [] }),
  getWorkflowInstanceStateById: jest.fn(),
}));

jest.mock('../../rest/databaseAPI', () => ({
  getDatabases: jest.fn(),
}));

jest.mock('../../rest/dashboardAPI', () => ({
  getDashboards: jest.fn(),
  getDataModels: jest.fn(),
}));

jest.mock('../../rest/driveAPI', () => ({
  getDriveAssets: jest.fn(),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

// The manage-menu options call hooks of their own; the menu is not part of paging.
jest.spyOn(entityUtilClassBase, 'getManageExtraOptions').mockReturnValue([]);

const mockGetDatabases = getDatabases as jest.Mock;
const mockGetDashboards = getDashboards as jest.Mock;
const mockGetDataModels = getDataModels as jest.Mock;
const mockGetDriveAssets = getDriveAssets as jest.Mock;
const mockSearchQuery = searchQuery as jest.Mock;

const page = (
  <Routes>
    <Route element={<ServiceDetailsPage />} path={ROUTES.SERVICE_WITH_TAB} />
  </Routes>
);

const driveRequests = (type: EntityType): CursorRequest[] =>
  mockGetDriveAssets.mock.calls
    .filter(([entityType]) => entityType === type)
    .map(([, params]) => params.paging);

const lastDriveRequest = (type: EntityType) => () => driveRequests(type).at(-1);

const searchRequests = (index: SearchIndex) =>
  mockSearchQuery.mock.calls
    .map(([request]) => request)
    .filter((request) => request.searchIndex === index);

const lastSearchRequest = (index: SearchIndex) => () => {
  const request = searchRequests(index).at(-1);

  return (
    request && {
      term: JSON.stringify(request.queryFilter).includes(SEARCH_TERM)
        ? SEARCH_TERM
        : undefined,
      page: request.pageNumber,
    }
  );
};

// Visited tabs stay mounted (inert), so each keeps its own paginator in the DOM.
const activePanel = () =>
  within(
    screen
      .getAllByRole('tabpanel')
      .find((panel) => !panel.hasAttribute('inert')) as HTMLElement
  );

const expectActivePanelOnPage = (pageNumber: number) =>
  expect(activePanel().getByTestId('page-indicator').textContent).toMatch(
    new RegExp(`\\b${pageNumber} label\\.of \\d+`)
  );

const clickTab = (tab: string) =>
  act(async () => {
    fireEvent.click(screen.getByTestId(tab));
  });

const clickActivePanelNext = () =>
  act(async () => {
    fireEvent.click(activePanel().getByTestId('next'));
  });

const hasNoCursor = (request?: CursorRequest & { before?: string }) =>
  !request?.after && !request?.before;

describe('ServiceDetailsPage pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const listResponse = async (
      _fqn: string,
      _fields: string,
      paging: CursorRequest = {}
    ) => cursorPage(paging);
    mockGetDatabases.mockImplementation(listResponse);
    mockGetDashboards.mockImplementation(listResponse);
    mockGetDataModels.mockImplementation(async (params: CursorRequest) =>
      cursorPage(params)
    );
    mockGetDriveAssets.mockImplementation(
      async (_type: EntityType, { paging }: { paging?: CursorRequest }) =>
        cursorPage(paging ?? {})
    );
    mockSearchQuery.mockImplementation(
      async ({ pageNumber }: { pageNumber: number }) =>
        searchQueryPage(pageNumber)
    );
  });

  describe('Service Databases', () => {
    const lastListRequest = () =>
      mockGetDatabases.mock.calls.at(-1)?.[2] as CursorRequest | undefined;

    it('pages databases by cursor and resets to page 1 after visiting insights', async () => {
      await expectCursorPaging({
        url: '/service/databaseServices/svc/databases',
        ui: page,
        lastListRequest,
      });

      await clickActivePanelNext();

      expect(await screen.findByText(PAGE_TWO_ROW)).toBeInTheDocument();

      expectActivePanelOnPage(2);

      await clickTab('insights');

      expect(screen.getByTestId('service-insights-tab')).toBeInTheDocument();

      await clickTab('databases');

      expect(await screen.findByText(PAGE_ONE_ROW)).toBeInTheDocument();
      expect(hasNoCursor(lastListRequest())).toBe(true);

      expectActivePanelOnPage(1);
    });

    it('switches to numbered search paging and back to page 1 on toggling deleted', async () => {
      await expectSearchPaging({
        url: '/service/databaseServices/svc/databases',
        ui: page,
        lastListRequest,
        lastSearchRequest: lastSearchRequest(SearchIndex.DATABASE),
        searchRequestCount: () => searchRequests(SearchIndex.DATABASE).length,
        searchParamName: 'schema',
      });
    });
  });

  describe('Dashboard data models tab', () => {
    it('resets data-model paging to page 1 after visiting the dashboards tab', async () => {
      renderPageAt(
        '/service/dashboardServices/svc/data-model?pageSize=15',
        page
      );

      expect(await screen.findByText(PAGE_ONE_ROW)).toBeInTheDocument();

      await clickActivePanelNext();

      expect(await screen.findByText(PAGE_TWO_ROW)).toBeInTheDocument();

      expectActivePanelOnPage(2);

      const dashboardRequests = mockGetDashboards.mock.calls.length;
      await clickTab('dashboards');
      await waitFor(() =>
        expect(mockGetDashboards.mock.calls.length).toBeGreaterThan(
          dashboardRequests
        )
      );

      await clickTab('data-model');

      await waitFor(() => expectActivePanelOnPage(1));
    });
  });

  describe('Drive Service Directories', () => {
    it('pages directories by cursor and keeps the page across a reload', async () => {
      await expectCursorPaging({
        url: '/service/driveServices/svc/directories?pageSize=15',
        ui: page,
        lastListRequest: lastDriveRequest(EntityType.DIRECTORY),
      });
    });

    it('switches to numbered search paging and back to page 1 on toggling deleted', async () => {
      await expectSearchPaging({
        url: '/service/driveServices/svc/directories?showDeletedTables=false',
        ui: page,
        lastListRequest: lastDriveRequest(EntityType.DIRECTORY),
        lastSearchRequest: lastSearchRequest(SearchIndex.DIRECTORY),
        searchRequestCount: () => searchRequests(SearchIndex.DIRECTORY).length,
        searchParamName: 'schema',
      });
    });
  });

  describe('Drive Service Files', () => {
    it('pages files by cursor and keeps the page across a reload', async () => {
      await expectCursorPaging({
        url: '/service/driveServices/svc/files?pageSize=15',
        ui: page,
        lastListRequest: lastDriveRequest(EntityType.FILE),
      });
    });

    it('switches to numbered search paging and back to page 1 on toggling deleted', async () => {
      await expectSearchPaging({
        url: '/service/driveServices/svc/files?showDeletedTables=false',
        ui: page,
        lastListRequest: lastDriveRequest(EntityType.FILE),
        lastSearchRequest: lastSearchRequest(SearchIndex.FILE),
        searchRequestCount: () => searchRequests(SearchIndex.FILE).length,
        searchParamName: 'file',
      });
    });

    it('resets paging when switching between Files and Spreadsheets and sends cursors only for the active tab', async () => {
      const rendered = renderPageAt(
        '/service/driveServices/svc/files?pageSize=15',
        page
      );

      expect(await screen.findByText(PAGE_ONE_ROW)).toBeInTheDocument();

      expectActivePanelOnPage(1);

      expect(activePanel().getByTestId('next')).toBeEnabled();

      await clickActivePanelNext();

      expect(await screen.findByText(PAGE_TWO_ROW)).toBeInTheDocument();

      expectActivePanelOnPage(2);

      const spreadsheetRequests = driveRequests(EntityType.SPREADSHEET).length;
      await clickTab('spreadsheets');
      await waitFor(() =>
        expect(driveRequests(EntityType.SPREADSHEET).length).toBeGreaterThan(
          spreadsheetRequests
        )
      );

      expect(hasNoCursor(lastDriveRequest(EntityType.SPREADSHEET)())).toBe(
        true
      );

      const fileRequests = driveRequests(EntityType.FILE).length;
      await clickTab('files');
      await waitFor(() =>
        expect(driveRequests(EntityType.FILE).length).toBeGreaterThan(
          fileRequests
        )
      );
      await waitFor(() => expectActivePanelOnPage(1));

      await clickActivePanelNext();

      await waitFor(() => expectActivePanelOnPage(2));

      expect(lastDriveRequest(EntityType.FILE)()?.after).toBe(AFTER_CURSOR);

      mockGetDriveAssets.mockClear();
      rendered.reload();

      expect(await screen.findByText(PAGE_TWO_ROW)).toBeInTheDocument();

      await waitFor(() => {
        expect(driveRequests(EntityType.DIRECTORY).length).toBeGreaterThan(0);
        expect(driveRequests(EntityType.SPREADSHEET).length).toBeGreaterThan(0);
      });

      expect(driveRequests(EntityType.DIRECTORY).every(hasNoCursor)).toBe(true);
      expect(driveRequests(EntityType.SPREADSHEET).every(hasNoCursor)).toBe(
        true
      );

      expectActivePanelOnPage(2);
    });
  });

  describe('Drive Service Spreadsheets', () => {
    it('pages spreadsheets by cursor and keeps the page across a reload', async () => {
      await expectCursorPaging({
        url: '/service/driveServices/svc/spreadsheets?pageSize=15',
        ui: page,
        lastListRequest: lastDriveRequest(EntityType.SPREADSHEET),
      });
    });

    it('switches to numbered search paging and back to page 1 on toggling deleted', async () => {
      await expectSearchPaging({
        url: '/service/driveServices/svc/spreadsheets?showDeletedTables=false',
        ui: page,
        lastListRequest: lastDriveRequest(EntityType.SPREADSHEET),
        lastSearchRequest: lastSearchRequest(SearchIndex.SPREADSHEET),
        searchRequestCount: () =>
          searchRequests(SearchIndex.SPREADSHEET).length,
        searchParamName: 'spreadsheet',
      });
    });
  });
});
