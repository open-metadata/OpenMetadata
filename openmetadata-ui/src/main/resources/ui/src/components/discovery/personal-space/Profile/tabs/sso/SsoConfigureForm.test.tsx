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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../../../../generated/settings/settings';
import { fetchMarkdownFile } from '../../../../../../rest/miscAPI';
import {
  applySecurityConfiguration,
  patchSecurityConfiguration,
  SecurityConfiguration,
  validateSecurityConfiguration,
} from '../../../../../../rest/securityConfigAPI';
import SsoConfigureForm from './SsoConfigureForm';

jest.mock('../../../../../../rest/securityConfigAPI', () => ({
  ...jest.requireActual('../../../../../../rest/securityConfigAPI'),
  getSecurityConfiguration: jest.fn(),
  applySecurityConfiguration: jest.fn().mockResolvedValue({ data: {} }),
  patchSecurityConfiguration: jest.fn().mockResolvedValue({ data: {} }),
  validateSecurityConfiguration: jest.fn(),
}));

jest.mock('../../../../../../rest/miscAPI', () => ({
  ...jest.requireActual('../../../../../../rest/miscAPI'),
  fetchMarkdownFile: jest.fn(),
}));

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  searchRoles: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
  showWarningToast: jest.fn(),
}));

// The markdown previewer pulls in the full editor; the hint body is plain text here.
jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    ({ markdown }: { markdown: string }) =>
      <div>{markdown}</div>
);

const OKTA_CONFIG = {
  authenticationConfiguration: {
    provider: AuthProvider.Okta,
    providerName: 'Okta',
    clientType: 'public',
    authority: 'https://test.okta.com/oauth2/default',
    clientId: 'okta-client-id',
    callbackUrl: 'http://localhost:8585/callback',
    publicKeyUrls: ['https://test.okta.com/oauth2/default/v1/keys'],
    jwtPrincipalClaims: ['email'],
    enableSelfSignup: true,
  },
  authorizerConfiguration: {
    className: 'org.openmetadata.service.security.DefaultAuthorizer',
    containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
    adminPrincipals: ['admin'],
    principalDomain: 'open-metadata.org',
    enforcePrincipalDomain: false,
    enableSecureSocketConnection: false,
  },
} as unknown as SecurityConfiguration;

const field = (path: string) =>
  document.querySelector(`[id="root/${path}"]`) as HTMLInputElement;

const renderForm = (
  props: Partial<React.ComponentProps<typeof SsoConfigureForm>> = {}
) => {
  const onChangeProvider = jest.fn();
  render(
    <MemoryRouter>
      <SsoConfigureForm
        showHint={false}
        onChangeProvider={onChangeProvider}
        {...props}
      />
    </MemoryRouter>
  );

  return { onChangeProvider };
};

describe('SsoConfigureForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchMarkdownFile as jest.Mock).mockResolvedValue(
      '$$section\n### Provider Name $(id="providerName")\nA display name for this SSO setup.\n$$'
    );
  });

  it('edits a saved configuration without the new-setup warning', async () => {
    renderForm({ securityConfig: OKTA_CONFIG });

    await waitFor(() =>
      expect(field('authenticationConfiguration/clientId')).toHaveValue(
        'okta-client-id'
      )
    );

    expect(
      screen.queryByTestId('sso-new-config-warning')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('sso-test-login-required')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('save-sso-configuration')).toBeEnabled();
  });

  it('gates a sign-in change on Test Login and saves only the diff with Save anyway', async () => {
    renderForm({ securityConfig: OKTA_CONFIG });
    await waitFor(() =>
      expect(field('authenticationConfiguration/clientId')).toBeInTheDocument()
    );

    fireEvent.change(field('authenticationConfiguration/clientId'), {
      target: { value: 'new-client-id' },
    });

    expect(
      await screen.findByTestId('sso-test-login-required')
    ).toBeInTheDocument();
    expect(screen.getByTestId('save-sso-configuration')).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-anyway-sso-configuration'));
    });

    expect(patchSecurityConfiguration).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          op: 'replace',
          path: '/authenticationConfiguration/clientId',
          value: 'new-client-id',
        },
      ])
    );
    expect(applySecurityConfiguration).not.toHaveBeenCalled();
  });

  it('discards edits from the unsaved-changes dialog', async () => {
    renderForm({ securityConfig: OKTA_CONFIG });
    await waitFor(() =>
      expect(field('authenticationConfiguration/clientId')).toBeInTheDocument()
    );
    fireEvent.change(field('authenticationConfiguration/clientId'), {
      target: { value: 'typo' },
    });

    fireEvent.click(screen.getByTestId('cancel-sso-configuration'));
    fireEvent.click(await screen.findByTestId('sso-unsaved-changes-discard'));

    await waitFor(() =>
      expect(field('authenticationConfiguration/clientId')).toHaveValue(
        'okta-client-id'
      )
    );
  });

  it('starts a new provider with the sign-out warning and returns to the grid on discard', async () => {
    const { onChangeProvider } = renderForm({
      selectedProvider: AuthProvider.Google,
    });

    expect(
      await screen.findByTestId('sso-new-config-warning')
    ).toBeInTheDocument();
    expect(screen.getByTestId('sso-test-login-required')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-sso-configuration'));
    fireEvent.click(await screen.findByTestId('sso-unsaved-changes-discard'));

    expect(onChangeProvider).toHaveBeenCalled();
  });

  it('validates a new provider before writing it', async () => {
    (validateSecurityConfiguration as jest.Mock).mockResolvedValue({
      data: {
        status: 'failed',
        errors: [
          {
            field: 'authenticationConfiguration.providerName',
            error: 'Provider name is taken',
          },
        ],
      },
    });
    renderForm({ selectedProvider: AuthProvider.Google });

    await act(async () => {
      fireEvent.click(
        await screen.findByTestId('save-anyway-sso-configuration')
      );
    });

    expect(validateSecurityConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationConfiguration: expect.objectContaining({
          provider: AuthProvider.Google,
        }),
      })
    );
    expect(applySecurityConfiguration).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Provider name is taken')
    ).toBeInTheDocument();
  });

  it('shows the SAML metadata drop zone only for SAML', async () => {
    renderForm({ selectedProvider: AuthProvider.Saml });

    expect(
      await screen.findByTestId('sso-saml-metadata-upload')
    ).toBeInTheDocument();
  });

  it('loads the provider docs from the SSO folder and shows them for the focused field', async () => {
    // Docs are cached per file for the page's lifetime, so use a provider no other test loads.
    renderForm({ selectedProvider: AuthProvider.Azure, showHint: true });

    await waitFor(() =>
      expect(fetchMarkdownFile).toHaveBeenCalledWith(
        'en-US/SSO/azureSSOClientConfig.md'
      )
    );
    const providerName = field('authenticationConfiguration/providerName');
    await waitFor(() =>
      expect(providerName.closest('[data-field-doc]')).not.toBeNull()
    );

    fireEvent.focus(providerName);

    expect(await screen.findByRole('note')).toHaveTextContent(
      'A display name for this SSO setup.'
    );
  });

  it('shows no hint while Show hint is off', async () => {
    renderForm({ securityConfig: OKTA_CONFIG });
    await waitFor(() =>
      expect(field('authenticationConfiguration/clientId')).toBeInTheDocument()
    );

    fireEvent.focus(field('authenticationConfiguration/providerName'));

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
