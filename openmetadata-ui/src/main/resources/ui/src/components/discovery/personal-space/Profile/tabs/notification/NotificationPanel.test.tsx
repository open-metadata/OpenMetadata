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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { NotificationView } from './Notification.types';
import NotificationPanel from './NotificationPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}` : key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Button: jest.fn().mockImplementation(({ children, onPress, ...props }) => (
    <button {...props} onClick={onPress}>
      {children}
    </button>
  )),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Bell01: jest.fn(() => <span data-testid="bell-icon" />),
  Lightbulb05: jest.fn(() => <span />),
  Lock01: jest.fn(() => <span data-testid="lock-icon" />),
}));

let mockSubPath = '';
const mockSetHash = jest.fn((_tab: string, subPath?: string) => {
  mockSubPath = subPath ?? '';
});

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'notification', subPath: mockSubPath, params: {} },
    setHash: mockSetHash,
    clearHash: jest.fn(),
    updateParams: jest.fn(),
  }),
}));

const mockCheckPermission = jest.fn().mockReturnValue(true);

jest.mock('../../../../../../utils/PermissionsUtils', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({
      permissions: {
        eventSubscription: { Create: true },
      },
    }),
  })
);

const mockGetContributions = jest.fn().mockReturnValue([]);
let mockContributionsReady = true;

jest.mock(
  '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      getContributions: mockGetContributions,
      contributionsReady: mockContributionsReady,
    }),
  })
);

// Sections render only for a Notifications menu item the user may see.
const VISIBLE_SECTIONS_MENU = [
  {
    key: 'notifications',
    items: [
      { key: 'notifications.weekly-emails', category: 'Weekly emails' },
      { key: 'notifications.templates', category: 'Templates' },
    ],
  },
];
const mockGetGlobalSettingsMenu = jest.fn();

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

let capturedLandingProps: { onNavigate: (v: NotificationView) => void };

jest.mock('./NotificationLanding', () =>
  jest.fn((props) => {
    capturedLandingProps = props;

    return <div data-testid="notification-landing" />;
  })
);

jest.mock('./NotificationAlertsPanel', () =>
  jest.fn(() => <div data-testid="notification-alerts-panel" />)
);

jest.mock('./NotificationAlertForm', () =>
  jest.fn(() => <div data-testid="notification-alert-form" />)
);

jest.mock('./NotificationAlertDetail', () =>
  jest.fn(() => <div data-testid="notification-alert-detail" />)
);

// Pushes a Create action from its mount effect, like a real section does.
const TemplatesSectionWithCreateAction = ({
  onSetHeaderActions,
}: {
  onSetHeaderActions?: (node: React.ReactNode) => void;
}) => {
  React.useEffect(() => {
    onSetHeaderActions?.(
      <button data-testid="section-create" type="button">
        Create
      </button>
    );
  }, [onSetHeaderActions]);

  return <div data-testid="templates-section" />;
};

describe('NotificationPanel', () => {
  const mockOnHeaderChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubPath = '';
    mockGetContributions.mockReturnValue([]);
    mockGetGlobalSettingsMenu.mockReturnValue(VISIBLE_SECTIONS_MENU);
    mockIsAdminUser = true;
    mockContributionsReady = true;
  });

  it('should render NotificationLanding by default', () => {
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('notification-landing')).toBeInTheDocument();
  });

  it('should render NotificationAlertsPanel when navigated to list view', () => {
    mockSubPath = 'alerts';
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('notification-alerts-panel')).toBeInTheDocument();
  });

  it('should call onHeaderChange with breadcrumbs and title on mount', () => {
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(mockOnHeaderChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        breadcrumbs: expect.any(Array),
        description: expect.any(String),
      })
    );
  });

  it('should render NotificationAlertForm when navigated to add view', () => {
    mockSubPath = 'alerts/add';
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('notification-alert-form')).toBeInTheDocument();
  });

  it('should render NotificationAlertDetail when navigated to detail view', () => {
    mockSubPath = 'alerts/test-fqn';
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('notification-alert-detail')).toBeInTheDocument();
  });

  it('should not show add-alert action when permission is denied', () => {
    mockCheckPermission.mockReturnValue(false);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    act(() => {
      capturedLandingProps.onNavigate({ type: 'list' });
    });

    const lastCall =
      mockOnHeaderChange.mock.calls[
        mockOnHeaderChange.mock.calls.length - 1
      ][0];

    expect(lastCall.actions).toBeUndefined();
  });

  it('should render the contributed section component for a section view', () => {
    mockSubPath = 'section/weekly-emails';
    mockGetContributions.mockReturnValue([
      {
        key: 'weekly-emails',
        component: () => <div data-testid="weekly-emails-section" />,
      },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('weekly-emails-section')).toBeInTheDocument();
  });

  it('should carry params through a section navigation into the hash', () => {
    mockSubPath = 'section/templates';
    let navigate:
      | ((subPath?: string, params?: Record<string, string>) => void)
      | undefined;
    const TemplatesSection = ({
      onNavigate,
    }: {
      onNavigate?: (subPath?: string, params?: Record<string, string>) => void;
    }) => {
      navigate = onNavigate;

      return <div data-testid="templates-section" />;
    };
    mockGetContributions.mockReturnValue([
      { key: 'templates', component: TemplatesSection },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    act(() => {
      navigate?.('view/a', { page: '3', cursor: 'abc' });
    });

    expect(mockSetHash).toHaveBeenCalledWith(
      'notification',
      'section/templates/view/a',
      { page: '3', cursor: 'abc' }
    );
  });

  it('should show the section icon in the header instead of the bell', () => {
    const SectionIcon = () => <span />;
    mockSubPath = 'section/weekly-emails';
    mockGetContributions.mockReturnValue([
      {
        key: 'weekly-emails',
        component: () => <div />,
        icon: SectionIcon,
      },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    const lastCall =
      mockOnHeaderChange.mock.calls[
        mockOnHeaderChange.mock.calls.length - 1
      ][0];

    expect(lastCall.icon).toBe(SectionIcon);
  });

  it('should keep header actions a section pushes from its mount effect', () => {
    // Child effects run before the panel's own effects, so this guards against
    // the panel wiping what the section just pushed on mount.
    mockSubPath = 'section/templates';
    mockGetContributions.mockReturnValue([
      { key: 'templates', component: TemplatesSectionWithCreateAction },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    const lastCall =
      mockOnHeaderChange.mock.calls[
        mockOnHeaderChange.mock.calls.length - 1
      ][0];

    render(lastCall.actions);

    expect(screen.getByTestId('section-create')).toHaveTextContent('Create');
  });

  it("should not leak one section's header actions into another", () => {
    // The guard for this is tagging sectionHeader with the owning key: a
    // header push from section A's mount effect must not survive navigating
    // to section B, which never pushed anything of its own.
    mockSubPath = 'section/templates';
    const WeeklyEmailsSection = () => (
      <div data-testid="weekly-emails-section" />
    );
    mockGetContributions.mockReturnValue([
      { key: 'templates', component: TemplatesSectionWithCreateAction },
      { key: 'weekly-emails', component: WeeklyEmailsSection },
    ]);

    const { rerender } = render(
      <NotificationPanel onHeaderChange={mockOnHeaderChange} />
    );

    mockSubPath = 'section/weekly-emails';
    rerender(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    const lastCall =
      mockOnHeaderChange.mock.calls[
        mockOnHeaderChange.mock.calls.length - 1
      ][0];

    expect(lastCall.actions).toBeUndefined();
  });

  it('should pass the sub-path and show a section sub-title in the header', () => {
    mockSubPath = 'section/templates/add';
    let receivedSubPath: string | undefined;
    const TemplatesSection = ({
      subPath,
      onSetSubTitle,
    }: {
      subPath?: string;
      onSetSubTitle?: (title: string | null) => void;
    }) => {
      receivedSubPath = subPath;
      React.useEffect(() => {
        onSetSubTitle?.('Add Template');
      }, [onSetSubTitle]);

      return <div data-testid="templates-section" />;
    };
    mockGetContributions.mockReturnValue([
      { key: 'templates', component: TemplatesSection },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    const lastCall =
      mockOnHeaderChange.mock.calls[
        mockOnHeaderChange.mock.calls.length - 1
      ][0];

    expect(receivedSubPath).toBe('add');
    expect(lastCall.title).toBe('Add Template');
    expect(
      lastCall.breadcrumbs.map((crumb: { id: string }) => crumb.id)
    ).toEqual(['settings', 'notification', 'section', 'current']);

    act(() => {
      lastCall.onBreadcrumbAction('section');
    });

    expect(mockSetHash).toHaveBeenCalledWith(
      'notification',
      'section/templates',
      undefined
    );
  });

  it('should render a placeholder when the section has no contribution', () => {
    mockSubPath = 'section/weekly-emails';

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByText('label.no-data')).toBeInTheDocument();
    expect(
      screen.queryByTestId('weekly-emails-section')
    ).not.toBeInTheDocument();
  });

  it('should wait for plugins to load before resolving a deep-linked section', () => {
    // `isLoading` alone is not enough: it turns false one render before
    // plugins' `contributeExtensions` actually runs. `contributionsReady`
    // covers that gap — a deep link must wait on it rather than briefly
    // resolve against an incomplete registry.
    mockContributionsReady = false;
    mockSubPath = 'section/weekly-emails';
    mockGetContributions.mockReturnValue([
      {
        key: 'weekly-emails',
        component: () => <div data-testid="weekly-emails-section" />,
      },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(
      screen.queryByTestId('weekly-emails-section')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('label.no-data')).not.toBeInTheDocument();
  });

  it('should fall back to a translated label for an unknown section key', () => {
    mockSubPath = 'section/not-a-real-section';

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    const lastCall =
      mockOnHeaderChange.mock.calls[
        mockOnHeaderChange.mock.calls.length - 1
      ][0];

    expect(lastCall.title).toBe('label.notification');
    expect(lastCall.breadcrumbs[lastCall.breadcrumbs.length - 1].label).toBe(
      'label.notification'
    );
  });

  it('should deny a deep-linked section whose menu item the user may not see', () => {
    mockSubPath = 'section/weekly-emails';
    mockGetGlobalSettingsMenu.mockReturnValue([
      {
        key: 'notifications',
        items: [
          {
            key: 'notifications.weekly-emails',
            category: 'Weekly emails',
            isProtected: false,
          },
        ],
      },
    ]);
    mockGetContributions.mockReturnValue([
      {
        key: 'weekly-emails',
        component: () => <div data-testid="weekly-emails-section" />,
      },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByText('label.access-denied')).toBeInTheDocument();
    expect(
      screen.queryByTestId('weekly-emails-section')
    ).not.toBeInTheDocument();
  });

  it('should deny a deep-linked section that has no menu item at all', () => {
    mockSubPath = 'section/weekly-emails';
    mockGetGlobalSettingsMenu.mockReturnValue([]);
    mockGetContributions.mockReturnValue([
      {
        key: 'weekly-emails',
        component: () => <div data-testid="weekly-emails-section" />,
      },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByText('label.access-denied')).toBeInTheDocument();
  });

  it('should build the settings menu with the real admin flag', () => {
    mockIsAdminUser = false;
    mockSubPath = 'section/weekly-emails';
    mockGetContributions.mockReturnValue([
      { key: 'weekly-emails', component: () => <div /> },
    ]);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(mockGetGlobalSettingsMenu).toHaveBeenCalledWith(
      expect.anything(),
      false
    );
  });

  it('should navigate to a section view from the landing', () => {
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    act(() => {
      capturedLandingProps.onNavigate({ type: 'section', key: 'templates' });
    });

    expect(mockSetHash).toHaveBeenCalledWith(
      'notification',
      'section/templates'
    );
  });
});
