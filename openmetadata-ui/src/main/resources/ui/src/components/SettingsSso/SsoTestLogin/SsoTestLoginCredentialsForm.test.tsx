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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import SsoTestLoginCredentialsForm from './SsoTestLoginCredentialsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const emailInput = () =>
  within(screen.getByTestId('sso-test-login-email')).getByRole(
    'textbox'
  ) as HTMLInputElement;

const passwordInput = () =>
  screen
    .getByTestId('sso-test-login-password')
    .querySelector('input') as HTMLInputElement;

describe('SsoTestLoginCredentialsForm', () => {
  it('should submit the entered email and password', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <SsoTestLoginCredentialsForm isSubmitting={false} onSubmit={onSubmit} />
    );

    fireEvent.change(emailInput(), { target: { value: 'alice@example.com' } });
    fireEvent.change(passwordInput(), { target: { value: 's3cret' } });
    fireEvent.click(screen.getByTestId('sso-test-login-submit-credentials'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('alice@example.com', 's3cret')
    );
  });

  it('should refuse an address the sign-in page would also refuse', async () => {
    const onSubmit = jest.fn();
    render(
      <SsoTestLoginCredentialsForm isSubmitting={false} onSubmit={onSubmit} />
    );

    fireEvent.change(emailInput(), { target: { value: 'not-an-email' } });
    fireEvent.change(passwordInput(), { target: { value: 's3cret' } });
    fireEvent.click(screen.getByTestId('sso-test-login-submit-credentials'));

    expect(
      await screen.findByText('message.field-text-is-invalid')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should keep the browser from saving the tested credentials as this admin's sign-in", () => {
    render(
      <SsoTestLoginCredentialsForm isSubmitting={false} onSubmit={jest.fn()} />
    );

    expect(emailInput()).toHaveAttribute('autocomplete', 'off');
    expect(passwordInput()).toHaveAttribute('autocomplete', 'new-password');
  });
});
