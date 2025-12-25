/*
 *  Copyright 2024 Collate.
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
import ResetPassword from './ResetPassword.component';

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest
    .fn()
    .mockImplementation(() => ({ search: '?user=admin&token=token' }));
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

const mockHandleResetPassword = jest.fn();
jest.mock('../../components/Auth/AuthProviders/BasicAuthProvider', () => {
  return {
    useBasicAuth: jest.fn().mockImplementation(() => ({
      handleResetPassword: mockHandleResetPassword,
    })),
  };
});

jest.mock('../../components/common/DocumentTitle/DocumentTitle', () => {
  return jest.fn().mockReturnValue(<p>DocumentTitle</p>);
});

jest.mock('../../hooks/useAlertStore', () => ({
  useAlertStore: jest.fn().mockReturnValue({
    alert: null,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const translations: Record<string, string> = {
        'label.reset-your-password': 'Reset Your Password',
        'label.password-not-match': 'Passwords do not match',
        'label.password': 'Password',
        'label.confirm-new-password': 'Confirm New Password',
        'label.new-password': 'New Password',
        'label.enter-entity': 'Enter {{entity}}',
        'label.save': 'Save',
        'message.field-text-is-required': '{{fieldText}} is required.',
      };

      if (options && translations[key]) {
        return translations[key].replace(
          '{{fieldText}}',
          options.fieldText || ''
        );
      }

      return translations[key] || key;
    },
  }),
}));

describe('ResetPassword', () => {
  it('should render correctly', async () => {
    render(<ResetPassword />);

    expect(
      await screen.findByTestId('reset-password-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('brand-image')).toBeInTheDocument();
    expect(await screen.findByTestId('password')).toBeInTheDocument();
    expect(await screen.findByTestId('confirm-password')).toBeInTheDocument();
    expect(await screen.findByTestId('submit-button')).toBeInTheDocument();
    expect(await screen.findByText('Reset Your Password')).toBeInTheDocument();
  });

  it('form submit should work', async () => {
    jest.useFakeTimers();
    render(<ResetPassword />);

    const submitButton = await screen.findByTestId('submit-button');
    const password = await screen.findByTestId('password');
    const confirmPwd = await screen.findByTestId('confirm-password');

    await act(async () => {
      fireEvent.change(password, { target: { value: 'Password@123' } });
      fireEvent.change(confirmPwd, { target: { value: 'Password@123' } });
      fireEvent.click(submitButton);
    });

    expect(mockHandleResetPassword).toHaveBeenCalledWith({
      confirmPassword: 'Password@123',
      password: 'Password@123',
      token: 'token',
      username: 'admin',
    });
  });

  it('confirm password alert should be visible', async () => {
    render(<ResetPassword />);

    const submitButton = await screen.findByTestId('submit-button');
    const password = await screen.findByTestId('password');
    const confirmPwd = await screen.findByTestId('confirm-password');

    await act(async () => {
      fireEvent.change(password, { target: { value: 'Password@123' } });
      fireEvent.change(confirmPwd, { target: { value: 'Password@1234' } });
      fireEvent.click(submitButton);
    });

    expect(
      await screen.findByText('Passwords do not match')
    ).toBeInTheDocument();
  });

  it('required field validation should work', async () => {
    render(<ResetPassword />);

    const submitButton = await screen.findByTestId('submit-button');

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
      expect(
        screen.getByText('Confirm New Password is required.')
      ).toBeInTheDocument();
    });
  });
});
