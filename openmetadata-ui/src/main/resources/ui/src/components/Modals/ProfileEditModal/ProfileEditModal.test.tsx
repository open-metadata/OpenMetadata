/*
 *  Copyright 2025 Collate.
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
import { AxiosError } from 'axios';
import { User } from '../../../generated/entity/teams/user';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ProfileEditModal } from './ProfileEditModal';

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockUserData = {
  displayName: 'Test User',
  id: '123',
  name: 'testuser',
  email: 'test@example.com',
} as User;

const mockOnCancel = jest.fn();
const mockUpdateUserDetails = jest.fn();

describe('ProfileEditModal', () => {
  it('should render the modal with correct title and form', async () => {
    render(
      <ProfileEditModal
        updateUserDetails={mockUpdateUserDetails}
        userData={mockUserData}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('profile-edit-modal')).toBeInTheDocument();
    expect(screen.getByText('label.edit-entity')).toBeInTheDocument();
    expect(screen.getByTestId('displayName-input')).toBeInTheDocument();
  });

  it('should initialize form with user display name', async () => {
    render(
      <ProfileEditModal
        updateUserDetails={mockUpdateUserDetails}
        userData={mockUserData}
        onCancel={mockOnCancel}
      />
    );

    const displayNameInput = screen.getByTestId('displayName-input');

    expect(displayNameInput).toHaveValue(mockUserData.displayName);
  });

  it('should call onCancel when cancel button is clicked', async () => {
    render(
      <ProfileEditModal
        updateUserDetails={mockUpdateUserDetails}
        userData={mockUserData}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('label.cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call updateUserDetails and close modal on successful save', async () => {
    render(
      <ProfileEditModal
        updateUserDetails={mockUpdateUserDetails}
        userData={mockUserData}
        onCancel={mockOnCancel}
      />
    );

    const saveButton = screen.getByText('label.save');
    const displayNameInput = screen.getByTestId('displayName-input');

    await act(async () => {
      fireEvent.change(displayNameInput, { target: { value: 'New Name' } });
      fireEvent.click(saveButton);
    });

    expect(mockUpdateUserDetails).toHaveBeenCalledWith(
      { displayName: 'New Name' },
      'displayName'
    );
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show error toast when updateUserDetails fails', async () => {
    const error = new Error('Update failed') as AxiosError;
    mockUpdateUserDetails.mockRejectedValueOnce(error);

    render(
      <ProfileEditModal
        updateUserDetails={mockUpdateUserDetails}
        userData={mockUserData}
        onCancel={mockOnCancel}
      />
    );

    const saveButton = screen.getByText('label.save');
    const displayNameInput = screen.getByTestId('displayName-input');

    await act(async () => {
      fireEvent.change(displayNameInput, { target: { value: 'New Name' } });
      fireEvent.click(saveButton);
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });
});
