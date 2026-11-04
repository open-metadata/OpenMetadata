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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

import MembersLanding from './MembersLanding';

let mockPermissions: Record<string, unknown> = { all: { ViewAll: true } };
let mockIsAdmin = true;
jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({ usePermissionProvider: () => ({ permissions: mockPermissions }) })
);
jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

// The landing grid reads contributed sections through this provider; default to
// none so the built-in cards are asserted in isolation.
const mockGetContributions = jest.fn().mockReturnValue([]);
jest.mock(
  '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      getContributions: mockGetContributions,
    }),
  })
);

describe('MembersLanding', () => {
  beforeEach(() => {
    mockGetContributions.mockReturnValue([]);
    mockPermissions = { all: { ViewAll: true } };
    mockIsAdmin = true;
  });

  it('keeps Online users to admins, as the classic settings do', () => {
    mockIsAdmin = false;
    render(<MembersLanding onNavigate={jest.fn()} />);

    expect(screen.getByTestId('members-card-teams')).toBeInTheDocument();
    expect(screen.getByTestId('members-card-users')).toBeInTheDocument();
    expect(screen.getByTestId('members-card-admins')).toBeInTheDocument();
    expect(
      screen.queryByTestId('members-card-online-users')
    ).not.toBeInTheDocument();
  });

  it('shows only the cards a non-admin may view', () => {
    mockIsAdmin = false;
    mockPermissions = { team: { ViewAll: true } };
    render(<MembersLanding onNavigate={jest.fn()} />);

    expect(screen.getByTestId('members-card-teams')).toBeInTheDocument();
    expect(screen.queryByTestId('members-card-users')).not.toBeInTheDocument();
    expect(screen.queryByTestId('members-card-admins')).not.toBeInTheDocument();
  });

  it('renders 4 landing cards', () => {
    const onNavigate = jest.fn();
    render(<MembersLanding onNavigate={onNavigate} />);

    expect(screen.getByTestId('members-card-teams')).toBeInTheDocument();
    expect(screen.getByTestId('members-card-users')).toBeInTheDocument();
    expect(screen.getByTestId('members-card-admins')).toBeInTheDocument();
    expect(screen.getByTestId('members-card-online-users')).toBeInTheDocument();
  });

  it('calls onNavigate with correct view when a card is clicked', () => {
    const onNavigate = jest.fn();
    render(<MembersLanding onNavigate={onNavigate} />);

    fireEvent.click(screen.getByTestId('members-card-teams'));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'teams' });
  });

  it('appends a card for each contributed section', () => {
    mockGetContributions.mockReturnValue([
      {
        key: 'provisioning',
        component: () => null,
        titleKey: 'label.provisioning',
        descriptionKey: 'message.provisioning-desc',
      },
    ]);

    render(<MembersLanding onNavigate={jest.fn()} />);

    // Built-ins stay, the contributed card is added after them.
    expect(screen.getByTestId('members-card-teams')).toBeInTheDocument();
    expect(screen.getByTestId('members-card-provisioning')).toBeInTheDocument();
  });

  it('navigates a contributed card to its section view', () => {
    const onNavigate = jest.fn();
    mockGetContributions.mockReturnValue([
      {
        key: 'provisioning',
        component: () => null,
        titleKey: 'label.provisioning',
      },
    ]);

    render(<MembersLanding onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTestId('members-card-provisioning'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'section',
      key: 'provisioning',
    });
  });
});
