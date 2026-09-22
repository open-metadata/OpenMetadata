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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RequestType } from '../../../../../generated/auth/changePasswordRequest';
import ChangePasswordRow from './ChangePasswordRow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockChangePassword = jest.fn();

jest.mock('../../../../../rest/auth-API', () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

const mockShowErrorToast = jest.fn();
const mockShowSuccessToast = jest.fn();

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => mockShowSuccessToast(...args),
}));

const VALID_PASSWORD = 'Test@1234';

const openForm = () =>
  fireEvent.click(screen.getByTestId('change-password-button'));

const typeInto = (testId: string, value: string) =>
  fireEvent.change(
    screen.getByTestId(testId).querySelector('input') as HTMLInputElement,
    { target: { value } }
  );

const fillValidForm = () => {
  typeInto('current-password-input', 'Old@1234');
  typeInto('new-password-input', VALID_PASSWORD);
  typeInto('confirm-password-input', VALID_PASSWORD);
};

describe('ChangePasswordRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChangePassword.mockResolvedValue({});
  });

  it('should render the collapsed row with only the change-password action', () => {
    render(<ChangePasswordRow username="john" />);

    expect(screen.getByTestId('change-password-button')).toBeInTheDocument();
    expect(screen.queryByTestId('new-password-input')).not.toBeInTheDocument();
  });

  it('should reveal the form fields when the action is clicked', () => {
    render(<ChangePasswordRow username="john" />);
    openForm();

    expect(screen.getByTestId('current-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
    expect(
      screen.queryByTestId('change-password-button')
    ).not.toBeInTheDocument();
  });

  it('should keep the submit button disabled until every requirement is met', () => {
    render(<ChangePasswordRow username="john" />);
    openForm();

    expect(screen.getByTestId('update-password-button')).toBeDisabled();

    typeInto('current-password-input', 'Old@1234');
    typeInto('new-password-input', 'weakpass');
    typeInto('confirm-password-input', 'weakpass');

    expect(screen.getByTestId('update-password-button')).toBeDisabled();

    fillValidForm();

    expect(screen.getByTestId('update-password-button')).toBeEnabled();
  });

  it('should show the strength meter only once a new password is typed', () => {
    render(<ChangePasswordRow username="john" />);
    openForm();

    expect(
      screen.queryByTestId('password-strength-meter')
    ).not.toBeInTheDocument();

    typeInto('new-password-input', VALID_PASSWORD);

    expect(screen.getByTestId('password-strength-meter')).toBeInTheDocument();
    expect(screen.getByTestId('password-strength-label')).toHaveTextContent(
      'label.strong'
    );
  });

  it('should warn when the confirmation does not match', () => {
    render(<ChangePasswordRow username="john" />);
    openForm();
    typeInto('new-password-input', VALID_PASSWORD);
    typeInto('confirm-password-input', 'Test@12345');

    expect(screen.getByText('label.password-not-match')).toBeInTheDocument();
    expect(screen.getByTestId('update-password-button')).toBeDisabled();
  });

  it('should submit a SELF change-password request and collapse on success', async () => {
    render(<ChangePasswordRow username="john" />);
    openForm();
    fillValidForm();
    fireEvent.click(screen.getByTestId('update-password-button'));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith({
        oldPassword: 'Old@1234',
        newPassword: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
        username: 'john',
        requestType: RequestType.Self,
      })
    );

    expect(mockShowSuccessToast).toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByTestId('change-password-button')).toBeInTheDocument()
    );
  });

  it('should surface an error toast and keep the form open on failure', async () => {
    mockChangePassword.mockRejectedValue(new Error('failed'));

    render(<ChangePasswordRow username="john" />);
    openForm();
    fillValidForm();
    fireEvent.click(screen.getByTestId('update-password-button'));

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
    expect(mockShowSuccessToast).not.toHaveBeenCalled();
  });

  it('should discard the typed values when cancelled', () => {
    render(<ChangePasswordRow username="john" />);
    openForm();
    fillValidForm();
    fireEvent.click(screen.getByTestId('cancel-change-password-button'));
    openForm();

    expect(
      screen.getByTestId('new-password-input').querySelector('input')
    ).toHaveValue('');
  });
});
