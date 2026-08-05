/*
 *  Copyright 2023 Collate.
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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChangePasswordForm from './ChangePasswordForm';

const LABEL_CANCEL = 'label.cancel' as const;
const LABEL_UPDATE_ENTITY = 'label.update-entity' as const;
const INPUT_NEW_PASSWORD = 'input-newPassword' as const;

const mockSave = jest.fn();

const mockCancel = jest.fn();

const MOCK_PROPS = {
  visible: true,
  onCancel: mockCancel,
  isLoggedInUser: true,
  isLoading: false,
  onSave: mockSave,
};

describe('ChangePasswordForm', () => {
  it('should render correctly', async () => {
    render(<ChangePasswordForm {...MOCK_PROPS} />);
    const modal = await screen.findByTestId('modal-container');

    expect(modal).toBeInTheDocument();
  });

  it('should handle form submission correctly for logged in user', async () => {
    render(<ChangePasswordForm {...MOCK_PROPS} />);
    const cancelButton = await screen.findByText(LABEL_CANCEL);
    const submitButton = await screen.findByText(LABEL_UPDATE_ENTITY);
    const oldPasswordInput = await screen.findByTestId('input-oldPassword');
    const newPasswordInput = await screen.findByTestId(INPUT_NEW_PASSWORD);
    const confirmPasswordInput = await screen.findByTestId(
      'input-confirm-newPassword'
    );

    expect(cancelButton).toBeInTheDocument();

    fireEvent.change(oldPasswordInput, { target: { value: 'oldPassword' } });
    fireEvent.change(newPasswordInput, { target: { value: 'Test@123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Test@123' } });

    await waitFor(async () => {
      await userEvent.click(submitButton);

      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });

  it('handles form submission correctly for admin', async () => {
    render(
      <ChangePasswordForm
        visible
        isLoading={false}
        isLoggedInUser={false}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );

    const cancelButton = await screen.findByText(LABEL_CANCEL);
    const submitButton = await screen.findByText(LABEL_UPDATE_ENTITY);
    const newPasswordInput = await screen.findByTestId(INPUT_NEW_PASSWORD);
    const confirmPasswordInput = await screen.findByTestId(
      'input-confirm-newPassword'
    );

    expect(cancelButton).toBeInTheDocument();

    fireEvent.change(newPasswordInput, { target: { value: 'Test@123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Test@123' } });

    await waitFor(async () => {
      await userEvent.click(submitButton);

      expect(mockSave).toHaveBeenCalledWith({
        newPassword: 'Test@123',
        confirmPassword: 'Test@123',
      });
    });
  });

  it('should invoke onCancel when Cancel button is clicked', async () => {
    render(
      <ChangePasswordForm
        visible
        isLoading={false}
        isLoggedInUser={false}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );

    const cancelButton = await screen.findByText(LABEL_CANCEL);
    const submitButton = await screen.findByText(LABEL_UPDATE_ENTITY);

    expect(cancelButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('displays loading state during submission', async () => {
    render(<ChangePasswordForm {...MOCK_PROPS} isLoading />);
    const submitButton = await screen.findByText(LABEL_UPDATE_ENTITY);

    const newPasswordInput = await screen.findByTestId('input-oldPassword');
    const confirmPasswordInput = await screen.findByTestId(INPUT_NEW_PASSWORD);

    fireEvent.change(newPasswordInput, { target: { value: 'oldPassword' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Test@123' } });

    await waitFor(async () => {
      await userEvent.click(submitButton);
    });

    expect(
      await screen.findByRole('img', { name: 'loading' })
    ).toBeInTheDocument();
  });
});
