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
import type { TestDefinition } from '../../../generated/tests/testDefinition';
import {
  DataQualityDimensions,
  DataType,
  EntityType,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  createTestDefinition,
  patchTestDefinition,
} from '../../../rest/testAPI';
import TestDefinitionForm from './TestDefinitionForm.component';

jest.mock('../../../rest/testAPI', () => ({
  createTestDefinition: jest.fn().mockResolvedValue({}),
  patchTestDefinition: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
}));

jest.mock('./TestDefinitionFormBody', () => ({
  __esModule: true,
  default: ({
    form,
  }: {
    form: { setValue: (name: string, value: unknown) => void };
  }) => (
    <div data-testid="form-body">
      <button
        data-testid="set-display-name"
        type="button"
        onClick={() => form.setValue('displayName', 'Updated Display Name')}>
        set-display-name
      </button>
    </div>
  ),
}));

jest.mock('../../common/ServiceDocPanel/ServiceDocPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="service-doc-panel" />,
}));

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
  supportedServices: [],
  enabled: true,
  sqlExpression: 'SELECT * FROM {table} WHERE {column} IS NOT NULL',
};

describe('TestDefinitionForm wrapper', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the drawer variant with the doc panel by default', () => {
    render(
      <TestDefinitionForm
        open
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('form-body')).toBeInTheDocument();
    expect(screen.getByTestId('service-doc-panel')).toBeInTheDocument();
  });

  it('renders the modal variant without the doc panel', () => {
    render(
      <TestDefinitionForm
        open
        variant="modal"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('form-body')).toBeInTheDocument();
    expect(screen.queryByTestId('service-doc-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('create-btn')).toBeInTheDocument();
  });

  it('uses the add title when there are no initialValues', () => {
    render(
      <TestDefinitionForm
        open
        variant="modal"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('label.add-entity')).toBeInTheDocument();
  });

  it('uses the edit title when initialValues are provided', () => {
    render(
      <TestDefinitionForm
        open
        initialValues={mockInitialValues}
        variant="modal"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('label.edit-entity')).toBeInTheDocument();
  });

  it('calls createTestDefinition with the built payload on create submit', async () => {
    render(
      <TestDefinitionForm
        open
        variant="modal"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('create-btn'));

    await waitFor(() => {
      expect(createTestDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          testPlatforms: [TestPlatform.OpenMetadata],
          entityType: EntityType.Table,
        })
      );
    });
    // Real payload built by buildCreateTestDefinitionPayload: FormSelectItem
    // option objects must have been unwrapped to raw enum/string values, not
    // passed through as `{ id, label }`.
    const [payload] = (createTestDefinition as jest.Mock).mock.calls[0];

    expect(typeof payload.entityType).toBe('string');
    expect(
      payload.testPlatforms.every((p: unknown) => typeof p === 'string')
    ).toBe(true);
    expect(patchTestDefinition).not.toHaveBeenCalled();

    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());
  });

  it('calls patchTestDefinition with a patch reflecting a real field change on edit submit', async () => {
    render(
      <TestDefinitionForm
        open
        initialValues={mockInitialValues}
        variant="modal"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('set-display-name'));
    fireEvent.click(screen.getByTestId('create-btn'));

    await waitFor(() => {
      expect(patchTestDefinition).toHaveBeenCalledWith(
        mockInitialValues.id,
        expect.arrayContaining([
          expect.objectContaining({
            op: 'replace',
            path: '/displayName',
            value: 'Updated Display Name',
          }),
        ])
      );
    });

    expect(createTestDefinition).not.toHaveBeenCalled();

    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());
  });

  it('does not call patchTestDefinition for an unchanged edit but still calls onSuccess', async () => {
    render(
      <TestDefinitionForm
        open
        initialValues={mockInitialValues}
        variant="modal"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('create-btn'));

    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());

    expect(patchTestDefinition).not.toHaveBeenCalled();
  });
});
