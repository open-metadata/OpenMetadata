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
  FieldProp,
  FieldTypes,
  getField,
} from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { applyPatch, type Operation } from 'fast-json-patch';
import { useState } from 'react';
import { Table } from '../../../../generated/entity/data/table';
import { TestCase } from '../../../../generated/tests/testCase';
import {
  TestDataType,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import {
  createTestCase,
  getTestDefinitionById,
  updateTestCaseById,
} from '../../../../rest/testAPI';
import { createUpdatedTestCasePatch } from '../../../../utils/DataQuality/DataQualityPureUtils';
import TestCaseFormDrawer from './TestCaseFormDrawer';
import {
  TestCaseFormContext,
  TestCaseFormDrawerProps,
  TestLevel,
} from './TestCaseFormV1.interface';
import { buildEditDefaults } from './transformTestCaseFormData';

const mockGetResourceLimit = jest.fn().mockResolvedValue(undefined);

// The real doc markdown Task 7 authored for the test-type field. The mocked
// TestCaseFormBody renders a real doc-bearing field via getField so the
// drawer's showFieldDocs/renderFieldDoc wiring is exercised end-to-end.
const TEST_TYPE_DOC =
  'The kind of validation to run. Choose a table- or column-level test; the parameters below adapt to your selection.';

jest.mock('../../../../rest/testAPI', () => ({
  createTestCase: jest.fn(),
  getTestDefinitionById: jest.fn(),
  updateTestCaseById: jest.fn(),
}));

jest.mock('../../../../utils/DataQuality/DataQualityPureUtils', () => ({
  ...jest.requireActual('../../../../utils/DataQuality/DataQualityPureUtils'),
  createUpdatedTestCasePatch: jest.fn(),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  addIngestionPipeline: jest.fn().mockResolvedValue({ id: 'pipeline-id' }),
  deployIngestionPipelineById: jest.fn().mockResolvedValue({}),
}));

jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockReturnValue({ isAirflowAvailable: true }),
  })
);

jest.mock('../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockReturnValue({
    config: {},
    getResourceLimit: (...args: unknown[]) => mockGetResourceLimit(...args),
  }),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: { ingestionPipeline: { Create: true, EditAll: true } },
  }),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('./transformTestCaseFormData', () => ({
  // `normalizeFormValuesForPayload` is the shared normalizer `handleEditSubmit`
  // (the code under test in the regression suite below) calls directly; it
  // must stay real so the edit-submit patch reflects genuine normalization,
  // not a stub.
  ...jest.requireActual('./transformTestCaseFormData'),
  transformTestCaseFormData: jest
    .fn()
    .mockReturnValue({ name: 'transformed-test-case' }),
  buildTestSuitePipelinePayload: jest
    .fn()
    .mockReturnValue({ name: 'pipeline-payload' }),
  buildEditDefaults: jest.fn().mockReturnValue({
    testName: 'existing-test-case',
    displayName: 'Existing Test Case',
    params: { value: '10' },
  }),
}));

const mockContext: TestCaseFormContext = {
  selectedDefinition: undefined,
  selectedTableData: undefined,
  selectedColumn: undefined,
  selectedTestLevel: TestLevel.TABLE,
  generateName: () => 'generated-name',
  canCreatePipeline: false,
};

const mockContextWithPipeline: TestCaseFormContext = {
  selectedDefinition: undefined,
  selectedTableData: {
    id: 'table-id',
    name: 'table',
    fullyQualifiedName: 'service.db.schema.table',
  } as Table,
  selectedColumn: undefined,
  selectedTestLevel: TestLevel.TABLE,
  generateName: () => 'generated-name',
  canCreatePipeline: true,
};

let emitContextFn: ((ctx: TestCaseFormContext) => void) | undefined;
let emitActiveFieldFn: ((fieldId: string) => void) | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastFormBodyProps: Record<string, any> | undefined;

jest.mock('./TestCaseFormBody', () =>
  jest.fn().mockImplementation(
    ({
      form,
      onContextChange,
      onActiveFieldChange,
      errorMessage,
      isEditMode,
      showOnlyParameter,
    }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any) => {
      emitContextFn = onContextChange;
      emitActiveFieldFn = onActiveFieldChange;
      lastFormBodyProps = { isEditMode, showOnlyParameter };

      const testTypeField: FieldProp = {
        name: 'testTypeId',
        label: 'Test Type',
        type: FieldTypes.TEXT,
        required: false,
        id: 'root/testType',
        doc: TEST_TYPE_DOC,
        props: { 'data-testid': 'test-type' },
      };

      const testNameValue = form?.watch ? form.watch('testName') : undefined;
      const displayNameValue = form?.watch
        ? form.watch('displayName')
        : undefined;
      const paramsValue = form?.watch ? form.watch('params') : undefined;

      return (
        <div data-testid="test-case-form-body">
          {!showOnlyParameter && (
            <input
              data-testid="test-case-name"
              disabled={Boolean(isEditMode)}
              value={testNameValue ?? ''}
              onChange={() => undefined}
            />
          )}
          {!showOnlyParameter && isEditMode && (
            <input
              data-testid="display-name"
              value={displayNameValue ?? ''}
              onChange={() => undefined}
            />
          )}
          {!showOnlyParameter && (
            <div data-testid="select-table-card">select-table-card</div>
          )}
          <div data-testid="test-type-card">
            {getField(testTypeField)}
            <div data-testid="params-value">
              {paramsValue ? JSON.stringify(paramsValue) : ''}
            </div>
          </div>
          {errorMessage && <div data-testid="form-error">{errorMessage}</div>}
          <button
            data-testid="emit-context"
            onClick={() => onContextChange?.(mockContext)}>
            emit
          </button>
          <button
            data-testid="emit-context-pipeline"
            onClick={() => onContextChange?.(mockContextWithPipeline)}>
            emit-pipeline
          </button>
          <button
            data-testid="emit-active-field"
            onClick={() => onActiveFieldChange?.('testName')}>
            emit-field
          </button>
        </div>
      );
    }
  )
);

jest.mock('../../../common/ServiceDocPanel/ServiceDocPanel', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="service-doc-panel">doc-panel</div>
    ))
);

// RichTextEditorPreviewerV1 wraps a lazy BlockEditor (TipTap) that does not
// render its content synchronously in jsdom. Mock it to render the markdown as
// plain text so the field-doc popover assertion inspects the real doc string
// that renderFieldDoc receives.
jest.mock(
  '../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    function MockRichTextEditorPreviewerV1({ markdown }: { markdown: string }) {
      return <div data-testid="rich-text-previewer">{markdown}</div>;
    }
);

const mockCreateTestCase = createTestCase as jest.Mock;
const mockAddIngestionPipeline = addIngestionPipeline as jest.Mock;
const mockDeployIngestionPipelineById =
  deployIngestionPipelineById as jest.Mock;

const mockTable = {
  id: 'table-id',
  name: 'table',
  fullyQualifiedName: 'service.db.schema.table',
} as Table;

const renderDrawer = (props: Partial<TestCaseFormDrawerProps> = {}) =>
  render(
    <TestCaseFormDrawer open table={mockTable} onClose={jest.fn()} {...props} />
  );

describe('TestCaseFormDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emitContextFn = undefined;
    emitActiveFieldFn = undefined;
    mockCreateTestCase.mockResolvedValue({
      name: 'transformed-test-case',
      id: 'created-id',
    });
  });

  it('should render the drawer with the form body when open is true', async () => {
    renderDrawer();

    expect(
      await screen.findByTestId('test-case-form-body')
    ).toBeInTheDocument();
    expect(screen.getByText('label.add-entity')).toBeInTheDocument();
  });

  it('should create test case and call onFormSubmit then onClose on submit', async () => {
    const onFormSubmit = jest.fn();
    const onClose = jest.fn();
    renderDrawer({ onFormSubmit, onClose });

    const submitBtn = await screen.findByTestId('create-btn');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockCreateTestCase).toHaveBeenCalledWith({
        name: 'transformed-test-case',
      });
    });

    await waitFor(() => {
      expect(onFormSubmit).toHaveBeenCalledWith({
        name: 'transformed-test-case',
        id: 'created-id',
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should call onClose exactly once on a successful submit', async () => {
    const onClose = jest.fn();
    renderDrawer({ onClose });

    const submitBtn = await screen.findByTestId('create-btn');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onClose exactly once when the cancel button is clicked', async () => {
    const onClose = jest.fn();
    renderDrawer({ onClose });

    const cancelBtn = await screen.findByTestId('cancel-btn');

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose exactly once when a consumer flips open to false on cancel', async () => {
    const onCloseSpy = jest.fn();

    const Consumer = () => {
      const [open, setOpen] = useState(true);

      return (
        <TestCaseFormDrawer
          open={open}
          table={mockTable}
          onClose={() => {
            onCloseSpy();
            setOpen(false);
          }}
        />
      );
    };

    render(<Consumer />);

    const cancelBtn = await screen.findByTestId('cancel-btn');

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('should keep the drawer open and not call onClose when createTestCase rejects', async () => {
    mockCreateTestCase.mockRejectedValueOnce({
      response: { data: { message: 'boom' } },
    });
    const onClose = jest.fn();
    const onFormSubmit = jest.fn();
    renderDrawer({ onClose, onFormSubmit });

    const submitBtn = await screen.findByTestId('create-btn');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it('should render the doc panel in classic variant', async () => {
    renderDrawer({ variant: 'drawer' });

    expect(await screen.findByTestId('service-doc-panel')).toBeInTheDocument();
  });

  it('should not render the service doc panel in ai variant', async () => {
    renderDrawer({ variant: 'modal' });

    expect(
      await screen.findByTestId('test-case-form-body')
    ).toBeInTheDocument();
    // The AI variant replaces the ServiceDocPanel hint with the per-field
    // documentation popover (gated by the Show Hint toggle).
    expect(screen.queryByTestId('service-doc-panel')).not.toBeInTheDocument();
  });

  it('should call addIngestionPipeline and deployIngestionPipelineById when canCreatePipeline is true', async () => {
    const mockTestSuite = { id: 'suite-id', name: 'test-suite' };
    mockCreateTestCase.mockResolvedValue({
      name: 'transformed-test-case',
      id: 'created-id',
      testSuite: mockTestSuite,
    });

    const onFormSubmit = jest.fn();
    const onClose = jest.fn();
    renderDrawer({ onFormSubmit, onClose });

    await screen.findByTestId('test-case-form-body');

    // Emit the pipeline-enabled context directly via the captured callback
    // before interacting with UI, to avoid triggering a re-render mid-test
    await act(async () => {
      emitContextFn?.(mockContextWithPipeline);
    });

    const submitBtn = await screen.findByTestId('create-btn');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockCreateTestCase).toHaveBeenCalledWith({
        name: 'transformed-test-case',
      });
    });

    await waitFor(() => {
      expect(mockAddIngestionPipeline).toHaveBeenCalledWith({
        name: 'pipeline-payload',
      });
    });

    await waitFor(() => {
      expect(mockDeployIngestionPipelineById).toHaveBeenCalledWith(
        'pipeline-id'
      );
    });

    await waitFor(() => {
      expect(onFormSubmit).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should forward onActiveFieldChange from body to the prop callback', async () => {
    const onActiveFieldChange = jest.fn();
    renderDrawer({ onActiveFieldChange });

    await screen.findByTestId('test-case-form-body');

    await act(async () => {
      emitActiveFieldFn?.('testName');
    });

    expect(onActiveFieldChange).toHaveBeenCalledWith('testName');
  });

  it('should not throw when onActiveFieldChange prop is not provided', async () => {
    renderDrawer();

    await screen.findByTestId('test-case-form-body');

    await expect(
      act(async () => {
        emitActiveFieldFn?.('testName');
      })
    ).resolves.not.toThrow();
  });

  describe('ai variant', () => {
    it('should render a centered modal (role=dialog) instead of the slideout drawer when open', async () => {
      renderDrawer({ variant: 'modal' });

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(
        await screen.findByTestId('test-case-form-body')
      ).toBeInTheDocument();
      // The AI modal exposes the same footer test ids as the classic drawer so
      // the shared submit helpers drive either variant.
      expect(screen.getByTestId('create-btn')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
      // But not the slideout drawer chrome.
      expect(screen.queryByTestId('drawer-title')).not.toBeInTheDocument();
    });

    it('should render the default ai header title', async () => {
      renderDrawer({ variant: 'modal' });

      await screen.findByRole('dialog');

      expect(screen.getByText('label.add-entity')).toBeInTheDocument();
    });

    it('should call onClose exactly once when the cancel button is clicked', async () => {
      const onClose = jest.fn();
      renderDrawer({ variant: 'modal', onClose });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose exactly once when the X close button is clicked', async () => {
      const onClose = jest.fn();
      renderDrawer({ variant: 'modal', onClose });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should create the test case and call onClose once on a successful submit', async () => {
      const onFormSubmit = jest.fn();
      const onClose = jest.fn();
      renderDrawer({ variant: 'modal', onFormSubmit, onClose });

      await screen.findByRole('dialog');

      const submitBtn = screen.getByRole('button', { name: 'label.create' });

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(mockCreateTestCase).toHaveBeenCalledWith({
          name: 'transformed-test-case',
        });
      });

      await waitFor(() => {
        expect(onFormSubmit).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should keep the modal open and show the inline error when createTestCase rejects', async () => {
      mockCreateTestCase.mockRejectedValueOnce({
        response: { data: { message: 'boom' } },
      });
      const onClose = jest.fn();
      renderDrawer({ variant: 'modal', onClose });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'label.create' }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent('boom');
      });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('gates the field doc popover behind the Show Hint toggle', async () => {
      renderDrawer({ variant: 'modal' });

      const testType = await screen.findByLabelText(/test type/i);

      // Show Hint is on by default: focusing a field shows its doc popover.
      await act(async () => {
        testType.focus();
      });

      expect(
        await screen.findByText(/kind of validation to run/i)
      ).toBeInTheDocument();

      // Toggling Show Hint off removes the popover.
      await act(async () => {
        fireEvent.click(
          screen.getByRole('switch', { name: 'label.show-hint' })
        );
      });

      expect(
        screen.queryByText(/kind of validation to run/i)
      ).not.toBeInTheDocument();
    });

    it('shows the field doc popover in the AI variant on focus', async () => {
      renderDrawer({ variant: 'modal' });

      const testType = await screen.findByLabelText(/test type/i);

      await act(async () => {
        testType.focus();
      });

      expect(
        await screen.findByText(/kind of validation to run/i)
      ).toBeInTheDocument();
    });
  });

  it('does not show the field doc popover in the classic variant on focus', async () => {
    renderDrawer({ variant: 'drawer' });

    const testType = await screen.findByLabelText(/test type/i);

    await act(async () => {
      testType.focus();
    });

    expect(
      screen.queryByText(/kind of validation to run/i)
    ).not.toBeInTheDocument();
  });

  describe('edit mode', () => {
    const mockTestDefinition = {
      id: 'def-1',
      name: 'tableRowCountToEqual',
      fullyQualifiedName: 'tableRowCountToEqual',
      supportsRowLevelPassedFailed: false,
    } as TestDefinition;

    const mockTestCase = {
      id: 'test-case-id',
      name: 'existing-test-case',
      displayName: 'Existing Test Case',
      entityLink: '<#E::table::service.db.schema.table>',
      testDefinition: {
        id: 'def-1',
        fullyQualifiedName: 'tableRowCountToEqual',
      },
      parameterValues: [{ name: 'value', value: '10' }],
      tags: [],
    } as unknown as TestCase;

    const mockGetTestDefinitionById = getTestDefinitionById as jest.Mock;
    const mockUpdateTestCaseById = updateTestCaseById as jest.Mock;
    const mockCreateUpdatedTestCasePatch =
      createUpdatedTestCasePatch as jest.Mock;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(mockTestDefinition);
      mockUpdateTestCaseById.mockResolvedValue(mockTestCase);
      mockCreateUpdatedTestCasePatch.mockReturnValue([
        { op: 'replace', path: '/displayName', value: 'Updated Name' },
      ]);
    });

    it('prefills the form with the test case name (disabled) and display name', async () => {
      renderDrawer({ testCase: mockTestCase });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith('def-1');
      });

      const nameInput = await screen.findByTestId('test-case-name');
      const displayNameInput = await screen.findByTestId('display-name');

      await waitFor(() => {
        expect(nameInput).toHaveValue('existing-test-case');
      });

      expect(nameInput).toBeDisabled();
      expect(displayNameInput).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('params-value')).toHaveTextContent('value');
      });
    });

    it('submits an update patch via updateTestCaseById and fires onUpdate', async () => {
      const onUpdate = jest.fn();
      const onClose = jest.fn();
      renderDrawer({ testCase: mockTestCase, onUpdate, onClose });

      await waitFor(() => {
        expect(screen.getByTestId('test-case-name')).toHaveValue(
          'existing-test-case'
        );
      });

      const submitBtn = await screen.findByTestId('create-btn');

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(mockUpdateTestCaseById).toHaveBeenCalledWith('test-case-id', [
          { op: 'replace', path: '/displayName', value: 'Updated Name' },
        ]);
      });

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(mockTestCase);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('does not call updateTestCaseById and closes the drawer when the patch is empty', async () => {
      mockCreateUpdatedTestCasePatch.mockReturnValue([]);
      const onClose = jest.fn();
      const onUpdate = jest.fn();
      renderDrawer({ testCase: mockTestCase, onClose, onUpdate });

      await waitFor(() => {
        expect(screen.getByTestId('test-case-name')).toHaveValue(
          'existing-test-case'
        );
      });

      const submitBtn = await screen.findByTestId('create-btn');

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });

      expect(mockUpdateTestCaseById).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('renders only the params card when showOnlyParameter is true', async () => {
      renderDrawer({ testCase: mockTestCase, showOnlyParameter: true });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalled();
      });

      expect(await screen.findByTestId('test-type-card')).toBeInTheDocument();
      expect(screen.queryByTestId('select-table-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-case-name')).not.toBeInTheDocument();
      expect(lastFormBodyProps?.showOnlyParameter).toBe(true);
    });

    it('renders the edit title with the test case name', async () => {
      renderDrawer({ testCase: mockTestCase });

      expect(await screen.findByText('label.edit-entity')).toBeInTheDocument();
    });
  });
});

describe('edit submit uses the directly-fetched definition (Finding 1 regression)', () => {
  // createUpdatedTestCasePatch is mocked module-wide above; pull the real
  // implementation here so a genuine JSON patch is produced and the
  // Array-param serialization bug is actually observable end-to-end.
  const { createUpdatedTestCasePatch: realCreateUpdatedTestCasePatch } =
    jest.requireActual('../../../../utils/DataQuality/DataQualityPureUtils');

  const mockGetTestDefinitionById = getTestDefinitionById as jest.Mock;
  const mockUpdateTestCaseById = updateTestCaseById as jest.Mock;
  const mockCreateUpdatedTestCasePatch =
    createUpdatedTestCasePatch as jest.Mock;
  const mockBuildEditDefaults = buildEditDefaults as jest.Mock;

  const arrayParamDefinition = {
    id: 'def-array',
    name: 'columnValuesToBeInSet',
    fullyQualifiedName: 'columnValuesToBeInSet',
    supportsRowLevelPassedFailed: false,
    parameterDefinition: [
      { name: 'allowedValues', dataType: TestDataType.Array },
    ],
  } as TestDefinition;

  const arrayParamTestCase = {
    id: 'test-case-id',
    name: 'existing-test-case',
    displayName: 'Existing Test Case',
    entityLink: '<#E::table::service.db.schema.table>',
    testDefinition: {
      id: 'def-array',
      fullyQualifiedName: 'columnValuesToBeInSet',
    },
    parameterValues: [
      { name: 'allowedValues', value: JSON.stringify(['a', 'b']) },
    ],
    tags: [],
  } as unknown as TestCase;

  beforeEach(() => {
    mockGetTestDefinitionById.mockResolvedValue(arrayParamDefinition);
    mockUpdateTestCaseById.mockResolvedValue(arrayParamTestCase);
    // Real implementation, restored per-test since the top-level mock
    // factory replaces createUpdatedTestCasePatch with a jest.fn().
    mockCreateUpdatedTestCasePatch.mockImplementation(
      realCreateUpdatedTestCasePatch
    );
    // Mirrors what the real buildEditDefaults produces for an Array-type
    // param (see transformTestCaseFormData.buildEditParams): a
    // `{ value: string }[]` shape that createTestCaseParameters must
    // re-serialize using the test definition's parameterDefinition. The
    // values differ from the stored testCase.parameterValues (['a','b'])
    // so the edit produces a genuine, non-empty patch.
    mockBuildEditDefaults.mockReturnValue({
      testName: arrayParamTestCase.name,
      displayName: arrayParamTestCase.displayName,
      params: { allowedValues: [{ value: 'c' }, { value: 'd' }] },
    });
  });

  it('serializes an Array-type param correctly even when TestCaseFormBody reports selectedDefinition as undefined (filter-miss/race)', async () => {
    renderDrawer({ testCase: arrayParamTestCase });

    await waitFor(() => {
      expect(mockGetTestDefinitionById).toHaveBeenCalledWith('def-array');
    });

    // Simulate TestCaseFormBody resolving its filtered definitions list
    // without the current test's definition (deprecated/mismatched, or a
    // race where submit happens before the list loads).
    await act(async () => {
      emitContextFn?.({
        selectedDefinition: undefined,
        selectedTableData: undefined,
        selectedColumn: undefined,
        selectedTestLevel: TestLevel.TABLE,
        generateName: () => 'generated-name',
        canCreatePipeline: false,
      });
    });

    const submitBtn = await screen.findByTestId('create-btn');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockUpdateTestCaseById).toHaveBeenCalled();
    });

    const [, patch] = mockUpdateTestCaseById.mock.calls[0] as [
      string,
      Array<{ op: string; path: string; value?: unknown }>
    ];

    const paramsValueOp = patch.find((op) =>
      op.path.startsWith('/parameterValues')
    );

    expect(paramsValueOp).toBeDefined();

    // The allowedValues param must be serialized as a JSON-stringified array
    // (matching TestCaseParameterValue.value: string), not the raw
    // `{ value: string }[]` form-field shape.
    expect(typeof paramsValueOp?.value).toBe('string');
    expect(JSON.parse(paramsValueOp?.value as string)).toEqual(['c', 'd']);
  });
});

describe('edit submit normalizes FormSelectItem-shaped prefill values (patch corruption regression)', () => {
  // createUpdatedTestCasePatch is mocked module-wide above; pull the real
  // implementation so the patch actually reflects whatever shape
  // handleEditSubmit hands it — a raw FormSelectItem/dotted-key/object-array
  // would otherwise be masked by the jest.fn() mock.
  const { createUpdatedTestCasePatch: realCreateUpdatedTestCasePatch } =
    jest.requireActual('../../../../utils/DataQuality/DataQualityPureUtils');

  const mockGetTestDefinitionById = getTestDefinitionById as jest.Mock;
  const mockUpdateTestCaseById = updateTestCaseById as jest.Mock;
  const mockCreateUpdatedTestCasePatch =
    createUpdatedTestCasePatch as jest.Mock;
  const mockBuildEditDefaults = buildEditDefaults as jest.Mock;

  // A `column` param is classified 'select' by `isSelectParam` (param.name
  // === 'column'), so edit prefill stores it as a FormSelectItem — see
  // `buildEditParamEntry` in transformTestCaseFormData.ts.
  const selectParamDefinition = {
    id: 'def-select',
    name: 'columnValuesToBeInSet',
    fullyQualifiedName: 'columnValuesToBeInSet',
    supportsRowLevelPassedFailed: false,
    parameterDefinition: [
      { name: 'column', dataType: TestDataType.String },
      { name: 'partition.interval', dataType: TestDataType.String },
      { name: 'allowedValues', dataType: TestDataType.Array },
    ],
  } as TestDefinition;

  const selectParamTestCase = {
    id: 'test-case-id',
    name: 'existing-test-case',
    displayName: 'Existing Test Case',
    entityLink: '<#E::table::service.db.schema.table::columns::col_x>',
    testDefinition: {
      id: 'def-select',
      fullyQualifiedName: 'columnValuesToBeInSet',
    },
    parameterValues: [
      { name: 'column', value: 'col_x' },
      { name: 'partition.interval', value: '15' },
      { name: 'allowedValues', value: JSON.stringify(['a', 'b']) },
    ],
    dimensionColumns: ['col_b'],
    tags: [],
  } as unknown as TestCase;

  beforeEach(() => {
    mockGetTestDefinitionById.mockResolvedValue(selectParamDefinition);
    mockUpdateTestCaseById.mockResolvedValue(selectParamTestCase);
    mockCreateUpdatedTestCasePatch.mockImplementation(
      realCreateUpdatedTestCasePatch
    );
    // Mirrors the real edit-prefill shape (`buildEditDefaults` /
    // `buildEditParamEntry`): a select param prefills as a FormSelectItem, a
    // dotted param name prefills sanitized (`___`), and `dimensionColumns`
    // prefills as FormSelectItem[] — all exactly as they'd render in the UI.
    mockBuildEditDefaults.mockReturnValue({
      testName: selectParamTestCase.name,
      displayName: selectParamTestCase.displayName,
      params: {
        column: { id: 'col_x', label: 'col_x' },
        partition___interval: '30',
        allowedValues: [
          { value: { id: 'a', label: 'a' } },
          { value: { id: 'b', label: 'b' } },
        ],
      },
      dimensionColumns: [{ id: 'col_a', label: 'col_a' }],
    });
  });

  it('emits ids/dotted-keys/string[] in the patch, not raw FormSelectItem shapes', async () => {
    renderDrawer({ testCase: selectParamTestCase });

    await waitFor(() => {
      expect(mockGetTestDefinitionById).toHaveBeenCalledWith('def-select');
    });

    const submitBtn = await screen.findByTestId('create-btn');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockUpdateTestCaseById).toHaveBeenCalled();
    });

    const [, patch] = mockUpdateTestCaseById.mock.calls[0] as [
      string,
      Operation[]
    ];

    // Reconstruct the patched entity instead of asserting on individual ops
    // directly — fast-json-patch may emit either a whole-array replace or
    // per-index replaces depending on how many elements changed, and the
    // assertion should hold either way.
    const patched = applyPatch(structuredClone(selectParamTestCase), patch)
      .newDocument as unknown as TestCase & {
      parameterValues: Array<{ name: string; value: string }>;
    };

    const columnParam = patched.parameterValues.find(
      (p) => p.name === 'column'
    );

    // Must be the raw string id, not `{ id: 'col_x', label: 'col_x' }`.
    expect(columnParam?.value).toBe('col_x');

    const dottedParam = patched.parameterValues.find(
      (p) => p.name === 'partition.interval'
    );

    // The sanitized `___` key must be restored to its dotted form.
    expect(dottedParam).toBeDefined();
    expect(dottedParam?.value).toBe('30');
    expect(
      patched.parameterValues.some((p) => p.name === 'partition___interval')
    ).toBe(false);

    const allowedValuesParam = patched.parameterValues.find(
      (p) => p.name === 'allowedValues'
    );

    // Array param values must unwrap the nested FormSelectItem to its id.
    expect(JSON.parse(allowedValuesParam?.value as string)).toEqual(['a', 'b']);

    // dimensionColumns must be a plain string[], not FormSelectItem[].
    expect(patched.dimensionColumns).toEqual(['col_a']);
  });
});

describe('createUpdatedTestCasePatch (phantom tags op)', () => {
  // createUpdatedTestCasePatch is mocked module-wide above for the drawer
  // tests; pull the real implementation to verify the tags-diffing edge case
  // that used to live in EditTestCaseModal(V1)'s tests.
  const { createUpdatedTestCasePatch: realCreateUpdatedTestCasePatch } =
    jest.requireActual('../../../../utils/DataQuality/DataQualityPureUtils');

  const baseTestCase = {
    id: 'test-case-id',
    name: 'existing-test-case',
    displayName: 'Existing Test Case',
    entityLink: '<#E::table::service.db.schema.table>',
    tags: undefined,
  } as unknown as TestCase;

  it('does not emit a phantom /tags op when editing display name of a tagless test case', () => {
    const patch = realCreateUpdatedTestCasePatch({
      testCase: baseTestCase,
      value: { displayName: 'Updated Display Name' },
      createTestCaseObject: {},
      isComputeRowCountFieldVisible: false,
    });

    expect(patch).not.toContainEqual(
      expect.objectContaining({ path: '/tags' })
    );
    expect(patch).toContainEqual({
      op: 'replace',
      path: '/displayName',
      value: 'Updated Display Name',
    });
  });

  it('emits a /tags replace op when tags actually change', () => {
    const patch = realCreateUpdatedTestCasePatch({
      testCase: baseTestCase,
      value: {
        displayName: 'Existing Test Case',
        tags: [
          {
            tagFQN: 'PII.Sensitive',
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
      },
      createTestCaseObject: {},
      isComputeRowCountFieldVisible: false,
    });

    expect(patch).toContainEqual(expect.objectContaining({ path: '/tags' }));
  });
});
