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
import type { InheritedPermission } from '../../../../../../rest/permissionAPI';
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

jest.mock('./PermissionSectionSkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="skeleton" />,
}));

import InheritedPermissionsSection from './InheritedPermissionsSection';

const ITEM = {
  permissionType: 'Admin',
  description: 'User has admin privileges',
  source: { name: 'Platform', type: 'team' },
  policies: [
    {
      policy: { name: 'AdminPolicy', type: 'policy' },
      effect: 'ALLOW',
      rules: [],
    },
  ],
} as unknown as InheritedPermission;

const renderSection = (props = {}) =>
  render(
    <MemoryRouter>
      <InheritedPermissionsSection items={[ITEM]} {...props} />
    </MemoryRouter>
  );

describe('InheritedPermissionsSection', () => {
  it('renders the skeleton while loading', () => {
    renderSection({ items: [], isLoading: true });

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders the empty state when there are no items', () => {
    renderSection({ items: [] });

    expect(
      screen.getByText('label.no-inherited-permissions')
    ).toBeInTheDocument();
  });

  it('renders the permission type, description, source and policies', () => {
    renderSection();

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('User has admin privileges')).toBeInTheDocument();
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByTestId('policy')).toHaveTextContent('AdminPolicy');
  });
});
