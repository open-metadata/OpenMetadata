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
import type { TeamPermission } from '../../../../../../rest/permissionAPI';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { name?: string }) => ref?.name ?? '',
}));

jest.mock('utils/RouterUtils', () => ({
  getPolicyWithFqnPath: () => '/policy',
  getRoleWithFqnPath: () => '/role',
  getTeamsWithFqnPath: () => '/team',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Badge: ({ children }: { children?: ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

jest.mock('./PolicyAccordion', () => ({
  __esModule: true,
  default: ({ policy }: { policy: { policy: { name?: string } } }) => (
    <div data-testid="policy">{policy.policy.name}</div>
  ),
}));

jest.mock('./RoleCard', () => ({
  __esModule: true,
  default: ({
    role,
    inheritedFrom,
  }: {
    role: { name?: string };
    inheritedFrom?: string;
  }) => (
    <div data-testid="role-card">{`${role.name}:${inheritedFrom ?? ''}`}</div>
  ),
}));

jest.mock('./PermissionSectionSkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="skeleton" />,
}));

import TeamPermissionsSection from './TeamPermissionsSection';

const TEAM = {
  team: { name: 'Organization', type: 'team' },
  teamType: 'Organization',
  hierarchyLevel: 1,
  teamHierarchy: [
    { id: 'a', name: 'TeamA', type: 'team' },
    { id: 'b', name: 'Organization', type: 'team' },
  ],
  rolePermissions: [
    {
      role: { name: 'DataConsumer', type: 'role' },
      inheritedFrom: 'Organization',
      policies: [],
    },
  ],
  directPolicies: [
    {
      policy: { name: 'DirectPolicy', type: 'policy' },
      effect: 'ALLOW',
      rules: [],
    },
  ],
} as unknown as TeamPermission;

const renderSection = (props = {}) =>
  render(
    <MemoryRouter>
      <TeamPermissionsSection teams={[TEAM]} {...props} />
    </MemoryRouter>
  );

describe('TeamPermissionsSection', () => {
  it('renders the skeleton while loading', () => {
    renderSection({ teams: [], isLoading: true });

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders the empty state when there are no teams', () => {
    renderSection({ teams: [] });

    expect(screen.getByText('label.no-team-permissions')).toBeInTheDocument();
  });

  it('renders team name, type, inherited level and hierarchy chain', () => {
    renderSection();

    expect(screen.getAllByText('Organization').length).toBeGreaterThan(0);
    expect(screen.getByText('TeamA')).toBeInTheDocument();
    expect(
      screen.getByText('label.level 1 label.inherited')
    ).toBeInTheDocument();
  });

  it('renders team roles and direct policies', () => {
    renderSection();

    expect(screen.getByTestId('role-card')).toHaveTextContent(
      'DataConsumer:Organization'
    );
    expect(screen.getByTestId('policy')).toHaveTextContent('DirectPolicy');
  });
});
