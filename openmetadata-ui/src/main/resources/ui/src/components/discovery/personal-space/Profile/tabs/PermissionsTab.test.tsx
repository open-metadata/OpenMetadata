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

import { act, render, screen, waitFor } from '@testing-library/react';
import type { User } from '../../../../../generated/entity/teams/user';
import { ReactNode } from 'react';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { MemoryRouter } from 'react-router-dom';

const mockGetMyPermissionDebugInfo = jest.fn();
const mockGetPermissionDebugInfo = jest.fn();

jest.mock('rest/permissionAPI', () => ({
  getMyPermissionDebugInfo: mockGetMyPermissionDebugInfo,
  getPermissionDebugInfo: mockGetPermissionDebugInfo,
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'alice' } }),
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { name?: string }) => ref?.name ?? '',
}));

jest.mock('utils/RouterUtils', () => ({
  getPolicyWithFqnPath: () => '/policy',
  getRoleWithFqnPath: () => '/role',
  getTeamsWithFqnPath: () => '/team',
}));

jest.mock('@untitledui/icons', () => ({
  UserCheck01: () => <span />,
  Lock01: () => <span />,
  ShieldTick: () => <span />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Divider: () => <hr />,
  Skeleton: () => <div data-testid="skeleton" />,
  Badge: ({ children }: { children?: ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  Accordion: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionPanel: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  Tag: ({ children }: { children?: ReactNode }) => (
    <span data-testid="tag">{children}</span>
  ),
  TagGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TagList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import PermissionsTab from './PermissionsTab';

const DEBUG_INFO = {
  user: { name: 'alice', type: 'user' },
  summary: {
    totalRoles: 1,
    totalPolicies: 1,
    totalRules: 1,
    directRoles: 1,
    inheritedRoles: 0,
    teamCount: 1,
    maxHierarchyDepth: 1,
    effectiveOperations: ['EditDescription'],
    deniedOperations: ['Delete'],
  },
  directRoles: [
    {
      role: { name: 'DataConsumer', type: 'role' },
      source: 'direct',
      policies: [
        {
          policy: { name: 'DataConsumerPolicy', type: 'policy' },
          effect: 'ALLOW',
          rules: [
            {
              name: 'EditRule',
              effect: 'ALLOW',
              operations: ['EditDescription'],
              resources: ['All'],
              matches: true,
            },
          ],
        },
      ],
    },
  ],
  teamPermissions: [
    {
      team: { name: 'Organization', type: 'team' },
      teamType: 'Organization',
      hierarchyLevel: 1,
      teamHierarchy: [],
      rolePermissions: [],
      directPolicies: [],
    },
  ],
  inheritedPermissions: [
    {
      permissionType: 'Admin',
      description: 'User has admin privileges',
      policies: [],
    },
  ],
};

const renderTab = (name = 'alice') =>
  render(
    <MemoryRouter>
      <PermissionsTab
        updateUserDetails={jest.fn()}
        userData={
          {
            name,
            teams: [{ id: 't1', name: 'CoreTeam', type: 'team' }],
            roles: [{ id: 'r1', name: 'Analyst', type: 'role' }],
            isAdmin: true,
          } as unknown as User
        }
      />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyPermissionDebugInfo.mockResolvedValue({ data: DEBUG_INFO });
  mockGetPermissionDebugInfo.mockResolvedValue({ data: DEBUG_INFO });
});

describe('PermissionsTab', () => {
  it('renders all four section titles', async () => {
    await act(async () => renderTab());

    expect(screen.getByText('label.permission-summary')).toBeInTheDocument();
    expect(screen.getByText('label.direct-role-plural')).toBeInTheDocument();
    expect(
      screen.getByText('label.team-permission-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('label.other-inherited-permission-plural')
    ).toBeInTheDocument();
  });

  it('renders the membership section with team, role, and synthetic admin chips', async () => {
    await act(async () => renderTab());

    expect(screen.getByText('label.membership')).toBeInTheDocument();
    expect(screen.getByTestId('membership-section')).toBeInTheDocument();
    expect(screen.getByText('CoreTeam')).toBeInTheDocument();
    expect(screen.getByText('Analyst')).toBeInTheDocument();
    // isAdmin surfaces a synthetic Admin role chip.
    expect(screen.getByText('label.admin')).toBeInTheDocument();
    expect(screen.getAllByText('label.admin-managed').length).toBe(2);
  });

  it('renders allowed/denied operation chips from the summary', async () => {
    await act(async () => renderTab());

    expect(screen.getAllByText('EditDescription').length).toBeGreaterThan(0);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders the direct role, its policy effect, and rule resources', async () => {
    await act(async () => renderTab());

    expect(screen.getByText('DataConsumer')).toBeInTheDocument();
    expect(screen.getByText('DataConsumerPolicy')).toBeInTheDocument();
    // ALLOW appears as the policy effect badge and the rule effect column.
    expect(screen.getAllByText('ALLOW').length).toBeGreaterThan(0);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders the inherited Admin permission with its description', async () => {
    await act(async () => renderTab());

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('User has admin privileges')).toBeInTheDocument();
  });

  it('fetches debug info for the logged-in user', async () => {
    await act(async () => renderTab());

    expect(mockGetMyPermissionDebugInfo).toHaveBeenCalledTimes(1);
  });

  it('fetches another user by name instead of the self endpoint', async () => {
    await act(async () => renderTab('bob'));

    expect(mockGetPermissionDebugInfo).toHaveBeenCalledWith('bob');
    expect(mockGetMyPermissionDebugInfo).not.toHaveBeenCalled();
  });

  it('surfaces a toast and stops loading when the fetch fails', async () => {
    mockGetMyPermissionDebugInfo.mockRejectedValue(new Error('boom'));

    await act(async () => renderTab());

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    // No crash: the empty summary still renders its section titles, and the
    // skeleton (loading) has been cleared.
    expect(screen.getByText('label.permission-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('shows skeletons while the request is in progress', () => {
    mockGetMyPermissionDebugInfo.mockReturnValue(new Promise(() => undefined));
    renderTab();

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('label.no-data-found')).not.toBeInTheDocument();
  });
});
