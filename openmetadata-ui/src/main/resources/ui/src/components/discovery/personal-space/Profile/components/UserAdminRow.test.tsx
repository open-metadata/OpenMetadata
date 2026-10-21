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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { User } from '../../../../../generated/entity/teams/user';
import UserAdminRow from './UserAdminRow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const user = { id: 'u1', name: 'jane', isAdmin: false } as User;

describe('UserAdminRow', () => {
  it('saves isAdmin only after the toggle actually changes', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <UserAdminRow
        canEdit
        updateUserDetails={updateUserDetails}
        userData={user}
      />
    );

    expect(screen.getByTestId('user-admin')).toHaveTextContent('label.no');

    fireEvent.click(screen.getByTestId('user-admin-edit'));

    expect(screen.getByTestId('user-admin-save')).toBeDisabled();

    fireEvent.click(screen.getByRole('switch'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('user-admin-save'));
    });

    expect(updateUserDetails).toHaveBeenCalledWith(
      { isAdmin: true },
      'isAdmin'
    );
  });

  it('shows the admin-managed lock when it cannot be edited', () => {
    render(
      <UserAdminRow
        canEdit={false}
        updateUserDetails={jest.fn()}
        userData={user}
      />
    );

    expect(screen.queryByTestId('user-admin-edit')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-admin-locked')).toBeInTheDocument();
  });
});
