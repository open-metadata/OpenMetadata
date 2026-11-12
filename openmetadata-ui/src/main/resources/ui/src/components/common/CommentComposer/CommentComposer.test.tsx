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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const mockOnSave = jest.fn();

let mockCurrentUser: { name?: string; displayName?: string } = {
  name: 'alice',
  displayName: 'Alice Johnson',
};

let mockEditorContent = '';
const mockClearEditor = jest.fn();
const mockSetEditorContent = jest.fn();

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: ({ displayName, name }: { displayName?: string; name?: string }) => (
    <div
      data-display-name={displayName}
      data-name={name}
      data-testid="avatar"
    />
  ),
}));

jest.mock(
  'components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew',
  () => {
    const { forwardRef, useImperativeHandle } = jest.requireActual('react');

    return {
      __esModule: true,
      default: forwardRef(
        (
          {
            onSave,
            onTextChange,
            placeHolder,
            editAction,
            defaultValue,
            className,
          }: {
            onSave?: (m: string) => void;
            onTextChange?: (m: string) => void;
            placeHolder?: string;
            editAction?: React.ReactNode;
            defaultValue?: string;
            className?: string;
          },
          ref: React.Ref<unknown>
        ) => {
          useImperativeHandle(ref, () => ({
            getEditorContent: () => mockEditorContent,
            clearEditorContent: mockClearEditor,
            setEditorContent: mockSetEditorContent,
          }));

          return (
            <div className={className} data-testid="editor-root">
              {/* quill's format bar, where quill-emoji adds its button. */}
              <div className="ql-toolbar" data-testid="format-bar">
                <span className="ql-formats">
                  <button
                    aria-label="bold"
                    className="ql-bold"
                    data-testid="bold-control"
                  />
                  <button
                    aria-label="ordered list"
                    className="ql-list"
                    data-testid="ordered-list-control"
                    value="ordered"
                  />
                </span>
                <span className="ql-formats">
                  <button
                    aria-label="emoji"
                    className="textarea-emoji-control"
                    data-testid="emoji-control"
                  />
                </span>
              </div>
              <button
                aria-label="feed-editor"
                data-default-value={defaultValue}
                data-placeholder={placeHolder}
                data-testid="feed-editor"
                onClick={() => onSave?.('hello')}
              />
              <input
                aria-label="draft"
                data-testid="draft-input"
                onChange={(event) => onTextChange?.(event.target.value)}
              />
              {editAction}
            </div>
          );
        }
      ),
    };
  }
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={rest['data-testid']}>{children}</div>,
  Button: ({
    onClick,
    onPress,
    isDisabled,
    children,
    ...rest
  }: {
    onClick?: () => void;
    onPress?: () => void;
    isDisabled?: boolean;
    children?: React.ReactNode;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <button
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid']}
      disabled={isDisabled}
      onClick={onClick ?? onPress}>
      {children}
    </button>
  ),
  ButtonUtility: ({
    onClick,
    tooltip,
    isDisabled,
    isSelected,
    ...rest
  }: {
    onClick?: () => void;
    tooltip?: string;
    isDisabled?: boolean;
    isSelected?: boolean;
    'data-testid'?: string;
  }) => (
    <button
      aria-label={tooltip}
      aria-pressed={isSelected}
      data-testid={rest['data-testid']}
      disabled={isDisabled}
      onClick={onClick}
    />
  ),
  Typography: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

import CommentComposer, { CommentEditForm } from './CommentComposer';

// Stands in for typing: the editor reports its markdown through onTextChange.
const type = (text: string) =>
  fireEvent.change(screen.getByTestId('draft-input'), {
    target: { value: text },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = { name: 'alice', displayName: 'Alice Johnson' };
});

describe('CommentComposer', () => {
  it("renders the current user's avatar", () => {
    render(<CommentComposer onSave={mockOnSave} />);

    const avatar = screen.getByTestId('avatar');

    expect(avatar).toHaveAttribute('data-name', 'alice');
    expect(avatar).toHaveAttribute('data-display-name', 'Alice Johnson');
  });

  // The design's arrow button replaces the editor's own send button.
  it('posts and clears the draft from the send button', () => {
    mockEditorContent = 'Looks right';
    render(<CommentComposer onSave={mockOnSave} />);

    type('Looks right');
    fireEvent.click(screen.getByTestId('send-button'));

    expect(mockOnSave).toHaveBeenCalledWith('Looks right');
    expect(mockClearEditor).toHaveBeenCalled();
  });

  it('keeps the send button disabled until something is typed', () => {
    render(<CommentComposer onSave={mockOnSave} />);

    expect(screen.getByTestId('send-button')).toBeDisabled();

    type('   ');

    expect(screen.getByTestId('send-button')).toBeDisabled();

    type('Looks right');

    expect(screen.getByTestId('send-button')).toBeEnabled();

    type('');

    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('disables the send button again once the comment is sent', () => {
    mockEditorContent = 'Looks right';
    render(<CommentComposer onSave={mockOnSave} />);

    type('Looks right');
    fireEvent.click(screen.getByTestId('send-button'));

    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('disables the send button again after Enter sends the comment', () => {
    render(<CommentComposer onSave={mockOnSave} />);

    type('hello');
    fireEvent.click(screen.getByTestId('feed-editor'));

    expect(mockOnSave).toHaveBeenCalledWith('hello');
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('forwards the editor save to onSave', () => {
    render(<CommentComposer onSave={mockOnSave} />);

    fireEvent.click(screen.getByTestId('feed-editor'));

    expect(mockOnSave).toHaveBeenCalledWith('hello');
  });

  // A refused comment comes back to the editor rather than vanishing with it.
  it('puts the draft back when the save fails', async () => {
    mockOnSave.mockRejectedValueOnce(new Error('refused'));
    render(<CommentComposer onSave={mockOnSave} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('feed-editor'));
    });

    expect(mockSetEditorContent).toHaveBeenCalledWith(
      expect.stringContaining('hello')
    );
    expect(screen.getByTestId('send-button')).toBeEnabled();
  });

  it('leaves the editor empty when the save succeeds', async () => {
    mockOnSave.mockResolvedValueOnce(undefined);
    render(<CommentComposer onSave={mockOnSave} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('feed-editor'));
    });

    expect(mockSetEditorContent).not.toHaveBeenCalled();
  });

  it('passes the default placeholder to the editor', () => {
    render(<CommentComposer onSave={mockOnSave} />);

    expect(screen.getByTestId('feed-editor')).toHaveAttribute(
      'data-placeholder',
      'message.leave-a-comment'
    );
  });

  it('respects a custom placeholder', () => {
    render(<CommentComposer placeHolder="Reply here" onSave={mockOnSave} />);

    expect(screen.getByTestId('feed-editor')).toHaveAttribute(
      'data-placeholder',
      'Reply here'
    );
  });

  it('exposes the placeholder to the editor chrome via a CSS variable', () => {
    render(<CommentComposer placeHolder="Reply here" onSave={mockOnSave} />);

    const holder = document.querySelector(
      '[style*="--comment-composer-placeholder"]'
    );

    expect(holder).not.toBeNull();
    expect(holder?.getAttribute('style')).toContain('Reply here');
  });

  // The format bar starts hidden; the toggle beside send shows and hides it.
  describe('formatting toggle', () => {
    // The class that hides Quill's format bar while the toggle is off.
    const COLLAPSED_CLASS = 'tw:[&_.ql-toolbar.ql-snow]:hidden!';
    const editorRoot = () => screen.getByTestId('editor-root');

    it('starts with the format bar hidden', () => {
      render(<CommentComposer onSave={jest.fn()} />);

      expect(editorRoot()).toHaveClass(COLLAPSED_CLASS);
      expect(screen.getByTestId('formatting-toggle')).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.getByTestId('formatting-toggle')).toHaveAttribute(
        'aria-label',
        'label.show-formatting'
      );
    });

    it('shows the format bar, then hides it again', () => {
      render(<CommentComposer onSave={jest.fn()} />);

      fireEvent.click(screen.getByTestId('formatting-toggle'));

      expect(editorRoot()).not.toHaveClass(COLLAPSED_CLASS);
      expect(screen.getByTestId('formatting-toggle')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByTestId('formatting-toggle')).toHaveAttribute(
        'aria-label',
        'label.hide-formatting'
      );

      fireEvent.click(screen.getByTestId('formatting-toggle'));

      expect(editorRoot()).toHaveClass(COLLAPSED_CLASS);
    });
  });

  // Quill draws its icons from one app-wide registry; the composer draws the
  // design's into its own buttons, Quill's and quill-emoji's alike.
  describe('format bar icons', () => {
    const iconIn = (button: Element | null) =>
      button?.querySelector('svg.comment-composer-icon');

    it("draws the design's icon into each format button", async () => {
      render(<CommentComposer onSave={jest.fn()} />);

      await waitFor(() =>
        expect(iconIn(screen.getByTestId('bold-control'))).toBeTruthy()
      );

      expect(iconIn(screen.getByTestId('ordered-list-control'))).toBeTruthy();
      expect(iconIn(screen.getByTestId('emoji-control'))).toBeTruthy();
    });

    it('draws the icons into a format bar rebuilt after mount', async () => {
      render(<CommentComposer onSave={jest.fn()} />);
      const newBar = document.createElement('div');
      newBar.className = 'ql-toolbar';
      newBar.innerHTML =
        '<span class="ql-formats"><button class="ql-italic"></button></span>';
      screen.getByTestId('format-bar').replaceWith(newBar);

      await waitFor(() =>
        expect(iconIn(newBar.querySelector('.ql-italic'))).toBeTruthy()
      );
    });
  });

  // quill-emoji adds its picker to the format bar with no horizontal position
  // and removes it on close.
  describe('emoji picker', () => {
    const openPicker = (top?: string) => {
      const picker = document.createElement('div');
      picker.id = 'textarea-emoji';
      if (top) {
        picker.style.top = top;
      }
      screen.getByTestId('format-bar').appendChild(picker);

      return picker;
    };

    it('anchors the picker above its button and marks the button open', async () => {
      render(<CommentComposer onSave={jest.fn()} />);
      const button = screen.getByTestId('emoji-control');
      const picker = openPicker('-250px');

      await waitFor(() => expect(button).toHaveClass('ql-active'));

      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(picker.style.left).toBe('0px');
      expect(picker.style.top).toBe('');
      expect(picker.style.bottom).toBe('100%');

      picker.remove();

      await waitFor(() => expect(button).not.toHaveClass('ql-active'));

      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    // The editor loads lazily and quill rebuilds its bar on re-initialising,
    // so the bar can be a new one by the time the picker opens.
    it('anchors the picker in a format bar rebuilt after mount', async () => {
      render(<CommentComposer onSave={jest.fn()} />);
      const oldBar = screen.getByTestId('format-bar');
      const newBar = document.createElement('div');
      newBar.className = 'ql-toolbar';
      newBar.innerHTML =
        '<span class="ql-formats"><button class="textarea-emoji-control"></button></span>';
      oldBar.replaceWith(newBar);
      const picker = document.createElement('div');
      picker.id = 'textarea-emoji';
      picker.style.top = '-250px';
      newBar.appendChild(picker);

      await waitFor(() =>
        expect(newBar.querySelector('.textarea-emoji-control')).toHaveClass(
          'ql-active'
        )
      );

      expect(picker.style.bottom).toBe('100%');
    });

    it('opens below the bar when quill-emoji chose below', async () => {
      render(<CommentComposer onSave={jest.fn()} />);
      const picker = openPicker();

      await waitFor(() => expect(picker.style.top).toBe('100%'));

      expect(picker.style.bottom).toBe('');
    });
  });
});

// An edited comment opens in the same box a new one is written in.
describe('CommentEditForm', () => {
  const renderEdit = (onSave = jest.fn(), onCancel = jest.fn()) =>
    render(
      <CommentEditForm
        message="**Looking** at this today."
        testId="edit-comment"
        onCancel={onCancel}
        onSave={onSave}
      />
    );

  it("opens the comment in the composer's editor, ready to send", async () => {
    renderEdit();

    expect(screen.getByTestId('edit-comment-editor')).toBeInTheDocument();
    expect(
      screen.getByTestId('feed-editor').getAttribute('data-default-value')
    ).toContain('<strong>Looking</strong>');
    expect(screen.getByTestId('send-button')).toBeEnabled();

    await waitFor(() =>
      expect(
        screen
          .getByTestId('bold-control')
          .querySelector('svg.comment-composer-icon')
      ).toBeTruthy()
    );
  });

  it('shows the new-line hint beside Cancel', () => {
    const onCancel = jest.fn();
    renderEdit(jest.fn(), onCancel);

    expect(screen.getByText(/message.to-add-new-line/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-edit-comment'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('saves the edited text from the send button', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    mockEditorContent = 'Looking at this tomorrow.';
    renderEdit(onSave);

    fireEvent.click(screen.getByTestId('send-button'));

    expect(onSave).toHaveBeenCalledWith('Looking at this tomorrow.');
  });
});
