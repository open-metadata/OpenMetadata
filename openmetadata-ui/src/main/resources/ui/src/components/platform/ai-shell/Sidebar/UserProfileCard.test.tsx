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
import { PropsWithChildren, SVGProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import UserProfileCard from './UserProfileCard';

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: ({ initials }: { initials?: string }) => (
    <span data-testid="avatar">{initials}</span>
  ),
  Box: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Dropdown: {
    Root: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Popover: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Menu: ({ children }: PropsWithChildren) => <ul>{children}</ul>,
    Item: ({ children }: PropsWithChildren) => <li>{children}</li>,
    Separator: () => <li role="separator" />,
  },
  Popover: ({
    children,
    isOpen,
  }: {
    children: PropsWithChildren['children'];
    isOpen: boolean;
  }) =>
    isOpen ? <div data-testid="mode-switcher-popover">{children}</div> : null,
  Tooltip: ({ children }: PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
  Typography: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: {
      displayName: 'Olivia Rhye',
      email: 'olivia@untitledui.com',
      name: 'olivia',
    },
  }),
}));

jest.mock('@untitledui/icons', () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;

  return new Proxy({}, { get: () => Icon });
});

jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: ({ displayName }: { displayName?: string }) => (
    <span data-testid="profile-picture">{displayName}</span>
  ),
}));

jest.mock('hooks/useAppMode', () => ({
  useAppMode: () => 'ai',
  useIsAiMode: () => true,
  RUNTIME_TO_PREFERENCE_WIRE: { ai: 'ai', default: 'classic' },
  PREFERENCE_MODE_TO_RUNTIME: { ai: 'ai', classic: 'default' },
  useAppModeStore: Object.assign(
    (selector: (s: { currentMode: string }) => unknown) =>
      selector({ currentMode: 'ai' }),
    { getState: () => ({ currentMode: 'ai' }) }
  ),
  writeAppMode: jest.fn(),
}));

jest.mock('hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { appMode: null },
    setPreference: jest.fn(),
  }),
}));

jest.mock('constants/appMode.constants', () => ({
  AI_APP_MODE: 'ai',
  DEFAULT_APP_MODE: 'default',
}));

jest.mock('utils/i18next/i18nextUtil', () => ({
  languageSelectOptions: [],
}));

jest.mock('utils/i18next/LocalUtil', () => ({
  __esModule: true,
  t: (k: string) => k,
  default: {
    language: 'en-US',
    changeLanguage: jest.fn(),
    t: (k: string) => k,
  },
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (entity: { displayName?: string; name?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('utils/i18next/LocalUtilClassBase', () => ({
  default: { loadLocales: jest.fn() },
}));

jest.mock(
  '../../../discovery/personal-space/InboxIconButton/InboxIconButton',
  () => ({
    __esModule: true,
    default: () => null,
  })
);

jest.mock('hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: false }),
}));

jest.mock('components/Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ onLogoutHandler: jest.fn() }),
}));

jest.mock('utils/RouterUtils', () => ({
  getUserPath: (name: string) => `/users/${name}`,
}));

jest.mock('../../../assets/svg/askcollate-icon.svg', () => ({
  ReactComponent: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="askcollate-icon" {...props} />
  ),
}));

jest.mock('../../../assets/svg/logo-monogram.svg', () => ({
  ReactComponent: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="collate-icon" {...props} />
  ),
}));

jest.mock('react-aria-components', () => ({
  Button: ({
    children,
    ...props
  }: import('react').PropsWithChildren<Record<string, unknown>>) => (
    <button
      {...(props as import('react').ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  ),
  Menu: ({ children }: PropsWithChildren) => <div>{children}</div>,
  MenuItem: ({
    children,
    onAction,
  }: PropsWithChildren<{ onAction?: () => void }>) => (
    <button type="button" onClick={onAction}>
      {children}
    </button>
  ),
  Popover: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SubmenuTrigger: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

describe('UserProfileCard', () => {
  it('wraps the AI user menu in a card container', () => {
    const { container } = render(
      <MemoryRouter>
        <UserProfileCard />
      </MemoryRouter>
    );

    expect(container.firstChild).toHaveClass('ask-user-card');
    expect(screen.getByTestId('ask-ai-user-menu-trigger')).toBeInTheDocument();
    expect(screen.getAllByText('Olivia Rhye').length).toBeGreaterThan(0);
  });
});
