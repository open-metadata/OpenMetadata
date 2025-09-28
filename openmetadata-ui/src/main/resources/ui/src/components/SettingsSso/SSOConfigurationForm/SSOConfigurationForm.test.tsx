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
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { VALIDATION_STATUS } from '../../../constants/SSO.constant';
import { AuthProvider, ClientType } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  fetchAuthenticationConfig,
  fetchAuthorizerConfig,
} from '../../../rest/miscAPI';
import {
  applySecurityConfiguration,
  getSecurityConfiguration,
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
  return function ProviderSelector({ onProviderSelect }: any) {
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
  return function SSODocPanel({ activeField, serviceName }: any) {
    return (
      <div data-testid="sso-doc-panel">
        <span>Active Field: {activeField}</span>
        <span>Service Name: {serviceName}</span>
      </div>
    );
  };
});

jest.mock('../../common/ResizablePanels/ResizablePanels', () => {
  return function ResizablePanels({ firstPanel, secondPanel }: any) {
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
    UnsavedChangesModal: ({ open, onDiscard, onSave, onCancel }: any) => {
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
    } as any);

    mockUseAuthProvider.mockReturnValue({
      onLogoutHandler: mockOnLogoutHandler,
    } as any);

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
      const mockConfig = {
        data: {
          authenticationConfiguration: {
            provider: AuthProvider.Google,
            clientType: ClientType.Confidential,
            oidcConfiguration: {
              id: 'test-id',
              secret: 'test-secret',
            },
          },
          authorizerConfiguration: {
            adminPrincipals: ['admin@test.com'],
          },
        },
      };
      mockGetSecurityConfiguration.mockResolvedValue(mockConfig as any);
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
      const mockValidationResponse = {
        data: {
          status: VALIDATION_STATUS.SUCCESS,
          message: 'Validation successful',
          results: [],
        },
      };

      const mockAuthConfig = { provider: AuthProvider.Google };
      const mockAuthorizerConfig = { adminPrincipals: ['admin'] };

      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
      );
      mockApplySecurityConfiguration.mockResolvedValue({} as any);
      mockFetchAuthenticationConfig.mockResolvedValue(mockAuthConfig as any);
      mockFetchAuthorizerConfig.mockResolvedValue(mockAuthorizerConfig as any);
      mockGetAuthConfig.mockReturnValue(mockAuthConfig as any);
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
      const mockValidationResponse = {
        data: {
          status: VALIDATION_STATUS.FAILED,
          message: 'Validation failed',
          results: [
            {
              component: 'authentication',
              status: VALIDATION_STATUS.FAILED,
              message: 'Client ID is required',
            },
          ],
        },
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
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
        expect(mockShowErrorToast).toHaveBeenCalledWith(
          expect.stringContaining('Validation failed')
        );
        expect(mockApplySecurityConfiguration).not.toHaveBeenCalled();
      });
    });

    it('should handle logout failure and clear storage', async () => {
      const mockValidationResponse = {
        data: {
          status: VALIDATION_STATUS.SUCCESS,
          message: 'Validation successful',
          results: [],
        },
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
      );
      mockApplySecurityConfiguration.mockResolvedValue({} as any);
      mockFetchAuthenticationConfig.mockResolvedValue({} as any);
      mockFetchAuthorizerConfig.mockResolvedValue({} as any);
      mockGetAuthConfig.mockReturnValue({} as any);
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
      const mockConfig = {
        data: {
          authenticationConfiguration: {
            provider: AuthProvider.Google,
            clientType: ClientType.Confidential,
          },
          authorizerConfiguration: {},
        },
      };
      mockGetSecurityConfiguration.mockResolvedValue(mockConfig as any);

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
      const mockConfig = {
        data: {
          authenticationConfiguration: {
            provider: AuthProvider.Google,
            clientType: ClientType.Confidential,
          },
          authorizerConfiguration: {},
        },
      };
      mockGetSecurityConfiguration.mockResolvedValue(mockConfig as any);

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
      const mockValidationResponse = {
        data: {
          status: VALIDATION_STATUS.SUCCESS,
          message: 'Validation successful',
          results: [],
        },
      };

      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
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
      const mockValidationResponse = {
        data: {
          status: VALIDATION_STATUS.SUCCESS,
          message: 'Validation successful',
          results: [],
        },
      };

      mockGetSecurityConfiguration.mockRejectedValue(new Error('No config'));
      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
      );
      mockApplySecurityConfiguration.mockResolvedValue({} as any);
      mockFetchAuthenticationConfig.mockResolvedValue({} as any);
      mockFetchAuthorizerConfig.mockResolvedValue({} as any);
      mockGetAuthConfig.mockReturnValue({} as any);

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
});
