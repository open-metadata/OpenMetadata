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
import { act, fireEvent, render, screen } from '@testing-library/react';
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
    expect(
      await screen.findByText('label.reset-your-password')
    ).toBeInTheDocument();
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
    jest.useFakeTimers();
    render(<ResetPassword />);

    const submitButton = await screen.findByTestId('submit-button');
    const password = await screen.findByTestId('password');
    const confirmPwd = await screen.findByTestId('confirm-password');

    await act(async () => {
      fireEvent.change(password, { target: { value: 'Password@123' } });
      fireEvent.change(confirmPwd, { target: { value: 'Password@1234' } });
      fireEvent.click(submitButton);
    });
    jest.advanceTimersByTime(20);

    expect(
      await screen.findByText('label.password-not-match')
    ).toBeInTheDocument();
  });

  it('required field validation should work', async () => {
    jest.useFakeTimers();
    render(<ResetPassword />);

    const submitButton = await screen.findByTestId('submit-button');

    await act(async () => {
      fireEvent.click(submitButton);
    });
    jest.advanceTimersByTime(20);

    expect(
      await screen.findAllByText('message.field-text-is-required')
    ).toHaveLength(2);
  });
});
