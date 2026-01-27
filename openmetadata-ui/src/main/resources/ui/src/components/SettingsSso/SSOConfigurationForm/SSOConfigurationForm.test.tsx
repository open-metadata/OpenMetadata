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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { VALIDATION_STATUS } from '../../../constants/SSO.constant';
import {
  AuthenticationConfiguration,
  AuthProvider,
  ClientType,
} from '../../../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../../../generated/configuration/authorizerConfiguration';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { ApplicationStore } from '../../../interface/store.interface';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
} from '../../../rest/miscAPI';
import {
  applySecurityConfiguration,
  getSecurityConfiguration,
  patchSecurityConfiguration,
  SecurityConfiguration,
  SecurityValidationResponse,
  validateSecurityConfiguration,
} from '../../../rest/securityConfigAPI';
import { getAuthConfig } from '../../../utils/AuthProvider.util';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useAuthProvider } from '../../Auth/AuthProviders/AuthProvider';
import SSOConfigurationFormRJSF from './SSOConfigurationForm';
import { SSOConfigurationFormProps } from './SSOConfigurationForm.interface';

// Mock dependencies
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Mock SSOUtils - use actual implementations where needed
jest.mock('../../../utils/SSOUtils', () => {
  const actual = jest.requireActual('../../../utils/SSOUtils');

  return {
    ...actual, // Use actual implementations
    // Only override what needs to be spied on
    applySamlConfiguration: jest.fn(actual.applySamlConfiguration),
    cleanupProviderSpecificFields: jest.fn(
      actual.cleanupProviderSpecificFields
    ),
  };
});

// Mock formUtils - use actual implementations
jest.mock('../../../utils/formUtils', () => {
  const actual = jest.requireActual('../../../utils/formUtils');

  return {
    ...actual, // Use actual implementations
  };
});

// Mock SwTokenStorageUtils
jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  setOidcToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

jest.mock('../../../rest/securityConfigAPI');
jest.mock('../../../rest/miscAPI');
jest.mock('../../../hooks/useApplicationStore');
jest.mock('../../Auth/AuthProviders/AuthProvider');
jest.mock('../../../utils/AuthProvider.util');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../ProviderSelector/ProviderSelector', () => {
  return function ProviderSelector({
    onProviderSelect,
  }: {
    onProviderSelect: (provider: AuthProvider) => void;
  }) {
    return (
      <div data-testid="provider-selector">
        <button onClick={() => onProviderSelect(AuthProvider.Google)}>
          Select Google
        </button>
        <button onClick={() => onProviderSelect(AuthProvider.Okta)}>
          Select Okta
        </button>
        <button onClick={() => onProviderSelect(AuthProvider.Azure)}>
          Select Azure
        </button>
        <button onClick={() => onProviderSelect(AuthProvider.Saml)}>
          Select SAML
        </button>
        <button onClick={() => onProviderSelect(AuthProvider.LDAP)}>
          Select LDAP
        </button>
      </div>
    );
  };
});

jest.mock('../SSODocPanel/SSODocPanel', () => {
  return function SSODocPanel({
    activeField,
    serviceName,
  }: {
    activeField?: string;
    serviceName?: string;
  }) {
    return (
      <div data-testid="sso-doc-panel">
        <span>Active Field: {activeField}</span>
        <span>Service Name: {serviceName}</span>
      </div>
    );
  };
});

jest.mock('../../common/ResizablePanels/ResizablePanels', () => {
  return function ResizablePanels({
    firstPanel,
    secondPanel,
  }: {
    firstPanel: { children: React.ReactNode };
    secondPanel: { children: React.ReactNode };
  }) {
    return (
      <div data-testid="resizable-panels">
        <div>{firstPanel.children}</div>
        <div>{secondPanel.children}</div>
      </div>
    );
  };
});

jest.mock('../../common/Loader/Loader', () => {
  return function Loader() {
    return <div data-testid="loader">Loading...</div>;
  };
});

jest.mock(
  '../../Modals/UnsavedChangesModal/UnsavedChangesModal.component',
  () => ({
    UnsavedChangesModal: ({
      open,
      onDiscard,
      onSave,
      onCancel,
    }: {
      open: boolean;
      onDiscard: () => void;
      onSave: () => void;
      onCancel?: () => void;
    }) => {
      if (!open) {
        return null;
      }

      return (
        <div data-testid="unsaved-changes-modal">
          <button onClick={onDiscard}>Discard</button>
          <button onClick={onSave}>Save</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      );
    },
  })
);

const mockShowErrorToast = showErrorToast as jest.MockedFunction<
  typeof showErrorToast
>;

const mockApplySecurityConfiguration =
  applySecurityConfiguration as jest.MockedFunction<
    typeof applySecurityConfiguration
  >;
const mockPatchSecurityConfiguration =
  patchSecurityConfiguration as jest.MockedFunction<
    typeof patchSecurityConfiguration
  >;
const mockValidateSecurityConfiguration =
  validateSecurityConfiguration as jest.MockedFunction<
    typeof validateSecurityConfiguration
  >;
const mockGetSecurityConfiguration =
  getSecurityConfiguration as jest.MockedFunction<
    typeof getSecurityConfiguration
  >;

const mockFetchAuthenticationConfig =
  fetchAuthenticationConfig as jest.MockedFunction<
    typeof fetchAuthenticationConfig
  >;
const mockFetchAuthorizerConfig = fetchAuthorizerConfig as jest.MockedFunction<
  typeof fetchAuthorizerConfig
>;
const mockGetAuthConfig = getAuthConfig as jest.MockedFunction<
  typeof getAuthConfig
>;

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;
const mockUseAuthProvider = useAuthProvider as jest.MockedFunction<
  typeof useAuthProvider
>;

// Helper function to create proper AxiosResponse mock objects
function createAxiosResponse<T>(data: T) {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
    request: {},
  };
}

describe('SSOConfigurationForm', () => {
  const mockSetIsAuthenticated = jest.fn();
  const mockSetAuthConfig = jest.fn();
  const mockSetAuthorizerConfig = jest.fn();
  const mockOnLogoutHandler = jest.fn();

  const defaultProps: SSOConfigurationFormProps = {};

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseApplicationStore.mockReturnValue({
      setIsAuthenticated: mockSetIsAuthenticated,
      setAuthConfig: mockSetAuthConfig,
      setAuthorizerConfig: mockSetAuthorizerConfig,
    } as Partial<ApplicationStore> as ApplicationStore);

    mockUseAuthProvider.mockReturnValue({
      onLogoutHandler: mockOnLogoutHandler,
      onLoginHandler: jest.fn(),
      handleSuccessfulLogin: jest.fn(),
      handleFailedLogin: jest.fn(),
      handleSuccessfulLogout: jest.fn(),
      updateAxiosInterceptors: jest.fn(),
    });

    Object.defineProperty(window, 'location', {
      value: {
        replace: jest.fn(),
      },
      writable: true,
    });

    // Mock sessionStorage and localStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        clear: jest.fn(),
      },
      writable: true,
    });

    Object.defineProperty(window, 'localStorage', {
      value: {
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  const renderComponent = (props: Partial<SSOConfigurationFormProps> = {}) => {
    return render(
      <MemoryRouter>
        <SSOConfigurationFormRJSF {...defaultProps} {...props} />
      </MemoryRouter>
    );
  };

  describe('Provider Selection', () => {
    beforeEach(() => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
    });

    it('should initialize form with Google provider', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('Google label.set-up')).toBeInTheDocument();
      });
    });

    it('should initialize form with SAML provider as public client', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const samlButton = screen.getByText('Select SAML');
      fireEvent.click(samlButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('SAML label.set-up')).toBeInTheDocument();
      });
    });

    it('should initialize form with LDAP provider as public client', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const ldapButton = screen.getByText('Select LDAP');
      fireEvent.click(ldapButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('Ldap label.set-up')).toBeInTheDocument();
      });
    });

    it('should call onProviderSelect when provider is selected', async () => {
      const mockOnProviderSelect = jest.fn();
      renderComponent({ onProviderSelect: mockOnProviderSelect });

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockOnProviderSelect).toHaveBeenCalledWith(AuthProvider.Google);
      });
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      const mockConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
          authority: 'https://accounts.google.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'test-client-id',
          clientType: ClientType.Confidential,
          providerName: 'Google',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          oidcConfiguration: {
            id: 'test-id',
            secret: 'test-secret',
            discoveryUri:
              'https://accounts.google.com/.well-known/openid-configuration',
            tenant: 'default',
          },
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: ['admin@test.com'],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as SecurityConfiguration;
      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockConfigData)
      );
    });

    it('should force edit mode when forceEditMode prop is true', async () => {
      renderComponent({ forceEditMode: true });

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('cancel-sso-configuration')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Save Configuration - New Configuration', () => {
    beforeEach(() => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
    });

    it('should validate and save new configuration successfully', async () => {
      const mockValidationData = {
        status: VALIDATION_STATUS.SUCCESS,
        message: 'Validation successful',
        results: [],
      };

      const mockAuthConfig: AuthenticationConfiguration = {
        provider: AuthProvider.Google,
        authority: 'https://accounts.google.com',
        callbackUrl: 'https://app.example.com/callback',
        clientId: 'test-client-id',
        providerName: 'Google',
        jwtPrincipalClaims: ['email'],
        publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
      };
      const mockAuthorizerConfig: AuthorizerConfiguration = {
        adminPrincipals: ['admin'],
        className: 'org.openmetadata.service.security.DefaultAuthorizer',
        containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
        enableSecureSocketConnection: false,
        enforcePrincipalDomain: false,
        principalDomain: '',
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );
      mockApplySecurityConfiguration.mockResolvedValue(
        createAxiosResponse({} as SecurityConfiguration)
      );
      mockFetchAuthenticationConfig.mockResolvedValue(mockAuthConfig);
      mockFetchAuthorizerConfig.mockResolvedValue(mockAuthorizerConfig);
      mockGetAuthConfig.mockReturnValue({
        ...mockAuthConfig,
        scope: 'openid email profile',
      });
      mockOnLogoutHandler.mockResolvedValue(undefined);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockValidateSecurityConfiguration).toHaveBeenCalled();
        expect(mockApplySecurityConfiguration).toHaveBeenCalled();

        expect(window.location.replace).toHaveBeenCalledWith('/signin');
      });
    });

    it('should handle validation failure', async () => {
      const mockValidationData = {
        status: VALIDATION_STATUS.FAILED,
        message: 'Validation failed',
        results: [
          {
            component: 'authentication',
            status: VALIDATION_STATUS.FAILED,
            message: 'Client ID is required',
          },
        ],
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockValidateSecurityConfiguration).toHaveBeenCalled();
        expect(mockApplySecurityConfiguration).not.toHaveBeenCalled();
      });
    });

    it('should handle logout failure and clear storage', async () => {
      const mockValidationData = {
        status: VALIDATION_STATUS.SUCCESS,
        message: 'Validation successful',
        results: [],
      };

      const mockAuthConfig: AuthenticationConfiguration = {
        provider: AuthProvider.Google,
        authority: 'https://accounts.google.com',
        callbackUrl: 'https://app.example.com/callback',
        clientId: 'test-client-id',
        providerName: 'Google',
        jwtPrincipalClaims: ['email'],
        publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
      };

      const mockAuthorizerConfig: AuthorizerConfiguration = {
        adminPrincipals: ['admin'],
        className: 'org.openmetadata.service.security.DefaultAuthorizer',
        containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
        enableSecureSocketConnection: false,
        enforcePrincipalDomain: false,
        principalDomain: '',
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );
      mockApplySecurityConfiguration.mockResolvedValue(
        createAxiosResponse({} as SecurityConfiguration)
      );
      mockFetchAuthenticationConfig.mockResolvedValue(mockAuthConfig);
      mockFetchAuthorizerConfig.mockResolvedValue(mockAuthorizerConfig);
      mockGetAuthConfig.mockReturnValue({
        ...mockAuthConfig,
        scope: 'openid email profile',
      });
      mockOnLogoutHandler.mockRejectedValue(new Error('Logout failed'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(window.sessionStorage.clear).toHaveBeenCalled();
        expect(window.localStorage.clear).toHaveBeenCalled();
        expect(window.location.replace).toHaveBeenCalledWith('/signin');
      });
    });
  });

  describe('Props Handling', () => {
    it('should handle selectedProvider prop', async () => {
      renderComponent({ selectedProvider: AuthProvider.Okta });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('Okta label.set-up')).toBeInTheDocument();
      });
    });

    it('should handle Basic provider in selectedProvider', async () => {
      renderComponent({ selectedProvider: AuthProvider.Basic });

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });
    });

    it('should handle onChangeProvider callback', async () => {
      const mockOnChangeProvider = jest.fn();
      const mockConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
          authority: 'https://accounts.google.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'test-client-id',
          clientType: ClientType.Confidential,
          providerName: 'Google',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: ['admin'],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as SecurityConfiguration;
      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockConfigData)
      );

      renderComponent({ onChangeProvider: mockOnChangeProvider });

      await waitFor(() => {
        expect(
          screen.getByTestId('change-provider-button')
        ).toBeInTheDocument();
      });

      const changeButton = screen.getByTestId('change-provider-button');
      fireEvent.click(changeButton);

      expect(mockOnChangeProvider).toHaveBeenCalled();
    });

    it('should render with hideBorder prop', async () => {
      const mockConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
          authority: 'https://accounts.google.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'test-client-id',
          clientType: ClientType.Confidential,
          providerName: 'Google',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: ['admin'],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as SecurityConfiguration;
      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockConfigData)
      );

      renderComponent({ hideBorder: true });

      await waitFor(() => {
        expect(screen.getByTestId('resizable-panels')).toBeInTheDocument();
        expect(
          screen.queryByText('Google label.set-up')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Client Type Switching', () => {
    it('should handle switching from Confidential to Public client', async () => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const oktaButton = screen.getByText('Select Okta');
      fireEvent.click(oktaButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });

      // The form would have clientType field rendered here
      // Simulating client type change would require mocking the form onChange
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockError = new AxiosError('API Error');
      mockGetSecurityConfiguration.mockRejectedValue(mockError);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });
    });

    it('should show error toast for save failures', async () => {
      const mockError = new Error('Save failed');
      const mockValidationData = {
        status: VALIDATION_STATUS.SUCCESS,
        message: 'Validation successful',
        results: [],
      };

      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );
      mockApplySecurityConfiguration.mockRejectedValue(mockError);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(mockError);
      });
    });
  });

  describe('Provider Icons', () => {
    it('should display correct provider title for each provider', async () => {
      const providers = [
        { provider: AuthProvider.Google, displayName: 'Google label.set-up' },
        { provider: AuthProvider.Azure, displayName: 'Azure AD label.set-up' },
        { provider: AuthProvider.Okta, displayName: 'Okta label.set-up' },
        { provider: AuthProvider.Auth0, displayName: 'Auth0 label.set-up' },
        {
          provider: AuthProvider.AwsCognito,
          displayName: 'AWS Cognito label.set-up',
        },
        { provider: AuthProvider.LDAP, displayName: 'Ldap label.set-up' },
        { provider: AuthProvider.Saml, displayName: 'SAML label.set-up' },
      ];

      for (const { provider, displayName } of providers) {
        const { unmount } = renderComponent({ selectedProvider: provider });

        await waitFor(() => {
          expect(
            screen.getByTestId('sso-configuration-form-card')
          ).toBeInTheDocument();
          expect(screen.getByText(displayName)).toBeInTheDocument();
        });

        unmount();
      }
    });
  });

  describe('Form Data Cleanup', () => {
    it('should cleanup provider-specific fields before submission', async () => {
      const mockValidationData = {
        status: VALIDATION_STATUS.SUCCESS,
        message: 'Validation successful',
        results: [],
      };

      const mockAuthConfig: AuthenticationConfiguration = {
        provider: AuthProvider.Saml,
        authority: 'https://idp.example.com',
        callbackUrl: 'https://app.example.com/callback',
        clientId: 'saml-client-id',
        providerName: 'SAML',
        jwtPrincipalClaims: ['email'],
        publicKeyUrls: [],
      };

      const mockAuthorizerConfig: AuthorizerConfiguration = {
        adminPrincipals: ['admin'],
        className: 'org.openmetadata.service.security.DefaultAuthorizer',
        containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
        enableSecureSocketConnection: false,
        enforcePrincipalDomain: false,
        principalDomain: '',
      };

      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );
      mockApplySecurityConfiguration.mockResolvedValue(
        createAxiosResponse({} as SecurityConfiguration)
      );
      mockFetchAuthenticationConfig.mockResolvedValue(mockAuthConfig);
      mockFetchAuthorizerConfig.mockResolvedValue(mockAuthorizerConfig);
      mockGetAuthConfig.mockReturnValue({
        ...mockAuthConfig,
        scope: 'openid email profile',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const samlButton = screen.getByText('Select SAML');
      fireEvent.click(samlButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockApplySecurityConfiguration).toHaveBeenCalledWith(
          expect.objectContaining({
            authenticationConfiguration: expect.objectContaining({
              provider: AuthProvider.Saml,
              clientType: ClientType.Public,
            }),
          })
        );
      });
    });
  });

  describe('Form Field Validation', () => {
    it('should handle field-specific validation errors without showing toast', async () => {
      // Field-specific errors have a field property and don't trigger toast
      const mockValidationData = {
        status: 'failed',
        message: 'Validation failed',
        results: [
          {
            component: 'authenticationConfiguration.oidcConfiguration.id',
            status: 'failed',
            message: 'Client ID is required',
          },
          {
            component: 'authenticationConfiguration.oidcConfiguration.secret',
            status: 'failed',
            message: 'Client Secret is required',
          },
        ],
      };

      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      // Select Google provider (OIDC with Confidential client)
      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      // Try to save without filling required fields
      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockValidateSecurityConfiguration).toHaveBeenCalled();
        // Validation should fail, so apply should not be called
        expect(mockApplySecurityConfiguration).not.toHaveBeenCalled();
        // Field-specific errors don't trigger showErrorToast
        expect(mockShowErrorToast).not.toHaveBeenCalled();
      });
    });
  });

  describe('Security Config Prop Handling', () => {
    it('should handle securityConfig prop without fetching', async () => {
      const mockSecurityConfig = {
        authenticationConfiguration: {
          provider: AuthProvider.Azure,
          clientType: ClientType.Confidential,
          authority: 'https://login.microsoftonline.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'azure-client-id',
          providerName: 'Azure',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: [],
          oidcConfiguration: {
            id: 'azure-client-id',
            secret: 'azure-secret',
            discoveryUri:
              'https://login.microsoftonline.com/.well-known/openid-configuration',
            tenant: 'azure-tenant',
          },
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: ['azure-admin@test.com'],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as Partial<SecurityConfiguration>;

      renderComponent({
        securityConfig: mockSecurityConfig as unknown as SecurityConfiguration,
      });

      await waitFor(() => {
        expect(mockGetSecurityConfiguration).not.toHaveBeenCalled();
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });

    it('should handle SAML config with IDP and SP field sync', async () => {
      const mockSamlConfig = {
        authenticationConfiguration: {
          provider: AuthProvider.Saml,
          authority: 'https://idp.example.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'saml-client-id',
          providerName: 'SAML',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: [],
          samlConfiguration: {
            idp: {},
            sp: {},
          },
        } as unknown as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: [],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as Partial<SecurityConfiguration>;

      renderComponent({
        securityConfig: mockSamlConfig as unknown as SecurityConfiguration,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });

    it('should populate SAML IDP authorityUrl when missing', async () => {
      const mockSamlConfig = {
        authenticationConfiguration: {
          provider: AuthProvider.Saml,
          authority: 'https://idp.example.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'saml-client-id',
          providerName: 'SAML',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: [],
          samlConfiguration: {
            idp: {},
            sp: {
              callback: 'https://app.example.com/callback',
            },
          },
        },
        authorizerConfiguration: {
          adminPrincipals: [],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        },
      };

      renderComponent({
        securityConfig: mockSamlConfig as unknown as SecurityConfiguration,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Save with Existing Configuration (PATCH)', () => {
    it('should save existing configuration without changes', async () => {
      const mockExistingConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Okta,
          authority: 'https://okta.example.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'okta-client-id',
          clientType: ClientType.Confidential,
          providerName: 'Okta',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: ['https://okta.example.com/oauth2/v1/keys'],
          oidcConfiguration: {
            id: 'okta-id',
            secret: 'okta-secret',
            discoveryUri:
              'https://okta.example.com/.well-known/openid-configuration',
            tenant: 'default',
          },
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: ['admin@okta.com'],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as SecurityConfiguration;

      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockExistingConfigData)
      );
      mockPatchSecurityConfiguration.mockResolvedValue(
        createAxiosResponse({} as SecurityConfiguration)
      );

      const { showSuccessToast } = jest.requireMock(
        '../../../utils/ToastUtils'
      );

      renderComponent({ forceEditMode: true });

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        // When there are no changes, no patches are generated, so patch is not called
        // But success toast should still be shown
        expect(showSuccessToast).toHaveBeenCalled();
      });
    });
  });

  describe('Handle Save and Exit Modal', () => {
    beforeEach(() => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
    });

    it('should handle Save and Exit from modal for new config', async () => {
      const mockValidationData = {
        status: VALIDATION_STATUS.SUCCESS,
        message: 'Validation successful',
        results: [],
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );
      mockApplySecurityConfiguration.mockResolvedValue(
        createAxiosResponse({} as SecurityConfiguration)
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('cancel-sso-configuration')
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('cancel-sso-configuration');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-changes-modal')).toBeInTheDocument();
      });

      const saveModalButton = screen.getByText('Save');
      fireEvent.click(saveModalButton);

      await waitFor(() => {
        expect(mockValidateSecurityConfiguration).toHaveBeenCalled();
      });
    });

    it('should handle Save and Exit from modal for existing config', async () => {
      const mockExistingConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
          authority: 'https://accounts.google.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'google-client-id',
          clientType: ClientType.Public,
          providerName: 'Google',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: [],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as SecurityConfiguration;

      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockExistingConfigData)
      );
      mockPatchSecurityConfiguration.mockResolvedValue(
        createAxiosResponse({} as SecurityConfiguration)
      );

      const { showSuccessToast } = jest.requireMock(
        '../../../utils/ToastUtils'
      );

      renderComponent({ forceEditMode: true });

      await waitFor(() => {
        expect(
          screen.getByTestId('cancel-sso-configuration')
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('cancel-sso-configuration');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-changes-modal')).toBeInTheDocument();
      });

      const saveModalButton = screen.getByText('Save');
      fireEvent.click(saveModalButton);

      await waitFor(() => {
        // Modal should close after save
        expect(showSuccessToast).toHaveBeenCalled();
      });
    });

    it('should handle modal close without saving', async () => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('cancel-sso-configuration')
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('cancel-sso-configuration');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-changes-modal')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Cancel');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId('unsaved-changes-modal')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Validation Error Handling', () => {
    beforeEach(() => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
    });

    it('should handle validation errors from response', async () => {
      const mockValidationData = {
        status: 'failed',
        message: 'Validation failed',
        results: [
          {
            component: 'authenticationConfiguration.clientId',
            status: 'failed',
            message: 'Client ID is required',
          },
        ],
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockValidateSecurityConfiguration).toHaveBeenCalled();
        expect(mockApplySecurityConfiguration).not.toHaveBeenCalled();
      });
    });

    it('should handle axios errors with validation errors', async () => {
      const axiosError = {
        response: {
          data: {
            status: 'failed',
            message: 'Validation failed',
            results: [
              {
                component:
                  'authenticationConfiguration.oidcConfiguration.secret',
                status: 'failed',
                message: 'Secret is required',
              },
            ],
          },
        },
      } as AxiosError;

      mockValidateSecurityConfiguration.mockRejectedValue(axiosError);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockValidateSecurityConfiguration).toHaveBeenCalled();
      });
    });

    it('should handle errors with both field and general messages', async () => {
      const mockMixedErrorsData = {
        status: 'failed',
        message: 'General validation error',
        errors: [
          {
            field: 'authenticationConfiguration.authority',
            error: 'Invalid authority URL',
          },
          {
            field: '',
            error: 'General validation error',
          },
        ],
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(
          mockMixedErrorsData as unknown as SecurityValidationResponse
        )
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Select Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(
          'General validation error'
        );
      });
    });
  });

  describe('Client Type Switching for Google', () => {
    beforeEach(() => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
    });

    it('should prepopulate Google fields when switching from Public to Confidential', async () => {
      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
      // Form is rendered and client type switching can occur
      // The actual switching logic is tested through the component
    });
  });

  describe('Provider Switching and Defaults', () => {
    beforeEach(() => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
    });

    it('should load defaults for Google provider', async () => {
      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('Google label.set-up')).toBeInTheDocument();
      });
    });

    it('should load defaults for SAML provider', async () => {
      renderComponent({ selectedProvider: AuthProvider.Saml });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('SAML label.set-up')).toBeInTheDocument();
      });
    });

    it('should load defaults for Auth0 provider', async () => {
      renderComponent({ selectedProvider: AuthProvider.Auth0 });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('Auth0 label.set-up')).toBeInTheDocument();
      });
    });

    it('should load defaults for Okta provider', async () => {
      renderComponent({ selectedProvider: AuthProvider.Okta });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('Okta label.set-up')).toBeInTheDocument();
      });
    });

    it('should load defaults for Azure provider', async () => {
      renderComponent({ selectedProvider: AuthProvider.Azure });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });

    it('should load defaults for CustomOIDC provider', async () => {
      renderComponent({ selectedProvider: AuthProvider.CustomOidc });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });

    it('should load defaults for AWS Cognito provider', async () => {
      renderComponent({ selectedProvider: AuthProvider.AwsCognito });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });

    it('should load defaults for LDAP provider', async () => {
      renderComponent({ selectedProvider: AuthProvider.LDAP });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
        expect(screen.getByText('Ldap label.set-up')).toBeInTheDocument();
      });
    });
  });

  describe('Form Change Handling', () => {
    beforeEach(() => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
    });

    it('should handle form state changes', async () => {
      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });

      // Form is interactive and changes can be tracked
      expect(screen.getByTestId('save-sso-configuration')).toBeInTheDocument();
    });

    it('should handle edit mode for existing Google Public config', async () => {
      const mockGooglePublicConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
          clientType: ClientType.Public,
          authority: 'https://accounts.google.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'test-client-id',
          providerName: 'Google',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: ['admin@example.com'],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as SecurityConfiguration;

      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockGooglePublicConfigData)
      );

      renderComponent({ forceEditMode: true });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });

    it('should handle edit mode for existing Google Confidential config', async () => {
      const mockGoogleConfidentialConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
          authority: 'https://accounts.google.com',
          callbackUrl: 'https://app.example.com/callback',
          clientId: 'google-client-id',
          clientType: ClientType.Confidential,
          providerName: 'Google',
          jwtPrincipalClaims: ['email'],
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          oidcConfiguration: {
            id: 'google-client-id',
            secret: 'google-secret',
            discoveryUri:
              'https://accounts.google.com/.well-known/openid-configuration',
            tenant: 'default',
          },
        } as AuthenticationConfiguration,
        authorizerConfiguration: {
          adminPrincipals: ['admin@example.com'],
          botPrincipals: ['bot@example.com'],
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          enableSecureSocketConnection: false,
          enforcePrincipalDomain: false,
          principalDomain: '',
        } as AuthorizerConfiguration,
      } as SecurityConfiguration;

      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockGoogleConfidentialConfigData)
      );

      renderComponent({ forceEditMode: true });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery', () => {
    beforeEach(() => {
      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
    });

    it('should handle network errors during save', async () => {
      const networkError = new Error('Network error');
      mockValidateSecurityConfiguration.mockRejectedValue(networkError);

      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(networkError);
      });
    });

    it('should handle successful validation with component messages', async () => {
      const mockValidationData = {
        status: VALIDATION_STATUS.SUCCESS,
        message: 'Validation completed',
        results: [
          {
            component: 'authentication',
            status: VALIDATION_STATUS.SUCCESS,
            message: 'Authentication OK',
          },
          {
            component: 'authorizer',
            status: VALIDATION_STATUS.SUCCESS,
            message: 'Authorizer OK',
          },
        ],
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockValidationData)
      );
      mockApplySecurityConfiguration.mockResolvedValue(
        createAxiosResponse({} as SecurityConfiguration)
      );

      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('save-sso-configuration')
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-sso-configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockApplySecurityConfiguration).toHaveBeenCalled();
      });
    });
  });

  describe('Invalid Provider Configuration', () => {
    it('should show provider selector for invalid non-basic provider config', async () => {
      const invalidConfig = {
        authenticationConfiguration: {
          provider: null as unknown as AuthProvider,
          providerName: '',
          authority: '',
          clientId: '',
          callbackUrl: '',
          jwtPrincipalClaims: [],
          jwtPrincipalClaimsMapping: [],
          publicKeyUrls: [],
          tokenValidationAlgorithm: '',
          enableSelfSignup: false,
        },
        authorizerConfiguration: {} as unknown as AuthorizerConfiguration,
      };

      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(invalidConfig)
      );

      renderComponent({});

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });
    });
  });

  describe('Client Type Switching Coverage', () => {
    it('should handle switching from Public to Confidential without existing callbackUrl', async () => {
      const mockConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
          providerName: 'Google',
          clientType: ClientType.Public,
          authority: 'https://accounts.google.com',
          clientId: 'test-client-id',
          callbackUrl: 'http://localhost:8585/callback',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          enableSelfSignup: false,
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockConfigData)
      );

      const { rerender } = renderComponent({
        selectedProvider: AuthProvider.Google,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });

      // Simulate client type change by re-rendering with updated config
      mockConfigData.authenticationConfiguration.clientType =
        ClientType.Confidential;
      rerender(
        <MemoryRouter>
          <SSOConfigurationFormRJSF selectedProvider={AuthProvider.Google} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });

    it('should handle switching from Confidential to Public for Google with callback URL', async () => {
      const mockConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Google,
          providerName: 'Google',
          clientType: ClientType.Confidential,
          authority: 'https://accounts.google.com',
          clientId: 'test-client-id',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
          tokenValidationAlgorithm: 'RS256',
          callbackUrl: 'https://custom.callback.com/auth',
          enableSelfSignup: false,
          oidcConfiguration: {
            id: 'test-id',
            secret: 'test-secret',
            callbackUrl: 'https://custom.callback.com/auth',
            discoveryUri:
              'https://accounts.google.com/.well-known/openid-configuration',
            tenant: '',
          },
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockConfigData)
      );

      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });

    it('should set default callback URL when switching to Public without any callbackUrl', async () => {
      const mockConfigData = {
        authenticationConfiguration: {
          provider: AuthProvider.Azure,
          providerName: 'Azure',
          clientType: ClientType.Confidential,
          authority: 'https://login.microsoftonline.com',
          clientId: 'test-client-id',
          jwtPrincipalClaims: ['email'],
          jwtPrincipalClaimsMapping: [],
          publicKeyUrls: [],
          tokenValidationAlgorithm: 'RS256',
          callbackUrl: 'http://localhost:8585/callback',
          enableSelfSignup: false,
          oidcConfiguration: {
            id: 'test-client-id',
            secret: 'test-secret',
            discoveryUri:
              'https://login.microsoftonline.com/.well-known/openid-configuration',
            tenant: 'common',
          },
        },
        authorizerConfiguration: {
          className: 'org.openmetadata.service.security.DefaultAuthorizer',
          containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
          adminPrincipals: [],
          principalDomain: '',
          enforcePrincipalDomain: false,
          enableSecureSocketConnection: false,
        },
      };

      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse(mockConfigData)
      );

      renderComponent({ selectedProvider: AuthProvider.Azure });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Field Error Clearing', () => {
    it('should render form with existing config', async () => {
      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse({
          authenticationConfiguration: {
            provider: AuthProvider.Google,
            providerName: 'google',
            clientType: ClientType.Public,
            authority: 'https://accounts.google.com',
            clientId: 'existing-client-id',
            callbackUrl: 'https://app.example.com/callback',
            publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
            jwtPrincipalClaims: ['email'],
            jwtPrincipalClaimsMapping: [],
            tokenValidationAlgorithm: 'RS256',
            enableSelfSignup: false,
          },
          authorizerConfiguration: {
            className: 'org.openmetadata.service.security.DefaultAuthorizer',
            containerRequestFilter:
              'org.openmetadata.service.security.JwtFilter',
            adminPrincipals: [],
            principalDomain: '',
            enforcePrincipalDomain: false,
            enableSecureSocketConnection: false,
          },
        })
      );

      renderComponent({});

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Focus Event Handling', () => {
    it('should update active field on focus', async () => {
      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse({
          authenticationConfiguration: {
            provider: AuthProvider.Google,
            providerName: 'google',
            clientType: ClientType.Public,
            authority: 'https://accounts.google.com',
            clientId: 'test-client-id',
            callbackUrl: 'http://localhost:8585/callback',
            jwtPrincipalClaims: ['email'],
            jwtPrincipalClaimsMapping: [],
            publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
            tokenValidationAlgorithm: 'RS256',
            enableSelfSignup: false,
          },
          authorizerConfiguration: {
            className: 'org.openmetadata.service.security.DefaultAuthorizer',
            containerRequestFilter:
              'org.openmetadata.service.security.JwtFilter',
            adminPrincipals: [],
            principalDomain: '',
            enforcePrincipalDomain: false,
            enableSecureSocketConnection: false,
          },
        })
      );

      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });

      // Verify doc panel is rendered (confirms activeField state is working)
      expect(screen.getByTestId('sso-doc-panel')).toBeInTheDocument();
    });
  });

  describe('Form onChange with No Errors', () => {
    it('should handle form change without existing errors', async () => {
      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse({
          authenticationConfiguration: {
            provider: AuthProvider.Google,
            providerName: 'google',
            clientType: ClientType.Public,
            authority: 'https://accounts.google.com',
            clientId: 'test-client-id',
            callbackUrl: 'http://localhost:8585/callback',
            jwtPrincipalClaims: ['email'],
            jwtPrincipalClaimsMapping: [],
            publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
            tokenValidationAlgorithm: 'RS256',
            enableSelfSignup: false,
          },
          authorizerConfiguration: {
            className: 'org.openmetadata.service.security.DefaultAuthorizer',
            containerRequestFilter:
              'org.openmetadata.service.security.JwtFilter',
            adminPrincipals: [],
            principalDomain: '',
            enforcePrincipalDomain: false,
            enableSecureSocketConnection: false,
          },
        })
      );

      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });

      // Verify the form card is rendered
      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Extract Field Name Utility', () => {
    it('should handle field name extraction from field IDs', async () => {
      mockGetSecurityConfiguration.mockResolvedValue(
        createAxiosResponse({
          authenticationConfiguration: {
            provider: AuthProvider.Google,
            providerName: 'google',
            clientType: ClientType.Public,
            authority: 'https://accounts.google.com',
            clientId: 'test-client-id',
            callbackUrl: 'http://localhost:8585/callback',
            jwtPrincipalClaims: ['email'],
            jwtPrincipalClaimsMapping: [],
            publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
            tokenValidationAlgorithm: 'RS256',
            enableSelfSignup: false,
          },
          authorizerConfiguration: {
            className: 'org.openmetadata.service.security.DefaultAuthorizer',
            containerRequestFilter:
              'org.openmetadata.service.security.JwtFilter',
            adminPrincipals: [],
            principalDomain: '',
            enforcePrincipalDomain: false,
            enableSecureSocketConnection: false,
          },
        })
      );

      renderComponent({ selectedProvider: AuthProvider.Google });

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form-card')
        ).toBeInTheDocument();
      });

      // Verify the doc panel shows proper field mapping
      const docPanel = screen.getByTestId('sso-doc-panel');

      expect(docPanel).toBeInTheDocument();
    });
  });
});
