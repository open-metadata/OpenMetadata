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
import { ReactNode } from 'react';
import { User } from '../../../../generated/entity/teams/user';
import { AuthProvider } from '../../../../generated/settings/settings';
import ProfileDetailsPanel from './ProfileDetailsPanel';

const mockUseAuth = jest.fn();
const mockUseApplicationStore = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => mockUseApplicationStore(),
}));

jest.mock(
  '../../../../components/common/ProfilePicture/ProfilePicture',
  () => ({
    __esModule: true,
    default: ({ displayName }: { displayName: string }) => (
      <div data-testid="profile-picture">{displayName}</div>
    ),
  })
);

jest.mock('./components/ChangePasswordRow', () => ({
  __esModule: true,
  default: ({ username }: { username: string }) => (
    <div data-testid="change-password-row">{username}</div>
  ),
}));
jest.mock('./components/DefaultPersonaRow', () => ({
  __esModule: true,
  default: () => <div data-testid="default-persona-row" />,
}));
jest.mock('./components/DomainsRow', () => ({
  __esModule: true,
  default: () => <div data-testid="domains-row" />,
}));
jest.mock('./components/PersonaRow', () => ({
  __esModule: true,
  default: () => <div data-testid="persona-row" />,
}));
jest.mock('./components/RowSkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="row-skeleton" />,
}));
jest.mock('./components/FieldRow', () => ({
  __esModule: true,
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <span>{title}</span>
      {children}
    </div>
  ),
}));
jest.mock('./components/InlineEditCard', () => ({
  __esModule: true,
  default: ({
    canEdit,
    view,
    renderEdit,
    onEnterEdit,
    onSave,
  }: {
    canEdit: boolean;
    view: ReactNode;
    renderEdit: () => ReactNode;
    onEnterEdit: () => void;
    onSave: () => Promise<void>;
  }) => (
    <div data-testid="inline-edit-card">
      {view}
      {canEdit && (
        <>
          <button data-testid="enter-edit" onClick={onEnterEdit}>
            edit
          </button>
          {renderEdit()}
          <button data-testid="save-edit" onClick={onSave}>
            save
          </button>
        </>
      )}
    </div>
  ),
}));

const user: User = {
  id: 'u1',
  name: 'harsh',
  displayName: 'harsh vador',
  email: 'harsh@example.com',
};

const renderPanel = (overrides: Partial<User> = {}, isLoading = false) => {
  const updateUserDetails = jest.fn().mockResolvedValue(undefined);
  render(
    <ProfileDetailsPanel
      isProfileLoading={isLoading}
      updateUserDetails={updateUserDetails}
      userData={{ ...user, ...overrides }}
    />
  );

  return updateUserDetails;
};

describe('ProfileDetailsPanel', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAdminUser: false });
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'harsh' },
      authConfig: { provider: AuthProvider.Basic },
    });
  });

  it('renders the profile rows, the verified email badge and the security section for self on basic auth', () => {
    renderPanel();

    expect(screen.getByTestId('profile-picture')).toHaveTextContent(
      'harsh vador'
    );
    expect(screen.getByText('Harsh Vador')).toBeInTheDocument();
    expect(screen.getByText('harsh@example.com')).toBeInTheDocument();
    expect(screen.getByText('label.success')).toBeInTheDocument();
    expect(screen.getByTestId('profile-section-security')).toBeInTheDocument();
    expect(screen.getByTestId('change-password-row')).toHaveTextContent(
      'harsh'
    );
    expect(screen.getByTestId('persona-row')).toBeInTheDocument();
    expect(screen.getByTestId('default-persona-row')).toBeInTheDocument();
    expect(screen.getByTestId('domains-row')).toBeInTheDocument();
  });

  it('falls back to the user name and hides the email badge when they are missing', () => {
    renderPanel({ displayName: undefined, email: undefined });

    expect(screen.getByTestId('profile-picture')).toHaveTextContent('harsh');
    expect(screen.queryByText('label.success')).not.toBeInTheDocument();
  });

  it('hides the security section for another user or an external provider', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'someone-else' },
      authConfig: { provider: AuthProvider.Google },
    });
    renderPanel();

    expect(
      screen.queryByTestId('profile-section-security')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('enter-edit')).not.toBeInTheDocument();
  });

  it('lets an admin edit another user’s preferred name and saves the trimmed draft', () => {
    mockUseAuth.mockReturnValue({ isAdminUser: true });
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'admin' },
      authConfig: { provider: AuthProvider.Basic },
    });
    const updateUserDetails = renderPanel();

    fireEvent.click(screen.getByTestId('enter-edit'));
    const input = screen
      .getByTestId('preferred-name-input')
      .querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  New Name  ' } });
    fireEvent.click(screen.getByTestId('save-edit'));

    expect(updateUserDetails).toHaveBeenCalledWith(
      { displayName: 'New Name' },
      'displayName'
    );
  });

  it('blocks editing and password change for a deleted user', () => {
    renderPanel({ deleted: true });

    expect(screen.queryByTestId('enter-edit')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('profile-section-security')
    ).not.toBeInTheDocument();
  });

  it('shows skeletons instead of the identity rows while loading', () => {
    renderPanel({}, true);

    expect(screen.getAllByTestId('row-skeleton')).toHaveLength(3);
    expect(screen.queryByTestId('persona-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('domains-row')).not.toBeInTheDocument();
  });
});
