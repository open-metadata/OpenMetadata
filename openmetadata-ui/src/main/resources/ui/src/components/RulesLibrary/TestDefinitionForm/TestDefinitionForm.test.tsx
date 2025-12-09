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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  EntityType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  createTestDefinition,
  updateTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
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
  enabled: true,
};

jest.mock('../../../rest/testAPI', () => ({
  createTestDefinition: jest.fn().mockImplementation(() => Promise.resolve({})),
  updateTestDefinition: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

describe('TestDefinitionForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render form in create mode', () => {
    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    expect(
      screen.getByText(/label.add-entity.*label.test-definition/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('label.name')).toBeInTheDocument();
    expect(screen.getByLabelText('label.display-name')).toBeInTheDocument();
    expect(screen.getByLabelText('label.description')).toBeInTheDocument();
    expect(screen.getByLabelText('label.entity-type')).toBeInTheDocument();
    expect(screen.getByLabelText('label.test-platform')).toBeInTheDocument();
    expect(screen.getByLabelText('label.enabled')).toBeInTheDocument();
  });

  it('should render form in edit mode with initial values', () => {
    render(
      <TestDefinitionForm
        initialValues={mockInitialValues}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByText(/label.edit-entity.*label.test-definition/)
    ).toBeInTheDocument();

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

  it('should disable name and entityType fields in edit mode', () => {
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

  it('should enable all fields in create mode', () => {
    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const nameInput = screen.getByLabelText('label.name');

    expect(nameInput).not.toBeDisabled();
  });

  it('should default enabled to true in create mode', () => {
    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const enabledSwitch = screen.getByRole('switch');

    expect(enabledSwitch).toBeChecked();
  });

  it('should show validation error when required fields are empty', async () => {
    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const saveButton = screen.getByTestId('save-test-definition');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText(/message.field-text-is-required.*label.name/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/message.field-text-is-required.*label.description/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/message.field-text-is-required.*label.entity-type/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/message.field-text-is-required.*label.test-platform/)
      ).toBeInTheDocument();
    });
  });

  it('should call createTestDefinition when submitting in create mode', async () => {
    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const nameInput = screen.getByLabelText('label.name');
    const descriptionInput = screen.getByLabelText('label.description');

    await userEvent.type(nameInput, 'testDefinitionName');
    await userEvent.type(descriptionInput, 'Test description');

    const saveButton = screen.getByTestId('save-test-definition');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createTestDefinition).toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should call updateTestDefinition when submitting in edit mode', async () => {
    render(
      <TestDefinitionForm
        initialValues={mockInitialValues}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    const displayNameInput = screen.getByLabelText('label.display-name');
    await userEvent.clear(displayNameInput);
    await userEvent.type(displayNameInput, 'Updated Display Name');

    const saveButton = screen.getByTestId('save-test-definition');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateTestDefinition).toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const cancelButton = screen.getByRole('button', { name: 'label.cancel' });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show error toast when API call fails', async () => {
    const mockError = new Error('API Error');

    (createTestDefinition as jest.Mock).mockRejectedValueOnce(mockError);

    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const nameInput = screen.getByLabelText('label.name');
    const descriptionInput = screen.getByLabelText('label.description');

    await userEvent.type(nameInput, 'testDefinitionName');
    await userEvent.type(descriptionInput, 'Test description');

    const saveButton = screen.getByTestId('save-test-definition');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  it('should toggle enabled switch', async () => {
    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const enabledSwitch = screen.getByRole('switch');

    expect(enabledSwitch).toBeChecked();

    fireEvent.click(enabledSwitch);

    await waitFor(() => {
      expect(enabledSwitch).not.toBeChecked();
    });

    fireEvent.click(enabledSwitch);

    await waitFor(() => {
      expect(enabledSwitch).toBeChecked();
    });
  });

  it('should close drawer when onClose is called', () => {
    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const drawer = screen.getByRole('dialog');

    expect(drawer).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should disable save button while submitting', async () => {
    let resolveCreate: (value: unknown) => void;
    const createPromise = new Promise((resolve) => {
      resolveCreate = resolve;
    });

    (createTestDefinition as jest.Mock).mockReturnValueOnce(createPromise);

    render(
      <TestDefinitionForm onCancel={mockOnCancel} onSuccess={mockOnSuccess} />
    );

    const nameInput = screen.getByLabelText('label.name');
    const descriptionInput = screen.getByLabelText('label.description');

    await userEvent.type(nameInput, 'testDefinitionName');
    await userEvent.type(descriptionInput, 'Test description');

    const saveButton = screen.getByTestId('save-test-definition');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toHaveClass('ant-btn-loading');
    });

    resolveCreate({});

    await waitFor(() => {
      expect(saveButton).not.toHaveClass('ant-btn-loading');
    });
  });
});
