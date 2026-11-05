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
import { AuthProvider } from '../../generated/settings/settings';
import {
  applySecurityConfiguration,
  getSecurityConfiguration,
  patchSecurityConfiguration,
  SecurityConfiguration,
  validateSecurityConfiguration,
} from '../../rest/securityConfigAPI';
import { showSuccessToast } from '../../utils/ToastUtils';
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
});
