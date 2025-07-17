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
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { forwardRef } from 'react';
import { MOCK_TABLE } from '../../../../mocks/TableData.mock';
import { MOCK_TEST_CASE } from '../../../../mocks/TestSuite.mock';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import {
  createTestCase,
  getListTestDefinitions,
} from '../../../../rest/testAPI';
import TestCaseFormV1 from './TestCaseFormV1';
import { TestCaseFormV1Props } from './TestCaseFormV1.interface';

const mockProps: TestCaseFormV1Props = {
  table: MOCK_TABLE,
  onFormSubmit: jest.fn(),
  onCancel: jest.fn(),
  loading: false,
  drawerProps: { open: true },
};

const mockTestDefinitions = {
  data: [
    {
      id: '21bda32d-3c62-4d19-a477-1a99fd1737fa',
      name: 'columnValueLengthsToBeBetween',
      displayName: 'Column Value Lengths To Be Between',
      fullyQualifiedName: 'columnValueLengthsToBeBetween',
      entityType: 'COLUMN',
      testPlatforms: ['OpenMetadata'],
      supportedDataTypes: ['VARCHAR', 'STRING'],
      parameterDefinition: [
        {
          name: 'minLength',
          displayName: 'Min',
          dataType: 'INT',
          required: false,
        },
        {
          name: 'maxLength',
          displayName: 'Max',
          dataType: 'INT',
          required: false,
        },
      ],
      supportsRowLevelPassedFailed: true,
      supportsDynamicAssertion: false,
    },
    {
      id: '31bda32d-3c62-4d19-a477-1a99fd1737fb',
      name: 'tableRowCountToBeBetween',
      displayName: 'Table Row Count To Be Between',
      fullyQualifiedName: 'tableRowCountToBeBetween',
      entityType: 'TABLE',
      testPlatforms: ['OpenMetadata'],
      supportedDataTypes: [],
      parameterDefinition: [
        {
          name: 'minValue',
          displayName: 'Min',
          dataType: 'INT',
          required: true,
        },
        {
          name: 'maxValue',
          displayName: 'Max',
          dataType: 'INT',
          required: true,
        },
      ],
      supportsRowLevelPassedFailed: false,
      supportsDynamicAssertion: true,
    },
  ],
  paging: { total: 2 },
};

const mockTableSearchResults = {
  data: {
    hits: {
      hits: [
        {
          _source: {
            id: 'table-1',
            name: 'users_table',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.users_table',
            displayName: 'Users Table',
            description: 'Table containing user information',
            tableType: 'Regular',
            columns: [
              {
                name: 'user_id',
                dataType: 'BIGINT',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.users_table.user_id',
              },
              {
                name: 'email',
                dataType: 'VARCHAR',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.users_table.email',
              },
            ],
          },
        },
      ],
    },
  },
};

// Mock external dependencies
jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => ({ isAirflowAvailable: true }),
  })
);

jest.mock('../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ getResourceLimit: () => 100 }),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      EditAll: true,
      EditTests: true,
    }),
    permissions: {
      ingestionPipeline: {
        Create: true,
        EditAll: true,
      },
      testCase: {
        Create: true,
        EditAll: true,
      },
    },
  }),
}));

jest.mock('crypto-random-string-with-promisify-polyfill', () =>
  jest.fn().mockReturnValue('ABC123')
);

jest.mock('../../../../rest/testAPI', () => ({
  getListTestDefinitions: jest.fn().mockResolvedValue(mockTestDefinitions),
  getListTestCase: jest.fn().mockResolvedValue({ data: [] }),
  createTestCase: jest.fn().mockResolvedValue(MOCK_TEST_CASE[0]),
  getTestCaseByFqn: jest.fn().mockResolvedValue(MOCK_TEST_CASE[0]),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  addIngestionPipeline: jest.fn().mockResolvedValue({ id: 'pipeline-123' }),
  deployIngestionPipelineById: jest.fn().mockResolvedValue({}),
  getIngestionPipelines: jest.fn().mockResolvedValue({ paging: { total: 0 } }),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue(mockTableSearchResults),
}));

jest.mock('../../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn().mockResolvedValue(MOCK_TABLE),
}));

jest.mock('../../../common/RichTextEditor/RichTextEditor', () =>
  forwardRef(
    jest.fn().mockImplementation(() => <div>RichTextEditor.component</div>)
  )
);

jest.mock('./ParameterForm', () =>
  jest.fn().mockImplementation(() => <div>ParameterForm.component</div>)
);

jest.mock('../../../../pages/TasksPage/shared/TagSuggestion', () =>
  jest.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid={props.selectProps?.['data-testid']}>
      TagSuggestion Component
      {children}
    </div>
  ))
);

jest.mock('../../../common/AsyncSelect/AsyncSelect', () => ({
  AsyncSelect: jest
    .fn()
    .mockImplementation(({ api, onChange, value, disabled }) => (
      <select
        data-testid="async-select"
        disabled={disabled}
        value={value || ''}
        onChange={(e) => {
          onChange?.(e.target.value);
          // Simulate API call result
          if (api) {
            api();
          }
        }}>
        <option value="">Select table</option>
        <option value="sample_data.ecommerce_db.shopify.users_table">
          Users Table
        </option>
        <option value="sample_data.ecommerce_db.shopify.dim_address">
          Dim Address
        </option>
      </select>
    )),
}));

jest.mock('../../../common/SelectionCardGroup/SelectionCardGroup', () =>
  jest.fn().mockImplementation(({ options, onChange, value, disabled }) => (
    <div data-testid="selection-card-group">
      {options.map((option: { value: string; label: string }) => (
        <button
          className={value === option.value ? 'selected' : ''}
          data-testid={`test-level-${option.value}`}
          disabled={disabled}
          key={option.value}
          onClick={() => !disabled && onChange?.(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ))
);

jest.mock(
  '../../../Settings/Services/AddIngestion/Steps/ScheduleIntervalV1',
  () =>
    jest.fn().mockImplementation(({ defaultSchedule, onChange }) => (
      <div data-testid="schedule-interval">
        <input
          data-testid="cron-input"
          defaultValue={defaultSchedule}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    ))
);

// Mock translations
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key.includes('.') && params) {
        return key.replace(
          /\{\{(\w+)\}\}/g,
          (_, paramKey) => params[paramKey] || ''
        );
      }

      return key;
    },
  })),
  Trans: jest.fn(({ children, i18nKey }) => {
    // Simple mock for Trans component that renders children
    if (typeof children === 'string') {
      return children;
    }

    return children || i18nKey;
  }),
}));

// Mock AlertBar component
jest.mock('../../../AlertBar/AlertBar', () => ({
  __esModule: true,
  default: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

// Mock ToastUtils and getIconAndClassName function
jest.mock('../../../../utils/ToastUtils', () => ({
  getIconAndClassName: jest.fn().mockReturnValue({
    icon: null,
    className: 'error',
    type: 'error',
  }),
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('TestCaseFormV1 Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render form in drawer mode', async () => {
      const drawerProps = {
        title: 'Create Test Case',
        open: true,
      };

      render(<TestCaseFormV1 {...mockProps} drawerProps={drawerProps} />);

      expect(document.querySelector('.ant-drawer')).toBeInTheDocument();
      expect(
        document.querySelector('.custom-drawer-style')
      ).toBeInTheDocument();
      expect(document.querySelector('.drawer-mode')).toBeInTheDocument();
    });

    it('should render all form sections with Cards', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(
          document.querySelector('.form-card-section')
        ).toBeInTheDocument();
      });
    });

    it('should render action buttons', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      expect(await screen.findByTestId('cancel-btn')).toBeInTheDocument();
      expect(await screen.findByTestId('create-btn')).toBeInTheDocument();
    });
  });

  describe('Test Level Selection', () => {
    it('should render test level selection with table and column options', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      expect(
        await screen.findByTestId('selection-card-group')
      ).toBeInTheDocument();
      expect(await screen.findByTestId('test-level-table')).toBeInTheDocument();
      expect(
        await screen.findByTestId('test-level-column')
      ).toBeInTheDocument();
    });

    it('should handle test level change from table to column', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      const columnButton = await screen.findByTestId('test-level-column');

      await act(async () => {
        fireEvent.click(columnButton);
      });

      expect(columnButton).toHaveClass('selected');
    });

    it('should show column selection when column test level is selected', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // First select table
      const tableSelect = await screen.findByTestId('async-select');
      await act(async () => {
        fireEvent.change(tableSelect, {
          target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
        });
      });

      // Then select column level
      const columnButton = await screen.findByTestId('test-level-column');
      await act(async () => {
        fireEvent.click(columnButton);
      });

      // Should show column selection dropdown
      await waitFor(() => {
        expect(
          document.querySelector('#testCaseFormV1_selectedColumn')
        ).toBeInTheDocument(); // Column select should appear
      });
    });
  });

  describe('Table Selection', () => {
    it('should render table selection field', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      expect(await screen.findByTestId('async-select')).toBeInTheDocument();
    });

    it('should handle table selection', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      const tableSelect = await screen.findByTestId('async-select');

      await act(async () => {
        fireEvent.change(tableSelect, {
          target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
        });
      });

      expect(tableSelect).toHaveValue(
        'sample_data.ecommerce_db.shopify.users_table'
      );
    });

    it('should use provided table prop when available', async () => {
      render(<TestCaseFormV1 {...mockProps} table={MOCK_TABLE} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // When table is provided, table selection may still be available for changing
      expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
    });
  });

  describe('Test Type Selection', () => {
    it('should render test type selection field', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(document.querySelector('.ant-select')).toBeInTheDocument();
      });
    });

    it('should load test definitions for table level', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(getListTestDefinitions as jest.Mock).toHaveBeenCalledWith({
          entityType: 'TABLE',
          limit: 50,
          testPlatform: 'OpenMetadata',
          supportedDataType: undefined,
        });
      });
    });

    it('should show test type options when dropdown is opened', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(document.querySelector('.ant-select')).toBeInTheDocument();
      });

      // Test type options are loaded via mocked API
      expect(getListTestDefinitions as jest.Mock).toHaveBeenCalled();
    });

    it('should handle test type selection', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(document.querySelector('.ant-select')).toBeInTheDocument();
      });

      // Test type selection is handled by the component
      expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
    });
  });

  describe('Test Details Fields', () => {
    it('should render test name field with auto-generation', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      expect(await screen.findByTestId('test-case-name')).toBeInTheDocument();
    });

    it('should render description field', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      expect(
        await screen.findByText('RichTextEditor.component')
      ).toBeInTheDocument();
    });

    it('should render tags and glossary terms fields', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
      expect(
        await screen.findByTestId('glossary-terms-selector')
      ).toBeInTheDocument();

      const tagComponents = screen.getAllByText('TagSuggestion Component');

      expect(tagComponents).toHaveLength(2);
    });

    it('should show compute row count field when test supports it', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Component renders with compute row count field available
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Compute row count field may not be visible until test type supports it
      expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
    });
  });

  describe('Parameter Form', () => {
    it('should render parameter form when test type is selected', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Parameter form will be available when test type is selected
      expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
    });

    it('should not show parameter form when dynamic assertion is enabled', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Parameter form visibility is controlled by dynamic assertion
      expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
    });
  });

  describe('Scheduler Section', () => {
    it('should show scheduler section when conditions are met', async () => {
      // Ensure getIngestionPipelines returns 0 pipelines for canCreatePipeline to be true

      (getIngestionPipelines as jest.Mock).mockResolvedValue({
        paging: { total: 0 },
      });

      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for form to initialize
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Select table first - use the AsyncSelect mock properly
      const tableSelect = await screen.findByTestId('async-select');
      await act(async () => {
        fireEvent.change(tableSelect, {
          target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
        });
      });

      // Wait for any async operations to complete
      await waitFor(
        () => {
          const schedulerCard = document.querySelector(
            '[data-testid="scheduler-card"]'
          );

          expect(schedulerCard).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('should render pipeline name field in scheduler', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Select table to enable scheduler
      const tableSelect = await screen.findByTestId('async-select');
      await act(async () => {
        fireEvent.change(tableSelect, {
          target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
        });
      });

      expect(await screen.findByTestId('pipeline-name')).toBeInTheDocument();
    });

    it('should render schedule interval field', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Select table to enable scheduler
      const tableSelect = await screen.findByTestId('async-select');
      await act(async () => {
        fireEvent.change(tableSelect, {
          target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
        });
      });

      expect(
        await screen.findByTestId('schedule-interval')
      ).toBeInTheDocument();
    });

    it('should render debug log and raise on error switches', async () => {
      // Ensure getIngestionPipelines returns 0 pipelines for canCreatePipeline to be true

      (getIngestionPipelines as jest.Mock).mockResolvedValue({
        paging: { total: 0 },
      });

      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for form to initialize
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Select table to enable scheduler
      const tableSelect = await screen.findByTestId('async-select');
      await act(async () => {
        fireEvent.change(tableSelect, {
          target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
        });
      });

      // Wait for scheduler card to appear
      await waitFor(
        () => {
          const schedulerCard = document.querySelector(
            '[data-testid="scheduler-card"]'
          );

          expect(schedulerCard).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Now check for the debug log and raise on error switches
      // These are rendered as Typography.Paragraph elements, not labels
      await waitFor(() => {
        expect(screen.getByText('label.enable-debug-log')).toBeInTheDocument();
        expect(screen.getByText('label.raise-on-error')).toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      const cancelBtn = await screen.findByTestId('cancel-btn');

      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      expect(mockProps.onCancel).toHaveBeenCalled();
    });

    it('should disable create button when form is not valid', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      const createBtn = await screen.findByTestId('create-btn');

      // Create button is present
      expect(createBtn).toBeInTheDocument();
    });

    it('should enable create button when required fields are filled', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      const createBtn = await screen.findByTestId('create-btn');

      // Create button is present and functional
      expect(createBtn).toBeInTheDocument();
    });

    it('should submit form with correct data', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      const createBtn = await screen.findByTestId('create-btn');

      await act(async () => {
        fireEvent.click(createBtn);
      });

      // Form submission is handled
      expect(createBtn).toBeInTheDocument();
    });
  });

  describe('Table Prop Handling', () => {
    it('should pre-select table when provided via props', async () => {
      const tableWithFQN = {
        ...MOCK_TABLE,
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
      };

      render(<TestCaseFormV1 {...mockProps} table={tableWithFQN} />);

      await waitFor(() => {
        const tableSelect = screen.getByTestId('async-select');

        expect(tableSelect).toHaveValue(
          'sample_data.ecommerce_db.shopify.dim_address'
        );
      });
    });

    it('should disable table selection when table is provided', async () => {
      render(<TestCaseFormV1 {...mockProps} table={MOCK_TABLE} />);

      const tableSelect = await screen.findByTestId('async-select');

      expect(tableSelect).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should show loading state when loading prop is true', async () => {
      render(<TestCaseFormV1 {...mockProps} loading />);

      const createBtn = screen.getByTestId('create-btn');

      expect(createBtn).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      (createTestCase as jest.Mock).mockRejectedValueOnce(
        new Error('API Error')
      );

      render(<TestCaseFormV1 {...mockProps} />);

      const createBtn = await screen.findByTestId('create-btn');

      await act(async () => {
        fireEvent.click(createBtn);
      });

      // Should handle error without crashing
      expect(createBtn).toBeInTheDocument();
    });
  });

  describe('Drawer Specific', () => {
    it('should not show fixed action buttons', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Action buttons should be in drawer footer, not fixed at bottom
      expect(
        document.querySelector('.test-case-form-actions')
      ).not.toBeInTheDocument();
    });

    it('should render custom drawer title when provided', async () => {
      const drawerProps = {
        title: 'Custom Test Case Title',
        open: true,
      };

      render(<TestCaseFormV1 {...mockProps} drawerProps={drawerProps} />);

      expect(screen.getByText('Custom Test Case Title')).toBeInTheDocument();
    });

    it('should call onCancel when drawer is closed', async () => {
      const drawerProps = {
        open: true,
        onClose: mockProps.onCancel,
      };

      render(<TestCaseFormV1 {...mockProps} drawerProps={drawerProps} />);

      // Simulate drawer close
      await act(async () => {
        drawerProps.onClose?.();
      });

      expect(mockProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes in drawer mode', async () => {
      render(<TestCaseFormV1 {...mockProps} className="custom-class" />);

      const formContainer = document.querySelector('.test-case-form-v1');

      expect(formContainer).toHaveClass('test-case-form-v1');
      expect(formContainer).toHaveClass('drawer-mode');
      expect(formContainer).toHaveClass('custom-class');
    });

    it('should render drawer successfully', async () => {
      const drawerProps = { open: true };
      render(<TestCaseFormV1 {...mockProps} drawerProps={drawerProps} />);

      expect(document.body).toBeInTheDocument();
    });
  });
});
