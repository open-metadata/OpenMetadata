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
import type { User } from '../../../../../../generated/entity/teams/user';
import { ReactNode } from 'react';

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

jest.mock('@untitledui/icons', () => ({
  Lock01: () => <span />,
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { name?: string }) => ref?.name ?? '',
}));

import MembershipSection from './MembershipSection';

describe('MembershipSection', () => {
  it('renders team and role chips plus the synthetic admin chip', () => {
    render(
      <MembershipSection
        userData={
          {
            name: 'alice',
            teams: [{ id: 't1', name: 'CoreTeam', type: 'team' }],
            roles: [{ id: 'r1', name: 'Analyst', type: 'role' }],
            isAdmin: true,
          } as unknown as User
        }
      />
    );

    expect(screen.getByText('CoreTeam')).toBeInTheDocument();
    expect(screen.getByText('Analyst')).toBeInTheDocument();
    // isAdmin surfaces a synthetic Admin role chip.
    expect(screen.getByText('label.admin')).toBeInTheDocument();
    // Both rows carry an "Admin-managed" tag.
    expect(screen.getAllByText('label.admin-managed').length).toBe(2);
  });

  it('renders placeholders when there are no teams or roles', () => {
    render(
      <MembershipSection
        userData={{ name: 'alice', teams: [], roles: [] } as unknown as User}
      />
    );

    expect(screen.getByText('message.no-teams-assigned')).toBeInTheDocument();
    expect(screen.getByText('message.no-roles-assigned')).toBeInTheDocument();
    expect(screen.queryByText('label.admin')).not.toBeInTheDocument();
  });
});
