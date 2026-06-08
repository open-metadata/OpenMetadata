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
import { render, screen } from '@testing-library/react';
import SsoTestLoginModal from './SsoTestLoginModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../common/Loader/Loader', () => {
  return function Loader() {
    return <div data-testid="loader" />;
  };
});

describe('SsoTestLoginModal', () => {
  it('should show the loading state while the test is running', () => {
    render(
      <SsoTestLoginModal
        isTesting
        open
        result={undefined}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('sso-test-login-loading')).toBeInTheDocument();
  });

  it('should show the resolved identity on success', () => {
    render(
      <SsoTestLoginModal
        open
        isTesting={false}
        result={{
          status: 'success',
          resolvedPrincipal: 'alice',
          resolvedEmail: 'alice@example.com',
          mappedRoles: ['DataConsumer'],
          domainCheck: { passed: true },
        }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('sso-test-login-details')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('DataConsumer')).toBeInTheDocument();
  });

  it('should show the failure reason when the configuration would reject the login', () => {
    render(
      <SsoTestLoginModal
        open
        isTesting={false}
        result={{ status: 'failed', errors: ['domain rejected'] }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('domain rejected')).toBeInTheDocument();
  });

  it('should show a popup error message', () => {
    render(
      <SsoTestLoginModal
        open
        error="message.sso-test-login-popup-failed"
        isTesting={false}
        result={undefined}
        onClose={jest.fn()}
      />
    );

    expect(
      screen.getByText('message.sso-test-login-popup-failed')
    ).toBeInTheDocument();
  });
});
