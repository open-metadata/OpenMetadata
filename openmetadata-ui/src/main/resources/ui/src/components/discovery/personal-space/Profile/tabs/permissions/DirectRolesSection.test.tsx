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
import type { DirectRolePermission } from '../../../../../../rest/permissionAPI';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('./RoleCard', () => ({
  __esModule: true,
  default: ({ role }: { role: { name?: string } }) => (
    <div data-testid="role-card">{role.name}</div>
  ),
}));

jest.mock('./PermissionSectionSkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="skeleton" />,
}));

import DirectRolesSection from './DirectRolesSection';

const ROLES = [
  {
    role: { name: 'DataConsumer', type: 'role' },
    source: 'direct',
    policies: [],
  },
] as unknown as DirectRolePermission[];

describe('DirectRolesSection', () => {
  it('renders the skeleton while loading', () => {
    render(<DirectRolesSection isLoading roles={[]} />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders the empty state when there are no roles', () => {
    render(<DirectRolesSection roles={[]} />);

    expect(
      screen.getByText('message.no-direct-roles-assigned')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.direct-roles-empty-hint')
    ).toBeInTheDocument();
  });

  it('renders a role card per direct role', () => {
    render(<DirectRolesSection roles={ROLES} />);

    expect(screen.getByTestId('role-card')).toHaveTextContent('DataConsumer');
  });
});
