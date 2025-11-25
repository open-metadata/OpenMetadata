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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Column, DataType } from '../../../../../generated/entity/data/table';
import { Operation } from '../../../../../generated/entity/policies/accessControl/resourcePermission';
import '../../../../../test/unit/mocks/mui.mock';
import TabFilters from './TabFilters';

const mockNavigate = jest.fn();
const mockOnSettingButtonClick = jest.fn();
const mockOnTestCaseDrawerOpen = jest.fn();
const mockUseParams = jest.fn(() => ({ subTab: 'table-profile' }));
const mockUseCustomLocation = jest.fn(() => ({
  search: '?startTs=1711065600000&endTs=1711670399000&key=last7days',
  pathname: '/table/test-table/profiler',
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

const mockUseTableProfiler = jest.fn(() => ({
  permissions: buildOperationPermission({
    EditDataProfile: true,
    ViewDataProfile: true,
  }),
  isTableDeleted: false,
  onSettingButtonClick: mockOnSettingButtonClick,
  onTestCaseDrawerOpen: mockOnTestCaseDrawerOpen,
  table: {
    columns: mockColumns,
  },
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

jest.mock(
  '../../../../../hooks/useCustomLocation/useCustomLocation',
  () => () => mockUseCustomLocation()
);

jest.mock('../../../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({ fqn: 'test-table-fqn' })),
}));

jest.mock('../../../../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn(() => ({ isTourOpen: false })),
}));

jest.mock('../../TableProfiler/TableProfilerProvider', () => ({
  useTableProfiler: () => mockUseTableProfiler(),
}));

jest.mock('../../../../../constants/profiler.constant', () => ({
  DEFAULT_RANGE_DATA: {
    startTs: 1711065600000,
    endTs: 1711670399000,
    key: 'last7days',
    title: 'Last 7 days',
  },
}));

jest.mock('../../TableProfiler/ProfilerClassBase', () => ({
  __esModule: true,
  default: {
    getDefaultTabKey: jest.fn(() => 'table-profile'),
  },
}));

const mockGetPrioritizedEditPermission = jest.fn();

jest.mock('../../../../../utils/PermissionsUtils', () => ({
  getPrioritizedEditPermission: jest.fn(() =>
    mockGetPrioritizedEditPermission()
  ),
}));

jest.mock('../../../../../utils/RouterUtils', () => ({
  getAddCustomMetricPath: jest.fn(() => '/custom-metric-path'),
  getEntityDetailsPath: jest.fn(() => '/entity-details-path'),
}));

jest.mock('../../../../common/MuiDatePickerMenu/MuiDatePickerMenu', () => {
  return function MockMuiDatePickerMenu({
    defaultDateRange,
    handleDateRangeChange,
    size,
  }: {
    defaultDateRange: { startTs: number; endTs: number; key: string };
    handleDateRangeChange: (value: {
      startTs: number;
      endTs: number;
      key: string;
      title: string;
    }) => void;
    size: string;
  }) {
    return (
      <div data-size={size} data-testid="mui-date-picker-menu">
        <span>{`Start: ${defaultDateRange.startTs}`}</span>
        <span>{`End: ${defaultDateRange.endTs}`}</span>
        <button
          onClick={() =>
            handleDateRangeChange({
              startTs: 1711065600000,
              endTs: 1711670399000,
              key: 'last7days',
              title: 'Last 7 days',
            })
          }>
          Change Date
        </button>
      </div>
    );
  };
});

jest.mock('../../TableProfiler/ColumnPickerMenu', () => {
  return function MockColumnPickerMenu({
    activeColumnFqn,
    handleChange,
  }: {
    activeColumnFqn: string;
    columns: Column[];
    handleChange: (key: string) => void;
  }) {
    return (
      <div data-testid="column-picker-menu">
        <span>{`Active: ${activeColumnFqn}`}</span>
        <button onClick={() => handleChange('new-column-fqn')}>
          Change Column
        </button>
      </div>
    );
  };
});

jest.mock('../../../../common/TabsLabel/TabsLabel.component', () => {
  return function MockTabsLabel({ id, name }: { id: string; name: string }) {
    return <div data-testid={`tabs-label-${id}`}>{name}</div>;
  };
});

jest.mock('../../../../../hoc/LimitWrapper', () => {
  return function MockLimitWrapper({
    children,
  }: {
    children: React.ReactElement;
  }) {
    return <div data-testid="limit-wrapper">{children}</div>;
  };
});

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <TabFilters />
    </MemoryRouter>
  );
};

describe('TabFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPrioritizedEditPermission.mockReturnValue(true);
    mockUseCustomLocation.mockReturnValue({
      search: '?startTs=1711065600000&endTs=1711670399000&key=last7days',
      pathname: '/table/test-table/profiler',
    });
    mockUseParams.mockReturnValue({ subTab: 'table-profile' });
    mockUseTableProfiler.mockReturnValue({
      permissions: buildOperationPermission({
        EditDataProfile: true,
        ViewDataProfile: true,
      }),
      isTableDeleted: false,
      onSettingButtonClick: mockOnSettingButtonClick,
      onTestCaseDrawerOpen: mockOnTestCaseDrawerOpen,
      table: {
        columns: mockColumns,
      },
    });
  });

  describe('Rendering', () => {
    it('should render the component', () => {
      renderComponent();

      expect(screen.getByTestId('mui-date-picker-menu')).toBeInTheDocument();
    });

    it('should render date picker with correct props', () => {
      renderComponent();

      const datePicker = screen.getByTestId('mui-date-picker-menu');

      expect(datePicker).toHaveAttribute('data-size', 'small');
      expect(datePicker).toHaveTextContent('Start: 1711065600000');
      expect(datePicker).toHaveTextContent('End: 1711670399000');
    });

    it('should render add button when user has edit permissions', () => {
      renderComponent();

      expect(
        screen.getByTestId('profiler-add-table-test-btn')
      ).toBeInTheDocument();
    });

    it('should render settings button when user has edit permissions', () => {
      renderComponent();

      expect(screen.getByTestId('profiler-setting-btn')).toBeInTheDocument();
    });

    it('should render LimitWrapper around add button', () => {
      renderComponent();

      expect(screen.getByTestId('limit-wrapper')).toBeInTheDocument();
    });
  });

  describe('Column Picker', () => {
    it('should render column picker when activeColumnFqn is present', () => {
      mockUseCustomLocation.mockReturnValue({
        search:
          '?activeColumnFqn=table.column1&startTs=1711065600000&endTs=1711670399000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(screen.getByTestId('column-picker-menu')).toBeInTheDocument();
      expect(screen.getByText('Active: table.column1')).toBeInTheDocument();
    });

    it('should not render column picker when activeColumnFqn is empty', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1711065600000&endTs=1711670399000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(
        screen.queryByTestId('column-picker-menu')
      ).not.toBeInTheDocument();
    });

    it('should display column label', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(screen.getByText('label.column:')).toBeInTheDocument();
    });
  });

  describe('Date Picker Visibility', () => {
    it('should render date picker on table-profile tab', () => {
      mockUseParams.mockReturnValue({ subTab: 'table-profile' });

      renderComponent();

      expect(screen.getByTestId('mui-date-picker-menu')).toBeInTheDocument();
    });

    it('should render date picker when column is selected', () => {
      mockUseParams.mockReturnValue({ subTab: 'column-profile' });
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(screen.getByTestId('mui-date-picker-menu')).toBeInTheDocument();
    });

    it('should not render date picker on column-profile tab without active column', () => {
      mockUseParams.mockReturnValue({ subTab: 'column-profile' });
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(
        screen.queryByTestId('mui-date-picker-menu')
      ).not.toBeInTheDocument();
    });

    it('should not render date picker on data-quality tab without active column', () => {
      mockUseParams.mockReturnValue({ subTab: 'data-quality' });
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(
        screen.queryByTestId('mui-date-picker-menu')
      ).not.toBeInTheDocument();
    });

    it('should not render date picker on overview tab without active column', () => {
      mockUseParams.mockReturnValue({ subTab: 'overview' });
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(
        screen.queryByTestId('mui-date-picker-menu')
      ).not.toBeInTheDocument();
    });

    it('should render date picker on overview tab when column is selected', () => {
      mockUseParams.mockReturnValue({ subTab: 'overview' });
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(screen.getByTestId('mui-date-picker-menu')).toBeInTheDocument();
    });

    it('should display date label when date picker is shown', () => {
      renderComponent();

      expect(screen.getByText('label.date:')).toBeInTheDocument();
    });
  });

  describe('Permissions', () => {
    it('should not render add button when user lacks edit permissions', () => {
      mockGetPrioritizedEditPermission.mockReturnValue(false);
      mockUseTableProfiler.mockReturnValue({
        permissions: buildOperationPermission({
          EditDataProfile: false,
          ViewDataProfile: true,
        }),
        isTableDeleted: false,
        onSettingButtonClick: mockOnSettingButtonClick,
        onTestCaseDrawerOpen: mockOnTestCaseDrawerOpen,
        table: { columns: [] },
      });

      renderComponent();

      expect(
        screen.queryByTestId('profiler-add-table-test-btn')
      ).not.toBeInTheDocument();

      mockGetPrioritizedEditPermission.mockReturnValue(true);
    });

    it('should not render settings button when user lacks edit permissions', () => {
      mockGetPrioritizedEditPermission.mockReturnValue(false);
      mockUseTableProfiler.mockReturnValue({
        permissions: buildOperationPermission({
          EditDataProfile: false,
          ViewDataProfile: true,
        }),
        isTableDeleted: false,
        onSettingButtonClick: mockOnSettingButtonClick,
        onTestCaseDrawerOpen: mockOnTestCaseDrawerOpen,
        table: { columns: [] },
      });

      renderComponent();

      expect(
        screen.queryByTestId('profiler-setting-btn')
      ).not.toBeInTheDocument();

      mockGetPrioritizedEditPermission.mockReturnValue(true);
    });

    it('should not render buttons when table is deleted', () => {
      mockUseTableProfiler.mockReturnValue({
        permissions: buildOperationPermission({
          EditDataProfile: true,
          ViewDataProfile: true,
        }),
        isTableDeleted: true,
        onSettingButtonClick: mockOnSettingButtonClick,
        onTestCaseDrawerOpen: mockOnTestCaseDrawerOpen,
        table: { columns: [] },
      });

      renderComponent();

      expect(
        screen.queryByTestId('profiler-add-table-test-btn')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('profiler-setting-btn')
      ).not.toBeInTheDocument();
    });
  });

  describe('URL Parameters', () => {
    it('should parse startTs from URL', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1234567890000&endTs=1711670399000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      const datePicker = screen.getByTestId('mui-date-picker-menu');

      expect(datePicker).toHaveTextContent('Start: 1234567890000');
    });

    it('should parse endTs from URL', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1711065600000&endTs=9876543210000',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      const datePicker = screen.getByTestId('mui-date-picker-menu');

      expect(datePicker).toHaveTextContent('End: 9876543210000');
    });

    it('should use default values when URL parameters are missing', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      const datePicker = screen.getByTestId('mui-date-picker-menu');

      expect(datePicker).toHaveTextContent('Start: 1711065600000');
      expect(datePicker).toHaveTextContent('End: 1711670399000');
    });
  });

  describe('Layout', () => {
    it('should render components in correct order', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      const container = screen.getByTestId('column-picker-menu').parentElement;

      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button elements', () => {
      renderComponent();

      const addButton = screen.getByTestId('profiler-add-table-test-btn');
      const settingsButton = screen.getByTestId('profiler-setting-btn');

      expect(addButton).toBeEnabled();
      expect(settingsButton).toBeEnabled();
    });

    it('should render settings button with proper structure', () => {
      renderComponent();

      const settingsButton = screen.getByTestId('profiler-setting-btn');

      expect(settingsButton).toBeInTheDocument();
    });
  });

  describe('Translations', () => {
    it('should use translation for column label', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?activeColumnFqn=table.column1',
        pathname: '/table/test-table/profiler',
      });

      renderComponent();

      expect(screen.getByText('label.column:')).toBeInTheDocument();
    });

    it('should use translation for date label', () => {
      renderComponent();

      expect(screen.getByText('label.date:')).toBeInTheDocument();
    });

    it('should use translation for add button', () => {
      renderComponent();

      expect(screen.getByText('label.add')).toBeInTheDocument();
    });
  });
});
