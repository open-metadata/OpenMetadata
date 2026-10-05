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
import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import AuthorPopover from './AuthorPopover';

// The card itself is the shared user popover with its own suite; this checks
// only when the inbox asks for one.
jest.mock(
  '../../../../../components/common/PopOverCard/UserPopOverCard',
  () => ({
    __esModule: true,
    default: ({
      userName,
      children,
    }: {
      userName: string;
      children: ReactNode;
    }) => <div data-testid={`user-card-${userName}`}>{children}</div>,
  })
);

describe('AuthorPopover', () => {
  it('opens the user card for a named author', () => {
    render(<AuthorPopover userName="priya.sharma">Priya</AuthorPopover>);

    expect(screen.getByTestId('user-card-priya.sharma')).toHaveTextContent(
      'Priya'
    );
    expect(screen.getByTestId('author-popover-trigger')).toBeInTheDocument();
  });

  // An event with no actor has no user to look up.
  it('renders the author bare when there is no user name', () => {
    render(<AuthorPopover userName="">System</AuthorPopover>);

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(
      screen.queryByTestId('author-popover-trigger')
    ).not.toBeInTheDocument();
  });
});
