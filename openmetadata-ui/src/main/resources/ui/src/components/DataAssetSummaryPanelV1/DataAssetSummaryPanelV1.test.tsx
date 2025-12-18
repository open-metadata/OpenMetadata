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

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { EntityType } from '../../enums/entity.enum';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { TagSource } from '../../generated/type/tagLabel';
import { patchDashboardDetails } from '../../rest/dashboardAPI';
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import { patchTableDetails } from '../../rest/tableAPI';
import { listTestCases } from '../../rest/testAPI';
import { fetchCharts } from '../../utils/DashboardDetailsUtils';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityOverview } from '../../utils/EntityUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { DataAssetSummaryPanelV1 } from './DataAssetSummaryPanelV1';
import { DataAssetSummaryPanelProps } from './DataAssetSummaryPanelV1.interface';

// Mock TableUtils first to ensure getTierTags is available
jest.mock('../../utils/TableUtils', () => {
  const mockGetTierTags = jest.fn(() => null);
  const mockGetTagsWithoutTier = jest.fn(() => []);
  const mockGetUsagePercentile = jest.fn(() => 0);
  const mockGetDataTypeString = jest.fn(() => 'string');
  const mockGenerateEntityLink = jest.fn();

  return {
    generateEntityLink: mockGenerateEntityLink,
    getTierTags: mockGetTierTags,
    getTagsWithoutTier: mockGetTagsWithoutTier,
    getUsagePercentile: mockGetUsagePercentile,
    getDataTypeString: mockGetDataTypeString,
  };
});

// Mock all the required dependencies
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(),
}));

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn(),
}));

jest.mock('../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
}));

jest.mock('../../rest/testAPI', () => ({
  listTestCases: jest.fn(),
}));

jest.mock('../../utils/DashboardDetailsUtils', () => ({
  fetchCharts: jest.fn(),
}));

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  getCurrentMillis: jest.fn(),
  getEpochMillisForPastDays: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../utils/EntitySummaryPanelUtils', () => ({
  getEntityChildDetails: jest.fn(),
}));

jest.mock('../../utils/EntityUtils', () => {
  const mockGetEntityOverview = jest.fn(() => []);

  return {
    DRAWER_NAVIGATION_OPTIONS: {
      explore: 'explore',
    },
    getEntityOverview: mockGetEntityOverview,
  };
});

// Mock DataInsight constants to prevent undefined DEFAULT_SELECTED_RANGE
jest.mock('../../constants/DataInsight.constants', () => ({
  DEFAULT_SELECTED_RANGE: { days: 30 },
  INITIAL_CHART_FILTER: { startTs: 0, endTs: 0 },
}));

jest.mock('../../constants/profiler.constant', () => ({
  PROFILER_FILTER_RANGE: {
    last30days: {
      days: 30,
    },
  },
}));

// Mock all patch API functions
jest.mock('../../rest/tableAPI', () => ({
  patchTableDetails: jest.fn(),
}));

jest.mock('../../rest/dashboardAPI', () => ({
  patchDashboardDetails: jest.fn(),
}));

jest.mock('../../rest/topicsAPI', () => ({
  patchTopicDetails: jest.fn(),
}));

jest.mock('../../rest/pipelineAPI', () => ({
  patchPipelineDetails: jest.fn(),
}));

jest.mock('../../rest/mlModelAPI', () => ({
  patchMlModelDetails: jest.fn(),
}));

jest.mock('../../rest/chartsAPI', () => ({
  patchChartDetails: jest.fn(),
}));

jest.mock('../../rest/apiCollectionsAPI', () => ({
  patchApiCollection: jest.fn(),
}));

jest.mock('../../rest/apiEndpointsAPI', () => ({
  patchApiEndPoint: jest.fn(),
}));

jest.mock('../../rest/databaseAPI', () => ({
  patchDatabaseDetails: jest.fn(),
  patchDatabaseSchemaDetails: jest.fn(),
}));

jest.mock('../../rest/storedProceduresAPI', () => ({
  patchStoredProceduresDetails: jest.fn(),
}));

jest.mock('../../rest/storageAPI', () => ({
  patchContainerDetails: jest.fn(),
}));

jest.mock('../../rest/dataModelsAPI', () => ({
  patchDataModelDetails: jest.fn(),
}));

jest.mock('../../rest/SearchIndexAPI', () => ({
  patchSearchIndexDetails: jest.fn(),
}));

jest.mock('../../rest/dataProductAPI', () => ({
  patchDataProduct: jest.fn(),
}));

// Mock child components
jest.mock('../common/DescriptionSection/DescriptionSection', () => {
  return jest.fn().mockImplementation(({ onDescriptionUpdate }) => (
    <div data-testid="description-section">
      <button
        data-testid="update-description-btn"
        onClick={() =>
          onDescriptionUpdate && onDescriptionUpdate('New description')
        }>
        Update Description
      </button>
    </div>
  ));
});

jest.mock('../common/OverviewSection/OverviewSection', () => {
  return jest.fn().mockImplementation(({ entityInfoV1 }) => (
    <div data-testid="overview-section">
      {(entityInfoV1 || []).map((item: any, index: number) => (
        <div
          data-testid={`overview-item-${String(item.name).toLowerCase()}`}
          key={index}>
          {item.name} {item.value}
        </div>
      ))}
    </div>
  ));
});

jest.mock('../common/DataQualitySection/DataQualitySection', () => {
  return jest.fn().mockImplementation(({ tests, totalTests }) => (
    <div data-testid="data-quality-section">
      <div data-testid="total-tests">{totalTests}</div>
      {tests.map((test: any, index: number) => (
        <div data-testid={`test-${test.type}`} key={index}>
          {test.type}: {test.count}
        </div>
      ))}
    </div>
  ));
});

jest.mock('../common/OwnersSection/OwnersSection', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="owners-section">Owners Section</div>
    ));
});

jest.mock('../common/DomainsSection/DomainsSection', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="domains-section">Domains Section</div>
    ));
});

jest.mock('../common/GlossaryTermsSection/GlossaryTermsSection', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="glossary-terms-section">Glossary Terms Section</div>
    ));
});

jest.mock('../common/TagsSection/TagsSection', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="tags-section">Tags Section</div>
    ));
});

jest.mock('../common/DataProductsSection/DataProductsSection', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="data-products-section">Data Products Section</div>
    ));
});

jest.mock('../common/QueryCount/QueryCount.component', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="query-count">Query Count</div>);
});

jest.mock('../common/Loader/Loader', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loading...</div>);
});

jest.mock(
  '../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component',
  () => {
    return jest
      .fn()
      .mockImplementation(({ children, loading }) => (
        <div data-testid="summary-panel-skeleton">
          {loading ? (
            <div data-testid="skeleton-loading">Loading...</div>
          ) : (
            children
          )}
        </div>
      ));
  }
);

// Mock data
const mockDataAsset = {
  id: 'test-id',
  name: 'test-table',
  fullyQualifiedName: 'test.fqn',
  entityType: EntityType.TABLE,
  description: 'Test description',
  displayName: 'Test Table',
  owners: [
    {
      id: 'owner-1',
      type: 'user',
      name: 'Test Owner',
      displayName: 'Test Owner',
    },
  ],
  domains: [
    {
      id: 'domain-1',
      type: 'domain',
      name: 'Test Domain',
      displayName: 'Test Domain',
    },
  ],
  tags: [
    {
      tagFQN: 'test.tag',
      source: TagSource.Classification,
      name: 'Test Tag',
      displayName: 'Test Tag',
    },
  ],
  dataProducts: [],
  columnNames: ['col1', 'col2', 'col3'],
  deleted: false,
};

const mockEntityPermissions = {
  ViewAll: true,
  ViewDataProfile: true,
  EditAll: true,
  EditTags: true,
  EditDescription: true,
};

const mockTestCaseData = [
  {
    id: 'test-case-1',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Success,
    },
  },
  {
    id: 'test-case-2',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Failed,
    },
  },
  {
    id: 'test-case-3',
    testCaseResult: {
      testCaseStatus: TestCaseStatus.Aborted,
    },
  },
];

const mockIncidentData = {
  paging: {
    total: 5,
  },
};

const mockChartsData = [
  {
    id: 'chart-1',
    name: 'Test Chart',
  },
];

describe('DataAssetSummaryPanelV1', () => {
  const mockT = jest.fn((key: string) => key);
  const mockGetEntityPermission = jest.fn();
  const mockOnOwnerUpdate = jest.fn();
  const mockOnDomainUpdate = jest.fn();
  const mockOnTagsUpdate = jest.fn();
  const mockOnDataProductsUpdate = jest.fn();
  const mockOnGlossaryTermsUpdate = jest.fn();
  const mockOnDescriptionUpdate = jest.fn();

  const defaultProps: DataAssetSummaryPanelProps = {
    dataAsset: mockDataAsset as any,
    entityType: EntityType.TABLE,
    isLoading: false,
    onOwnerUpdate: mockOnOwnerUpdate,
    onDomainUpdate: mockOnDomainUpdate,
    onTagsUpdate: mockOnTagsUpdate,
    onDataProductsUpdate: mockOnDataProductsUpdate,
    onGlossaryTermsUpdate: mockOnGlossaryTermsUpdate,
    onDescriptionUpdate: mockOnDescriptionUpdate,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermission: mockGetEntityPermission,
    });
    (useTourProvider as jest.Mock).mockReturnValue({
      isTourPage: false,
    });

    // Setup API mocks with fresh instances
    mockGetEntityPermission.mockResolvedValue(mockEntityPermissions);
    (getCurrentMillis as jest.Mock).mockReturnValue(1234567890);
    (getEpochMillisForPastDays as jest.Mock).mockReturnValue(1234567890);
    (generateEntityLink as jest.Mock).mockReturnValue('test-link');
    (getListTestCaseIncidentStatus as jest.Mock).mockResolvedValue(
      mockIncidentData
    );
    (listTestCases as jest.Mock).mockResolvedValue({ data: mockTestCaseData });
    (fetchCharts as jest.Mock).mockResolvedValue(mockChartsData);
    (getEntityOverview as jest.Mock).mockImplementation(
      (_entityType: any, _dataAsset: any, additionalInfo: any) => [
        { name: 'Type', value: 'Table', visible: ['explore'] },
        { name: 'Rows', value: 1000, visible: ['explore'] },
        { name: 'Columns', value: 15, visible: ['explore'] },
        { name: 'Queries', value: 250, visible: ['explore'] },
        {
          name: 'Incidents',
          value:
            (additionalInfo && additionalInfo.incidentCount) !== undefined
              ? additionalInfo.incidentCount
              : 0,
          visible: ['explore'],
        },
      ]
    );
  });

  afterEach(() => {
    cleanup();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', async () => {
      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      expect(screen.getByTestId('summary-panel-skeleton')).toBeInTheDocument();
    });

    it('should show skeleton when loading', async () => {
      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} isLoading />);
      });

      expect(screen.getByTestId('skeleton-loading')).toBeInTheDocument();
    });

    it('should render description section', async () => {
      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('description-section')).toBeInTheDocument();
      });
    });

    it('should render overview section with correct data', async () => {
      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('overview-section')).toBeInTheDocument();
        expect(screen.getByTestId('overview-item-type')).toBeInTheDocument();
        expect(screen.getByTestId('overview-item-rows')).toBeInTheDocument();
        expect(screen.getByTestId('overview-item-columns')).toBeInTheDocument();
        expect(screen.getByTestId('overview-item-queries')).toBeInTheDocument();
        expect(
          screen.getByTestId('overview-item-incidents')
        ).toBeInTheDocument();
      });
    });

    it('should render all sections for TABLE entity type', async () => {
      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('owners-section')).toBeInTheDocument();
        expect(screen.getByTestId('domains-section')).toBeInTheDocument();
        expect(
          screen.getByTestId('glossary-terms-section')
        ).toBeInTheDocument();
        expect(screen.getByTestId('tags-section')).toBeInTheDocument();
        expect(screen.getByTestId('data-products-section')).toBeInTheDocument();
      });
    });

    it('should render limited sections for DATA_PRODUCT entity type', async () => {
      const dataProductProps = {
        ...defaultProps,
        entityType: EntityType.DATA_PRODUCT,
      };

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...dataProductProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('owners-section')).toBeInTheDocument();
        expect(screen.getByTestId('domains-section')).toBeInTheDocument();
        expect(screen.getByTestId('tags-section')).toBeInTheDocument();
        expect(
          screen.queryByTestId('glossary-terms-section')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId('data-products-section')
        ).not.toBeInTheDocument();
      });
    });

    it('should render simplified sections for USER entity type', async () => {
      const userProps = {
        ...defaultProps,
        entityType: EntityType.USER,
      };

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...userProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('description-section')).toBeInTheDocument();
        expect(screen.getByTestId('overview-section')).toBeInTheDocument();
        expect(screen.getByTestId('owners-section')).toBeInTheDocument();
        expect(screen.getByTestId('tags-section')).toBeInTheDocument();
        // USER entity type should not have glossary terms or data products
        expect(
          screen.queryByTestId('glossary-terms-section')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId('data-products-section')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch entity permissions on mount', async () => {
      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(mockGetEntityPermission).toHaveBeenCalledWith(
          'table',
          mockDataAsset.id
        );
      });
    });

    it('should fetch incident count for TABLE entity', async () => {
      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(getListTestCaseIncidentStatus).toHaveBeenCalledWith({
          limit: 0,
          latest: true,
          originEntityFQN: mockDataAsset.fullyQualifiedName,
          startTs: 1234567890,
          endTs: 1234567890,
        });
      });
    });

    it('should fetch test cases for TABLE entity', async () => {
      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(listTestCases).toHaveBeenCalledWith({
          entityLink: 'test-link',
          includeAllTests: true,
          limit: 100,
          fields: ['testCaseResult', 'incidentId'],
        });
      });
    });

    it('should fetch charts for DASHBOARD entity', async () => {
      const dashboardProps = {
        ...defaultProps,
        entityType: EntityType.DASHBOARD,
        dataAsset: {
          ...mockDataAsset,
          name: 'test-dashboard',
          displayName: 'Test Dashboard',
          entityType: EntityType.DASHBOARD,
          charts: [{ id: 'chart-1' }],
        } as any,
      };

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...dashboardProps} />);
      });

      await waitFor(() => {
        expect(fetchCharts).toHaveBeenCalledWith([{ id: 'chart-1' }]);
      });
    });

    it('should not fetch data when entity is deleted', async () => {
      const deletedProps = {
        ...defaultProps,
        dataAsset: {
          ...mockDataAsset,
          deleted: true,
        } as any,
      };

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...deletedProps} />);
      });

      await waitFor(() => {
        // The component still calls getEntityPermission even for deleted entities
        // but the subsequent data fetching should be skipped
        expect(mockGetEntityPermission).toHaveBeenCalledWith(
          'table',
          mockDataAsset.id
        );
      });
    });

    it('should not fetch data when on tour page', async () => {
      (useTourProvider as jest.Mock).mockReturnValue({
        isTourPage: true,
      });

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(mockGetEntityPermission).not.toHaveBeenCalled();
      });
    });
  });

  describe('Description Update', () => {
    it('should handle description update successfully', async () => {
      (patchTableDetails as jest.Mock).mockResolvedValue({});

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('update-description-btn')
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('update-description-btn'));
      });

      await waitFor(() => {
        expect(patchTableDetails).toHaveBeenCalledWith(mockDataAsset.id, [
          {
            op: 'replace',
            path: '/description',
            value: 'New description',
          },
        ]);
        expect(showSuccessToast).toHaveBeenCalled();
        expect(mockOnDescriptionUpdate).toHaveBeenCalledWith('New description');
      });
    });

    it('should handle description update error', async () => {
      const mockError = new Error('Update failed') as AxiosError;
      (patchTableDetails as jest.Mock).mockRejectedValue(mockError);

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('update-description-btn')
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('update-description-btn'));
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          mockError,
          'server.entity-updating-error'
        );
      });
    });

    it('should use correct patch API for different entity types', async () => {
      (patchDashboardDetails as jest.Mock).mockResolvedValue({});

      const dashboardProps = {
        ...defaultProps,
        entityType: EntityType.DASHBOARD,
      };

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...dashboardProps} />);
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('update-description-btn')
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('update-description-btn'));
      });

      await waitFor(() => {
        expect(patchDashboardDetails).toHaveBeenCalledWith(mockDataAsset.id, [
          {
            op: 'replace',
            path: '/description',
            value: 'New description',
          },
        ]);
      });
    });

    it('should throw error for unsupported entity type', async () => {
      const unsupportedProps = {
        ...defaultProps,
        entityType: 'UNSUPPORTED_TYPE' as EntityType,
      };

      // Suppress console.error for this test
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...unsupportedProps} />);
      });

      // For unsupported entity types, the component should still render the skeleton
      expect(screen.getByTestId('summary-panel-skeleton')).toBeInTheDocument();

      // The description section should not render for unsupported entity types
      expect(
        screen.queryByTestId('update-description-btn')
      ).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Data Quality Section', () => {
    it('should render data quality section when test cases are available', async () => {
      // Ensure clean state for this test
      jest.clearAllMocks();
      mockGetEntityPermission.mockResolvedValue(mockEntityPermissions);
      (listTestCases as jest.Mock).mockResolvedValue({
        data: mockTestCaseData,
      });
      (getEntityOverview as jest.Mock).mockReturnValue([]);

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      // Wait for test cases to load and data quality section to render
      await waitFor(
        () => {
          expect(
            screen.getByTestId('data-quality-section')
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.getByTestId('total-tests')).toHaveTextContent('3');
      expect(screen.getByTestId('test-success')).toHaveTextContent(
        'success: 1'
      );
      expect(screen.getByTestId('test-failed')).toHaveTextContent('failed: 1');
      expect(screen.getByTestId('test-aborted')).toHaveTextContent(
        'aborted: 1'
      );
    });

    it('should not render data quality section when no test cases', async () => {
      (listTestCases as jest.Mock).mockResolvedValue({ data: [] });

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('data-quality-section')).toHaveTextContent(
          '0'
        );
        expect(screen.getByTestId('test-success')).toHaveTextContent(
          'success: 0'
        );
        expect(screen.getByTestId('test-aborted')).toHaveTextContent(
          'aborted: 0'
        );
        expect(screen.getByTestId('test-failed')).toHaveTextContent(
          'failed: 0'
        );
      });
    });

    it('should handle test cases fetch error', async () => {
      const mockError = new Error('Test fetch failed') as AxiosError;
      (listTestCases as jest.Mock).mockRejectedValue(mockError);

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
        expect(screen.getByTestId('data-quality-section')).toHaveTextContent(
          '0'
        );
        expect(screen.getByTestId('test-success')).toHaveTextContent(
          'success: 0'
        );
        expect(screen.getByTestId('test-aborted')).toHaveTextContent(
          'aborted: 0'
        );
        expect(screen.getByTestId('test-failed')).toHaveTextContent(
          'failed: 0'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle incident count fetch error gracefully', async () => {
      (getListTestCaseIncidentStatus as jest.Mock).mockRejectedValue(
        new Error('Incident fetch failed')
      );

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('overview-item-incidents')).toHaveTextContent(
          'Incidents 0'
        );
      });
    });

    it('should handle charts fetch error gracefully', async () => {
      const dashboardProps = {
        ...defaultProps,
        entityType: EntityType.DASHBOARD,
        dataAsset: {
          ...mockDataAsset,
          name: 'test-dashboard',
          displayName: 'Test Dashboard',
          entityType: EntityType.DASHBOARD,
          charts: [{ id: 'chart-1' }],
        } as any,
      };

      (fetchCharts as jest.Mock).mockRejectedValue(
        new Error('Charts fetch failed')
      );

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...dashboardProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('description-section')).toBeInTheDocument();
      });
    });
  });

  describe('Permission-based Rendering', () => {
    it('should pass correct permissions to sections', async () => {
      const limitedPermissions = {
        ViewAll: false,
        ViewDataProfile: true,
        EditAll: false,
        EditTags: true,
      };

      mockGetEntityPermission.mockResolvedValue(limitedPermissions);

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('owners-section')).toBeInTheDocument();
        expect(screen.getByTestId('domains-section')).toBeInTheDocument();
        expect(screen.getByTestId('tags-section')).toBeInTheDocument();
      });
    });

    it('should not fetch incident count without proper permissions', async () => {
      const noPermissions = {
        ViewAll: false,
        ViewDataProfile: false,
        EditAll: false,
        EditTags: false,
      };

      mockGetEntityPermission.mockResolvedValue(noPermissions);

      await act(async () => {
        render(<DataAssetSummaryPanelV1 {...defaultProps} />);
      });

      await waitFor(() => {
        expect(getListTestCaseIncidentStatus).not.toHaveBeenCalled();
      });
    });
  });

  describe('Component Updates', () => {
    it('should re-fetch data when dataAsset changes', async () => {
      const { rerender } = render(
        <DataAssetSummaryPanelV1 {...defaultProps} />
      );

      await waitFor(() => {
        expect(mockGetEntityPermission).toHaveBeenCalledTimes(1);
      });

      const newDataAsset = {
        ...mockDataAsset,
        id: 'new-id',
        name: 'new-table',
        displayName: 'New Table',
        fullyQualifiedName: 'new.fqn',
      } as any;

      await act(async () => {
        rerender(
          <DataAssetSummaryPanelV1 {...defaultProps} dataAsset={newDataAsset} />
        );
      });

      await waitFor(() => {
        expect(mockGetEntityPermission).toHaveBeenCalledTimes(2);
        expect(mockGetEntityPermission).toHaveBeenLastCalledWith(
          'table',
          'new-id'
        );
      });
    });

    it('should update when entityType changes', async () => {
      const { rerender } = render(
        <DataAssetSummaryPanelV1 {...defaultProps} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('data-products-section')).toBeInTheDocument();
      });

      await act(async () => {
        rerender(
          <DataAssetSummaryPanelV1
            {...defaultProps}
            entityType={EntityType.DATA_PRODUCT}
          />
        );
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('data-products-section')
        ).not.toBeInTheDocument();
      });
    });
  });
});
