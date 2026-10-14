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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { GlobalSettingsMenuCategory } from '../../../../../../constants/GlobalSettings.constants';
import NotificationLanding from './NotificationLanding';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

let mockGetContributions = jest.fn().mockReturnValue([]);

jest.mock(
  '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      getContributions: mockGetContributions,
    }),
  })
);

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: () => ({ permissions: {} }),
  })
);

const mockGetGlobalSettingsMenu = jest.fn().mockReturnValue([]);

jest.mock('../../../../../../utils/GlobalSettingsClassBase', () => ({
  __esModule: true,
  default: {
    getGlobalSettingsMenuWithPermission: (...args: unknown[]) =>
      mockGetGlobalSettingsMenu(...args),
  },
}));

let mockIsAdminUser = true;

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdminUser }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Card: Object.assign(
    jest
      .fn()
      .mockImplementation(
        ({
          children,
          onClick,
          isClickable: _isClickable,
          size: _size,
          ...props
        }) => (
          <button {...props} type="button" onClick={onClick}>
            {children}
          </button>
        )
      ),
    {
      Content: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Bell01: jest.fn(() => <span data-testid="bell-icon" />),
}));

describe('NotificationLanding', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContributions = jest.fn().mockReturnValue([]);
    mockGetGlobalSettingsMenu.mockReturnValue([]);
    mockIsAdminUser = true;
  });

  it('should render the notification landing card', () => {
    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(screen.getByTestId('notification-landing')).toBeInTheDocument();
    expect(screen.getByTestId('notification-card-alerts')).toBeInTheDocument();
  });

  it('should render alert title and description text', () => {
    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(screen.getByText('label.alert-plural')).toBeInTheDocument();
    expect(screen.getByText('message.alerts-description')).toBeInTheDocument();
  });

  it('should call onNavigate with list view when card is clicked', () => {
    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    fireEvent.click(screen.getByTestId('notification-card-alerts'));

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'list' });
  });

  it('should render only built-in card when no sections are contributed', () => {
    mockGetGlobalSettingsMenu.mockReturnValue([
      {
        key: GlobalSettingsMenuCategory.NOTIFICATIONS,
        items: [
          {
            key: `${GlobalSettingsMenuCategory.NOTIFICATIONS}.weekly-emails`,
            category: 'Weekly emails',
            description: 'desc',
            icon: () => <span />,
          },
        ],
      },
    ]);

    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(screen.getByTestId('notification-card-alerts')).toBeInTheDocument();
    expect(
      screen.queryByTestId('notification-card-weekly-emails')
    ).not.toBeInTheDocument();
  });

  it('should render contributed section cards from the settings menu', () => {
    mockGetContributions.mockReturnValue([
      { key: 'weekly-emails', component: () => <span /> },
    ]);
    mockGetGlobalSettingsMenu.mockReturnValue([
      {
        key: GlobalSettingsMenuCategory.NOTIFICATIONS,
        items: [
          {
            key: `${GlobalSettingsMenuCategory.NOTIFICATIONS}.weekly-emails`,
            category: 'Weekly emails',
            description: 'Weekly email desc',
            icon: () => <span />,
          },
          {
            key: `${GlobalSettingsMenuCategory.NOTIFICATIONS}.templates`,
            category: 'Templates',
            description: 'Templates desc',
            icon: () => <span />,
          },
        ],
      },
    ]);

    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    // Contributed + matching menu item shows; the unmatched menu item does not.
    expect(
      screen.getByTestId('notification-card-weekly-emails')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('notification-card-templates')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-card-weekly-emails'));

    expect(mockOnNavigate).toHaveBeenCalledWith({
      type: 'section',
      key: 'weekly-emails',
    });
  });

  it('should show sections contributed after the landing first rendered', () => {
    mockGetGlobalSettingsMenu.mockReturnValue([
      {
        key: GlobalSettingsMenuCategory.NOTIFICATIONS,
        items: [
          {
            key: `${GlobalSettingsMenuCategory.NOTIFICATIONS}.weekly-emails`,
            category: 'Weekly emails',
            description: 'desc',
            icon: () => <span />,
          },
        ],
      },
    ]);
    const { rerender } = render(
      <NotificationLanding onNavigate={mockOnNavigate} />
    );

    expect(
      screen.queryByTestId('notification-card-weekly-emails')
    ).not.toBeInTheDocument();

    // Simulate a new getContributions reference (what the provider produces
    // after plugins' contributeExtensions runs), now returning a contribution.
    mockGetContributions = jest
      .fn()
      .mockReturnValue([{ key: 'weekly-emails', component: () => <span /> }]);
    rerender(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(
      screen.getByTestId('notification-card-weekly-emails')
    ).toBeInTheDocument();
  });

  it('should prefer the contribution icon over the settings menu icon', () => {
    mockGetContributions.mockReturnValue([
      {
        key: 'weekly-emails',
        component: () => <span />,
        icon: () => <span data-testid="contribution-icon" />,
      },
    ]);
    mockGetGlobalSettingsMenu.mockReturnValue([
      {
        key: GlobalSettingsMenuCategory.NOTIFICATIONS,
        items: [
          {
            key: `${GlobalSettingsMenuCategory.NOTIFICATIONS}.weekly-emails`,
            category: 'Weekly emails',
            description: 'desc',
            icon: () => <span data-testid="menu-icon" />,
          },
        ],
      },
    ]);

    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(screen.getByTestId('contribution-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-icon')).not.toBeInTheDocument();
  });

  it('should drop a section whose isProtected is false', () => {
    mockGetContributions.mockReturnValue([
      { key: 'weekly-emails', component: () => <span /> },
    ]);
    mockGetGlobalSettingsMenu.mockReturnValue([
      {
        key: GlobalSettingsMenuCategory.NOTIFICATIONS,
        items: [
          {
            key: `${GlobalSettingsMenuCategory.NOTIFICATIONS}.weekly-emails`,
            category: 'Weekly emails',
            description: 'desc',
            icon: () => <span />,
            isProtected: false,
          },
        ],
      },
    ]);

    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(
      screen.queryByTestId('notification-card-weekly-emails')
    ).not.toBeInTheDocument();
  });

  it('shows a beta badge only for a card whose menu item is marked beta', () => {
    mockGetContributions.mockReturnValue([
      { key: 'weekly-emails', component: () => <span /> },
      { key: 'templates', component: () => <span /> },
    ]);
    mockGetGlobalSettingsMenu.mockReturnValue([
      {
        key: GlobalSettingsMenuCategory.NOTIFICATIONS,
        items: [
          {
            key: `${GlobalSettingsMenuCategory.NOTIFICATIONS}.weekly-emails`,
            category: 'Weekly emails',
            description: 'desc',
            icon: () => <span />,
            isBeta: true,
          },
          {
            key: `${GlobalSettingsMenuCategory.NOTIFICATIONS}.templates`,
            category: 'Templates',
            description: 'desc',
            icon: () => <span />,
          },
        ],
      },
    ]);

    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(
      within(screen.getByTestId('notification-card-weekly-emails')).getByText(
        'label.beta'
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('notification-card-templates')).queryByText(
        'label.beta'
      )
    ).not.toBeInTheDocument();
  });

  it('builds the cards with the real admin flag, not a hardcoded true', () => {
    mockIsAdminUser = false;
    mockGetContributions.mockReturnValue([
      { key: 'weekly-emails', component: () => <span /> },
    ]);

    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(mockGetGlobalSettingsMenu).toHaveBeenCalledWith(
      expect.anything(),
      false
    );
  });
});
