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

const mockOnSave = jest.fn();

let mockCurrentUser: { name?: string; displayName?: string } = {
  name: 'alice',
  displayName: 'Alice Johnson',
};

let mockEditorContent = '';
const mockClearEditor = jest.fn();

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
            placeHolder,
            editAction,
          }: {
            onSave?: (m: string) => void;
            placeHolder?: string;
            editAction?: React.ReactNode;
          },
          ref: React.Ref<unknown>
        ) => {
          useImperativeHandle(ref, () => ({
            getEditorContent: () => mockEditorContent,
            clearEditorContent: mockClearEditor,
          }));

          return (
            <>
              <button
                aria-label="feed-editor"
                data-placeholder={placeHolder}
                data-testid="feed-editor"
                onClick={() => onSave?.('hello')}
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
    ...rest
  }: {
    onClick?: () => void;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <button
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid']}
      onClick={onClick}
    />
  ),
}));

import InboxCommentComposer from './InboxCommentComposer';

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

    fireEvent.click(screen.getByTestId('send-button'));

    expect(mockOnSave).toHaveBeenCalledWith('Looks right');
    expect(mockClearEditor).toHaveBeenCalled();
  });

  it('sends nothing for an empty draft', () => {
    mockEditorContent = '';
    render(<InboxCommentComposer onSave={mockOnSave} />);

    fireEvent.click(screen.getByTestId('send-button'));

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('forwards the editor save to onSave', () => {
    render(<InboxCommentComposer onSave={mockOnSave} />);

    fireEvent.click(screen.getByTestId('feed-editor'));

    expect(mockOnSave).toHaveBeenCalledWith('hello');
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
});
