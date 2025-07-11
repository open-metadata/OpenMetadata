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
import { act, fireEvent, render } from '@testing-library/react';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import { showErrorToast } from '../../utils/ToastUtils';
import ForgotPassword from './ForgotPassword.component';

const mockNavigate = jest.fn();
const mockHandleForgotPassword = jest.fn();
const mockHandleError = jest.fn().mockImplementation(() => {
  return Promise.reject({
    response: {
      data: { message: 'Error!' },
    },
  });
});

jest.mock('../../components/Auth/AuthProviders/BasicAuthProvider', () => {
  return {
    useBasicAuth: jest.fn().mockImplementation(() => ({
      handleForgotPassword: mockHandleForgotPassword,
    })),
  };
});

jest.mock('../../components/common/DocumentTitle/DocumentTitle', () => {
  return jest.fn().mockReturnValue(<p>DocumentTitle</p>);
});

jest.mock('../../hooks/useAlertStore', () => ({
  useAlertStore: jest.fn(() => ({
    alert: { message: 'Test Alert', type: 'success' },
    resetAlert: jest.fn(),
  })),
}));

jest.mock('../../components/AlertBar/AlertBar', () => {
  return jest.fn().mockReturnValue(<p data-testid="alert-bar">Alert Bar</p>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

describe('ForgotPassword', () => {
  it('renders correctly', () => {
    const { getByTestId, getByText } = render(<ForgotPassword />);

    expect(getByTestId('forgot-password-container')).toBeInTheDocument();
    expect(
      getByText('message.enter-your-registered-email')
    ).toBeInTheDocument();
  });

  it('calls handleForgotPassword with the correct email', async () => {
    (useBasicAuth as jest.Mock).mockReturnValue({
      handleForgotPassword: mockHandleForgotPassword,
    });

    const { getByLabelText, getByText } = render(<ForgotPassword />);
    const emailInput = getByLabelText('label.email');
    const submitButton = getByText('label.send-login-link');
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockHandleForgotPassword).toHaveBeenCalledWith('test@example.com');
  });

  it('shows an error when email is not provided', async () => {
    jest.useFakeTimers();
    const { getByLabelText, getByText, findByText } = render(
      <ForgotPassword />
    );
    const emailInput = getByLabelText('label.email');
    const submitButton = getByText('label.send-login-link');

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: '' } });
      fireEvent.click(submitButton);
    });
    jest.advanceTimersByTime(20);
    const errorMessage = await findByText('label.field-invalid');

    expect(errorMessage).toBeInTheDocument();
  });

  it('show alert', async () => {
    const { getByLabelText, getByText, getByTestId } = render(
      <ForgotPassword />
    );
    const emailInput = getByLabelText('label.email');
    const submitButton = getByText('label.send-login-link');
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockHandleForgotPassword).toHaveBeenCalledWith('test@example.com');
    expect(getByTestId('alert-bar')).toBeInTheDocument();
  });

  it('show call push back to login', async () => {
    const { getByTestId } = render(<ForgotPassword />);
    const goBackButton = getByTestId('go-back-button');
    await act(async () => {
      fireEvent.click(goBackButton);
    });

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should call show error toast', async () => {
    (useBasicAuth as jest.Mock).mockReturnValueOnce({
      handleForgotPassword: mockHandleError,
    });

    const { getByLabelText, getByText, getByTestId } = render(
      <ForgotPassword />
    );
    const emailInput = getByLabelText('label.email');
    const submitButton = getByText('label.send-login-link');
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(showErrorToast).toHaveBeenCalledWith('server.email-not-found');
    expect(mockHandleError).toHaveBeenCalledWith('test@example.com');
    expect(getByTestId('alert-bar')).toBeInTheDocument();
  });
});
