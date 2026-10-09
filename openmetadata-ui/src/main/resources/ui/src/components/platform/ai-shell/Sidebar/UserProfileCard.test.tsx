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
import React from 'react';
import UserProfileCard from './UserProfileCard';

let mockSwitcherCardRef: React.RefObject<HTMLElement> | undefined;

jest.mock('../../../AppModeSwitcher/AppModeSwitcher', () => ({
  __esModule: true,
  default: ({
    compact,
    cardRef,
  }: {
    compact?: boolean;
    cardRef?: React.RefObject<HTMLElement>;
  }) => {
    mockSwitcherCardRef = cardRef;

    return (
      <button data-testid="app-mode-switcher" type="button">
        {compact ? 'compact' : 'full'}
      </button>
    );
  },
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
  beforeEach(() => {
    mockSwitcherCardRef = undefined;
  });

  it('shows the full user menu beside the inbox, with the mode switcher in its own card below', () => {
    render(<UserProfileCard />);

    const profileCard = screen.getByTestId('ask-user-card');
    const switcherCard = screen.getByTestId('ask-app-mode-card');

    expect(profileCard).toHaveTextContent('expanded');
    expect(profileCard).toContainElement(
      screen.getByTestId('ai-inbox-icon-btn')
    );
    expect(profileCard).not.toContainElement(
      screen.getByTestId('app-mode-switcher')
    );
    expect(switcherCard).toHaveTextContent('full');
  });

  it('hands the switcher its own card, so clicks inside it do not close the switcher popover', () => {
    render(<UserProfileCard />);

    expect(mockSwitcherCardRef?.current).toBe(
      screen.getByTestId('ask-app-mode-card')
    );
  });

  it('stacks the inbox, avatar-only user menu and compact switcher in the rail', () => {
    render(<UserProfileCard compact />);

    const [inbox, userMenu, switcher] = screen.getAllByRole('button');

    expect(inbox).toHaveAttribute('data-testid', 'ai-inbox-icon-btn');
    expect(userMenu).toHaveTextContent('collapsed');
    expect(switcher).toHaveTextContent('compact');
  });
});
