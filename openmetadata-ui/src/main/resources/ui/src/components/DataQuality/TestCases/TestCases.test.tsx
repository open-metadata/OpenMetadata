/*
 *  Copyright 2023 Collate.
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
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getTags } from '../../../rest/tagAPI';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { TestCases } from './TestCases.component';

const mockTestCasePermission = {
  Create: true,
  Delete: true,
  ViewAll: true,
  ViewBasic: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

const mockNoViewPermission = {
  Create: false,
  Delete: false,
  ViewAll: false,
  ViewBasic: false,
  EditAll: false,
  EditDescription: false,
  EditDisplayName: false,
  EditCustomFields: false,
};

let mockLocation = { search: '' };
const mockNavigate = jest.fn();
const mockShowModal = jest.fn();

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      testCase: mockTestCasePermission,
    },
  })),
}));

jest.mock('../../../rest/testAPI', () => {
  return {
    ...jest.requireActual('../../../rest/testAPI'),
    getListTestCaseBySearch: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: [], paging: { total: 0 } })
      ),
    getTestCaseById: jest.fn().mockImplementation(() => Promise.resolve()),
  };
});

jest.mock('../../../rest/searchAPI', () => {
  return {
    ...jest.requireActual('../../../rest/searchAPI'),
    searchQuery: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ hits: { hits: [], total: { value: 0 } } })
      ),
  };
});

jest.mock('../../../rest/tagAPI', () => {
  return {
    getTags: jest.fn().mockImplementation(() =>
      Promise.resolve({
        data: [
          {
            fullyQualifiedName: 'Tier.Tier1',
            name: 'Tier1',
          },
        ],
      })
    ),
  };
});

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    ...mockLocation,
  }));
});

jest.mock('react-router-dom', () => {
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn().mockImplementation(() => mockNavigate),
    useParams: jest
      .fn()
      .mockReturnValue({ tab: DataQualityPageTabs.TEST_CASES }),
  };
});

jest.mock('../../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});

jest.mock('../../common/SearchBarComponent/SearchBar.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ onSearch, searchValue }) => (
    <div data-testid="searchbar-component">
      <input
        data-testid="search-input"
        value={searchValue}
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  )),
}));

jest.mock('../../Database/Profiler/DataQualityTab/DataQualityTab', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(
      ({ testCases, isLoading, onTestUpdate, tableHeader }) => (
        <div data-testid="data-quality-tab">
          {tableHeader}
          <span data-testid="test-case-count">{testCases?.length ?? 0}</span>
          <span data-testid="loading-state">
            {isLoading ? 'loading' : 'loaded'}
          </span>
          <button
            data-testid="trigger-update"
            onClick={() =>
              onTestUpdate?.({
                id: 'test-1',
                name: 'updated-test',
                fullyQualifiedName: 'test.updated',
              })
            }>
            Update Test
          </button>
        </div>
      )
    ),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ type }) => (
      <div data-testid={`error-placeholder-type-${type}`}>
        ErrorPlaceHolder.component
      </div>
    )),
}));

const mockDataQualityContext = {
  isTestCaseSummaryLoading: false,
  testCaseSummary: {
    total: 10,
    success: 5,
    failed: 3,
    aborted: 2,
  },
  activeTab: DataQualityPageTabs.TEST_CASES,
};

jest.mock('../../../pages/DataQuality/DataQualityProvider', () => {
  return {
    useDataQualityProvider: jest
      .fn()
      .mockImplementation(() => mockDataQualityContext),
  };
});

jest.mock('../SummaryPannel/PieChartSummaryPanel.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ isLoading, testSummary }) => (
    <div data-testid="summary-panel">
      <span data-testid="summary-loading">
        {isLoading ? 'loading' : 'loaded'}
      </span>
      <span data-testid="summary-total">{testSummary?.total ?? 0}</span>
    </div>
  )),
}));

jest.mock(
  '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn().mockImplementation(() => ({
      showModal: mockShowModal,
    })),
  })
);

jest.mock('../../common/EntityPageInfos/ManageButton/ManageButton', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="manage-button">ManageButton</div>
    ));
});

jest.mock('../../PageHeader/PageHeader.component', () => {
  return jest.fn().mockImplementation(({ data }) => (
    <div data-testid="page-header">
      <span data-testid="header-title">{data?.header}</span>
    </div>
  ));
});

jest.mock('../../common/DatePickerMenu/DatePickerMenu.component', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="date-picker-menu">DatePickerMenu</div>
    ));
});

jest.mock('../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: {
    getTags: jest.fn().mockResolvedValue({
      data: [
        {
          label: 'Tag1',
          value: 'Tag.Tag1',
          data: { classification: { name: 'Classification1' } },
        },
      ],
    }),
  },
}));

const { usePermissionProvider } = jest.requireMock(
  '../../../context/PermissionProvider/PermissionProvider'
);

describe('TestCases component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation = { search: '' };
    usePermissionProvider.mockReturnValue({
      permissions: {
        testCase: mockTestCasePermission,
      },
    });
  });

  describe('Render & Initial State', () => {
    it('should render the component successfully', async () => {
      render(<TestCases />);

      expect(
        await screen.findByTestId('test-case-container')
      ).toBeInTheDocument();
    });

    it('should render filter components', async () => {
      render(<TestCases />);

      expect(await screen.findByTestId('advanced-filter')).toBeInTheDocument();
      expect(
        await screen.findByTestId('status-select-filter')
      ).toBeInTheDocument();
      expect(
        await screen.findByTestId('test-case-type-select-filter')
      ).toBeInTheDocument();
    });

    it('should render mocked child components', async () => {
      render(<TestCases />);

      expect(await screen.findByTestId('data-quality-tab')).toBeInTheDocument();
      expect(await screen.findByTestId('summary-panel')).toBeInTheDocument();
      expect(await screen.findByTestId('page-header')).toBeInTheDocument();
    });

    it('should render table filter when selected', async () => {
      render(<TestCases />);

      expect(
        await screen.findByTestId('table-select-filter')
      ).toBeInTheDocument();
    });

    it('should render tags filter when selected', async () => {
      render(<TestCases />);

      expect(
        await screen.findByTestId('tags-select-filter')
      ).toBeInTheDocument();
    });
  });

  describe('Permission Handling', () => {
    it('should show error placeholder when user has no view permissions', async () => {
      usePermissionProvider.mockReturnValue({
        permissions: {
          testCase: mockNoViewPermission,
        },
      });

      render(<TestCases />);

      expect(
        await screen.findByTestId('error-placeholder-type-PERMISSION')
      ).toBeInTheDocument();
    });

    it('should render component when user has ViewBasic permission', async () => {
      usePermissionProvider.mockReturnValue({
        permissions: {
          testCase: { ...mockNoViewPermission, ViewBasic: true },
        },
      });

      render(<TestCases />);

      expect(
        await screen.findByTestId('test-case-container')
      ).toBeInTheDocument();
    });

    it('should render component when user has ViewAll permission', async () => {
      usePermissionProvider.mockReturnValue({
        permissions: {
          testCase: { ...mockNoViewPermission, ViewAll: true },
        },
      });

      render(<TestCases />);

      expect(
        await screen.findByTestId('test-case-container')
      ).toBeInTheDocument();
    });
  });

  describe('API Calls', () => {
    it('should call getListTestCaseBySearch on page load', async () => {
      const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

      render(<TestCases />);

      await waitFor(() => {
        expect(mockGetListTestCase).toHaveBeenCalledWith(
          expect.objectContaining({
            fields: ['testCaseResult', 'testSuite', 'incidentId'],
            includeAllTests: true,
            limit: 15,
            offset: 0,
          })
        );
      });
    });

    it('should call getListTestCaseBySearch with search term from URL', async () => {
      mockLocation.search = '?searchValue=sale';
      const mockSearchQuery = getListTestCaseBySearch as jest.Mock;

      render(<TestCases />);

      await waitFor(() => {
        expect(mockSearchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            q: '*sale*',
          })
        );
      });
    });

    it('should call getListTestCaseBySearch with testCaseStatus from URL', async () => {
      mockLocation.search = '?testCaseStatus=Failed';
      const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

      render(<TestCases />);

      await waitFor(() => {
        expect(mockGetListTestCase).toHaveBeenCalledWith(
          expect.objectContaining({
            testCaseStatus: 'Failed',
          })
        );
      });
    });
  });

  describe('Filter Interactions', () => {
    it('should toggle filter selection when clicking advanced filter menu item', async () => {
      render(<TestCases />);

      const advancedFilter = await screen.findByTestId('advanced-filter');

      await act(async () => {
        fireEvent.click(advancedFilter);
      });

      await waitFor(() => {
        expect(screen.getByTestId('advanced-filter')).toBeInTheDocument();
      });
    });

    it('should call navigate when filter value changes', async () => {
      render(<TestCases />);

      const statusSelect = await screen.findByTestId('status-select-filter');

      expect(statusSelect).toBeInTheDocument();
    });
  });

  describe('URL Parameter Handling', () => {
    it('should parse tableFqn from URL params', async () => {
      mockLocation.search = '?tableFqn=test.table.fqn';
      const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

      render(<TestCases />);

      await waitFor(() => {
        expect(mockGetListTestCase).toHaveBeenCalled();
      });
    });

    it('should parse multiple filters from URL params', async () => {
      mockLocation.search =
        '?searchValue=test&testCaseStatus=Failed&tableFqn=my.table';
      const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

      render(<TestCases />);

      await waitFor(() => {
        expect(mockGetListTestCase).toHaveBeenCalledWith(
          expect.objectContaining({
            q: '*test*',
            testCaseStatus: 'Failed',
          })
        );
      });
    });

    it('should handle empty URL params', async () => {
      mockLocation.search = '';
      const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

      render(<TestCases />);

      await waitFor(() => {
        expect(mockGetListTestCase).toHaveBeenCalledWith(
          expect.objectContaining({
            q: undefined,
            testCaseStatus: undefined,
          })
        );
      });
    });
  });

  describe('Test Case Update', () => {
    it('should handle test case update from DataQualityTab', async () => {
      (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
        data: [
          { id: 'test-1', name: 'Test 1', fullyQualifiedName: 'test.1' },
          { id: 'test-2', name: 'Test 2', fullyQualifiedName: 'test.2' },
        ],
        paging: { total: 2 },
      });

      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('data-quality-tab')).toBeInTheDocument();
      });

      const updateButton = screen.getByTestId('trigger-update');

      await act(async () => {
        fireEvent.click(updateButton);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state in DataQualityTab', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      });
    });

    it('should pass loading state to SummaryPanel', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('summary-loading')).toBeInTheDocument();
      });
    });
  });

  describe('Sort Options', () => {
    it('should use default sort options on initial load', async () => {
      const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

      render(<TestCases />);

      await waitFor(() => {
        expect(mockGetListTestCase).toHaveBeenCalledWith(
          expect.objectContaining({
            sortField: 'testCaseResult.timestamp',
            sortType: 'desc',
          })
        );
      });
    });
  });

  describe('Page Header', () => {
    it('should render page header with correct title', async () => {
      render(<TestCases />);

      expect(await screen.findByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByTestId('header-title')).toHaveTextContent(
        'label.test-case-insight-plural'
      );
    });
  });

  describe('Manage Button', () => {
    it('should render manage button', async () => {
      render(<TestCases />);

      expect(await screen.findByTestId('manage-button')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      (getListTestCaseBySearch as jest.Mock).mockRejectedValueOnce(
        new Error('API Error')
      );

      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-container')).toBeInTheDocument();
      });
    });

    it('should handle searchQuery error gracefully', async () => {
      (searchQuery as jest.Mock).mockRejectedValueOnce(
        new Error('Search Error')
      );

      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-container')).toBeInTheDocument();
      });
    });

    it('should handle getTags error gracefully', async () => {
      (getTags as jest.Mock).mockRejectedValueOnce(new Error('Tags Error'));

      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-container')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Panel', () => {
    it('should pass testCaseSummary to SummaryPanel', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('summary-total')).toHaveTextContent('10');
      });
    });
  });

  describe('Selected Filters', () => {
    it('should have default filters selected (status, type, table, tags)', async () => {
      render(<TestCases />);

      expect(
        await screen.findByTestId('status-select-filter')
      ).toBeInTheDocument();
      expect(
        await screen.findByTestId('test-case-type-select-filter')
      ).toBeInTheDocument();
      expect(
        await screen.findByTestId('table-select-filter')
      ).toBeInTheDocument();
      expect(
        await screen.findByTestId('tags-select-filter')
      ).toBeInTheDocument();
    });

    it('should not show platform filter by default', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('platform-select-filter')
        ).not.toBeInTheDocument();
      });
    });

    it('should not show tier filter by default', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('tier-select-filter')
        ).not.toBeInTheDocument();
      });
    });

    it('should not show service filter by default', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('service-select-filter')
        ).not.toBeInTheDocument();
      });
    });

    it('should not show dimension filter by default', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('dimension-select-filter')
        ).not.toBeInTheDocument();
      });
    });

    it('should not show lastRun filter by default', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(
          screen.queryByTestId('date-picker-menu')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should handle empty test cases response', async () => {
      (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-count')).toHaveTextContent('0');
      });
    });
  });

  describe('Test Cases Data', () => {
    it('should pass test cases to DataQualityTab', async () => {
      (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
        data: [
          { id: 'test-1', name: 'Test 1' },
          { id: 'test-2', name: 'Test 2' },
          { id: 'test-3', name: 'Test 3' },
        ],
        paging: { total: 3 },
      });

      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-count')).toHaveTextContent('3');
      });
    });
  });

  describe('URL Search Params with Special Characters', () => {
    it('should handle search value with special characters', async () => {
      mockLocation.search = '?searchValue=test%20case%20name';
      const mockGetListTestCase = getListTestCaseBySearch as jest.Mock;

      render(<TestCases />);

      await waitFor(() => {
        expect(mockGetListTestCase).toHaveBeenCalled();
      });
    });
  });

  describe('Integration with DataQualityProvider', () => {
    it('should receive testCaseSummary from DataQualityProvider', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('summary-panel')).toBeInTheDocument();
      });
    });

    it('should receive isTestCaseSummaryLoading from DataQualityProvider', async () => {
      render(<TestCases />);

      await waitFor(() => {
        expect(screen.getByTestId('summary-loading')).toHaveTextContent(
          'loaded'
        );
      });
    });
  });
});
