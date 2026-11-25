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
import { act, renderHook, waitFor } from '@testing-library/react';
import { get } from 'lodash';
import { SamlSSOClientConfig } from '../../generated/security/client/samlSSOClientConfig';
import { AuthProvider } from '../../generated/settings/settings';
import {
  applySecurityConfiguration,
  getSecurityConfiguration,
  patchSecurityConfiguration,
  SecurityConfiguration,
  validateSecurityConfiguration,
} from '../../rest/securityConfigAPI';
import i18next from '../../utils/i18next/LocalUtil';
import { showSuccessToast } from '../../utils/ToastUtils';
import { FormData } from './SSOConfigurationForm/SSOConfigurationForm.interface';
import { useSsoConfiguration } from './useSsoConfiguration';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../rest/securityConfigAPI', () => ({
  getSecurityConfiguration: jest.fn(),
  applySecurityConfiguration: jest.fn().mockResolvedValue({ data: {} }),
  patchSecurityConfiguration: jest.fn().mockResolvedValue({ data: {} }),
  validateSecurityConfiguration: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
  showWarningToast: jest.fn(),
}));

jest.mock('../../utils/SwTokenStorageUtils', () => ({
  setOidcToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    setIsAuthenticated: jest.fn(),
    setCurrentUser: jest.fn(),
  }),
}));

const OKTA_CONFIG = {
  authenticationConfiguration: {
    provider: AuthProvider.Okta,
    providerName: 'Okta',
    clientType: 'public',
    authority: 'https://test.okta.com',
    clientId: 'okta-client-id',
    callbackUrl: 'http://localhost:8585/callback',
    publicKeyUrls: ['https://test.okta.com/keys'],
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

const SAML_ACS = 'https://om.example.com/api/v1/saml/acs';

const samlConfig = (callback: string) =>
  ({
    authenticationConfiguration: {
      provider: AuthProvider.Saml,
      providerName: 'SAML',
      clientType: 'public',
      authority: 'https://om.example.com/api/v1/saml/login',
      callbackUrl: callback,
      publicKeyUrls: ['https://om.example.com/api/v1/system/config/jwks'],
      jwtPrincipalClaims: ['email'],
      enableSelfSignup: true,
      samlConfiguration: {
        debugMode: false,
        idp: {
          entityId: 'https://idp.example.com/metadata',
          ssoLoginUrl: 'https://idp.example.com/sso',
          idpX509Certificate: 'IDP_CERT',
          authorityUrl: 'https://om.example.com/api/v1/saml/login',
        },
        sp: {
          entityId: 'https://om.example.com/api/v1/saml/metadata',
          acs: SAML_ACS,
          callback,
        },
        security: {
          strictMode: false,
          wantAssertionsSigned: false,
          wantMessagesSigned: false,
          sendSignedAuthRequest: false,
        },
      },
    },
    authorizerConfiguration: OKTA_CONFIG.authorizerConfiguration,
  } as unknown as SecurityConfiguration);

// Saved by an earlier form version that wrote the ACS URL into both browser callback fields.
const SAML_CONFIG_WITH_ACS_CALLBACK = samlConfig(SAML_ACS);

const OKTA_CONFIDENTIAL_CONFIG = {
  authenticationConfiguration: {
    provider: AuthProvider.Okta,
    providerName: 'Okta',
    clientType: 'confidential',
    authority: 'https://test.okta.com',
    clientId: 'okta-client-id',
    callbackUrl: 'http://localhost:8585/callback',
    publicKeyUrls: ['https://test.okta.com/keys'],
    jwtPrincipalClaims: ['email'],
    enableSelfSignup: true,
    oidcConfiguration: {
      type: 'okta',
      id: 'okta-client-id',
      secret: 'okta-secret',
      discoveryUri: 'https://test.okta.com/.well-known/openid-configuration',
      callbackUrl: 'http://localhost:8585/callback',
      serverUrl: 'http://localhost:8585',
    },
  },
  authorizerConfiguration: OKTA_CONFIG.authorizerConfiguration,
} as unknown as SecurityConfiguration;

const CUSTOM_AUTHORIZER_CONFIG = {
  ...OKTA_CONFIG,
  authorizerConfiguration: {
    ...OKTA_CONFIG.authorizerConfiguration,
    className: 'com.example.CustomAuthorizer',
    containerRequestFilter: 'com.example.CustomJwtFilter',
  },
} as SecurityConfiguration;

const editClientId = (
  result: { current: ReturnType<typeof useSsoConfiguration> },
  clientId: string
) =>
  act(() => {
    const data = result.current.internalData;
    result.current.handleOnChange({
      formData: {
        ...data,
        authenticationConfiguration: {
          ...data?.authenticationConfiguration,
          clientId,
        },
      },
    } as Parameters<typeof result.current.handleOnChange>[0]);
  });

describe('useSsoConfiguration', () => {
  const replace = jest.fn();

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      value: { replace },
      writable: true,
    });
  });

  beforeEach(() => jest.clearAllMocks());

  it('loads the saved configuration when none is passed in', async () => {
    (getSecurityConfiguration as jest.Mock).mockResolvedValue({
      data: OKTA_CONFIG,
    });
    const { result } = renderHook(() => useSsoConfiguration({}));

    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    expect(result.current.hasExistingConfig).toBe(true);
    expect(result.current.currentProvider).toBe(AuthProvider.Okta);
    expect(
      result.current.internalData?.authenticationConfiguration.clientId
    ).toBe('okta-client-id');
  });

  it('asks for a provider when only basic auth is configured', async () => {
    (getSecurityConfiguration as jest.Mock).mockResolvedValue({
      data: {
        ...OKTA_CONFIG,
        authenticationConfiguration: { provider: AuthProvider.Basic },
      },
    });
    const { result } = renderHook(() => useSsoConfiguration({}));

    await waitFor(() => expect(result.current.showProviderSelector).toBe(true));

    expect(result.current.hasExistingConfig).toBe(false);
  });

  it('gates an edit to sign-in settings on Test Login, and saves only the diff', async () => {
    const { result } = renderHook(() =>
      useSsoConfiguration({ securityConfig: OKTA_CONFIG, forceEditMode: true })
    );
    await waitFor(() => expect(result.current.hasExistingConfig).toBe(true));

    expect(result.current.isSaveGatedOnTestLogin).toBe(false);

    editClientId(result, 'new-client-id');

    expect(result.current.isSaveGatedOnTestLogin).toBe(true);

    await act(() => result.current.handleSave());

    expect(patchSecurityConfiguration).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          op: 'replace',
          path: '/authenticationConfiguration/clientId',
          value: 'new-client-id',
        },
      ])
    );
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.configuration-save-success'
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['an OIDC public client', OKTA_CONFIG],
    ['an OIDC confidential client', OKTA_CONFIDENTIAL_CONFIG],
    ['a SAML configuration', samlConfig('https://om.example.com/callback')],
    ['a custom authorizer', CUSTOM_AUTHORIZER_CONFIG],
  ])(
    'saves %s left untouched without a PATCH',
    async (_name, securityConfig) => {
      const { result } = renderHook(() =>
        useSsoConfiguration({ securityConfig, forceEditMode: true })
      );
      await waitFor(() => expect(result.current.hasExistingConfig).toBe(true));

      await act(() => result.current.handleSave());

      expect(patchSecurityConfiguration).not.toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.configuration-save-success'
      );
    }
  );

  it('saves the repaired browser callback of a SAML configuration saved with the ACS URL', async () => {
    const { result } = renderHook(() =>
      useSsoConfiguration({
        securityConfig: SAML_CONFIG_WITH_ACS_CALLBACK,
        forceEditMode: true,
      })
    );
    await waitFor(() => expect(result.current.hasExistingConfig).toBe(true));

    await act(() => result.current.handleSave());

    // The two callback fields, and nothing else.
    expect(patchSecurityConfiguration).toHaveBeenCalledWith([
      {
        op: 'replace',
        path: '/authenticationConfiguration/samlConfiguration/sp/callback',
        value: 'https://om.example.com/callback',
      },
      {
        op: 'replace',
        path: '/authenticationConfiguration/callbackUrl',
        value: 'https://om.example.com/callback',
      },
    ]);
  });

  it('discards edits back to the saved configuration', async () => {
    const { result } = renderHook(() =>
      useSsoConfiguration({ securityConfig: OKTA_CONFIG, forceEditMode: true })
    );
    await waitFor(() => expect(result.current.hasExistingConfig).toBe(true));
    editClientId(result, 'typo');

    act(() => result.current.handleCancelConfirm());

    expect(
      result.current.internalData?.authenticationConfiguration.clientId
    ).toBe('okta-client-id');
  });

  it('starts a fresh form for a selected provider, always gated', async () => {
    const { result } = renderHook(() =>
      useSsoConfiguration({ selectedProvider: AuthProvider.Google })
    );

    await waitFor(() =>
      expect(result.current.currentProvider).toBe(AuthProvider.Google)
    );

    expect(result.current.hasExistingConfig).toBe(false);
    expect(result.current.isSaveGatedOnTestLogin).toBe(true);
    expect(getSecurityConfiguration).not.toHaveBeenCalled();
  });

  it('validates a new configuration, applies it and signs the admin out', async () => {
    (validateSecurityConfiguration as jest.Mock).mockResolvedValue({
      data: { status: 'success', errors: [] },
    });
    const { result } = renderHook(() =>
      useSsoConfiguration({ selectedProvider: AuthProvider.Google })
    );
    await waitFor(() => expect(result.current.internalData).toBeDefined());

    await act(() => result.current.handleSave());

    expect(applySecurityConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationConfiguration: expect.objectContaining({
          provider: AuthProvider.Google,
        }),
      })
    );
    expect(replace).toHaveBeenCalledWith('/signin');
  });

  it('keeps a new configuration that fails validation and marks the field', async () => {
    (validateSecurityConfiguration as jest.Mock).mockResolvedValue({
      data: {
        status: 'failed',
        errors: [
          {
            field: 'authenticationConfiguration.clientId',
            error: 'Client ID is required',
          },
        ],
      },
    });
    const { result } = renderHook(() =>
      useSsoConfiguration({ selectedProvider: AuthProvider.Google })
    );
    await waitFor(() => expect(result.current.internalData).toBeDefined());

    await act(() => result.current.handleSave());

    expect(applySecurityConfiguration).not.toHaveBeenCalled();
    expect(result.current.fieldErrorsRef.current).toEqual({
      authenticationConfiguration: {
        clientId: { __errors: ['Client ID is required'] },
      },
    });
  });

  it('returns to provider selection when a new setup is discarded', async () => {
    const onChangeProvider = jest.fn();
    const { result } = renderHook(() =>
      useSsoConfiguration({
        selectedProvider: AuthProvider.Google,
        onChangeProvider,
      })
    );
    await waitFor(() => expect(result.current.internalData).toBeDefined());

    act(() => result.current.handleCancelConfirm());

    expect(onChangeProvider).toHaveBeenCalled();
    expect(result.current.internalData).toBeUndefined();
  });

  it('offers the SAML signing switches only while Strict Mode is on', async () => {
    const { result } = renderHook(() =>
      useSsoConfiguration({ selectedProvider: AuthProvider.Saml })
    );
    await waitFor(() => expect(result.current.internalData).toBeDefined());
    const securityUiSchema = () =>
      get(
        result.current.uiSchema,
        'authenticationConfiguration.samlConfiguration.security'
      );

    expect(securityUiSchema().wantAssertionEncrypted).toEqual({
      'ui:title': 'label.require-encrypted-assertions',
    });
    expect(securityUiSchema().wantMessagesSigned).toEqual({
      'ui:widget': 'hidden',
      'ui:hideError': true,
    });
    expect(securityUiSchema().wantAssertionsSigned).toEqual({
      'ui:widget': 'hidden',
      'ui:hideError': true,
    });

    act(() => {
      const data = result.current.internalData as FormData;
      const samlConfiguration = data.authenticationConfiguration
        .samlConfiguration as SamlSSOClientConfig | undefined;
      const withStrictMode: FormData = {
        ...data,
        authenticationConfiguration: {
          ...data.authenticationConfiguration,
          samlConfiguration: {
            ...samlConfiguration,
            security: { ...samlConfiguration?.security, strictMode: true },
          },
        },
      };
      result.current.handleOnChange({
        formData: withStrictMode,
      } as Parameters<typeof result.current.handleOnChange>[0]);
    });

    expect(securityUiSchema().wantAssertionEncrypted).toEqual({
      'ui:title': 'label.require-encrypted-assertions',
    });
    expect(securityUiSchema().wantMessagesSigned).toEqual({
      'ui:title': 'label.want-messages-signed',
    });
    expect(securityUiSchema().wantAssertionsSigned).toEqual({
      'ui:title': 'label.want-assertions-signed',
    });
  });

  it('titles every SAML field in the language active when the form is built', async () => {
    const translate = i18next.t as unknown as jest.Mock;
    const defaultTranslate = translate.getMockImplementation();
    translate.mockImplementation(
      (key: string, options?: Record<string, string>) =>
        options ? `${key} ${JSON.stringify(options)}` : key
    );

    try {
      const { result } = renderHook(() =>
        useSsoConfiguration({ selectedProvider: AuthProvider.Saml })
      );
      await waitFor(() => expect(result.current.internalData).toBeDefined());
      const authUiSchema = get(
        result.current.uiSchema,
        'authenticationConfiguration'
      );
      const samlUiSchema = authUiSchema.samlConfiguration;

      expect(authUiSchema.enableSelfSignup['ui:title']).toBe(
        'label.enable-self-signup'
      );
      expect(samlUiSchema['ui:title']).toBe(
        'label.entity-configuration {"entity":"SAML"}'
      );
      expect(samlUiSchema.debugMode['ui:title']).toBe('label.debug-mode');
      expect(samlUiSchema.idp['ui:title']).toBe('label.identity-provider-idp');
      expect(samlUiSchema.idp.entityId['ui:title']).toBe(
        'label.provider-entity-id {"provider":"IdP"}'
      );
      expect(samlUiSchema.idp.ssoLoginUrl['ui:title']).toBe(
        'label.idp-sso-login-url'
      );
      expect(samlUiSchema.idp.idpX509Certificate['ui:title']).toBe(
        'label.provider-x509-certificate {"provider":"IdP"}'
      );
      expect(samlUiSchema.idp.nameId['ui:title']).toBe('label.name-id-format');
      expect(samlUiSchema.sp['ui:title']).toBe('label.service-provider-sp');
      expect(samlUiSchema.sp.entityId).toEqual({
        'ui:title': 'label.provider-entity-id {"provider":"SP"}',
        'ui:help': 'message.saml-sp-entity-id-help',
      });
      expect(samlUiSchema.sp.acs).toEqual({
        'ui:title': 'label.assertion-consumer-service-url',
        'ui:help': 'message.saml-acs-url-help',
      });
      expect(samlUiSchema.sp.spX509Certificate['ui:title']).toBe(
        'label.provider-x509-certificate {"provider":"SP"}'
      );
      expect(samlUiSchema.sp.spPrivateKey['ui:title']).toBe(
        'label.sp-private-key'
      );
      expect(samlUiSchema.security['ui:title']).toBe(
        'label.entity-configuration {"entity":"label.security"}'
      );
      expect(samlUiSchema.security.strictMode['ui:title']).toBe(
        'label.strict-mode'
      );
      expect(samlUiSchema.security.tokenValidity['ui:title']).toBe(
        'label.token-validity-seconds'
      );
      expect(samlUiSchema.security.sendSignedAuthRequest['ui:title']).toBe(
        'label.send-signed-auth-request'
      );
    } finally {
      translate.mockImplementation(defaultTranslate);
    }
  });
});
