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
import { RuleInfo } from 'rest/permissionAPI';

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

import PermissionRuleRow from './PermissionRuleRow';

const rule = (overrides: Partial<RuleInfo> = {}): RuleInfo =>
  ({
    name: 'EditRule',
    effect: 'ALLOW',
    operations: ['EditDescription'],
    resources: ['All'],
    matches: true,
    ...overrides,
  } as RuleInfo);

describe('PermissionRuleRow', () => {
  it('renders operations, resources and effect columns', () => {
    render(<PermissionRuleRow rule={rule()} />);

    expect(screen.getByText('EditDescription')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('ALLOW')).toBeInTheDocument();
  });

  it('renders the condition when present', () => {
    render(<PermissionRuleRow rule={rule({ condition: 'matchTeam()' })} />);

    expect(screen.getByText('matchTeam()')).toBeInTheDocument();
  });

  it('shows a placeholder for empty operations / resources', () => {
    render(
      <PermissionRuleRow rule={rule({ operations: [], resources: [] })} />
    );

    expect(screen.getAllByText('--').length).toBe(2);
  });
});
