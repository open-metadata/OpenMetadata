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
import { FieldTypes, getField } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { DataQualityDimensions } from '../../../enums/DataQuality.enum';
import type { TestDefinition } from '../../../generated/tests/testDefinition';
import {
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

const NAME_DOC = 'Provide the unique technical name for the test definition.';

type MockForm = { setValue: (name: string, value: unknown) => void };

let mockLatestForm: MockForm | undefined;

jest.mock('./TestDefinitionFormBody', () => ({
  __esModule: true,
  default: ({ form }: { form: MockForm }) => {
    mockLatestForm = form;

    return (
      <div data-testid="form-body">
        {getField({
          name: 'name',
          label: 'Name',
          type: FieldTypes.TEXT,
          required: false,
          id: 'root/name',
          doc: NAME_DOC,
        })}
        <button
          data-testid="set-display-name"
          type="button"
          onClick={() => form.setValue('displayName', 'Updated Display Name')}>
          set-display-name
        </button>
      </div>
    );
  },
}));

// The real previewer wraps a lazy TipTap editor that does not render in jsdom;
// render the markdown as text so the Form Hint assertions see the doc string.
jest.mock(
  '../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    function MockRichTextEditorPreviewerV1({ markdown }: { markdown: string }) {
      return <div>{markdown}</div>;
    }
);

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

  it('renders the drawer with the Show Hint toggle on', async () => {
    render(
      <TestDefinitionForm
        open
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('form-body')).toBeInTheDocument();
    expect(screen.getByTestId('save-test-definition')).toBeInTheDocument();
    expect(
      await screen.findByRole('switch', { name: 'label.show-hint' })
    ).toBeChecked();
  });

  it('opens Add empty after an edit closes, even if a closing field writes its old value back', async () => {
    const { rerender } = render(
      <TestDefinitionForm
        open
        initialValues={mockInitialValues}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByLabelText('Name')).toHaveValue(mockInitialValues.name);

    rerender(
      <TestDefinitionForm
        open={false}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );
    // The drawer's fields stay mounted while it slides out and re-register
    // their last value. jsdom unmounts them at once, so write it directly.
    act(() => mockLatestForm?.setValue('name', mockInitialValues.name));

    rerender(
      <TestDefinitionForm
        open
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(await screen.findByLabelText('Name')).toHaveValue('');
  });

  it('shows the focused field doc in the Form Hint until Show Hint is off', async () => {
    render(
      <TestDefinitionForm
        open
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await act(async () => {
      screen.getByLabelText('Name').focus();
    });

    expect(await screen.findByText(NAME_DOC)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'label.show-hint' }));
    });

    expect(screen.queryByText(NAME_DOC)).not.toBeInTheDocument();
  });

  it('uses the add title when there are no initialValues', () => {
    render(
      <TestDefinitionForm
        open
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
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('save-test-definition'));

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
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('set-display-name'));
    fireEvent.click(screen.getByTestId('save-test-definition'));

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
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('save-test-definition'));

    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());

    expect(patchTestDefinition).not.toHaveBeenCalled();
  });

  it('keeps the form open (no onSuccess/onCancel) when create fails', async () => {
    (createTestDefinition as jest.Mock).mockRejectedValueOnce(
      new Error('boom')
    );

    render(
      <TestDefinitionForm
        open
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('save-test-definition'));

    await waitFor(() => expect(createTestDefinition).toHaveBeenCalled());

    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnCancel).not.toHaveBeenCalled();
  });
});
