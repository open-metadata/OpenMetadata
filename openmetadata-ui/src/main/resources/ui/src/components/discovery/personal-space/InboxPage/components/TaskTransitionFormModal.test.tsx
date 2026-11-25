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

import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  Task,
  TaskAvailableTransition,
  TaskStatus,
} from '../../../../../generated/entity/tasks/task';
import { TaskFormSchema } from '../../../../../rest/taskFormSchemasAPI';

// The modal shell is a render/portal boundary (react-aria overlays, focus traps);
// stub it so the test asserts the modal's wiring, not the overlay plumbing.
// The field widgets (Input, TextArea, Checkbox, Select, FormItemLabel, Grid)
// stay real so the form really renders and really edits — mocks belong at
// boundaries, not in the internal schema/field code (see CLAUDE.md).
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
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
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

// `TaskPayloadSchemaFields` pulls in the rich-text / diff / tag-selector
// editors for description- and tag-task widgets. Our transition forms only use
// plain string / number / boolean widgets, so these never render — but they are
// imported at module load, so stub them to keep the test off the editor stack.
jest.mock('../../../../../pages/TasksPage/shared/DescriptionTabs', () => ({
  DescriptionTabs: () => <div data-testid="description-tabs" />,
}));
jest.mock('../../../../../pages/TasksPage/shared/TagsTabs', () => ({
  TagsTabs: () => <div data-testid="tags-tabs" />,
}));
jest.mock('../../../../../pages/TasksPage/shared/TagSuggestion', () => ({
  __esModule: true,
  default: () => <div data-testid="tag-suggestion" />,
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
          targetField: { type: 'string', title: 'Target Field' },
          proposedText: { type: 'string', title: 'Proposed Text' },
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
} as unknown as Task;

describe('TaskTransitionFormModal', () => {
  it('renders the form seeded from the task payload', async () => {
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
    await screen.findByTestId('task-transition-form-confirm');

    expect(
      screen.getByTestId('task-transition-form-modal')
    ).toBeInTheDocument();
    expect(screen.getByTestId('task-transition-form-modal')).toHaveAttribute(
      'data-title',
      'Approve'
    );
    expect(screen.getByRole('textbox', { name: /Target Field/ })).toHaveValue(
      'description'
    );
    expect(screen.getByRole('textbox', { name: /Proposed Text/ })).toHaveValue(
      ''
    );
  });

  it('disables confirm and shows the required hint while a required field is missing', async () => {
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
    await screen.findByTestId('task-transition-form-confirm');

    expect(screen.getByTestId('task-transition-form-confirm')).toBeDisabled();
    expect(
      screen.getByTestId('task-transition-form-required-hint')
    ).toBeInTheDocument();
  });

  it('enables confirm and fires onConfirm with the payload once required fields are filled', async () => {
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
    await screen.findByTestId('task-transition-form-confirm');

    fireEvent.change(screen.getByRole('textbox', { name: /Proposed Text/ }), {
      target: { value: 'new description' },
    });

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

  it('keeps confirm disabled until a comment is entered when the transition requires one', async () => {
    const onConfirm = jest.fn();
    const approve = SCHEMA.transitionForms?.approve as {
      formSchema: { properties: Record<string, unknown> };
    };
    render(
      <TaskTransitionFormModal
        open
        actionLabel="Approve"
        schema={{
          ...SCHEMA,
          transitionForms: {
            approve: {
              formSchema: {
                ...approve.formSchema,
                properties: {
                  ...approve.formSchema.properties,
                  comment: { type: 'string', title: 'Comment' },
                },
              },
              uiSchema: { 'ui:resolution': { mode: 'payload' }, comment: {} },
            },
          },
        }}
        task={TASK}
        title="Approve"
        transition={{ ...TRANSITION, requiresComment: true }}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );
    await screen.findByTestId('task-transition-form-confirm');

    fireEvent.change(screen.getByRole('textbox', { name: /Proposed Text/ }), {
      target: { value: 'new description' },
    });

    expect(screen.getByTestId('task-transition-form-confirm')).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: /Comment/ }), {
      target: { value: 'Looks good' },
    });
    fireEvent.click(screen.getByTestId('task-transition-form-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({
      targetField: 'description',
      proposedText: 'new description',
      comment: 'Looks good',
    });
  });

  // A required boolean field set to `false` is a valid answer, not a missing
  // one — confirm must stay enabled so the resolver can submit `false`.
  it('does not block confirm for a required boolean field set to false', async () => {
    const onConfirm = jest.fn();
    const booleanSchema: TaskFormSchema = {
      ...SCHEMA,
      transitionForms: {
        approve: {
          formSchema: {
            type: 'object',
            required: ['approved'],
            properties: {
              approved: { type: 'boolean', title: 'Approved', default: false },
            },
          },
          uiSchema: { 'ui:resolution': { mode: 'payload' } },
        },
      },
    };
    const booleanTask = {
      ...TASK,
      payload: { approved: false },
    } as never;

    render(
      <TaskTransitionFormModal
        open
        actionLabel="Approve"
        schema={booleanSchema}
        task={booleanTask}
        title="Approve"
        transition={TRANSITION}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );
    await screen.findByTestId('task-transition-form-confirm');

    expect(
      screen.getByTestId('task-transition-form-confirm')
    ).not.toBeDisabled();
    expect(
      screen.queryByTestId('task-transition-form-required-hint')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('task-transition-form-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({ approved: false });
  });

  // A required number field set to `0` is a valid answer, not a missing one.
  it('does not block confirm for a required number field set to 0', async () => {
    const onConfirm = jest.fn();
    const numberSchema: TaskFormSchema = {
      ...SCHEMA,
      transitionForms: {
        approve: {
          formSchema: {
            type: 'object',
            required: ['confidence'],
            properties: {
              confidence: { type: 'number', title: 'Confidence' },
            },
          },
          uiSchema: { 'ui:resolution': { mode: 'payload' } },
        },
      },
    };
    const numberTask = {
      ...TASK,
      payload: { confidence: 0 },
    } as never;

    render(
      <TaskTransitionFormModal
        open
        actionLabel="Approve"
        schema={numberSchema}
        task={numberTask}
        title="Approve"
        transition={TRANSITION}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );
    await screen.findByTestId('task-transition-form-confirm');

    expect(
      screen.getByTestId('task-transition-form-confirm')
    ).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('task-transition-form-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({ confidence: 0 });
  });

  it('does not fire onConfirm while loading', async () => {
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
    await screen.findByTestId('task-transition-form-confirm');

    fireEvent.change(screen.getByRole('textbox', { name: /Proposed Text/ }), {
      target: { value: 'new description' },
    });
    fireEvent.click(screen.getByTestId('task-transition-form-confirm'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is pressed', async () => {
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
    await screen.findByTestId('task-transition-form-confirm');

    fireEvent.click(screen.getByTestId('task-transition-form-cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when the overlay is dismissed', async () => {
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
    await screen.findByTestId('task-transition-form-confirm');

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
