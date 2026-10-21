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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MembersView } from './Members.types';

// react-i18next is mocked globally in setupTests.js — no per-file mock needed.

let mockPermissions: Record<string, unknown> = { all: { Create: true } };
jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({ usePermissionProvider: () => ({ permissions: mockPermissions }) })
);

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: false }),
}));

jest.mock(
  './MembersLanding',
  () => (props: { onNavigate: (v: MembersView) => void }) =>
    (
      <button
        data-testid="members-landing"
        onClick={() => props.onNavigate({ type: 'teams' })}>
        landing
      </button>
    )
);

jest.mock(
  './MembersTeamDetail',
  () =>
    (props: {
      fqn: string;
      onNavigate: (v: MembersView) => void;
      onRename?: (name: string) => void;
    }) => {
      const React = require('react');
      const { onRename } = props;
      // Defer like the real component, which reports the name only after its
      // async getTeamByName resolves — so the panel's sync clear-on-nav effect
      // runs first and doesn't wipe it.
      React.useEffect(() => {
        const id = setTimeout(() => onRename?.('Engineering Team'), 0);

        return () => clearTimeout(id);
      }, [onRename]);

      return (
        <div data-fqn={props.fqn} data-testid="members-team-detail">
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
      );
    }
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
jest.mock('./MembersCreateUserForm', () => () => (
  <div data-testid="create-user" />
));
jest.mock('./MembersOnlineUsersPanel', () => () => (
  <div data-testid="online-users" />
));

import MembersPanel from './MembersPanel';

// useSettingsHash reads the hash from `window.location` (seeded on mount, then
// driven by popstate) — BrowserRouter mirrors window in production, but
// MemoryRouter does not, so set window.location.hash to simulate the deep link.
const renderAt = (hash: string) => {
  globalThis.location.hash = hash;

  return render(
    <MemoryRouter initialEntries={[`/settings${hash}`]}>
      <MembersPanel />
    </MemoryRouter>
  );
};

describe('MembersPanel', () => {
  beforeEach(() => {
    globalThis.location.hash = '';
    mockPermissions = { all: { Create: true } };
  });

  it('renders landing view by default', () => {
    render(
      <MemoryRouter>
        <MembersPanel />
      </MemoryRouter>
    );

    expect(screen.getByTestId('members-landing')).toBeInTheDocument();
  });

  it('shows the fetched team display name in the header, not the raw FQN', async () => {
    globalThis.location.hash = '#members/teams/Engineering';
    const onHeaderChange = jest.fn();

    await act(async () => {
      render(
        <MemoryRouter>
          <MembersPanel onHeaderChange={onHeaderChange} />
        </MemoryRouter>
      );
    });

    await waitFor(() =>
      expect(onHeaderChange).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Engineering Team' })
      )
    );
  });
});

describe('MembersPanel hash navigation', () => {
  beforeEach(() => {
    globalThis.location.hash = '';
    mockPermissions = { all: { Create: true } };
  });

  it('landing -> teams updates the view', () => {
    renderAt('#members');
    fireEvent.click(screen.getByTestId('members-landing'));

    expect(screen.getByTestId('members-team-detail')).toHaveAttribute(
      'data-fqn',
      'Organization'
    );
  });

  it('teams -> team-detail updates the view (the reported bug)', () => {
    renderAt('#members/teams');

    expect(screen.getByTestId('members-team-detail')).toHaveAttribute(
      'data-fqn',
      'Organization'
    );

    fireEvent.click(screen.getByTestId('go-child'));

    expect(screen.getByTestId('members-team-detail')).toHaveAttribute(
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

  it('gates the add-team form behind create permission', () => {
    mockPermissions = {};
    renderAt('#members/teams/add');

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('add-team-form')).not.toBeInTheDocument();
  });

  it('gates the team-import form behind create permission', () => {
    mockPermissions = {};
    renderAt('#members/teams/Engineering.Data/import-team');

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('import-form')).not.toBeInTheDocument();
  });

  it('gates the create-user form behind create permission', () => {
    mockPermissions = {};
    renderAt('#members/users/create');

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('create-user')).not.toBeInTheDocument();
  });
});
