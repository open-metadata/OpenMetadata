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
import { useState } from 'react';
import { Table } from '../../../../generated/entity/data/table';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import { createTestCase } from '../../../../rest/testAPI';
import TestCaseFormDrawer from './TestCaseFormDrawer';
import {
  TestCaseFormContext,
  TestCaseFormDrawerProps,
  TestLevel,
} from './TestCaseFormV1.interface';

const mockGetResourceLimit = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../../rest/testAPI', () => ({
  createTestCase: jest.fn(),
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
  transformTestCaseFormData: jest
    .fn()
    .mockReturnValue({ name: 'transformed-test-case' }),
  buildTestSuitePipelinePayload: jest
    .fn()
    .mockReturnValue({ name: 'pipeline-payload' }),
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

jest.mock('./TestCaseFormBody', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        onContextChange,
        onActiveFieldChange,
        errorMessage,
      }: {
        onContextChange?: (ctx: TestCaseFormContext) => void;
        onActiveFieldChange?: (fieldId: string) => void;
        errorMessage?: string;
      }) => {
        emitContextFn = onContextChange;
        emitActiveFieldFn = onActiveFieldChange;

        return (
          <div data-testid="test-case-form-body">
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

    const submitBtn = await screen.findByTestId('save-btn');

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

    const submitBtn = await screen.findByTestId('save-btn');

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

    const submitBtn = await screen.findByTestId('save-btn');

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
    renderDrawer({ variant: 'classic' });

    expect(await screen.findByTestId('service-doc-panel')).toBeInTheDocument();
  });

  it('should render the doc panel inside the floating hint card in ai variant', async () => {
    renderDrawer({ variant: 'ai' });

    expect(
      await screen.findByTestId('test-case-form-body')
    ).toBeInTheDocument();
    expect(screen.getByTestId('test-case-form-hint')).toBeInTheDocument();
    expect(screen.getByTestId('service-doc-panel')).toBeInTheDocument();
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

    const submitBtn = await screen.findByTestId('save-btn');

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
      renderDrawer({ variant: 'ai' });

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(
        await screen.findByTestId('test-case-form-body')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-btn')).not.toBeInTheDocument();
    });

    it('should render the default ai header title', async () => {
      renderDrawer({ variant: 'ai' });

      await screen.findByRole('dialog');

      expect(screen.getByText('label.add-entity')).toBeInTheDocument();
    });

    it('should call onClose exactly once when the cancel button is clicked', async () => {
      const onClose = jest.fn();
      renderDrawer({ variant: 'ai', onClose });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose exactly once when the X close button is clicked', async () => {
      const onClose = jest.fn();
      renderDrawer({ variant: 'ai', onClose });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should create the test case and call onClose once on a successful submit', async () => {
      const onFormSubmit = jest.fn();
      const onClose = jest.fn();
      renderDrawer({ variant: 'ai', onFormSubmit, onClose });

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
      renderDrawer({ variant: 'ai', onClose });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'label.create' }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent('boom');
      });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should show the form hint by default and hide it when Show Hint is toggled off', async () => {
      renderDrawer({ variant: 'ai' });

      await screen.findByRole('dialog');

      expect(screen.getByTestId('service-doc-panel')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('switch', { name: 'label.show-hint' })
        );
      });

      expect(screen.queryByTestId('service-doc-panel')).not.toBeInTheDocument();
    });
  });
});
