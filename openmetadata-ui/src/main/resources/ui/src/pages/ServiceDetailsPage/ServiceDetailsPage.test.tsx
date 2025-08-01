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
import { AxiosError } from 'axios';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { noop } from 'lodash';
import { act } from 'react';
import { ROUTES } from '../../constants/constants';
import { OPEN_METADATA } from '../../constants/Services.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ClientErrors } from '../../enums/Axios.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { WorkflowStatus } from '../../generated/governance/workflows/workflowInstanceState';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { getDashboards } from '../../rest/dashboardAPI';
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
import { getEntityName } from '../../utils/EntityUtils';
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
  MemoryRouter: ({ children }: any) => (
    <div data-testid="memory-router">{children}</div>
  ),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({
    fqn: 'test-service',
  })),
}));

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockImplementation(() => ({
    paging: { total: 10, pageSize: 10, currentPage: 1 },
    pageSize: 10,
    currentPage: 1,
    pagingCursor: { before: null, after: null },
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
  })),
}));

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
  })),
}));

// Mock components
jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children, pageTitle }: any) => (
    <div data-testid="page-layout" title={pageTitle}>
      {children}
    </div>
  ))
);

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: ({
      onFollowClick,
      onDisplayNameUpdate,
      onRestoreDataAsset,
      disableRunAgentsButton,
    }: any) => (
      <div data-testid="data-assets-header">
        <button data-testid="follow-button" onClick={onFollowClick}>
          Follow
        </button>
        <button
          data-testid="update-name-button"
          onClick={() => onDisplayNameUpdate({ displayName: 'Updated Name' })}>
          Update Name
        </button>
        <button data-testid="restore-button" onClick={onRestoreDataAsset}>
          Restore
        </button>
        <button data-testid="run-agents" disabled={disableRunAgentsButton}>
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
  jest.fn().mockImplementation(({ serviceDetails }: any) => (
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
  jest.fn().mockImplementation(({ serviceCategory }: any) => (
    <div data-testid="test-connection">
      <span data-testid="test-connection-category">{serviceCategory}</span>
    </div>
  ))
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
    .mockImplementation(({ name }: any) => (
      <div data-testid="tabs-label">{name}</div>
    ))
);

jest.mock('../../components/common/NextPrevious/NextPrevious', () =>
  jest.fn().mockImplementation(({ pagingHandler }: any) => (
    <div data-testid="next-previous">
      <button
        onClick={() => pagingHandler({ cursorType: 'before', currentPage: 1 })}>
        Previous
      </button>
      <button
        onClick={() => pagingHandler({ cursorType: 'after', currentPage: 2 })}>
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

jest.mock('../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn().mockReturnValue(''),
  getEntityName: jest.fn().mockReturnValue('Test Service'),
  getEntityReferenceFromEntity: jest.fn().mockReturnValue({}),
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

jest.mock('../../utils/LocalStorageUtils', () => ({
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
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: { ViewAll: false, EditAll: false },
}));

// Additional utility mocks
jest.mock('../../utils/StringsUtils', () => ({
  escapeESReservedCharacters: jest.fn().mockImplementation((text) => text),
  getEncodedFqn: jest.fn().mockImplementation((text) => text),
}));

describe('ServiceDetailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
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

      expect(await screen.findByTestId('loader')).toBeInTheDocument();
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
      error.response = { status: ClientErrors.FORBIDDEN } as any;
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

    it('should use correct entity utilities', async () => {
      await renderComponent();

      await waitFor(() => {
        expect(getEntityName).toHaveBeenCalledWith(mockServiceDetails);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service fetch error', async () => {
      (getServiceByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Service not found'))
      );

      await renderComponent();

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
      }));

      await renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });

      // Should not fetch permissions for OpenMetadata service
      expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
    });
  });
});
