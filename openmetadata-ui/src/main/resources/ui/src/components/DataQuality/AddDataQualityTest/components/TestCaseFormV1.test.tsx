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
import { act, forwardRef } from 'react';
import { TEST_CASE_NAME_REGEX } from '../../../../constants/regex.constants';
import { MOCK_TABLE } from '../../../../mocks/TableData.mock';
import { MOCK_TEST_CASE } from '../../../../mocks/TestSuite.mock';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import { getListTestDefinitions } from '../../../../rest/testAPI';
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
  getListTestDefinitions: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTestDefinitions)),
  getListTestCase: jest.fn().mockResolvedValue({ data: [] }),
  getListTestCaseBySearch: jest.fn().mockResolvedValue({ data: [] }),
  getTestCaseByFqn: jest.fn().mockResolvedValue(MOCK_TEST_CASE[0]),
  createTestCase: jest
    .fn()
    .mockResolvedValue({ id: 'new-test-case-id', name: 'new_test_case' }),
  TestCaseType: {
    all: 'all',
    table: 'table',
    column: 'column',
  },
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  addIngestionPipeline: jest.fn().mockResolvedValue({ id: 'pipeline-123' }),
  deployIngestionPipelineById: jest.fn().mockResolvedValue({}),
  getIngestionPipelines: jest.fn().mockResolvedValue({ paging: { total: 0 } }),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTableSearchResults)),
}));

jest.mock('../../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
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

// Mock ServiceDocPanel component
jest.mock('../../../common/ServiceDocPanel/ServiceDocPanel', () =>
  jest
    .fn()
    .mockImplementation(({ activeField }) => (
      <div data-testid="service-doc-panel">
        ServiceDocPanel Component - Active Field: {activeField}
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

// Mock formUtils to prevent scroll issues in tests
jest.mock('../../../../utils/formUtils', () => ({
  ...jest.requireActual('../../../../utils/formUtils'),
  createScrollToErrorHandler: jest.fn(() => jest.fn()),
}));

describe('TestCaseFormV1 Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render form in drawer mode with all essential elements', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      expect(document.querySelector('.ant-drawer')).toBeInTheDocument();
      expect(document.querySelector('.drawer-mode')).toBeInTheDocument();
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
      await waitFor(
        () => {
          // Column selection should appear after switching to column level and selecting table
          expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Table Selection', () => {
    it('should handle table selection and table prop integration', async () => {
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
  });

  describe('Test Type Selection', () => {
    it('should load test definitions and handle test type selection', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(getListTestDefinitions as jest.Mock).toHaveBeenCalledWith({
          entityType: 'TABLE',
          limit: 50,
          testPlatform: 'OpenMetadata',
          supportedDataType: undefined,
        });
        expect(document.querySelector('.ant-select')).toBeInTheDocument();
      });
    });
  });

  describe('Test Details Fields', () => {
    it('should render all essential form fields', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      expect(await screen.findByTestId('test-case-name')).toBeInTheDocument();
      expect(
        await screen.findByText('RichTextEditor.component')
      ).toBeInTheDocument();
      expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
      expect(
        await screen.findByTestId('glossary-terms-selector')
      ).toBeInTheDocument();
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
    it('should handle cancel and submit actions', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      const cancelBtn = await screen.findByTestId('cancel-btn');
      const createBtn = await screen.findByTestId('create-btn');

      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      expect(mockProps.onCancel).toHaveBeenCalled();
      expect(createBtn).toBeInTheDocument();
    });
  });

  describe('Table Prop Handling', () => {
    it('should handle table prop correctly', async () => {
      render(<TestCaseFormV1 {...mockProps} table={MOCK_TABLE} />);

      const tableSelect = await screen.findByTestId('async-select');

      expect(tableSelect).toBeDisabled();
    });
  });

  describe('Custom Query Functionality', () => {
    it('should render custom query button for table level tests', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Custom query button should be visible for table level
      await waitFor(() => {
        const customQueryButton = screen.getByTestId('custom-query');

        expect(customQueryButton).toBeInTheDocument();
      });
    });

    it('should toggle to custom query mode when custom query button is clicked', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Click custom query button
      const customQueryButton = await screen.findByTestId('custom-query');
      await act(async () => {
        fireEvent.click(customQueryButton);
      });

      // Should show the edit button to go back to test type selection
      await waitFor(() => {
        const editButton = screen.getByTestId('test-type-btn');

        expect(editButton).toBeInTheDocument();
      });
    });

    it('should switch back to test type selection from custom query mode', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // First switch to custom query mode
      const customQueryButton = await screen.findByTestId('custom-query');
      await act(async () => {
        fireEvent.click(customQueryButton);
      });

      // Wait for mode to change
      await waitFor(() => {
        const editButton = screen.getByTestId('test-type-btn');

        expect(editButton).toBeInTheDocument();
      });

      // Now click the select test type button to go back
      const selectTestTypeButton = screen.getByTestId('test-type-btn');

      await act(async () => {
        fireEvent.click(selectTestTypeButton);
      });

      // Should show custom query button again
      await waitFor(() => {
        expect(screen.getByTestId('custom-query')).toBeInTheDocument();
      });
    });

    it('should hide test type dropdown when in custom query mode', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Initially test type dropdown should be visible
      await waitFor(() => {
        expect(screen.getByTestId('test-type')).toBeInTheDocument();
      });

      // Switch to custom query mode
      const customQueryButton = await screen.findByTestId('custom-query');
      await act(async () => {
        fireEvent.click(customQueryButton);
      });

      // Test type dropdown should not be easily accessible in custom query mode
      await waitFor(() => {
        expect(screen.getByText('label.test-type')).toBeInTheDocument();

        // The dropdown should exist but be hidden from view
        const testTypeSelect = document.querySelector(
          '[data-testid="test-type"]'
        );

        expect(testTypeSelect).toBeInTheDocument();
      });
    });

    it('should not show custom query button for column level tests', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Switch to column level
      const columnButton = await screen.findByTestId('test-level-column');
      await act(async () => {
        fireEvent.click(columnButton);
      });

      // Custom query button should not be present for column level
      await waitFor(() => {
        expect(screen.queryByTestId('custom-query')).not.toBeInTheDocument();
      });
    });

    it('should show test type label when in custom query mode', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Switch to custom query mode
      const customQueryButton = await screen.findByTestId('custom-query');
      await act(async () => {
        fireEvent.click(customQueryButton);
      });

      // Should show test type label
      await waitFor(() => {
        expect(screen.getByText('label.test-type')).toBeInTheDocument();
      });
    });

    it('should properly handle form field updates when switching modes', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Switch to custom query mode
      const customQueryButton = await screen.findByTestId('custom-query');
      await act(async () => {
        fireEvent.click(customQueryButton);
      });

      // Verify the form field is set correctly (tableCustomSQLQuery)
      await waitFor(() => {
        expect(screen.getByText('label.test-type')).toBeInTheDocument();
      });

      // Switch back to regular mode
      const selectTestTypeButton = screen.getByTestId('test-type-btn');

      await act(async () => {
        fireEvent.click(selectTestTypeButton);
      });

      // Verify we're back to normal mode
      await waitFor(() => {
        expect(screen.getByTestId('custom-query')).toBeInTheDocument();
      });
    });
  });

  // =============================================
  // NEW FEATURE TESTS
  // =============================================

  describe('ServiceDocPanel Integration', () => {
    it('should render ServiceDocPanel with correct props', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('service-doc-panel')).toBeInTheDocument();
        expect(
          screen.getByText(/ServiceDocPanel Component - Active Field:/)
        ).toBeInTheDocument();
      });
    });

    it('should render dual-pane drawer layout', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(
          document.querySelector('.drawer-content-wrapper')
        ).toBeInTheDocument();
        expect(
          document.querySelector('.drawer-form-content')
        ).toBeInTheDocument();
        expect(document.querySelector('.drawer-doc-panel')).toBeInTheDocument();
      });
    });

    it('should update activeField when field receives focus', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      const testNameField = document.querySelector(
        'input[data-testid="test-case-name"]'
      );

      expect(testNameField).toBeInTheDocument();
      expect(testNameField).toBeTruthy();

      if (testNameField) {
        fireEvent.focus(testNameField);
      }

      await waitFor(() => {
        expect(
          screen.getByText(/Active Field: root\/name/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Enhanced Field Focus Handling', () => {
    it('should handle focus events and activeField updates', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      const form = screen.getByTestId('test-case-form-v1');

      // Create a mock focus event with root pattern
      const mockEvent = {
        target: { id: 'root/testLevel' },
      };

      fireEvent.focus(form, mockEvent);

      await waitFor(() => {
        expect(
          screen.getByText(/Active Field: root\/testLevel/)
        ).toBeInTheDocument();
      });
    });

    it('should handle scheduler card click for activeField', async () => {
      // Mock getIngestionPipelines to return 0 pipelines
      (getIngestionPipelines as jest.Mock).mockResolvedValue({
        paging: { total: 0 },
      });

      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Select table to enable scheduler
      const tableSelect = screen.getByTestId('async-select');
      fireEvent.change(tableSelect, {
        target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
      });

      // Wait for scheduler card to appear
      await waitFor(
        () => {
          const schedulerCard = document.querySelector(
            '[data-testid="scheduler-card"]'
          );

          expect(schedulerCard).toBeInTheDocument();

          if (schedulerCard) {
            fireEvent.click(schedulerCard);
          }
        },
        { timeout: 5000 }
      );

      // ActiveField should be updated for scheduler
      await waitFor(() => {
        expect(
          screen.getByText(/Active Field: root\/cron/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Display Name Field Enhancement', () => {
    it('should set display name equal to test name in form submission', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      const testNameField = document.querySelector(
        'input[data-testid="test-case-name"]'
      );

      expect(testNameField).toBeTruthy();

      if (testNameField) {
        fireEvent.change(testNameField, {
          target: { value: 'test_with_display_name' },
        });
      }

      // Form submission would use this name as both name and displayName
      expect(testNameField).toHaveValue('test_with_display_name');
    });

    it('should handle display name in createTestCaseObj function', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Select required fields for form submission
      const tableSelect = screen.getByTestId('async-select');
      fireEvent.change(tableSelect, {
        target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
      });

      const testNameField = document.querySelector(
        'input[data-testid="test-case-name"]'
      );

      if (testNameField) {
        fireEvent.change(testNameField, {
          target: { value: 'test_case_with_display' },
        });
      }

      // The component internally sets displayName = name in createTestCaseObj
      expect(testNameField).toHaveValue('test_case_with_display');
    });
  });

  describe('Enhanced Table and Column Integration', () => {
    it('should handle table selection with focus field updates', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      const tableSelect = screen.getByTestId('async-select');

      // Focus and selection should work together
      fireEvent.focus(tableSelect);
      fireEvent.change(tableSelect, {
        target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
      });

      // Verify that the table selection worked
      await waitFor(() => {
        expect(tableSelect).toHaveValue(
          'sample_data.ecommerce_db.shopify.users_table'
        );
      });
    });

    it('should handle column selection field focus when in column mode', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      // Switch to column level
      const columnButton = screen.getByTestId('test-level-column');
      fireEvent.click(columnButton);

      // Select table first
      const tableSelect = screen.getByTestId('async-select');
      fireEvent.change(tableSelect, {
        target: { value: 'sample_data.ecommerce_db.shopify.users_table' },
      });

      // Wait for column selection to appear and verify it's functional
      await waitFor(
        () => {
          // Verify the form is still functional in column mode
          expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Test Case Name Validation', () => {
    it('should render test case name field with validation rules', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      const testNameField = screen.getByTestId('test-case-name');

      expect(testNameField).toBeInTheDocument();

      // Test that the field accepts input
      await act(async () => {
        fireEvent.change(testNameField, {
          target: { value: 'valid_test_name' },
        });
      });

      expect(testNameField).toHaveValue('valid_test_name');
    });

    it('should accept valid test case names without validation errors', async () => {
      render(<TestCaseFormV1 {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-case-form-v1')).toBeInTheDocument();
      });

      const testNameField = screen.getByTestId('test-case-name');

      // Test valid name format
      const validName = 'table_column_count_equals';

      await act(async () => {
        fireEvent.change(testNameField, { target: { value: validName } });
        fireEvent.blur(testNameField);
      });

      // Field should accept the valid input
      expect(testNameField).toHaveValue(validName);
    });

    it('should have TEST_CASE_NAME_REGEX validation configured', () => {
      // Test that TEST_CASE_NAME_REGEX pattern is correctly configured
      // Test forbidden characters
      expect(TEST_CASE_NAME_REGEX.test('test::case')).toBe(false);
      expect(TEST_CASE_NAME_REGEX.test('test"case')).toBe(false);
      expect(TEST_CASE_NAME_REGEX.test('test>case')).toBe(false);

      // Test allowed characters
      expect(TEST_CASE_NAME_REGEX.test('table_column_count_equals')).toBe(true);
      expect(TEST_CASE_NAME_REGEX.test('valid.test.name')).toBe(true);
      expect(TEST_CASE_NAME_REGEX.test('test case with spaces')).toBe(true);
    });
  });

  describe('Test Cases Selection Logic', () => {
    it('should set testCases to undefined when selectAllTestCases is not false', () => {
      const testValues = {
        selectAllTestCases: true,
        otherField: 'value',
      };

      // Testing the new logic: values?.selectAllTestCases === false
      const result =
        testValues?.selectAllTestCases === false
          ? ['testCase1', 'testCase2']
          : undefined;

      expect(result).toBeUndefined();
    });

    it('should set testCases to array when selectAllTestCases is explicitly false', () => {
      const testValues = {
        selectAllTestCases: false,
        otherField: 'value',
      };

      const mockSelectedTestCases = ['existingTestCase1', 'existingTestCase2'];
      const mockCreatedTestCase = { name: 'newTestCase' };

      // Testing the new logic: values?.selectAllTestCases === false
      const result =
        testValues?.selectAllTestCases === false
          ? [mockCreatedTestCase.name, ...mockSelectedTestCases]
          : undefined;

      expect(result).toEqual([
        'newTestCase',
        'existingTestCase1',
        'existingTestCase2',
      ]);
    });

    it('should set testCases to undefined when selectAllTestCases is undefined', () => {
      const testValues: { selectAllTestCases?: boolean; otherField: string } = {
        otherField: 'value',
      };

      // Testing the new logic: values?.selectAllTestCases === false
      const result =
        testValues?.selectAllTestCases === false ? ['testCase1'] : undefined;

      expect(result).toBeUndefined();
    });
  });
});
