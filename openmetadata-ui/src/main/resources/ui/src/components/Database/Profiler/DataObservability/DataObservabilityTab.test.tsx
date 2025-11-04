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
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  Column,
  DataType,
  Table,
} from '../../../../generated/entity/data/table';
import { Operation } from '../../../../generated/entity/policies/accessControl/resourcePermission';
import '../../../../test/unit/mocks/mui.mock';
import { TableProfilerProps } from '../TableProfiler/TableProfiler.interface';
import DataObservabilityTab from './DataObservabilityTab';

const mockNavigate = jest.fn();
const mockUseParams = jest.fn(() => ({ subTab: 'table-profile' }));
const mockUseCustomLocation = jest.fn(() => ({
  search: '?startTs=1711065600000&endTs=1711670399000',
  pathname: '/table/test-table/profiler',
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => mockUseCustomLocation(),
}));

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({ fqn: 'test-table-fqn' })),
}));

jest.mock('../../../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn(() => ({ isTourOpen: false })),
}));

jest.mock('../TableProfiler/ProfilerClassBase', () => ({
  __esModule: true,
  default: {
    getDefaultTabKey: jest.fn(() => 'table-profile'),
    getProfilerTabOptions: jest.fn(() => [
      { key: 'table-profile', label: 'Table Profile' },
      { key: 'column-profile', label: 'Column Profile' },
      { key: 'data-quality', label: 'Data Quality' },
    ]),
    getProfilerTabs: jest.fn(() => ({
      'table-profile': () => (
        <div data-testid="table-profile-component">Table Profile Content</div>
      ),
      'column-profile': () => (
        <div data-testid="column-profile-component">Column Profile Content</div>
      ),
      'data-quality': () => (
        <div data-testid="data-quality-component">Data Quality Content</div>
      ),
    })),
  },
}));

jest.mock('./TabFilters/TabFilters', () => {
  return function MockTabFilters() {
    return <div data-testid="tab-filters">Tab Filters</div>;
  };
});

jest.mock('../TableProfiler/TableProfilerProvider', () => ({
  TableProfilerProvider: ({
    children,
  }: PropsWithChildren<TableProfilerProps>) => (
    <div data-testid="table-profiler-provider">{children}</div>
  ),
}));

jest.mock('../../../../constants/PageHeaders.constant', () => ({
  PAGE_HEADERS: {
    COLUMN_PROFILE: {
      header: 'Column Profile',
    },
  },
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn(
    (_type, _fqn, _tab, subTab) => `/entity-details/${subTab}`
  ),
}));

jest.mock('../../../../rest/testAPI', () => ({
  getDataQualityReport: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [{ stateId: '5' }],
    })
  ),
}));

const buildOperationPermission = (
  overrides: Partial<Record<Operation, boolean>> = {}
): OperationPermission => {
  const permission = {} as OperationPermission;

  Object.values(Operation).forEach((operation) => {
    permission[operation] = overrides[operation] ?? false;
  });

  return permission;
};

const mockColumns: Column[] = [
  {
    name: 'column1',
    fullyQualifiedName: 'table.column1',
    dataType: DataType.String,
  },
  {
    name: 'column2',
    fullyQualifiedName: 'table.column2',
    dataType: DataType.String,
  },
];

const mockTableData: Table = {
  id: 'test-table-id',
  name: 'test-table',
  fullyQualifiedName: 'test-table-fqn',
  columns: mockColumns,
};

const defaultProps: TableProfilerProps = {
  permissions: buildOperationPermission({
    ViewAll: true,
    ViewDataProfile: true,
  }),
  table: mockTableData,
};

const renderComponent = (props: Partial<TableProfilerProps> = {}) => {
  return render(
    <MemoryRouter>
      <DataObservabilityTab {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('DataObservabilityTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ subTab: 'table-profile' });
    mockUseCustomLocation.mockReturnValue({
      search: '?startTs=1711065600000&endTs=1711670399000',
      pathname: '/table/test-table/profiler',
    });
  });

  describe('Rendering', () => {
    it('should render the component', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('table-profiler-container')
        ).toBeInTheDocument();
      });
    });

    it('should render TableProfilerProvider', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('table-profiler-provider')
        ).toBeInTheDocument();
      });
    });

    it('should render TabFilters component', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tab-filters')).toBeInTheDocument();
      });
    });

    it('should render tabs when activeColumnFqn is not present', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });

    it('should render all tab options', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });

    it('should render back button when activeColumnFqn is present', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        const backButton = screen.getByText('Column Profile').closest('button');

        expect(backButton).toBeInTheDocument();
        expect(screen.queryByText('Table Profile')).not.toBeInTheDocument();
        expect(screen.queryByText('Data Quality')).not.toBeInTheDocument();
      });
    });

    it('should render active tab component', async () => {
      mockUseParams.mockReturnValue({ subTab: 'table-profile' });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('table-profile-component')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should render all tabs', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });

    it('should render correct active tab content', async () => {
      mockUseParams.mockReturnValue({ subTab: 'column-profile' });
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('column-profile-component')
        ).toBeInTheDocument();
      });
    });

    it('should have tabs visible when no column is selected', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1234567890000&endTs=9876543210000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });

    it('should render tabs as clickable buttons', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1234567890000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
      });

      const columnProfileTab = screen
        .getByText('Column Profile')
        .closest('button');

      expect(columnProfileTab).toBeTruthy();
      expect(columnProfileTab).toBeInTheDocument();
    });
  });

  describe('Back Button', () => {
    it('should navigate back when back button is clicked', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
      });

      const backButton = screen.getByText('Column Profile');

      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/entity-details/column-profile',
        search: expect.not.stringContaining('activeColumnFqn'),
      });
    });

    it('should clear activeColumnFqn when navigating back', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1&startTs=1234567890000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
      });

      const backButton = screen.getByText('Column Profile');

      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          search: expect.stringMatching(
            /^(?!.*activeColumnFqn).*startTs=1234567890000/
          ),
        })
      );
    });

    it('should render back button with drop-down icon', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        const backButton = screen.getByText('Column Profile').closest('button');

        expect(backButton).toBeInTheDocument();
      });
    });
  });

  describe('Active Tab Content', () => {
    it('should render table-profile content when active', async () => {
      mockUseParams.mockReturnValue({ subTab: 'table-profile' });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('table-profile-component')
        ).toBeInTheDocument();
        expect(screen.getByText('Table Profile Content')).toBeInTheDocument();
      });
    });

    it('should render column-profile content when active', async () => {
      mockUseParams.mockReturnValue({ subTab: 'column-profile' });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('column-profile-component')
        ).toBeInTheDocument();
        expect(screen.getByText('Column Profile Content')).toBeInTheDocument();
      });
    });

    it('should render data-quality content when active', async () => {
      mockUseParams.mockReturnValue({ subTab: 'data-quality' });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('data-quality-component')
        ).toBeInTheDocument();
        expect(screen.getByText('Data Quality Content')).toBeInTheDocument();
      });
    });
  });

  describe('URL Parameter Handling', () => {
    it('should parse activeColumnFqn from URL', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Table Profile')).not.toBeInTheDocument();
        expect(screen.queryByText('Data Quality')).not.toBeInTheDocument();
      });
    });

    it('should handle URL without activeColumnFqn', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });

    it('should handle URL with query params starting with ?', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1234567890000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });

    it('should handle URL with query params not starting with ?', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: 'startTs=1234567890000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });
  });

  describe('Props Handling', () => {
    it('should pass props to TableProfilerProvider', async () => {
      const customProps: TableProfilerProps = {
        permissions: buildOperationPermission({
          ViewAll: true,
          EditAll: true,
        }),
        table: mockTableData,
      };

      renderComponent(customProps);

      await waitFor(() => {
        expect(
          screen.getByTestId('table-profiler-provider')
        ).toBeInTheDocument();
      });
    });

    it('should render when table prop is not provided', async () => {
      expect(() => renderComponent({ table: undefined })).not.toThrow();
    });
  });

  describe('Layout', () => {
    it('should render Stack component with correct structure', async () => {
      renderComponent();

      await waitFor(() => {
        const container = screen.getByTestId('table-profiler-container');
        const tabFilters = screen.getByTestId('tab-filters');

        expect(container).toContainElement(tabFilters);
      });
    });

    it('should render content panel', async () => {
      renderComponent();

      await waitFor(() => {
        const contentPanel = screen
          .getByTestId('table-profiler-container')
          .querySelector('.data-observability-content-panel');

        expect(contentPanel).toBeInTheDocument();
      });
    });

    it('should render content inside content panel', async () => {
      renderComponent();

      await waitFor(() => {
        const contentPanel = screen
          .getByTestId('table-profiler-container')
          .querySelector('.data-observability-content-panel');
        const content = screen.getByTestId('table-profile-component');

        expect(contentPanel).toContainElement(content);
      });
    });
  });

  describe('Integration', () => {
    it('should render with default props', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('table-profiler-container')
        ).toBeInTheDocument();
        expect(screen.getByTestId('tab-filters')).toBeInTheDocument();
      });
    });

    it('should render all tab options from ProfilerClassBase', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });

    it('should render active tab component from ProfilerClassBase', async () => {
      mockUseParams.mockReturnValue({ subTab: 'data-quality' });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByTestId('data-quality-component')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible tab list', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Table Profile')).toBeInTheDocument();
        expect(screen.getByText('Column Profile')).toBeInTheDocument();
        expect(screen.getByText('Data Quality')).toBeInTheDocument();
      });
    });

    it('should have accessible tabs', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        const tableProfileTab = screen.getByText('Table Profile');
        const columnProfileTab = screen.getByText('Column Profile');
        const dataQualityTab = screen.getByText('Data Quality');

        expect(tableProfileTab).toBeVisible();
        expect(columnProfileTab).toBeVisible();
        expect(dataQualityTab).toBeVisible();
      });
    });

    it('should have accessible back button', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      await waitFor(() => {
        const backButton = screen.getByText('Column Profile').closest('button');

        expect(backButton).toBeEnabled();
      });
    });
  });

  describe('Incident Count', () => {
    it('should fetch incident count on mount', async () => {
      const { getDataQualityReport } = jest.requireMock(
        '../../../../rest/testAPI'
      );

      renderComponent();

      await waitFor(() => {
        expect(getDataQualityReport).toHaveBeenCalledTimes(2);
      });
    });
  });
});
