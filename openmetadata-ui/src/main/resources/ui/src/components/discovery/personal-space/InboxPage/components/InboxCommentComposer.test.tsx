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
  () => ({
    __esModule: true,
    default: ({
      onSave,
      placeHolder,
    }: {
      onSave?: (m: string) => void;
      placeHolder?: string;
    }) => (
      <button
        aria-label="feed-editor"
        data-placeholder={placeHolder}
        data-testid="feed-editor"
        onClick={() => onSave?.('hello')}
      />
    ),
  })
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

  it('forwards the editor save to onSave', () => {
    render(<InboxCommentComposer onSave={mockOnSave} />);

    fireEvent.click(screen.getByTestId('feed-editor'));

    expect(mockOnSave).toHaveBeenCalledWith('hello');
  });

  it('passes the default placeholder to the editor', () => {
    render(<InboxCommentComposer onSave={mockOnSave} />);

    expect(screen.getByTestId('feed-editor')).toHaveAttribute(
      'data-placeholder',
      'label.add-comment'
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
