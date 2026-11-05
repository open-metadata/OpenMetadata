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
import { MemoryRouter } from 'react-router-dom';
import AuthorPopover from './AuthorPopover';

// The card itself is the shared user popover with its own suite; this checks
// when the inbox asks for one and how it is reached.
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

const renderPopover = (node: ReactNode) =>
  render(<MemoryRouter>{node}</MemoryRouter>);

describe('AuthorPopover', () => {
  // A keyboard reaches the name; the shared card opens on its focus.
  it('links a named author to their profile, in the tab order', () => {
    renderPopover(<AuthorPopover userName="priya.sharma">Priya</AuthorPopover>);

    const trigger = screen.getByTestId('author-popover-trigger');

    expect(trigger).toHaveAttribute('href', expect.stringContaining('priya'));
    expect(trigger).not.toHaveAttribute('tabindex');
    expect(screen.getByTestId('user-card-priya.sharma')).toBeInTheDocument();
  });

  // The avatar repeats the name beside it, so it stays out of the tab order.
  it('keeps a decorative avatar out of the tab order and screen readers', () => {
    renderPopover(
      <AuthorPopover decorative userName="priya.sharma">
        P
      </AuthorPopover>
    );

    const trigger = screen.getByTestId('author-popover-trigger');

    expect(trigger).toHaveAttribute('tabindex', '-1');
    expect(trigger).toHaveAttribute('aria-hidden', 'true');
  });

  // An event with no actor has no user to look up.
  it('renders the author bare when there is no user name', () => {
    renderPopover(<AuthorPopover userName="">System</AuthorPopover>);

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(
      screen.queryByTestId('author-popover-trigger')
    ).not.toBeInTheDocument();
  });
});
