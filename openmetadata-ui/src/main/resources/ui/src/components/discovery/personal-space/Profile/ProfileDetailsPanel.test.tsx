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

import { fireEvent, render, screen, within } from '@testing-library/react';
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
  default: ({ username, isSelf }: { username: string; isSelf: boolean }) => (
    <div data-is-self={String(isSelf)} data-testid="change-password-row">
      {username}
    </div>
  ),
}));
jest.mock('./customProperties/UserCustomPropertiesSection', () => ({
  __esModule: true,
  default: () => <div data-testid="user-custom-properties-section" />,
}));
jest.mock('./components/UserDescriptionRow', () => ({
  __esModule: true,
  default: ({ canEdit }: { canEdit: boolean }) => (
    <div data-can-edit={String(canEdit)} data-testid="user-description-row" />
  ),
}));
jest.mock('./components/DefaultPersonaRow', () => ({
  __esModule: true,
  default: () => <div data-testid="default-persona-row" />,
}));
jest.mock('./components/DomainsRow', () => ({
  __esModule: true,
  default: ({ canEdit }: { canEdit?: boolean }) => (
    <div data-can-edit={String(canEdit)} data-testid="domains-row" />
  ),
}));
jest.mock('./components/PersonaRow', () => ({
  __esModule: true,
  default: ({ canEdit }: { canEdit?: boolean }) => (
    <div data-can-edit={String(canEdit)} data-testid="persona-row" />
  ),
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
    testId,
    isSaveDisabled,
  }: {
    canEdit: boolean;
    view: ReactNode;
    renderEdit: () => ReactNode;
    onEnterEdit: () => void;
    onSave: () => Promise<void>;
    testId?: string;
    isSaveDisabled?: boolean;
  }) => (
    <div data-testid={testId}>
      {view}
      {canEdit && (
        <>
          <button data-testid="enter-edit" onClick={onEnterEdit}>
            edit
          </button>
          {renderEdit()}
          <button
            data-testid="save-edit"
            disabled={isSaveDisabled}
            onClick={onSave}>
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

const renderPanel = (
  overrides: Partial<User> = {},
  isLoading = false,
  showCustomProperties = false,
  canEditAll?: boolean
) => {
  const updateUserDetails = jest.fn().mockResolvedValue(undefined);
  render(
    <ProfileDetailsPanel
      canEditAll={canEditAll}
      isProfileLoading={isLoading}
      showCustomProperties={showCustomProperties}
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
    expect(
      within(screen.getByTestId('preferred-name')).getByText('harsh vador')
    ).toBeInTheDocument();
    expect(screen.getByText('harsh@example.com')).toBeInTheDocument();
    expect(screen.getByText('label.verified-status')).toBeInTheDocument();
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
    expect(screen.queryByText('label.verified-status')).not.toBeInTheDocument();
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

  it('lets an admin reset another user’s password but not rename them', () => {
    mockUseAuth.mockReturnValue({ isAdminUser: true });
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'admin' },
      authConfig: { provider: AuthProvider.Basic },
    });
    renderPanel();

    expect(screen.queryByTestId('enter-edit')).not.toBeInTheDocument();
    expect(screen.getByTestId('change-password-row')).toHaveAttribute(
      'data-is-self',
      'false'
    );
  });

  it('lets you edit your own description, read-only for anyone else', () => {
    renderPanel();

    expect(screen.getByTestId('user-description-row')).toHaveAttribute(
      'data-can-edit',
      'true'
    );
  });

  it('lets a holder of EditAll on another user rename them and edit the rows', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'steward' },
      authConfig: { provider: AuthProvider.Google },
    });
    renderPanel({}, false, false, true);

    expect(screen.getByTestId('enter-edit')).toBeInTheDocument();
    expect(screen.getByTestId('user-description-row')).toHaveAttribute(
      'data-can-edit',
      'true'
    );
    expect(screen.getByTestId('persona-row')).toHaveAttribute(
      'data-can-edit',
      'true'
    );
    // Domains get no override: only admins may change a user's domains, which
    // is the row's own default (ADR:2026-10-21-only-admins-change-a-users-domains).
    expect(screen.getByTestId('domains-row')).toHaveAttribute(
      'data-can-edit',
      'undefined'
    );
  });

  it('keeps another user read-only without EditAll on them', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'steward' },
      authConfig: { provider: AuthProvider.Google },
    });
    renderPanel({}, false, false, false);

    expect(screen.queryByTestId('enter-edit')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-description-row')).toHaveAttribute(
      'data-can-edit',
      'false'
    );
    expect(screen.getByTestId('persona-row')).toHaveAttribute(
      'data-can-edit',
      'false'
    );
  });

  it('hides a masked email and its verified badge', () => {
    renderPanel({ email: '********@masked.com' });

    expect(screen.queryByText('********@masked.com')).not.toBeInTheDocument();
    expect(screen.queryByText('label.verified-status')).not.toBeInTheDocument();
  });

  it('lists custom properties only when asked (own Profile tab)', () => {
    renderPanel();

    expect(
      screen.queryByTestId('user-custom-properties-section')
    ).not.toBeInTheDocument();
  });

  it('renders the custom properties section on your own Profile tab', () => {
    renderPanel({}, false, true);

    expect(
      screen.getByTestId('user-custom-properties-section')
    ).toBeInTheDocument();
  });

  it('holds the custom properties section back until the full profile loads', () => {
    // Before then userData is the store's copy without `extension`.
    renderPanel({}, true, true);

    expect(
      screen.queryByTestId('user-custom-properties-section')
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      'an LDAP deployment, which cannot change passwords',
      AuthProvider.LDAP,
      {},
    ],
    ['a bot, which signs in with a JWT', AuthProvider.Basic, { isBot: true }],
  ])('offers no password change on %s', (_label, provider, overrides) => {
    mockUseAuth.mockReturnValue({ isAdminUser: true });
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'admin' },
      authConfig: { provider },
    });
    renderPanel(overrides);

    expect(
      screen.queryByTestId('profile-section-security')
    ).not.toBeInTheDocument();
  });

  it('lets you edit your own preferred name and saves the trimmed draft', () => {
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

  it.each([
    ['unchanged', 'harsh vador'],
    ['unchanged after trimming', '  harsh vador  '],
    ['blank', '   '],
  ])('disables save and skips the API when the name is %s', (_, value) => {
    mockUseAuth.mockReturnValue({ isAdminUser: true });
    const updateUserDetails = renderPanel();

    fireEvent.click(screen.getByTestId('enter-edit'));
    const input = screen
      .getByTestId('preferred-name-input')
      .querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByTestId('save-edit'));

    expect(screen.getByTestId('save-edit')).toBeDisabled();
    expect(updateUserDetails).not.toHaveBeenCalled();
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

  it.each(['José', 'Søren', 'Éowyn', 'François', 'Müller', 'Renée'])(
    'renders the displayName "%s" verbatim, preserving its diacritics',
    (name) => {
      renderPanel({ displayName: name });

      const nameRow = screen.getByTestId('preferred-name');

      expect(within(nameRow).getByText(name)).toBeInTheDocument();
    }
  );

  it.each(['McDonald', "O'Brien", 'van der Berg', 'mary-jane'])(
    'renders the displayName "%s" verbatim, without re-tokenizing or re-casing',
    (name) => {
      renderPanel({ displayName: name });

      const nameRow = screen.getByTestId('preferred-name');

      expect(within(nameRow).getByText(name)).toBeInTheDocument();
    }
  );

  it('shows the same raw value in the read-only view and the edit input (no view/edit mismatch)', () => {
    renderPanel({ displayName: 'Søren' });

    const nameRow = screen.getByTestId('preferred-name');

    expect(within(nameRow).getByText('Søren')).toBeInTheDocument();

    const input = nameRow.querySelector('input') as HTMLInputElement;

    expect(input.value).toBe('Søren');
  });

  it('still humanizes the username slug with startCase when no displayName is set', () => {
    renderPanel({ displayName: undefined, name: 'john.doe' });

    const nameRow = screen.getByTestId('preferred-name');

    expect(within(nameRow).getByText('John Doe')).toBeInTheDocument();
    expect(within(nameRow).queryByText('john.doe')).not.toBeInTheDocument();
  });
});
