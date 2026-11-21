/*
 *  Copyright 2026 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  TaskAvailableTransition,
  TaskStatus,
} from '../../../../../generated/entity/tasks/task';
import { TaskFormSchema } from '../../../../../rest/taskFormSchemasAPI';

jest.mock('@openmetadata/ui-core-components', () => ({
  ModalOverlay: ({
    isOpen,
    onOpenChange,
    children,
  }: {
    isOpen?: boolean;
    onOpenChange: (...args: unknown[]) => void;
    children?: ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="overlay">
        <button
          aria-label="overlay-dismiss"
          data-testid="overlay-dismiss"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    ) : null,
  Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Dialog: Object.assign(
    ({
      children,
      title,
      'data-testid': testId,
    }: {
      children?: ReactNode;
      title?: string;
      'data-testid'?: string;
    }) => (
      <div data-testid={testId ?? 'dialog'} data-title={title}>
        {children}
      </div>
    ),
    {
      Content: ({ children }: { children?: ReactNode }) => (
        <div data-testid="dialog-content">{children}</div>
      ),
      Footer: ({ children }: { children?: ReactNode }) => (
        <div data-testid="dialog-footer">{children}</div>
      ),
    }
  ),
  Typography: ({
    children,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={testId}>{children}</span>,
  Button: ({
    children,
    onPress,
    isDisabled,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    onPress?: (...args: unknown[]) => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button
      data-testid={testId}
      disabled={isDisabled}
      type="button"
      onClick={onPress}>
      {children}
    </button>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

// A controllable form: renders one field per schema property and reports the
// current value, with a setter so a test can fill a required field. The real
// `TaskPayloadSchemaFields` has its own suite; here we only verify the modal
// wires `onChange`, the required guard and `onConfirm`/`onCancel` correctly.
let lastPayload: Record<string, unknown> | undefined;
let setField: ((field: string, value: unknown) => void) | undefined;
jest.mock(
  '../../../../../pages/TasksPage/shared/TaskPayloadSchemaFields',
  () => ({
    __esModule: true,
    default: ({
      payload,
      schema,
      onChange,
    }: {
      payload?: Record<string, unknown>;
      schema?: { properties?: Record<string, unknown> };
      onChange?: (next: Record<string, unknown>) => void;
    }) => {
      lastPayload = payload;
      setField = (field: string, value: unknown) =>
        onChange?.({ ...payload, [field]: value });

      return (
        <div data-testid="task-payload-fields">
          <span data-testid="field-names">
            {Object.keys(schema?.properties ?? {}).join(',')}
          </span>
          <span data-testid="field-targetField">
            {String(payload?.targetField)}
          </span>
          <span data-testid="field-proposedText">
            {String(payload?.proposedText)}
          </span>
        </div>
      );
    },
  })
);

const mockGetTaskTransitionFormSchema = jest.fn();
const mockGetTaskTransitionUiSchema = jest.fn();
const mockGetEditableTaskPayload = jest.fn();

jest.mock('../../../../../utils/TaskFormSchemaUtils', () => ({
  applyTaskFormSchemaDefaults: (payload: Record<string, unknown>) => payload,
  getEditableTaskPayload: (...a: unknown[]) => mockGetEditableTaskPayload(...a),
  getTaskTransitionFormSchema: (...a: unknown[]) =>
    mockGetTaskTransitionFormSchema(...a),
  getTaskTransitionUiSchema: (...a: unknown[]) =>
    mockGetTaskTransitionUiSchema(...a),
}));

import TaskTransitionFormModal from './TaskTransitionFormModal';

const TRANSITION: TaskAvailableTransition = {
  id: 'approve',
  label: 'Approve',
  formRef: 'approve',
  resolutionType: 'Approved' as TaskAvailableTransition['resolutionType'],
  targetStageId: 'approved',
  targetTaskStatus: TaskStatus.Approved,
};

const SCHEMA: TaskFormSchema = {
  name: 'CustomTask',
  taskType: 'CustomTask',
  taskCategory: 'Custom',
  formSchema: { type: 'object', properties: {} },
  transitionForms: {
    approve: {
      formSchema: {
        type: 'object',
        required: ['targetField', 'proposedText'],
        properties: {
          targetField: { type: 'string' },
          proposedText: { type: 'string' },
        },
      },
      uiSchema: { 'ui:resolution': { mode: 'payload' } },
    },
  },
};

const TASK = {
  id: 'task-1',
  type: 'CustomTask',
  category: 'Custom',
  status: TaskStatus.Open,
  payload: { targetField: 'description' },
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  const approveForm = SCHEMA.transitionForms?.approve;
  mockGetTaskTransitionFormSchema.mockReturnValue(approveForm?.formSchema);
  mockGetTaskTransitionUiSchema.mockReturnValue(approveForm?.uiSchema);
  // The editable payload seeds the form with the task's existing values.
  mockGetEditableTaskPayload.mockReturnValue({ targetField: 'description' });
});

// Helper so tests can drive the mocked `TaskPayloadSchemaFields` `onChange`.
function actSetField(field: string, value: unknown) {
  const setter = setField;
  if (!setter) {
    throw new Error('TaskPayloadSchemaFields was not rendered');
  }
  act(() => {
    setter(field, value);
  });
}

describe('TaskTransitionFormModal', () => {
  it('renders the form seeded from the task payload', () => {
    render(
      <TaskTransitionFormModal
        open
        actionLabel="Approve"
        schema={SCHEMA}
        task={TASK}
        title="Approve"
        transition={TRANSITION}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('task-transition-form-modal')
    ).toBeInTheDocument();
    expect(screen.getByTestId('task-transition-form-modal')).toHaveAttribute(
      'data-title',
      'Approve'
    );
    expect(screen.getByTestId('field-names').textContent).toBe(
      'targetField,proposedText'
    );
    // The `proposedText` is not in the task payload, so it reads as `undefined`.
    expect(screen.getByTestId('field-targetField').textContent).toBe(
      'description'
    );
    expect(screen.getByTestId('field-proposedText').textContent).toBe(
      'undefined'
    );
    // The editable payload the form was seeded with is the task payload.
    expect(lastPayload).toEqual({ targetField: 'description' });
  });

  it('disables confirm and shows the required hint while a required field is missing', () => {
    render(
      <TaskTransitionFormModal
        open
        actionLabel="Approve"
        schema={SCHEMA}
        task={TASK}
        title="Approve"
        transition={TRANSITION}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    // `proposedText` is required and missing → confirm disabled, hint shown.
    expect(screen.getByTestId('task-transition-form-confirm')).toBeDisabled();
    expect(
      screen.getByTestId('task-transition-form-required-hint')
    ).toBeInTheDocument();
  });

  it('enables confirm and fires onConfirm with the payload once required fields are filled', () => {
    const onConfirm = jest.fn();
    render(
      <TaskTransitionFormModal
        open
        actionLabel="Approve"
        schema={SCHEMA}
        task={TASK}
        title="Approve"
        transition={TRANSITION}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(setField).toBeDefined();

    // Fill the missing required field.
    actSetField('proposedText', 'new description');

    expect(
      screen.getByTestId('task-transition-form-confirm')
    ).not.toBeDisabled();
    expect(
      screen.queryByTestId('task-transition-form-required-hint')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('task-transition-form-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({
      targetField: 'description',
      proposedText: 'new description',
    });
  });

  it('does not fire onConfirm while loading', () => {
    const onConfirm = jest.fn();
    render(
      <TaskTransitionFormModal
        isLoading
        open
        actionLabel="Approve"
        schema={SCHEMA}
        task={TASK}
        title="Approve"
        transition={TRANSITION}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    actSetField('proposedText', 'new description');
    // The confirm button stays clickable (it is only `isLoading`-disabled by
    // the button's own loading state, not `isDisabled`), but the handler must
    // not fire while loading to avoid a double-submit.
    fireEvent.click(screen.getByTestId('task-transition-form-confirm'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is pressed', () => {
    const onCancel = jest.fn();
    render(
      <TaskTransitionFormModal
        open
        actionLabel="Approve"
        schema={SCHEMA}
        task={TASK}
        title="Approve"
        transition={TRANSITION}
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('task-transition-form-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when the overlay is dismissed', () => {
    const onCancel = jest.fn();
    render(
      <TaskTransitionFormModal
        open
        actionLabel="Approve"
        schema={SCHEMA}
        task={TASK}
        title="Approve"
        transition={TRANSITION}
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('overlay-dismiss'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <TaskTransitionFormModal
        actionLabel="Approve"
        open={false}
        schema={SCHEMA}
        task={TASK}
        title="Approve"
        transition={TRANSITION}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('task-transition-form-modal')
    ).not.toBeInTheDocument();
  });
});
