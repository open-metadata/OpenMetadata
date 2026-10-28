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
import { useEffect, useState } from 'react';
import { User } from '../../../../generated/entity/teams/user';
import type { ProfileHeaderOverride } from './profileNavConfig';
import ProfileTabPanel from './ProfileTabPanel';
import type {
  MembersUserDetailProps,
  MembersView,
} from './tabs/members/Members.types';

let mockHashState = { tab: 'profile', subPath: '', params: {} };
const mockSetHash = jest.fn();
let mockIsAdmin = false;

jest.mock('../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({ state: mockHashState, setHash: mockSetHash }),
}));
jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'harsh' } }),
}));
// A stable `t`, like react-i18next's: the header effects depend on it.
const mockT = (key: string) => key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));
jest.mock(
  './ProfileDetailsPanel',
  () =>
    ({ showCustomProperties }: { showCustomProperties?: boolean }) =>
      (
        <div
          data-show-cp={String(Boolean(showCustomProperties))}
          data-testid="profile-details-panel"
        />
      )
);
jest.mock(
  './tabs/members/MembersUserDetail',
  () =>
    ({ view, onNavigate, onSetHeader }: MembersUserDetailProps) => {
      useEffect(() => {
        onSetHeader({ title: view.name });

        return () => onSetHeader(undefined);
      }, [onSetHeader, view.name]);

      return (
        <div data-testid="members-user-detail">
          {view.name}
          <button
            aria-label="go-access"
            data-testid="go-access"
            onClick={() =>
              onNavigate({
                type: 'user-detail',
                name: view.name,
                tab: 'access',
              } as MembersView)
            }
          />
        </div>
      );
    }
);

const HARSH = {
  id: 'me',
  name: 'harsh',
  displayName: 'Harsh V',
  email: 'harsh@acme.io',
  isAdmin: true,
} as User;

const onHeaderSpy = jest.fn();

const Harness = ({
  loadError,
  onReload,
}: {
  loadError?: boolean;
  onReload?: () => void;
}) => {
  const [header, setHeader] = useState<ProfileHeaderOverride | null>(null);
  const [onHeaderChange] = useState(
    () => (next: ProfileHeaderOverride | null) => {
      onHeaderSpy(next);
      setHeader(next);
    }
  );

  return (
    <>
      <div data-testid="header-title">{header?.title}</div>
      <div data-testid="header-description">{header?.description}</div>
      <div data-testid="header-crumbs">
        {header?.breadcrumbs?.map((crumb) => crumb.label).join(' > ')}
      </div>
      <div data-testid="header-suffix">{header?.titleSuffix}</div>
      {header?.onBreadcrumbAction && (
        <button
          aria-label="crumb-users"
          data-testid="crumb-users"
          onClick={() => header.onBreadcrumbAction?.('users')}
        />
      )}
      {header?.actions}
      <ProfileTabPanel
        isProfileLoading={false}
        loadError={loadError}
        updateUserDetails={jest.fn()}
        userData={HARSH}
        onHeaderChange={onHeaderChange}
        onReload={onReload}
      />
    </>
  );
};

describe('ProfileTabPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHashState = { tab: 'profile', subPath: '', params: {} };
    mockIsAdmin = false;
  });

  it('shows your own profile with the identity header and custom properties', () => {
    render(<Harness />);

    expect(screen.getByTestId('profile-details-panel')).toHaveAttribute(
      'data-show-cp',
      'true'
    );
    expect(screen.getByTestId('header-title')).toHaveTextContent('Harsh V');
    expect(screen.getByTestId('header-description')).toHaveTextContent(
      '@harsh · harsh@acme.io'
    );
    expect(screen.getByTestId('user-you-badge')).toBeInTheDocument();
    expect(screen.getByText('label.admin')).toBeInTheDocument();
    // Default Account › Profile crumbs come from ProfilePage.
    expect(screen.getByTestId('header-crumbs')).toBeEmptyDOMElement();
    expect(screen.queryByTestId('members-user-detail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('own-profile-kebab')).not.toBeInTheDocument();
  });

  it('shows an error with a reload instead of the editable panel when your profile failed to load', () => {
    const onReload = jest.fn();
    render(<Harness loadError onReload={onReload} />);

    expect(screen.getByTestId('profile-load-error')).toBeInTheDocument();
    // No details panel, so no custom-property (or any other) edit control.
    expect(
      screen.queryByTestId('profile-details-panel')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('label.reload'));

    expect(onReload).toHaveBeenCalled();
  });

  it('opens another user read-only with non-clickable crumbs for a non-admin', () => {
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };
    render(<Harness />);

    expect(screen.getByTestId('members-user-detail')).toHaveTextContent('jane');
    expect(
      screen.queryByTestId('profile-details-panel')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toHaveTextContent('jane');
    expect(screen.getByTestId('header-crumbs')).toHaveTextContent(
      'label.setting-plural > label.member-plural > label.user-plural > jane'
    );
    expect(screen.queryByTestId('crumb-users')).not.toBeInTheDocument();
  });

  it('keeps tab navigation on the profile route', () => {
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };
    render(<Harness />);

    fireEvent.click(screen.getByTestId('go-access'));

    expect(mockSetHash).toHaveBeenCalledWith('profile', 'jane/access');
  });

  it('lets an admin follow the crumbs to Members › Users', () => {
    mockIsAdmin = true;
    mockHashState = { tab: 'profile', subPath: 'jane', params: {} };
    render(<Harness />);

    fireEvent.click(screen.getByTestId('crumb-users'));

    expect(mockSetHash).toHaveBeenCalledWith('members', 'users');
  });

  it('treats your own name in the hash as your own profile', () => {
    mockHashState = { tab: 'profile', subPath: 'harsh', params: {} };
    render(<Harness />);

    expect(screen.getByTestId('profile-details-panel')).toBeInTheDocument();
  });

  // A shared `#profile/<you>/tasks/<id>` link must open that task, not drop
  // its tab and task segments and land on your own Profile.
  it('opens your own task from a profile link that names it', () => {
    mockHashState = {
      tab: 'profile',
      subPath: 'harsh/tasks/TASK-00170',
      params: {},
    };
    render(<Harness />);

    expect(screen.getByTestId('members-user-detail')).toHaveTextContent(
      'harsh'
    );
    expect(
      screen.queryByTestId('profile-details-panel')
    ).not.toBeInTheDocument();
  });

  it('clears the header on unmount', () => {
    const { unmount } = render(<Harness />);
    unmount();

    expect(onHeaderSpy).toHaveBeenLastCalledWith(null);
  });
});
