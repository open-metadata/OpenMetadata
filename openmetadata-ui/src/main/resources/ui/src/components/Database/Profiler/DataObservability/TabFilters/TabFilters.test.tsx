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
import { fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Column, DataType } from '../../../../../generated/entity/data/table';
import { Operation } from '../../../../../generated/entity/policies/accessControl/resourcePermission';
import TabFilters from './TabFilters';

const TABLE_PROFILE = 'table-profile';
const TABLE_TEST_TABLE_PROFILER = '/table/test-table/profiler';
const DATE_PICKER_MENU = 'date-picker-menu';
const PROFILER_ADD_TABLE_TEST_BTN = 'profiler-add-table-test-btn';
const PROFILER_SETTING_BTN = 'profiler-setting-btn';
const COLUMN_PICKER_MENU = 'column-picker-menu';
const ACTIVECOLUMNFQN_TABLE_COLUMN1 = '?activeColumnFqn=table.column1';

jest.mock('@openmetadata/ui-core-components', () => {
  const Button = ({
    children,
    iconLeading,
    iconTrailing,
    size,
    ...props
  }: PropsWithChildren<Record<string, unknown>>) => (
    <button data-size={size} {...props}>
      {iconLeading as ReactNode}
      {children}
      {iconTrailing as ReactNode}
    </button>
  );

  const DropdownRoot = ({ children }: PropsWithChildren) => (
    <div>{children}</div>
  );

  const DropdownPopover = ({ children }: PropsWithChildren) => (
    <div>{children}</div>
  );

  const DropdownMenu = <T extends { id: string }>({
    items,
    children,
  }: {
    items: T[];
    children: (item: T) => ReactNode;
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.id}>{children(item)}</div>
      ))}
    </div>
  );

  const DropdownItem = ({
    id,
    label,
    onAction,
  }: {
    id: string;
    label: string;
    onAction?: () => void;
  }) => (
    <button data-testid={`dropdown-item-${id}`} onClick={onAction}>
      {label}
    </button>
  );

  const Tooltip = ({ children }: PropsWithChildren) => <>{children}</>;

  const Dropdown = {
    Root: DropdownRoot,
    Popover: DropdownPopover,
    Menu: DropdownMenu,
    Item: DropdownItem,
  };

  return {
    Button,
    Dropdown,
    Tooltip,
  };
});

jest.mock('../../../../common/DatePickerMenu/DatePickerMenu.component', () => {
  return function MockDatePickerMenu({
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
      <div data-size={size} data-testid={DATE_PICKER_MENU}>
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

const mockNavigate = jest.fn();
const mockOnSettingButtonClick = jest.fn();
const mockOnTestCaseDrawerOpen = jest.fn();
const mockUseParams = jest.fn(() => ({ subTab: TABLE_PROFILE }));
const mockUseCustomLocation = jest.fn(() => ({
  search: '?startTs=1711065600000&endTs=1711670399000&key=last7days',
  pathname: TABLE_TEST_TABLE_PROFILER,
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
  },
  DEFAULT_SELECTED_RANGE: {
    key: 'last7days',
    title: 'label.last-number-of-days',
    titleData: {
      numberOfDays: 7,
    },
    days: 7,
  },
}));

jest.mock('../../TableProfiler/ProfilerClassBase', () => ({
  __esModule: true,
  default: {
    getDefaultTabKey: jest.fn(() => TABLE_PROFILE),
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

jest.mock('../../TableProfiler/ColumnPickerMenu', () => {
  return function MockColumnPickerMenu({
    activeColumnFqn,
    handleChange,
  }: {
    activeColumnFqn: string;
    handleChange: (key: string) => void;
  }) {
    return (
      <div data-testid={COLUMN_PICKER_MENU}>
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
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
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
      pathname: TABLE_TEST_TABLE_PROFILER,
    });
    mockUseParams.mockReturnValue({ subTab: TABLE_PROFILE });
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

      expect(screen.getByTestId(DATE_PICKER_MENU)).toBeInTheDocument();
    });

    it('should render date picker with correct props', () => {
      renderComponent();

      const datePicker = screen.getByTestId(DATE_PICKER_MENU);

      expect(datePicker).toHaveAttribute('data-size', 'small');
      expect(datePicker).toHaveTextContent('Start: 1711065600000');
      expect(datePicker).toHaveTextContent('End: 1711670399000');
    });

    it('should render add button when user has edit permissions', () => {
      renderComponent();

      expect(
        screen.getByTestId(PROFILER_ADD_TABLE_TEST_BTN)
      ).toBeInTheDocument();
    });

    it('should render settings button when user has edit permissions', () => {
      renderComponent();

      expect(screen.getByTestId(PROFILER_SETTING_BTN)).toBeInTheDocument();
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
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      expect(screen.getByTestId(COLUMN_PICKER_MENU)).toBeInTheDocument();
      expect(screen.getByText('Active: table.column1')).toBeInTheDocument();
    });

    it('should not render column picker when activeColumnFqn is empty', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1711065600000&endTs=1711670399000',
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      expect(screen.queryByTestId(COLUMN_PICKER_MENU)).not.toBeInTheDocument();
    });

    it('should display column label', () => {
      mockUseCustomLocation.mockReturnValue({
        search: ACTIVECOLUMNFQN_TABLE_COLUMN1,
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      expect(screen.getByText('label.column:')).toBeInTheDocument();
    });
  });

  describe('Date Picker Visibility', () => {
    it('should render date picker on table-profile tab', () => {
      mockUseParams.mockReturnValue({ subTab: TABLE_PROFILE });

      renderComponent();

      expect(screen.getByTestId(DATE_PICKER_MENU)).toBeInTheDocument();
    });

    it('should render date picker when column is selected', () => {
      mockUseParams.mockReturnValue({ subTab: 'column-profile' });
      mockUseCustomLocation.mockReturnValue({
        search: ACTIVECOLUMNFQN_TABLE_COLUMN1,
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      expect(screen.getByTestId(DATE_PICKER_MENU)).toBeInTheDocument();
    });

    it('should not render date picker on column-profile tab without active column', () => {
      mockUseParams.mockReturnValue({ subTab: 'column-profile' });
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      expect(screen.queryByTestId(DATE_PICKER_MENU)).not.toBeInTheDocument();
    });

    it('should not render date picker on data-quality tab without active column', () => {
      mockUseParams.mockReturnValue({ subTab: 'data-quality' });
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      expect(screen.queryByTestId(DATE_PICKER_MENU)).not.toBeInTheDocument();
    });

    it('should not render date picker on overview tab without active column', () => {
      mockUseParams.mockReturnValue({ subTab: 'overview' });
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      expect(screen.queryByTestId(DATE_PICKER_MENU)).not.toBeInTheDocument();
    });

    it('should render date picker on overview tab when column is selected', () => {
      mockUseParams.mockReturnValue({ subTab: 'overview' });
      mockUseCustomLocation.mockReturnValue({
        search: ACTIVECOLUMNFQN_TABLE_COLUMN1,
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      expect(screen.getByTestId(DATE_PICKER_MENU)).toBeInTheDocument();
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
        screen.queryByTestId(PROFILER_ADD_TABLE_TEST_BTN)
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
        screen.queryByTestId(PROFILER_SETTING_BTN)
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
        screen.queryByTestId(PROFILER_ADD_TABLE_TEST_BTN)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(PROFILER_SETTING_BTN)
      ).not.toBeInTheDocument();
    });
  });

  describe('URL Parameters', () => {
    it('should parse startTs from URL', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1234567890000&endTs=1711670399000',
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      const datePicker = screen.getByTestId(DATE_PICKER_MENU);

      expect(datePicker).toHaveTextContent('Start: 1234567890000');
    });

    it('should parse endTs from URL', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?startTs=1711065600000&endTs=9876543210000',
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      const datePicker = screen.getByTestId(DATE_PICKER_MENU);

      expect(datePicker).toHaveTextContent('End: 9876543210000');
    });

    it('should use default values when URL parameters are missing', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '',
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      const datePicker = screen.getByTestId(DATE_PICKER_MENU);

      expect(datePicker).toHaveTextContent('Start: 1711065600000');
      expect(datePicker).toHaveTextContent('End: 1711670399000');
    });
  });

  describe('Layout', () => {
    it('should render components in correct order', () => {
      mockUseCustomLocation.mockReturnValue({
        search: ACTIVECOLUMNFQN_TABLE_COLUMN1,
        pathname: TABLE_TEST_TABLE_PROFILER,
      });

      renderComponent();

      const container = screen.getByTestId(COLUMN_PICKER_MENU).parentElement;

      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button elements', () => {
      renderComponent();

      const addButton = screen.getByTestId(PROFILER_ADD_TABLE_TEST_BTN);
      const settingsButton = screen.getByTestId(PROFILER_SETTING_BTN);

      expect(addButton).toBeEnabled();
      expect(settingsButton).toBeEnabled();
    });

    it('should render settings button with proper structure', () => {
      renderComponent();

      const settingsButton = screen.getByTestId(PROFILER_SETTING_BTN);

      expect(settingsButton).toBeInTheDocument();
    });
  });

  describe('Button Props', () => {
    it('should render add button with color="primary"', () => {
      renderComponent();

      expect(screen.getByTestId(PROFILER_ADD_TABLE_TEST_BTN)).toHaveAttribute(
        'color',
        'primary'
      );
    });

    it('should render add button with size="sm"', () => {
      renderComponent();

      expect(screen.getByTestId(PROFILER_ADD_TABLE_TEST_BTN)).toHaveAttribute(
        'data-size',
        'sm'
      );
    });

    it('should render settings button with color="secondary"', () => {
      renderComponent();

      expect(screen.getByTestId(PROFILER_SETTING_BTN)).toHaveAttribute(
        'color',
        'secondary'
      );
    });

    it('should render settings button with size="lg"', () => {
      renderComponent();

      expect(screen.getByTestId(PROFILER_SETTING_BTN)).toHaveAttribute(
        'data-size',
        'lg'
      );
    });

    it('should call onSettingButtonClick when settings button is clicked', () => {
      renderComponent();

      fireEvent.click(screen.getByTestId(PROFILER_SETTING_BTN));

      expect(mockOnSettingButtonClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Translations', () => {
    it('should use translation for column label', () => {
      mockUseCustomLocation.mockReturnValue({
        search: ACTIVECOLUMNFQN_TABLE_COLUMN1,
        pathname: TABLE_TEST_TABLE_PROFILER,
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
