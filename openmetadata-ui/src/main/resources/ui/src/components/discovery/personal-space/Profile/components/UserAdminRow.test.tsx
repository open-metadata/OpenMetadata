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

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const user = { id: 'u1', name: 'jane', isAdmin: false } as User;

describe('UserAdminRow', () => {
  it('saves isAdmin as soon as the visible toggle is flipped', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <UserAdminRow
        canEdit
        updateUserDetails={updateUserDetails}
        userData={user}
      />
    );

    const toggle = screen.getByRole('switch');

    expect(toggle).not.toBeChecked();
    expect(screen.queryByText('label.save-changes')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(updateUserDetails).toHaveBeenCalledWith(
      { isAdmin: true },
      'isAdmin'
    );
  });

  it('shows the toggle disabled when the viewer cannot change admin status', () => {
    render(
      <UserAdminRow
        canEdit={false}
        updateUserDetails={jest.fn()}
        userData={{ ...user, isAdmin: true }}
      />
    );

    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('moves the switch right away and reverts it if the save fails', async () => {
    let rejectSave!: (error: Error) => void;
    const updateUserDetails = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSave = reject;
        })
    );
    render(
      <UserAdminRow
        canEdit
        updateUserDetails={updateUserDetails}
        userData={user}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'));
    });

    expect(screen.getByRole('switch')).toBeChecked();

    await act(async () => {
      rejectSave(new Error('boom'));
    });

    expect(screen.getByRole('switch')).not.toBeChecked();
  });
});
