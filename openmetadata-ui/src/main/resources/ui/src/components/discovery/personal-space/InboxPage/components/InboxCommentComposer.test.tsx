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
          }: {
            onSave?: (m: string) => void;
            onTextChange?: (m: string) => void;
            placeHolder?: string;
            editAction?: React.ReactNode;
          },
          ref: React.Ref<unknown>
        ) => {
          useImperativeHandle(ref, () => ({
            getEditorContent: () => mockEditorContent,
            clearEditorContent: mockClearEditor,
            setEditorContent: mockSetEditorContent,
          }));

          return (
            <>
              {/* quill's format bar, where quill-emoji adds its button. */}
              <div className="ql-toolbar" data-testid="format-bar">
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
            </>
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
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    onClick,
    isDisabled,
    ...rest
  }: {
    onClick?: () => void;
    isDisabled?: boolean;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <button
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid']}
      disabled={isDisabled}
      onClick={onClick}
    />
  ),
}));

import InboxCommentComposer from './InboxCommentComposer';

// Stands in for typing: the editor reports its markdown through onTextChange.
const type = (text: string) =>
  fireEvent.change(screen.getByTestId('draft-input'), {
    target: { value: text },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = { name: 'alice', displayName: 'Alice Johnson' };
});

describe('InboxCommentComposer', () => {
  it("renders the current user's avatar", () => {
    render(<InboxCommentComposer onSave={mockOnSave} />);

    const avatar = screen.getByTestId('avatar');

    expect(avatar).toHaveAttribute('data-name', 'alice');
    expect(avatar).toHaveAttribute('data-display-name', 'Alice Johnson');
  });

  // The design's arrow button replaces the editor's own send button.
  it('posts and clears the draft from the send button', () => {
    mockEditorContent = 'Looks right';
    render(<InboxCommentComposer onSave={mockOnSave} />);

    type('Looks right');
    fireEvent.click(screen.getByTestId('send-button'));

    expect(mockOnSave).toHaveBeenCalledWith('Looks right');
    expect(mockClearEditor).toHaveBeenCalled();
  });

  it('keeps the send button disabled until something is typed', () => {
    render(<InboxCommentComposer onSave={mockOnSave} />);

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
    render(<InboxCommentComposer onSave={mockOnSave} />);

    type('Looks right');
    fireEvent.click(screen.getByTestId('send-button'));

    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('disables the send button again after Enter sends the comment', () => {
    render(<InboxCommentComposer onSave={mockOnSave} />);

    type('hello');
    fireEvent.click(screen.getByTestId('feed-editor'));

    expect(mockOnSave).toHaveBeenCalledWith('hello');
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('forwards the editor save to onSave', () => {
    render(<InboxCommentComposer onSave={mockOnSave} />);

    fireEvent.click(screen.getByTestId('feed-editor'));

    expect(mockOnSave).toHaveBeenCalledWith('hello');
  });

  // A refused comment comes back to the editor rather than vanishing with it.
  it('puts the draft back when the save fails', async () => {
    mockOnSave.mockRejectedValueOnce(new Error('refused'));
    render(<InboxCommentComposer onSave={mockOnSave} />);

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
    render(<InboxCommentComposer onSave={mockOnSave} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('feed-editor'));
    });

    expect(mockSetEditorContent).not.toHaveBeenCalled();
  });

  it('passes the default placeholder to the editor', () => {
    render(<InboxCommentComposer onSave={mockOnSave} />);

    expect(screen.getByTestId('feed-editor')).toHaveAttribute(
      'data-placeholder',
      'message.leave-a-comment'
    );
  });

  it('respects a custom placeholder', () => {
    render(
      <InboxCommentComposer placeHolder="Reply here" onSave={mockOnSave} />
    );

    expect(screen.getByTestId('feed-editor')).toHaveAttribute(
      'data-placeholder',
      'Reply here'
    );
  });

  it('exposes the placeholder to the editor chrome via a CSS variable', () => {
    render(
      <InboxCommentComposer placeHolder="Reply here" onSave={mockOnSave} />
    );

    const holder = document.querySelector(
      '[style*="--inbox-composer-placeholder"]'
    );

    expect(holder).not.toBeNull();
    expect(holder?.getAttribute('style')).toContain('Reply here');
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
      render(<InboxCommentComposer onSave={jest.fn()} />);
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

    it('opens below the bar when quill-emoji chose below', async () => {
      render(<InboxCommentComposer onSave={jest.fn()} />);
      const picker = openPicker();

      await waitFor(() => expect(picker.style.top).toBe('100%'));

      expect(picker.style.bottom).toBe('');
    });
  });
});
