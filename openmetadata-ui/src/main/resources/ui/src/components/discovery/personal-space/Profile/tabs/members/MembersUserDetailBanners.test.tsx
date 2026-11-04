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
let mockIsAdmin = true;

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

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
  canRestore = true,
  onRestore = jest.fn()
) =>
  render(
    <MembersUserDetailBanners
      activeTab={activeTab}
      canRestore={canRestore}
      user={{ ...ALICE, ...user }}
      onRestore={onRestore}
    />
  );

describe('MembersUserDetailBanners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = true;
  });

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

  it('hides the restore button from viewers who cannot restore', () => {
    renderBanners({ deleted: true }, 'overview', false);

    expect(screen.getByTestId('user-deleted-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('banner-restore-user')).not.toBeInTheDocument();
  });

  it('shows the bot banner on overview only, linking to the bot', () => {
    renderBanners({ isBot: true, isAdmin: true });

    expect(screen.getByTestId('user-bot-banner')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-in-bots'));

    // BotsPanel matches the raw name, so it must not be percent-encoded.
    expect(mockSetHash).toHaveBeenCalledWith('bots', 'alice bot');
  });

  it('offers no Open in Bots link to a non-admin, who has no Bots page', () => {
    mockIsAdmin = false;
    renderBanners({ isBot: true });

    expect(screen.getByTestId('user-bot-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('open-in-bots')).not.toBeInTheDocument();
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
