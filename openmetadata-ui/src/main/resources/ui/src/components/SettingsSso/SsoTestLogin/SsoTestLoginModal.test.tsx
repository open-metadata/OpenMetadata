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
import {
  Stage,
  StageStatus,
  Status,
  TestLoginResult,
} from '../../../generated/system/testLoginResult';
import { SsoTestLoginModalProps } from './SsoTestLogin.interface';
import SsoTestLoginModal from './SsoTestLoginModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../common/Loader/Loader', () => {
  return function Loader() {
    return <div data-testid="loader" />;
  };
});

const renderModal = (props: Partial<SsoTestLoginModalProps>) =>
  render(
    <SsoTestLoginModal
      open
      isAwaitingCredentials={false}
      isTesting={false}
      onClose={jest.fn()}
      onSubmitCredentials={jest.fn()}
      {...props}
    />
  );

const oidcTimeline = (domainStatus: StageStatus): TestLoginResult['stages'] => [
  { stage: Stage.Started, status: StageStatus.Passed },
  { stage: Stage.Redirected, status: StageStatus.Passed },
  { stage: Stage.CredentialsVerified, status: StageStatus.Skipped },
  { stage: Stage.IdentityResolved, status: StageStatus.Passed },
  {
    stage: Stage.DomainChecked,
    status: domainStatus,
    message:
      domainStatus === StageStatus.Failed ? 'domain rejected' : undefined,
  },
];

describe('SsoTestLoginModal', () => {
  it('should show the loading state while the test is running', () => {
    renderModal({ isTesting: true });

    expect(screen.getByTestId('sso-test-login-loading')).toBeInTheDocument();
  });

  it('should show the resolved identity on success', () => {
    renderModal({
      result: {
        status: Status.Success,
        resolvedPrincipal: 'alice',
        resolvedEmail: 'alice@example.com',
        mappedRoles: ['DataConsumer'],
        domainCheck: { passed: true },
        stages: oidcTimeline(StageStatus.Passed),
      },
    });

    expect(screen.getByTestId('sso-test-login-details')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('DataConsumer')).toBeInTheDocument();
  });

  it('should show the failure reason when the configuration would reject the login', () => {
    renderModal({
      result: {
        status: Status.Failed,
        errors: ['domain rejected'],
        stages: oidcTimeline(StageStatus.Failed),
      },
    });

    expect(screen.getAllByText('domain rejected').length).toBeGreaterThan(0);
  });

  it('should show a popup error message', () => {
    renderModal({ error: 'message.sso-test-login-popup-failed' });

    expect(
      screen.getByText('message.sso-test-login-popup-failed')
    ).toBeInTheDocument();
  });

  it('should list the stages that apply and hide the ones that do not', () => {
    renderModal({
      result: {
        status: Status.Failed,
        stages: oidcTimeline(StageStatus.Failed),
      },
    });

    expect(
      screen.getByTestId(`sso-test-login-stage-${Stage.DomainChecked}`)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`sso-test-login-stage-${Stage.CredentialsVerified}`)
    ).not.toBeInTheDocument();
  });

  it('should call out the rejected domain even when domain enforcement is off', () => {
    // allowedEmailDomains rejects an identity without enforcePrincipalDomain being on.
    renderModal({
      result: {
        status: Status.Failed,
        resolvedEmail: 'contractor@partner.io',
        domainCheck: {
          enforced: false,
          passed: false,
          resolvedDomain: 'partner.io',
        },
        stages: oidcTimeline(StageStatus.Failed),
      },
    });

    expect(
      screen.getByText('partner.io (label.failed)', { exact: false })
    ).toBeInTheDocument();
  });

  it('should ask for credentials instead of waiting on a popup', () => {
    renderModal({ isAwaitingCredentials: true, isTesting: false });

    expect(
      screen.getByTestId('sso-test-login-credentials-form')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('sso-test-login-loading')
    ).not.toBeInTheDocument();
  });

  it("should list the configuration check's problems when it stops the test", () => {
    renderModal({
      configurationCheck: {
        status: StageStatus.Failed,
        problems: [
          'Client ID is required',
          'The discovery document is unreachable',
        ],
      },
      error: 'message.sso-test-login-configuration-invalid',
    });

    const check = screen.getByTestId('sso-test-login-stage-configuration');

    expect(check).toHaveTextContent(
      'label.sso-test-stage-configuration-checked'
    );
    expect(check).toHaveTextContent('Client ID is required');
    expect(check).toHaveTextContent('The discovery document is unreachable');
    expect(
      screen.getByText('message.sso-test-login-configuration-invalid')
    ).toBeInTheDocument();
  });

  it('should say it is checking the configuration while the check runs', () => {
    renderModal({
      isTesting: true,
      configurationCheck: { status: StageStatus.Running, problems: [] },
    });

    expect(
      screen.getByText('message.sso-test-login-checking-configuration')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.sso-test-login-waiting')
    ).not.toBeInTheDocument();
  });
});
