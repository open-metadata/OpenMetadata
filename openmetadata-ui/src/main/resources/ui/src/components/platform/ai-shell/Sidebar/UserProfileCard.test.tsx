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

import { render, screen } from '@testing-library/react';
import UserProfileCard from './UserProfileCard';

jest.mock('../../../discovery/personal-space/AIUserMenu/AIUserMenu', () => ({
  __esModule: true,
  default: ({ collapsed }: { collapsed?: boolean }) => (
    <button data-testid="ai-user-menu" type="button">
      {collapsed ? 'collapsed' : 'expanded'}
    </button>
  ),
}));

jest.mock(
  '../../../discovery/personal-space/InboxIconButton/InboxIconButton',
  () => ({
    __esModule: true,
    default: () => (
      <button data-testid="ai-inbox-icon-btn" type="button">
        inbox
      </button>
    ),
  })
);

describe('UserProfileCard', () => {
  it('shows the full user menu beside the inbox when expanded', () => {
    render(<UserProfileCard />);

    const [userMenu, inbox] = screen.getAllByRole('button');

    expect(userMenu).toHaveTextContent('expanded');
    expect(inbox).toHaveAttribute('data-testid', 'ai-inbox-icon-btn');
  });

  it('stacks the inbox above the avatar-only user menu in the rail', () => {
    render(<UserProfileCard compact />);

    const [inbox, userMenu] = screen.getAllByRole('button');

    expect(inbox).toHaveAttribute('data-testid', 'ai-inbox-icon-btn');
    expect(userMenu).toHaveTextContent('collapsed');
  });
});
