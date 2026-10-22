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
import { User } from '../../../../../../generated/entity/teams/user';
import type { UserDetailTab } from './Members.types';
import MembersUserDetailBanners from './MembersUserDetailBanners';

const mockSetHash = jest.fn();

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({ setHash: mockSetHash }),
}));

const ALICE = {
  id: 'u-alice',
  name: 'alice bot',
  displayName: 'Alice Johnson',
  updatedAt: 1700000000000,
} as User;

const renderBanners = (
  user: Partial<User>,
  activeTab: UserDetailTab = 'overview',
  canManage = true,
  onRestore = jest.fn()
) =>
  render(
    <MembersUserDetailBanners
      activeTab={activeTab}
      canManage={canManage}
      user={{ ...ALICE, ...user }}
      onRestore={onRestore}
    />
  );

describe('MembersUserDetailBanners', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing for an active, human, non-admin user', () => {
    const { container } = renderBanners({});

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the deleted banner with a restore button for managers', () => {
    const onRestore = jest.fn();
    renderBanners({ deleted: true }, 'overview', true, onRestore);

    expect(screen.getByTestId('user-deleted-banner')).toHaveTextContent(
      'message.user-deleted-read-only-description'
    );

    fireEvent.click(screen.getByTestId('banner-restore-user'));

    expect(onRestore).toHaveBeenCalled();
  });

  it('hides the restore button from viewers who cannot manage', () => {
    renderBanners({ deleted: true }, 'overview', false);

    expect(screen.getByTestId('user-deleted-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('banner-restore-user')).not.toBeInTheDocument();
  });

  it('shows the bot banner on overview only, linking to the bot', () => {
    renderBanners({ isBot: true, isAdmin: true });

    expect(screen.getByTestId('user-bot-banner')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-in-bots'));

    expect(mockSetHash).toHaveBeenCalledWith('bots', 'alice%20bot');
  });

  it('hides the bot banner off the overview tab', () => {
    renderBanners({ isBot: true }, 'access');

    expect(screen.queryByTestId('user-bot-banner')).not.toBeInTheDocument();
  });

  it('shows the admin banner on the access tab for a human admin only', () => {
    renderBanners({ isAdmin: true }, 'access');

    expect(screen.getByTestId('user-admin-banner')).toHaveTextContent(
      'message.user-is-an-admin'
    );
  });

  it.each([
    [{ isAdmin: true }, 'overview' as UserDetailTab],
    [{ isAdmin: true, isBot: true }, 'access' as UserDetailTab],
  ])('hides the admin banner for %j on %s', (flags, tab) => {
    renderBanners(flags, tab);

    expect(screen.queryByTestId('user-admin-banner')).not.toBeInTheDocument();
  });
});
