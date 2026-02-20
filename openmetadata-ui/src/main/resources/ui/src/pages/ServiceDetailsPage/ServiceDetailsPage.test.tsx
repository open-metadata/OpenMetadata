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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { noop } from 'lodash';
import { act, ReactNode } from 'react';
import { NextPreviousProps } from '../../components/common/NextPrevious/NextPrevious.interface';
import { TabsLabelProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import { TestConnectionProps } from '../../components/common/TestConnection/TestConnection.interface';
import { DataAssetsHeaderProps } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ServiceInsightsTabProps } from '../../components/ServiceInsights/ServiceInsightsTab.interface';
import { ROUTES } from '../../constants/constants';
import { OPEN_METADATA } from '../../constants/Services.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ClientErrors } from '../../enums/Axios.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { CursorType } from '../../enums/pagination.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { AgentType } from '../../generated/entity/applications/app';
import { WorkflowStatus } from '../../generated/governance/workflows/workflowInstanceState';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { useTableFilters } from '../../hooks/useTableFilters';
import { getApplicationList } from '../../rest/applicationAPI';
import { getDashboards, getDataModels } from '../../rest/dashboardAPI';
import { getDatabases } from '../../rest/databaseAPI';
import { getPipelineServiceHostIp } from '../../rest/ingestionPipelineAPI';
import {
  addServiceFollower,
  getServiceByFQN,
  patchService,
  removeServiceFollower,
  restoreService,
} from '../../rest/serviceAPI';
import { getTopics } from '../../rest/topicsAPI';
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../rest/workflowAPI';
import { getPrioritizedViewPermission } from '../../utils/PermissionsUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { getCountLabel, shouldTestConnection } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import ServiceDetailsPage from './ServiceDetailsPage';

// Mock data
const mockServiceDetails = {
  id: 'test-service-id',
  name: 'test-service',
  displayName: 'Test Service',
  description: 'Test service description',
  serviceType: 'Mysql',
  fullyQualifiedName: 'test-service',
  deleted: false,
  version: 1,
  followers: [],
  owners: [],
  tags: [],
  connection: {
    config: {
      hostPort: 'localhost:3306',
      username: 'test',
    },
  },
};

// Mock all the API calls
jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockServiceDetails)),
  patchService: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockServiceDetails)),
  addServiceFollower: jest.fn().mockImplementation(() =>
    Promise.resolve({
      changeDescription: {
        fieldsAdded: [{ newValue: [{ id: 'test-user-id' }] }],
      },
    })
  ),
  removeServiceFollower: jest.fn().mockImplementation(() =>
    Promise.resolve({
      changeDescription: {
        fieldsDeleted: [{ oldValue: [{ id: 'test-user-id' }] }],
      },
    })
  ),
  restoreService: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ version: 2 })),
}));

jest.mock(
  '../../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: jest.fn().mockReturnValue([]) },
    }),
  })
);

jest.mock('../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
  getPipelineServiceHostIp: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));
jest.mock('../../rest/databaseAPI', () => ({
  getDatabases: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/topicsAPI', () => ({
  getTopics: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/dashboardAPI', () => ({
  getDashboards: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
  getDataModels: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/pipelineAPI', () => ({
  getPipelines: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/mlModelAPI', () => ({
  getMlModels: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/storageAPI', () => ({
  getContainers: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/SearchIndexAPI', () => ({
  getSearchIndexes: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/apiCollectionsAPI', () => ({
  getApiCollections: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/applicationAPI', () => ({
  getApplicationList: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [],
      paging: {
        total: 0,
      },
    })
  ),
}));
jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockImplementation(() =>
    Promise.resolve({
      paging: {
        total: 0,
      },
    })
  ),
}));

jest.mock('../../rest/workflowAPI', () => ({
  getWorkflowInstancesForApplication: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  getWorkflowInstanceStateById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

// Mock hooks
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: {
      id: 'test-user-id',
      name: 'Test User',
      teams: [],
    },
  })),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  useLocation: () => ({
    pathname: '/mock-path',
    search: '',
    state: undefined,
    key: '',
    hash: '',
  }),
  MemoryRouter: ({ children }: { children: ReactNode }) => (
    <div data-testid="memory-router">{children}</div>
  ),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({
    fqn: 'test-service',
  })),
}));

jest.mock('../../hooks/paging/usePaging', () => {
  const mockPaging = { total: 10 };
  const mockPagingCursor = {
    cursorType: undefined,
    cursorValue: undefined,
    currentPage: '1',
    pageSize: 10,
  };

  return {
    usePaging: jest.fn().mockImplementation(() => ({
      paging: mockPaging,
      pageSize: 10,
      currentPage: 1,
      pagingCursor: mockPagingCursor,
      showPagination: true,
      handlePageChange: jest.fn(),
      handlePagingChange: jest.fn(),
      handlePageSizeChange: jest.fn(),
    })),
  };
});

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({ isAdminUser: true })),
}));

jest.mock('../../context/AirflowStatusProvider/AirflowStatusProvider', () => ({
  useAirflowStatus: jest.fn().mockImplementation(() => ({
    isAirflowAvailable: true,
    platform: 'airflow',
  })),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ ViewAll: true, EditAll: true, Create: true })
      ),
    permissions: {
      database: { ViewAll: true, EditAll: true },
      dashboard: { ViewAll: true, EditAll: true },
      pipeline: { ViewAll: true, EditAll: true },
    },
  })),
}));

// Mock components
jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(
      ({ children, pageTitle }: { children: ReactNode; pageTitle: string }) => (
        <div data-testid="page-layout" title={pageTitle}>
          {children}
        </div>
      )
    )
);

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: ({
      onFollowClick,
      onDisplayNameUpdate,
      onRestoreDataAsset,
      disableRunAgentsButton,
      disableRunAgentsButtonMessage,
    }: DataAssetsHeaderProps) => (
      <div data-testid="data-assets-header">
        <button data-testid="follow-button" onClick={onFollowClick}>
          Follow
        </button>
        <button
          data-testid="update-name-button"
          onClick={() =>
            onDisplayNameUpdate({ name: 'name', displayName: 'Updated Name' })
          }>
          Update Name
        </button>
        <button data-testid="restore-button" onClick={onRestoreDataAsset}>
          Restore
        </button>
        <button
          data-testid="run-agents"
          disabled={disableRunAgentsButton}
          title={disableRunAgentsButtonMessage}>
          Run Agents
        </button>
      </div>
    ),
  })
);

jest.mock(
  '../../components/Settings/Services/Ingestion/Ingestion.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="ingestion-component">Ingestion</div>
      ))
);

jest.mock(
  '../../components/Settings/Services/ServiceConnectionDetails/ServiceConnectionDetails.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="service-connection-details">
          ServiceConnectionDetails
        </div>
      ))
);

jest.mock('../../components/ServiceInsights/ServiceInsightsTab', () =>
  jest
    .fn()
    .mockImplementation(({ serviceDetails }: ServiceInsightsTabProps) => (
      <div data-testid="service-insights-tab">
        <span data-testid="insights-service-id">{serviceDetails?.id}</span>
      </div>
    ))
);

jest.mock('./ServiceMainTabContent', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="service-main-tab-content">ServiceMainTabContent</div>
    ))
);

jest.mock(
  '../../components/Dashboard/DataModel/DataModels/DataModelsTable',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="data-model-table">Data Model Table</div>
      ))
);

jest.mock('../../components/common/TestConnection/TestConnection', () =>
  jest
    .fn()
    .mockImplementation(
      ({ serviceCategory, extraInfo }: TestConnectionProps) => (
        <div data-testid="test-connection">
          <span data-testid="test-connection-category">{serviceCategory}</span>
          <span data-testid="test-connection-extra-info">{extraInfo}</span>
        </div>
      )
    )
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="error-placeholder">ErrorPlaceholder</div>
    ))
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="loader">Loader</div>)
);

// Additional missing component mocks
jest.mock(
  '../../components/common/AirflowMessageBanner/AirflowMessageBanner',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="airflow-message-banner">Airflow Message Banner</div>
      ))
);

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest
    .fn()
    .mockImplementation(({ name }: TabsLabelProps) => (
      <div data-testid="tabs-label">{name}</div>
    ))
);

jest.mock('../../components/common/NextPrevious/NextPrevious', () =>
  jest.fn().mockImplementation(({ pagingHandler }: NextPreviousProps) => (
    <div data-testid="next-previous">
      <button
        onClick={() =>
          pagingHandler({ cursorType: CursorType.BEFORE, currentPage: 1 })
        }>
        Previous
      </button>
      <button
        onClick={() =>
          pagingHandler({ cursorType: CursorType.AFTER, currentPage: 2 })
        }>
        Next
      </button>
    </div>
  ))
);

// Mock utils
jest.mock('../../utils/ServiceUtils', () => ({
  getCountLabel: jest.fn().mockReturnValue('Databases'),
  getEntityTypeFromServiceCategory: jest.fn().mockReturnValue('database'),
  getResourceEntityFromServiceCategory: jest
    .fn()
    .mockReturnValue('databaseService'),
  getServiceDisplayNameQueryFilter: jest.fn().mockReturnValue(''),
  getServiceRouteFromServiceType: jest.fn().mockReturnValue('database'),
  shouldTestConnection: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  getAgentsTabWidgets: jest.fn().mockImplementation(() => ({
    CollateAIAgentsWidget: jest
      .fn()
      .mockImplementation(() => <div>CollateAIAgentsWidget</div>),
  })),
  getServiceExtraInfo: jest.fn().mockReturnValue({}),
  getExtraInfo: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../utils/EntityUtilClassBase', () => ({
  getManageExtraOptions: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getEntityMissingError: jest.fn().mockReturnValue('Entity not found'),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getEditConnectionPath: jest.fn().mockReturnValue('/edit-connection'),
  getServiceDetailsPath: jest.fn().mockReturnValue('/service-details'),
  getServiceVersionPath: jest.fn().mockReturnValue('/service-version'),
  getSettingPath: jest.fn().mockReturnValue('/settings'),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../utils/SwTokenStorageUtils', () => ({
  removeAutoPilotStatus: jest.fn(),
}));

jest.mock('../../utils/TagsUtils', () => ({
  updateTierTag: jest.fn(),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    serviceCategory: ServiceCategory.DATABASE_SERVICES,
    tab: EntityTabs.INSIGHTS,
  })),
}));

// Additional utility mocks for project-local modules
jest.mock('../../utils/DatasetDetailsUtils', () => ({
  commonTableFields: 'mockedFields',
}));

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  getCurrentMillis: jest.fn().mockImplementation(() => 1715404800000),
  getDayAgoStartGMTinMillis: jest.fn().mockImplementation(() => 1715318400000),
  getEpochMillisForPastDays: jest
    .fn()
    .mockImplementation((days) => 1715404800000 - days * 24 * 60 * 60 * 1000),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: { ViewAll: false, EditAll: false },
  getPrioritizedViewPermission: jest.fn().mockReturnValue(true),
}));

// Additional utility mocks
jest.mock('../../utils/StringsUtils', () => ({
  escapeESReservedCharacters: jest.fn().mockImplementation((text) => text),
  getEncodedFqn: jest.fn().mockImplementation((text) => text),
}));

const mockSetFilters = jest.fn();
jest.mock('../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockImplementation(() => ({
    filters: {},
    setFilters: mockSetFilters,
  })),
}));

describe('ServiceDetailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = async (props = {}) => {
    return await act(async () => {
      render(
        <MemoryRouter>
          <ServiceDetailsPage {...props} />
        </MemoryRouter>
      );
    });
  };

  describe('Component Rendering', () => {
    it('should render loading state initially', async () => {
      render(
        <MemoryRouter>
          <ServiceDetailsPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should pass service name as pageTitle to PageLayoutV1', async () => {
      await renderComponent();

      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'Test Service',
        }),
        expect.anything()
      );
    });

    it('should render service details when loaded', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('data-assets-header')).toBeInTheDocument();
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });

    it('should render error placeholder when service is not found', async () => {
      (getServiceByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Not found'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });
    });

    it('should navigate to forbidden page when access is denied', async () => {
      const mockNavigate = jest.fn();
      (useNavigate as jest.Mock).mockReturnValue(mockNavigate);

      const error = new Error('Forbidden') as AxiosError;
      error.response = { status: ClientErrors.FORBIDDEN } as AxiosResponse;
      (getServiceByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(error)
      );

      await renderComponent();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FORBIDDEN, {
          replace: true,
        });
      });
    });
  });

  describe('Service Details Management', () => {
    it('should fetch service details on mount', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(getServiceByFQN).toHaveBeenCalledWith(
          ServiceCategory.DATABASE_SERVICES,
          'test-service',
          {
            fields: 'owners,tags,followers,dataProducts,domains',
            include: 'all',
          }
        );
      });
    });

    it('should fetch service permissions on mount', async () => {
      const mockGetEntityPermissionByFqn = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ ViewAll: true, EditAll: true, Create: true })
        );

      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
        permissions: {
          database: { ViewAll: true, EditAll: true },
          dashboard: { ViewAll: true, EditAll: true },
          pipeline: { ViewAll: true, EditAll: true },
        },
      }));

      await renderComponent();

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
          'databaseService',
          'test-service'
        );
      });
    });

    it('should update service display name', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });

      const updateNameButton = screen.getByTestId('update-name-button');
      fireEvent.click(updateNameButton);

      await waitFor(() => {
        expect(patchService).toHaveBeenCalledWith(
          ServiceCategory.DATABASE_SERVICES,
          'test-service-id',
          expect.any(Array)
        );
      });
    });

    it('should handle display name update error', async () => {
      (patchService as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Update failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });

      const updateNameButton = screen.getByTestId('update-name-button');
      fireEvent.click(updateNameButton);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Follow/Unfollow Functionality', () => {
    it('should follow service successfully', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });

      const followButton = screen.getByTestId('follow-button');
      fireEvent.click(followButton);

      await waitFor(() => {
        expect(addServiceFollower).toHaveBeenCalledWith(
          'test-service-id',
          'test-user-id'
        );
      });
    });

    it('should unfollow service successfully', async () => {
      // Mock service with current user as follower
      const serviceWithFollower = {
        ...mockServiceDetails,
        followers: [{ id: 'test-user-id' }],
      };
      (getServiceByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve(serviceWithFollower)
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });

      const followButton = screen.getByTestId('follow-button');
      fireEvent.click(followButton);

      await waitFor(() => {
        expect(removeServiceFollower).toHaveBeenCalledWith(
          'test-service-id',
          'test-user-id'
        );
      });
    });

    it('should handle follow error', async () => {
      (addServiceFollower as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Follow failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });

      const followButton = screen.getByTestId('follow-button');
      fireEvent.click(followButton);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          new Error('Follow failed'),
          'server.entity-follow-error'
        );
      });
    });
  });

  describe('Service Restoration', () => {
    it('should restore service successfully', async () => {
      const deletedService = {
        ...mockServiceDetails,
        deleted: true,
      };
      (getServiceByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve(deletedService)
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });

      const restoreButton = screen.getByTestId('restore-button');
      fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(restoreService).toHaveBeenCalledWith(
          ServiceCategory.DATABASE_SERVICES,
          'test-service-id'
        );
      });
    });

    it('should handle restore error', async () => {
      (restoreService as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Restore failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });

      const restoreButton = screen.getByTestId('restore-button');
      fireEvent.click(restoreButton);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          new Error('Restore failed'),
          'message.restore-entities-error'
        );
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch databases for database service', async () => {
      (getDatabases as jest.Mock).mockResolvedValue({
        data: [{ id: 'db1', name: 'Database 1' }],
        paging: { total: 1 },
      });

      await renderComponent();

      await waitFor(() => {
        expect(getDatabases).toHaveBeenCalled();
      });
    });

    it('should include usageSummary in database fields when ViewUsage is allowed', async () => {
      (getPrioritizedViewPermission as jest.Mock).mockReturnValue(true);
      (getDatabases as jest.Mock).mockResolvedValue({
        data: [{ id: 'db1', name: 'Database 1' }],
        paging: { total: 1 },
      });

      await renderComponent();

      await waitFor(() => {
        expect(getDatabases).toHaveBeenCalled();
      });

      const fields = (getDatabases as jest.Mock).mock.calls[0][1];

      expect(fields).toContain('usageSummary');
    });

    it('should exclude usageSummary from database fields when ViewUsage is denied', async () => {
      (getPrioritizedViewPermission as jest.Mock).mockReturnValue(false);
      (getDatabases as jest.Mock).mockResolvedValue({
        data: [{ id: 'db1', name: 'Database 1' }],
        paging: { total: 1 },
      });

      await renderComponent();

      await waitFor(() => {
        expect(getDatabases).toHaveBeenCalled();
      });

      const fields = (getDatabases as jest.Mock).mock.calls[0][1];

      expect(fields).not.toContain('usageSummary');
    });

    it('should fetch topics for messaging service', async () => {
      (getTopics as jest.Mock).mockResolvedValue({
        data: [{ id: 'topic1', name: 'Topic 1' }],
        paging: { total: 1 },
      });

      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: ServiceCategory.MESSAGING_SERVICES,
        tab: EntityTabs.INSIGHTS,
      });

      await renderComponent();

      await waitFor(() => {
        expect(getTopics).toHaveBeenCalled();
      });
    });

    it('should fetch dashboards for dashboard service', async () => {
      (getDashboards as jest.Mock).mockResolvedValue({
        data: [{ id: 'dashboard1', name: 'Dashboard 1' }],
        paging: { total: 1 },
      });

      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
        tab: EntityTabs.INSIGHTS,
      });

      await renderComponent();

      await waitFor(() => {
        expect(getDashboards).toHaveBeenCalled();
      });
    });
  });

  describe('Data Model Tab Count', () => {
    beforeEach(() => {
      // Set up dashboard service context
      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
        tab: EntityTabs.DATA_Model,
      });
    });

    it('should fetch data model count with different values for deleted and non-deleted items', async () => {
      // Mock getDataModels to return different counts based on include parameter
      (getDataModels as jest.Mock).mockImplementation((params) => {
        const isDeleted = params.include === Include.Deleted;

        return Promise.resolve({
          paging: {
            total: isDeleted ? 5 : 10, // 5 deleted, 10 non-deleted
          },
        });
      });

      await renderComponent();

      // Wait for initial load with non-deleted items
      await waitFor(() => {
        expect(getDataModels).toHaveBeenCalledWith({
          service: 'test-service',
          fields: 'mockedFields, followers',
          include: Include.NonDeleted,
          limit: 0,
        });
      });

      // Verify initial count (non-deleted)
      expect(getDataModels).toHaveBeenCalledTimes(1);

      // Clear previous calls to track new ones
      jest.clearAllMocks();

      // Mock getServiceByFQN to return service with deleted: true to trigger showDeleted: true
      const deletedService = {
        ...mockServiceDetails,
        deleted: true,
      };
      (getServiceByFQN as jest.Mock).mockResolvedValue(deletedService);
      (useTableFilters as jest.Mock).mockReturnValue({
        filters: { showDeletedTables: true },
        setFilters: jest.fn(),
      });

      // Re-render component to trigger the showDeleted change
      await renderComponent();

      // Wait for data model fetch with deleted items
      await waitFor(() => {
        expect(getDataModels).toHaveBeenCalledWith({
          service: 'test-service',
          fields: 'mockedFields, followers',
          include: Include.Deleted,
          limit: 0,
        });
      });
    });

    it('should update data model count when toggling between deleted and non-deleted items', async () => {
      // Mock getDataModels to return different counts
      (getDataModels as jest.Mock).mockImplementation((params) => {
        const isDeleted = params.include === Include.Deleted;

        return Promise.resolve({
          paging: {
            total: isDeleted ? 3 : 7, // Different counts for deleted vs non-deleted
          },
        });
      });

      (useTableFilters as jest.Mock).mockReturnValue({
        filters: { showDeletedTables: false },
        setFilters: jest.fn(),
      });

      await renderComponent();

      // Wait for initial fetch (non-deleted by default)
      await waitFor(() => {
        expect(getDataModels).toHaveBeenCalledWith(
          expect.objectContaining({
            include: Include.NonDeleted,
            limit: 0,
          })
        );
      });

      // Verify initial calls were made (may be called multiple times during initial render)
      expect(getDataModels).toHaveBeenCalled();

      // Clear previous calls and simulate deleted service to trigger showDeleted: true
      jest.clearAllMocks();

      const deletedService = {
        ...mockServiceDetails,
        deleted: true,
      };
      (getServiceByFQN as jest.Mock).mockResolvedValue(deletedService);
      (useTableFilters as jest.Mock).mockReturnValue({
        filters: { showDeletedTables: true },
        setFilters: jest.fn(),
      });

      // Re-render component to trigger the showDeleted change
      await renderComponent();

      // Wait for fetch with deleted items
      await waitFor(() => {
        expect(getDataModels).toHaveBeenCalledWith(
          expect.objectContaining({
            include: Include.Deleted,
            limit: 0,
          })
        );
      });

      // Verify the deleted call was made
      expect(getDataModels).toHaveBeenCalled();
    });
  });

  describe('Airflow Integration', () => {
    it('should fetch host IP when airflow is available', async () => {
      (getPipelineServiceHostIp as jest.Mock).mockResolvedValue({
        status: 200,
        data: { ip: '192.168.1.1' },
      });

      await renderComponent();

      await waitFor(() => {
        expect(getPipelineServiceHostIp).toHaveBeenCalled();
      });
    });

    it('should handle host IP fetch error gracefully', async () => {
      (getPipelineServiceHostIp as jest.Mock).mockRejectedValue(
        new Error('Host IP fetch failed')
      );

      await renderComponent();

      await waitFor(() => {
        expect(getPipelineServiceHostIp).toHaveBeenCalled();
      });
    });
  });

  describe('Service Category Specific Behavior', () => {
    it('should render data model tab for dashboard services', async () => {
      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
        tab: EntityTabs.DATA_Model,
      });

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('data-model-table')).toBeInTheDocument();
      });
    });

    it('should render agents tab for metadata services', async () => {
      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: ServiceCategory.METADATA_SERVICES,
        tab: EntityTabs.AGENTS,
      });

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('ingestion-component')).toBeInTheDocument();
      });
    });
  });

  describe('Workflow Status Management', () => {
    it('should fetch workflow status for applications', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          data: [{ id: 'workflow1', status: 'running' }],
        })
      );

      await renderComponent();

      await waitFor(() => {
        expect(getWorkflowInstancesForApplication).toHaveBeenCalled();
      });
    });

    it('should handle workflow status fetch error', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.reject(new Error('Workflow fetch failed'))
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty service details', async () => {
      (getServiceByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({})
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });
    });

    it('should handle undefined service category', async () => {
      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: undefined,
        tab: EntityTabs.INSIGHTS,
      });

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });
    });

    it('should handle missing current user', async () => {
      (useApplicationStore as unknown as jest.Mock).mockReturnValue({
        currentUser: null,
      });

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('service-page')).toBeInTheDocument();
      });
    });
  });

  describe('AutoPilot Trigger', () => {
    it('Should disable the AutoPilot Trigger when the isWorkflowStatusLoading is true', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(
        () => new Promise(noop)
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('run-agents')).toBeDisabled();
      });
    });

    it('Should enable the AutoPilot Trigger when the isWorkflowStatusLoading is false and the workflow status is not available', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.resolve({})
      );

      await renderComponent();

      expect(screen.getByTestId('run-agents')).toBeEnabled();
    });

    it('Should disable the AutoPilot Trigger when the isWorkflowStatusLoading is false and the workflow status is running', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          data: [{ id: 'workflow1', status: WorkflowStatus.Running }],
        })
      );
      (getWorkflowInstanceStateById as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: [] })
      );

      await renderComponent();

      expect(screen.getByTestId('run-agents')).toBeDisabled();
    });

    it('Should enable the AutoPilot Trigger when the isWorkflowStatusLoading is false and the workflow status is not running', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          data: [{ id: 'workflow1', status: WorkflowStatus.Failure }],
        })
      );

      await renderComponent();

      expect(screen.getByTestId('run-agents')).toBeEnabled();
    });

    it('Should return disableRunAgentsButton as true and disableRunAgentsButtonMessage as undefined when workflow is loading', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(
        () => new Promise(noop)
      );

      await renderComponent();

      await waitFor(() => {
        const runAgentsButton = screen.getByTestId('run-agents');

        expect(runAgentsButton).toBeDisabled();
        expect(runAgentsButton).not.toHaveAttribute('title');
      });
    });

    it('Should return disableRunAgentsButton as false and disableRunAgentsButtonMessage as undefined when workflow status is empty', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.resolve({})
      );

      await renderComponent();

      await waitFor(() => {
        const runAgentsButton = screen.getByTestId('run-agents');

        expect(runAgentsButton).toBeEnabled();
        expect(runAgentsButton).not.toHaveAttribute('title');
      });
    });

    it('Should return disableRunAgentsButton as true and disableRunAgentsButtonMessage with message when workflow is running', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          data: [{ id: 'workflow1', status: WorkflowStatus.Running }],
        })
      );
      (getWorkflowInstanceStateById as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          mainInstanceState: { status: WorkflowStatus.Running },
        })
      );

      await renderComponent();

      await waitFor(() => {
        const runAgentsButton = screen.getByTestId('run-agents');

        expect(runAgentsButton).toBeDisabled();
        expect(runAgentsButton).toHaveAttribute(
          'title',
          'message.auto-pilot-already-running'
        );
      });
    });

    it('Should return disableRunAgentsButton as false and disableRunAgentsButtonMessage with message as undefined when workflow has failed', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          data: [{ id: 'workflow1', status: WorkflowStatus.Failure }],
        })
      );
      (getWorkflowInstanceStateById as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          mainInstanceState: { status: WorkflowStatus.Failure },
        })
      );

      await renderComponent();

      await waitFor(() => {
        const runAgentsButton = screen.getByTestId('run-agents');

        expect(runAgentsButton).toBeEnabled();
        expect(runAgentsButton).not.toHaveAttribute('title');
      });
    });

    it('Should return disableRunAgentsButton as false when workflow has completed', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          data: [{ id: 'workflow1', status: WorkflowStatus.Finished }],
        })
      );
      (getWorkflowInstanceStateById as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          mainInstanceState: { status: WorkflowStatus.Finished },
        })
      );

      await renderComponent();

      await waitFor(() => {
        const runAgentsButton = screen.getByTestId('run-agents');

        expect(runAgentsButton).toBeEnabled();
      });
    });
  });

  describe('Test connection tab', () => {
    const mockServiceUtil = serviceUtilClassBase as jest.Mocked<
      typeof serviceUtilClassBase
    >;

    it('should pass ingestion runner name to TestConnection component', async () => {
      const ingestionRunnerName = 'IngestionRunner1';
      (mockServiceUtil.getServiceExtraInfo as jest.Mock).mockReturnValue({
        name: ingestionRunnerName,
      });
      (useRequiredParams as jest.Mock).mockImplementation(() => ({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        tab: EntityTabs.CONNECTION,
      }));
      (getServiceByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ...mockServiceDetails,
          ingestionRunnerName,
        })
      );

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('test-connection')).toBeInTheDocument();
        expect(
          screen.getByTestId('test-connection-extra-info')
        ).toHaveTextContent(ingestionRunnerName);
      });
    });
  });

  describe('Utility Function Integration', () => {
    it('should use correct service utilities', async () => {
      (getPipelineServiceHostIp as jest.Mock).mockResolvedValue({});
      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        tab: EntityTabs.INSIGHTS,
      });

      await renderComponent();

      await waitFor(() => {
        expect(getCountLabel).toHaveBeenCalledWith(
          ServiceCategory.DATABASE_SERVICES
        );
        expect(shouldTestConnection).toHaveBeenCalledWith(
          ServiceCategory.DATABASE_SERVICES
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service fetch error', async () => {
      // Mock service fetch to fail with a generic error
      (getServiceByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Service not found'))
      );

      await renderComponent();

      // The component should show error placeholder when service fetch fails
      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });
    });
  });

  describe('OpenMetadata Service Handling', () => {
    it('should handle OpenMetadata service correctly', async () => {
      (useFqn as jest.Mock).mockImplementation(() => ({
        fqn: OPEN_METADATA,
      }));
      const mockGetEntityPermissionByFqn = jest
        .fn()
        .mockImplementation(() => Promise.resolve({}));

      (usePermissionProvider as jest.Mock).mockImplementation(() => ({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
        permissions: {
          database: {},
          dashboard: {},
          pipeline: {},
        },
      }));

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });

      // Should not fetch permissions for OpenMetadata service
      expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
    });
  });

  describe('Collate AI Agents Functionality', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();

      // Set up database service context (CollateAI widgets are only supported for DB services)
      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        tab: EntityTabs.AGENTS,
      });
    });

    it('should call getApplicationList with multiple agent types', async () => {
      const mockAgentsData = [
        {
          id: 'agent1',
          name: 'CollateAI Agent 1',
          agentType: AgentType.CollateAI,
        },
        {
          id: 'agent2',
          name: 'CollateAI Quality Agent',
          agentType: AgentType.CollateAIQualityAgent,
        },
        {
          id: 'agent3',
          name: 'CollateAI Tier Agent',
          agentType: AgentType.CollateAITierAgent,
        },
      ];

      (getApplicationList as jest.Mock).mockResolvedValue({
        data: mockAgentsData,
        paging: { total: 3 },
      });

      await renderComponent();

      // Wait for the agents to be fetched
      await waitFor(() => {
        expect(getApplicationList).toHaveBeenCalledWith({
          agentType: [
            AgentType.CollateAI,
            AgentType.CollateAIQualityAgent,
            AgentType.CollateAITierAgent,
          ],
          limit: 10,
        });
      });
    });

    it('should handle agent list fetching with paging parameters', async () => {
      const mockPagingInfo = {
        after: 'cursor123',
        before: 'cursor456',
        limit: 25,
      };

      (getApplicationList as jest.Mock).mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      // We need to mock usePaging specifically for collate agent paging
      (usePaging as jest.Mock)
        .mockReturnValueOnce({
          // ingestionPagingInfo
          paging: {},
          pageSize: 15,
          pagingCursor: {},
          handlePageChange: jest.fn(),
          handlePagingChange: jest.fn(),
        })
        .mockReturnValueOnce({
          // collateAgentPagingInfo
          paging: mockPagingInfo,
          pageSize: 25,
          pagingCursor: {},
          handlePageChange: jest.fn(),
          handlePagingChange: jest.fn(),
        })
        .mockReturnValue({
          // Default for other usages
          paging: {},
          pageSize: 15,
          pagingCursor: {},
          handlePageChange: jest.fn(),
          handlePagingChange: jest.fn(),
        });

      await renderComponent();

      await waitFor(() => {
        expect(getApplicationList).toHaveBeenCalledWith(
          expect.objectContaining({
            agentType: [
              AgentType.CollateAI,
              AgentType.CollateAIQualityAgent,
              AgentType.CollateAITierAgent,
            ],
          })
        );
      });
    });

    it('should handle errors during agent list fetching', async () => {
      const mockError = new Error('Failed to fetch agents');
      (getApplicationList as jest.Mock).mockRejectedValue(mockError);

      await renderComponent();

      await waitFor(() => {
        expect(getApplicationList).toHaveBeenCalled();
      });

      // The showErrorToast should be called with the error
      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
      });
    });

    it('should not fetch agents for non-database services', async () => {
      // Set up messaging service context (CollateAI widgets not supported)
      (useRequiredParams as jest.Mock).mockReturnValue({
        serviceCategory: ServiceCategory.MESSAGING_SERVICES,
        tab: EntityTabs.INSIGHTS,
      });

      await renderComponent();

      // Should not call getApplicationList for non-DB services
      expect(getApplicationList).not.toHaveBeenCalled();
    });

    it('should properly handle CollateAI widget support check', async () => {
      // Mock serviceUtilClassBase.getAgentsTabWidgets to return CollateAI widget
      const mockCollateAIWidget = jest
        .fn()
        .mockReturnValue(<div data-testid="collate-ai-widget" />);

      (serviceUtilClassBase.getAgentsTabWidgets as jest.Mock).mockReturnValue({
        CollateAIAgentsWidget: mockCollateAIWidget,
      });

      await renderComponent();

      // For database services, the CollateAI widget should be supported
      await waitFor(() => {
        expect(getApplicationList).toHaveBeenCalled();
      });
    });

    it('should handle empty agent list response', async () => {
      (getApplicationList as jest.Mock).mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      await renderComponent();

      await waitFor(() => {
        expect(getApplicationList).toHaveBeenCalledWith({
          agentType: [
            AgentType.CollateAI,
            AgentType.CollateAIQualityAgent,
            AgentType.CollateAITierAgent,
          ],
          limit: 15,
        });
      });
    });

    it('should call fetchCollateAgentsList with correct agent types instead of single agent type', async () => {
      // This test ensures the refactor from single agentType to array is correct
      const expectedAgentTypes = [
        AgentType.CollateAI,
        AgentType.CollateAIQualityAgent,
        AgentType.CollateAITierAgent,
      ];

      (getApplicationList as jest.Mock).mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      await renderComponent();

      await waitFor(() => {
        expect(getApplicationList).toHaveBeenCalledWith(
          expect.objectContaining({
            agentType: expectedAgentTypes,
          })
        );
      });

      // Ensure it was NOT called with the old single agent type format
      expect(getApplicationList).not.toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: AgentType.CollateAI, // Single value (old format)
        })
      );
    });
  });
});
