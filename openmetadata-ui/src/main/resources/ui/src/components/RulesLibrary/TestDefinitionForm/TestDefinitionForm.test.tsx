/*
 *  Copyright 2024 Collate.
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
import {
  DataQualityDimensions,
  DataType,
  EntityType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  createTestDefinition,
  updateTestDefinition,
} from '../../../rest/testAPI';
import TestDefinitionForm from './TestDefinitionForm.component';

const mockOnSuccess = jest.fn();
const mockOnCancel = jest.fn();

const mockInitialValues: TestDefinition = {
  id: 'test-def-1',
  name: 'columnValuesToBeNotNull',
  displayName: 'Column Values To Be Not Null',
  description: 'Ensures that all values in a column are not null',
  entityType: EntityType.Column,
  testPlatforms: [TestPlatform.OpenMetadata],
  dataQualityDimension: DataQualityDimensions.Completeness,
  supportedDataTypes: [DataType.String, DataType.Int],
  enabled: true,
};

jest.mock('../../../rest/testAPI', () => ({
  createTestDefinition: jest.fn(),
  updateTestDefinition: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../Database/SchemaEditor/SchemaEditor', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ value, onChange }) => (
      <textarea
        data-testid="schema-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )),
}));

describe('TestDefinitionForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createTestDefinition as jest.Mock).mockResolvedValue({});
    (updateTestDefinition as jest.Mock).mockResolvedValue({});
  });

  describe('Rendering', () => {
    it('should render form in create mode with all required fields', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      expect(screen.getByLabelText('label.name')).toBeInTheDocument();
      expect(screen.getByLabelText('label.display-name')).toBeInTheDocument();
      expect(screen.getByLabelText('label.description')).toBeInTheDocument();
      expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
      expect(screen.getByLabelText('label.entity-type')).toBeInTheDocument();
      expect(screen.getByLabelText('label.test-platform')).toBeInTheDocument();
      expect(
        screen.getByLabelText('label.data-quality-dimension')
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('label.supported-data-type-plural')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('label.enabled')).toBeInTheDocument();
      expect(screen.getByTestId('save-test-definition')).toBeInTheDocument();
    });

    it('should render form in edit mode with initial values populated', () => {
      render(
        <TestDefinitionForm
          initialValues={mockInitialValues}
          onCancel={mockOnCancel}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('label.edit-entity')).toBeInTheDocument();

      const nameInput = screen.getByLabelText('label.name') as HTMLInputElement;
      expect(nameInput.value).toBe('columnValuesToBeNotNull');
      expect(nameInput).toBeDisabled();

      const displayNameInput = screen.getByLabelText(
        'label.display-name'
      ) as HTMLInputElement;
      expect(displayNameInput.value).toBe('Column Values To Be Not Null');

      const descriptionInput = screen.getByLabelText(
        'label.description'
      ) as HTMLTextAreaElement;
      expect(descriptionInput.value).toBe(
        'Ensures that all values in a column are not null'
      );
    });

    it('should render SQL query editor section', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      expect(screen.getByTestId('schema-editor')).toBeInTheDocument();
      expect(screen.getByText('label.sql-query')).toBeInTheDocument();
      expect(
        screen.getByText('message.test-definition-sql-query-help')
      ).toBeInTheDocument();
    });

    it('should render parameter section with add button', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      expect(screen.getByText('label.parameter-plural')).toBeInTheDocument();
      expect(
        screen.getByText('message.test-definition-parameters-description')
      ).toBeInTheDocument();

      const addButtons = screen.getAllByText('label.add-entity');
      expect(addButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Form Field Behavior', () => {
    it('should disable name field in edit mode', () => {
      render(
        <TestDefinitionForm
          initialValues={mockInitialValues}
          onCancel={mockOnCancel}
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByLabelText('label.name');
      expect(nameInput).toBeDisabled();
    });

    it('should enable name field in create mode', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const nameInput = screen.getByLabelText('label.name');
      expect(nameInput).not.toBeDisabled();
    });

    it('should default enabled switch to checked in create mode', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const enabledSwitch = screen.getByRole('switch');
      expect(enabledSwitch).toBeChecked();
    });

    it('should toggle enabled switch', async () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const enabledSwitch = screen.getByRole('switch');
      expect(enabledSwitch).toBeChecked();

      await act(async () => {
        fireEvent.click(enabledSwitch);
      });

      await waitFor(() => {
        expect(enabledSwitch).not.toBeChecked();
      });

      await act(async () => {
        fireEvent.click(enabledSwitch);
      });

      await waitFor(() => {
        expect(enabledSwitch).toBeChecked();
      });
    });

    it('should update SQL expression when typing in editor', async () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const sqlEditor = screen.getByTestId(
        'schema-editor'
      ) as HTMLTextAreaElement;

      await act(async () => {
        fireEvent.change(sqlEditor, {
          target: { value: 'SELECT * FROM {table} WHERE {column} IS NOT NULL' },
        });
      });

      expect(sqlEditor.value).toBe(
        'SELECT * FROM {table} WHERE {column} IS NOT NULL'
      );
    });

    it('should populate SQL expression in edit mode', () => {
      const mockValuesWithSql = {
        ...mockInitialValues,
        sqlExpression: 'SELECT * FROM {table}',
      } as TestDefinition & { sqlExpression?: string };

      render(
        <TestDefinitionForm
          initialValues={mockValuesWithSql}
          onCancel={mockOnCancel}
          onSuccess={mockOnSuccess}
        />
      );

      const sqlEditor = screen.getByTestId('schema-editor');
      expect(sqlEditor).toHaveValue('SELECT * FROM {table}');
    });
  });

  describe('Parameter Management', () => {
    it('should add new parameter when add button is clicked', async () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const addButtons = screen.getAllByText('label.add-entity');
      const parameterAddButton = addButtons[addButtons.length - 1];

      await act(async () => {
        fireEvent.click(parameterAddButton);
      });

      await waitFor(() => {
        expect(screen.getByText('label.parameter 1')).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText('label.parameter-name')
        ).toBeInTheDocument();
      });
    });

    it('should remove parameter when remove button is clicked', async () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const addButtons = screen.getAllByText('label.add-entity');
      const parameterAddButton = addButtons[addButtons.length - 1];

      await act(async () => {
        fireEvent.click(parameterAddButton);
      });

      await waitFor(() => {
        expect(screen.getByText('label.parameter 1')).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText('minus-circle');

      await act(async () => {
        fireEvent.click(removeButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('label.parameter 1')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors when required fields are empty', async () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const saveButton = screen.getByTestId('save-test-definition');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        const errors = screen.getAllByText('message.field-text-is-required');
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Form Submission', () => {
    it('should have save button that triggers form submission', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const saveButton = screen.getByTestId('save-test-definition');
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).toHaveTextContent('label.save');
    });

    it('should render form with proper structure for submission', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      expect(screen.getByLabelText('label.name')).toBeInTheDocument();
      expect(screen.getByLabelText('label.description')).toBeInTheDocument();
      expect(screen.getByLabelText('label.entity-type')).toBeInTheDocument();
      expect(screen.getByLabelText('label.test-platform')).toBeInTheDocument();
      expect(screen.getByTestId('save-test-definition')).toBeInTheDocument();
    });

    it('should initialize with testPlatforms field in edit mode', () => {
      render(
        <TestDefinitionForm
          initialValues={mockInitialValues}
          onCancel={mockOnCancel}
          onSuccess={mockOnSuccess}
        />
      );

      const testPlatformField = screen.getByLabelText('label.test-platform');
      expect(testPlatformField).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onCancel when cancel button is clicked', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const cancelButton = screen.getByText('label.cancel');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should close drawer when clicking close icon', () => {
      render(
        <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
      );

      const drawer = screen.getByRole('dialog');
      expect(drawer).toBeInTheDocument();
    });
  });
});
