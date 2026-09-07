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
          type="button"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    ) : null,
  Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Dialog: Object.assign(
    ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    {
      Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Content: ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
      ),
    }
  ),
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
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
    <button data-testid={testId} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
  TextArea: ({
    value,
    onChange,
    hint,
    isInvalid,
    'data-testid': testId,
  }: {
    value?: string;
    onChange: (value: string) => void;
    hint?: ReactNode;
    isInvalid?: boolean;
    'data-testid'?: string;
  }) => (
    <div>
      <textarea
        aria-label={testId}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {isInvalid && hint && <span data-testid="comment-hint">{hint}</span>}
    </div>
  ),
  Select: Object.assign(
    ({
      items,
      selectedKey,
      onSelectionChange,
      hint,
      isInvalid,
      'data-testid': testId,
    }: {
      items: { id: string; label: ReactNode }[];
      selectedKey?: string | null;
      onSelectionChange: (key: string | null) => void;
      hint?: ReactNode;
      isInvalid?: boolean;
      'data-testid'?: string;
    }) => (
      <div>
        <select
          data-testid={testId}
          value={selectedKey ?? ''}
          onChange={(e) => onSelectionChange(e.target.value || null)}>
          <option value="">none</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {isInvalid && hint && <span data-testid="root-cause-hint">{hint}</span>}
      </div>
    ),
    { Item: ({ children }: { children?: ReactNode }) => <>{children}</> }
  ),
}));

jest.mock('generated/tests/testCaseResolutionStatus', () => ({
  TestCaseFailureReasonType: {
    Duplicates: 'Duplicates',
    FalsePositive: 'FalsePositive',
    MissingData: 'MissingData',
    Other: 'Other',
    OutOfBounds: 'OutOfBounds',
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import TaskActionCommentModal from './TaskActionCommentModal';

jest.mock('./TaskAssigneeSelect', () => ({
  __esModule: true,
  default: ({
    onChange,
  }: {
    onChange: (assignee: { id: string; type: string; name: string }) => void;
  }) => (
    <div data-testid="task-action-assignee">
      <input aria-label="assignee-input" data-testid="assignee-input" />
      <button
        aria-label="assignee-pick"
        data-testid="assignee-pick"
        onClick={() => onChange({ id: 'u1', type: 'user', name: 'bob' })}
      />
    </div>
  ),
}));

const defaultProps = {
  open: true,
  title: 'Close task',
  actionLabel: 'label.close',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe('TaskActionCommentModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<TaskActionCommentModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId('overlay')).not.toBeInTheDocument();
  });

  it('confirms with the trimmed comment', () => {
    render(<TaskActionCommentModal {...defaultProps} />);

    fireEvent.change(screen.getByTestId('task-action-comment'), {
      target: { value: '  looks good  ' },
    });
    fireEvent.click(screen.getByTestId('task-action-comment-confirm'));

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      comment: 'looks good',
      rootCause: undefined,
      assignee: undefined,
    });
  });

  it('allows an empty comment when not required', () => {
    render(<TaskActionCommentModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('task-action-comment-confirm'));

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      comment: '',
      rootCause: undefined,
      assignee: undefined,
    });
  });

  it('keeps confirm disabled while a required comment is blank', () => {
    render(
      <TaskActionCommentModal
        {...defaultProps}
        requiredMessage="message.task-closed-without-comment"
      />
    );

    const confirm = screen.getByTestId('task-action-comment-confirm');

    expect(confirm).toBeDisabled();
    // No hint yet: the field has not been touched.
    expect(screen.queryByTestId('comment-hint')).not.toBeInTheDocument();

    fireEvent.click(confirm);

    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('hints once a touched required comment is emptied again', () => {
    render(
      <TaskActionCommentModal
        {...defaultProps}
        requiredMessage="message.task-closed-without-comment"
      />
    );

    const field = screen.getByTestId('task-action-comment');
    fireEvent.change(field, { target: { value: 'typed' } });

    expect(screen.getByTestId('task-action-comment-confirm')).toBeEnabled();

    fireEvent.change(field, { target: { value: '   ' } });

    expect(screen.getByTestId('comment-hint')).toHaveTextContent(
      'message.task-closed-without-comment'
    );
    expect(screen.getByTestId('task-action-comment-confirm')).toBeDisabled();
  });

  it('confirms once a required comment is provided', () => {
    render(
      <TaskActionCommentModal
        {...defaultProps}
        requiredMessage="message.task-closed-without-comment"
      />
    );

    fireEvent.change(screen.getByTestId('task-action-comment'), {
      target: { value: 'closing this' },
    });
    fireEvent.click(screen.getByTestId('task-action-comment-confirm'));

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      comment: 'closing this',
      rootCause: undefined,
      assignee: undefined,
    });
  });

  it('cancels via the cancel button and overlay dismiss', () => {
    render(<TaskActionCommentModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('task-action-comment-cancel'));
    fireEvent.click(screen.getByTestId('overlay-dismiss'));

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(2);
  });

  it('ignores cancel while the action is in flight', () => {
    render(<TaskActionCommentModal {...defaultProps} isLoading />);

    fireEvent.click(screen.getByTestId('overlay-dismiss'));

    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });

  it('hides the root cause select by default', () => {
    render(<TaskActionCommentModal {...defaultProps} />);

    expect(
      screen.queryByTestId('task-action-root-cause')
    ).not.toBeInTheDocument();
  });

  it('requires a root cause when shown', () => {
    render(<TaskActionCommentModal {...defaultProps} showRootCause />);

    fireEvent.change(screen.getByTestId('task-action-comment'), {
      target: { value: 'resolved it' },
    });

    const confirm = screen.getByTestId('task-action-comment-confirm');

    expect(confirm).toBeDisabled();

    fireEvent.click(confirm);

    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the comment and the selected root cause', () => {
    render(<TaskActionCommentModal {...defaultProps} showRootCause />);

    fireEvent.change(screen.getByTestId('task-action-root-cause'), {
      target: { value: 'FalsePositive' },
    });
    fireEvent.change(screen.getByTestId('task-action-comment'), {
      target: { value: 'resolved it' },
    });
    fireEvent.click(screen.getByTestId('task-action-comment-confirm'));

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      comment: 'resolved it',
      rootCause: 'FalsePositive',
      assignee: undefined,
    });
  });

  it('renders the subtitle when given', () => {
    render(
      <TaskActionCommentModal
        {...defaultProps}
        subtitle={<span>#TASK-1 · a task</span>}
      />
    );

    expect(screen.getByTestId('task-action-subtitle')).toHaveTextContent(
      '#TASK-1 · a task'
    );
  });

  it('drops the comment field when the action does not take one', () => {
    render(<TaskActionCommentModal {...defaultProps} showComment={false} />);

    expect(screen.queryByTestId('task-action-comment')).not.toBeInTheDocument();
  });

  describe('assignee', () => {
    it('is hidden by default', () => {
      render(<TaskActionCommentModal {...defaultProps} />);

      expect(
        screen.queryByTestId('task-action-assignee')
      ).not.toBeInTheDocument();
    });

    it('keeps confirm disabled until one is picked', () => {
      render(
        <TaskActionCommentModal
          {...defaultProps}
          showAssignee
          showComment={false}
        />
      );

      expect(screen.getByTestId('task-action-comment-confirm')).toBeDisabled();

      fireEvent.click(screen.getByTestId('task-action-comment-confirm'));

      expect(defaultProps.onConfirm).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('assignee-pick'));

      expect(screen.getByTestId('task-action-comment-confirm')).toBeEnabled();
    });

    it('blurs the picker when the press lands elsewhere in the dialog', () => {
      // Its listbox is a portalled popover, so an in-dialog press is not an
      // outside press; blurring is what closes it.
      render(
        <TaskActionCommentModal {...defaultProps} showAssignee showComment />
      );

      const input = screen.getByTestId('assignee-input');
      input.focus();

      expect(document.activeElement).toBe(input);

      fireEvent.pointerDown(screen.getByTestId('task-action-comment'));

      expect(document.activeElement).not.toBe(input);
    });

    it('leaves the picker focused when the press is inside it', () => {
      render(
        <TaskActionCommentModal {...defaultProps} showAssignee showComment />
      );

      const input = screen.getByTestId('assignee-input');
      input.focus();
      fireEvent.pointerDown(input);

      expect(document.activeElement).toBe(input);
    });

    it('confirms with the picked assignee', () => {
      render(
        <TaskActionCommentModal
          {...defaultProps}
          showAssignee
          showComment={false}
        />
      );

      fireEvent.click(screen.getByTestId('assignee-pick'));
      fireEvent.click(screen.getByTestId('task-action-comment-confirm'));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith({
        comment: '',
        rootCause: undefined,
        assignee: { id: 'u1', type: 'user', name: 'bob' },
      });
    });
  });
});
