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
import type { PolicyInfo } from '../../../../../../rest/permissionAPI';
import type { EntityReference } from '../../../../../../generated/entity/type';
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
}));

jest.mock('./PolicyAccordion', () => ({
  __esModule: true,
  default: ({ policy }: { policy: { policy: { name?: string } } }) => (
    <div data-testid="policy">{policy.policy.name}</div>
  ),
}));

import RoleCard from './RoleCard';

const POLICIES = [
  {
    policy: { name: 'P1', type: 'policy' },
    effect: 'ALLOW',
    rules: [{ name: 'r1' }, { name: 'r2' }],
  },
] as unknown as PolicyInfo[];

const renderCard = (props = {}) =>
  render(
    <MemoryRouter>
      <RoleCard
        policies={POLICIES}
        role={{ name: 'DataConsumer', type: 'role' } as EntityReference}
        {...props}
      />
    </MemoryRouter>
  );

describe('RoleCard', () => {
  it('renders the role link and policy / rule counts', () => {
    renderCard();

    expect(screen.getByText('DataConsumer')).toBeInTheDocument();
    expect(screen.getByText('label.policy-plural : 1')).toBeInTheDocument();
    expect(screen.getByText('label.rule-plural : 2')).toBeInTheDocument();
    expect(screen.getByTestId('policy')).toHaveTextContent('P1');
  });

  it('renders the inherited-from line when provided', () => {
    renderCard({ inheritedFrom: 'Organization' });

    expect(
      screen.getByText('label.inherited-from : Organization')
    ).toBeInTheDocument();
  });

  it('omits the inherited-from line by default', () => {
    renderCard();

    expect(screen.queryByText(/label.inherited-from/)).not.toBeInTheDocument();
  });
});
