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

jest.mock('../../../AppModeSwitcher/AppModeSwitcher', () => ({
  __esModule: true,
  default: ({ compact }: { compact?: boolean }) => (
    <button data-testid="app-mode-switcher" type="button">
      {compact ? 'compact' : 'full'}
    </button>
  ),
}));

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
  it('shows the full user menu, the inbox and the mode switcher in one card', () => {
    render(<UserProfileCard />);

    const profileCard = screen.getByTestId('ask-user-card');

    expect(profileCard).toHaveTextContent('expanded');
    expect(profileCard).toContainElement(
      screen.getByTestId('ai-inbox-icon-btn')
    );
    expect(profileCard).toContainElement(
      screen.getByTestId('app-mode-switcher')
    );
    expect(screen.getByTestId('app-mode-switcher')).toHaveTextContent('full');
  });

  it('stacks the inbox, avatar-only user menu and compact switcher in the rail', () => {
    render(<UserProfileCard compact />);

    const [inbox, userMenu, switcher] = screen.getAllByRole('button');

    expect(inbox).toHaveAttribute('data-testid', 'ai-inbox-icon-btn');
    expect(userMenu).toHaveTextContent('collapsed');
    expect(switcher).toHaveTextContent('compact');
  });
});
