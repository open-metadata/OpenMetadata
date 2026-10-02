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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MembersView } from './Members.types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({ usePermissionProvider: () => ({ permissions: {} }) })
);

jest.mock(
  './MembersLanding',
  () => (props: { onNavigate: (v: MembersView) => void }) =>
    (
      <button
        data-testid="go-teams"
        onClick={() => props.onNavigate({ type: 'teams' })}>
        landing
      </button>
    )
);

jest.mock(
  './MembersTeamDetail',
  () => (props: { fqn: string; onNavigate: (v: MembersView) => void }) =>
    (
      <div data-fqn={props.fqn} data-testid="team-detail">
        <button
          data-testid="go-child"
          onClick={() =>
            props.onNavigate({
              type: 'team-detail',
              fqn: 'child-team',
              name: 'child-team',
            })
          }>
          detail:{props.fqn}
        </button>
        <button
          data-testid="go-add"
          onClick={() => props.onNavigate({ type: 'teams-add' })}>
          add
        </button>
        <button
          data-testid="go-import"
          onClick={() =>
            props.onNavigate({
              type: 'teams-import',
              fqn: props.fqn,
              importType: 'teams',
            })
          }>
          import
        </button>
      </div>
    )
);

jest.mock('./MembersAddTeamForm', () => () => (
  <div data-testid="add-team-form" />
));
jest.mock(
  './MembersImportForm',
  () => (props: { fqn: string; importType: string }) =>
    (
      <div
        data-fqn={props.fqn}
        data-import-type={props.importType}
        data-testid="import-form"
      />
    )
);
jest.mock('./MembersUsersPanel', () => () => <div data-testid="users-panel" />);
jest.mock('./MembersAdminsPanel', () => () => (
  <div data-testid="admins-panel" />
));
jest.mock('./MembersCreateUserForm', () => () => (
  <div data-testid="create-user" />
));
jest.mock('./MembersOnlineUsersPanel', () => () => (
  <div data-testid="online-users" />
));

import MembersPanel from './MembersPanel';

const renderAt = (hash: string) =>
  render(
    <MemoryRouter initialEntries={[`/settings${hash}`]}>
      <MembersPanel />
    </MemoryRouter>
  );

describe('MembersPanel hash navigation', () => {
  it('landing -> teams updates the view', () => {
    renderAt('#members');
    fireEvent.click(screen.getByTestId('go-teams'));

    expect(screen.getByTestId('team-detail')).toHaveAttribute(
      'data-fqn',
      'Organization'
    );
  });

  it('teams -> team-detail updates the view (the reported bug)', () => {
    renderAt('#members/teams');

    expect(screen.getByTestId('team-detail')).toHaveAttribute(
      'data-fqn',
      'Organization'
    );

    fireEvent.click(screen.getByTestId('go-child'));

    expect(screen.getByTestId('team-detail')).toHaveAttribute(
      'data-fqn',
      'child-team'
    );
  });

  it('teams -> teams-add shows the add form', () => {
    renderAt('#members/teams');
    fireEvent.click(screen.getByTestId('go-add'));

    expect(screen.getByTestId('add-team-form')).toBeInTheDocument();
  });

  it('team-detail -> teams-import shows the import form with the team fqn', () => {
    renderAt('#members/teams');
    fireEvent.click(screen.getByTestId('go-import'));

    const form = screen.getByTestId('import-form');

    expect(form).toHaveAttribute('data-fqn', 'Organization');
    expect(form).toHaveAttribute('data-import-type', 'teams');
  });

  it('deep-links a user import hash to the import form', () => {
    renderAt('#members/teams/Engineering.Data/import-user');

    const form = screen.getByTestId('import-form');

    expect(form).toHaveAttribute('data-fqn', 'Engineering.Data');
    expect(form).toHaveAttribute('data-import-type', 'users');
  });
});
