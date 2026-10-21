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
import { act, render, screen } from '@testing-library/react';
import { User } from '../../../../../../generated/entity/teams/user';
import MembersUserEdit from './MembersUserEdit';

const mockGetUserByName = jest.fn();

jest.mock('../../../../../../rest/userAPI', () => ({
  getUserByName: (...args: unknown[]) => mockGetUserByName(...args),
  updateUserDetail: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

jest.mock(
  '../../ProfileDetailsPanel',
  () =>
    ({ userData }: { userData: User }) =>
      <div data-testid="details-panel">{userData.name}</div>
);

jest.mock(
  '../permissions/MembershipSection',
  () =>
    ({ userData }: { userData: User }) =>
      <div data-testid="membership">{userData.name}</div>
);

describe('MembersUserEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the named user, not the logged-in one, and reports the display name', async () => {
    mockGetUserByName.mockResolvedValue({
      id: 'u2',
      name: 'jane',
      displayName: 'Jane Doe',
    });
    const onResolveName = jest.fn();

    await act(async () => {
      render(<MembersUserEdit name="jane" onResolveName={onResolveName} />);
    });

    expect(mockGetUserByName).toHaveBeenCalledWith('jane', expect.any(Object));
    expect(screen.getByTestId('details-panel')).toHaveTextContent('jane');
    expect(screen.getByTestId('membership')).toHaveTextContent('jane');
    expect(onResolveName).toHaveBeenCalledWith('Jane Doe');
  });

  it('shows a not-found placeholder for an unknown user', async () => {
    mockGetUserByName.mockRejectedValue({ response: { status: 404 } });

    await act(async () => {
      render(<MembersUserEdit name="ghost" onResolveName={jest.fn()} />);
    });

    expect(screen.getByTestId('user-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('details-panel')).not.toBeInTheDocument();
  });
});
