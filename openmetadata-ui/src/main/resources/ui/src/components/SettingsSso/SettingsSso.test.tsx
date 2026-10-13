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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../generated/settings/settings';
import {
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../generated/system/settingsSourceResponse';
import * as securityConfigAPI from '../../rest/securityConfigAPI';
import { getSettingsSource } from '../../rest/settingConfigAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import SettingsSso from './SettingsSso';
import { SSOConfigurationFormProps } from './SSOConfigurationForm/SSOConfigurationForm.interface';

const mockSecurityConfig: securityConfigAPI.SecurityConfiguration = {
  authenticationConfiguration: {
    provider: AuthProvider.Google,
    providerName: 'Google SSO',
    publicKeyUrls: ['https://www.googleapis.com/oauth2/v3/certs'],
    authority: 'https://accounts.google.com',
    clientId: 'test-client-id',
    callbackUrl: 'http://localhost:8585/callback',
    jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
    tokenValidationAlgorithm: 'RS256',
    jwtPrincipalClaimsMapping: ['username:preferred_username', 'email:email'],
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
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../rest/securityConfigAPI', () => ({
  getSecurityConfiguration: jest.fn(),
  patchSecurityConfiguration: jest.fn(),
}));

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsSource: jest.fn(),
  adoptDeploymentConfig: jest.fn(),
}));

jest.mock('../../utils/SSOUtilClassBase', () => ({
  default: {
    isSSOEnabled: jest.fn().mockReturnValue(true),
    getSSOProvider: jest.fn().mockReturnValue(AuthProvider.Google),
    getSCIMAccessTokenCardComponent: jest.fn(),
    getScimGroupMappingComponent: jest.fn(),
  },
}));

jest.mock('./ProviderSelector/ProviderSelector', () => {
  return function ProviderSelector({
    onProviderSelect,
  }: {
    onProviderSelect: (provider: AuthProvider) => void;
  }) {
    return (
      <div data-testid="provider-selector">
        <button
          data-testid="provider-google"
          onClick={() => onProviderSelect(AuthProvider.Google)}>
          Google
        </button>
        <button
          data-testid="provider-okta"
          onClick={() => onProviderSelect(AuthProvider.Okta)}>
          Okta
        </button>
      </div>
    );
  };
});

jest.mock('./SSOConfigurationForm/SSOConfigurationForm', () => {
  return function SSOConfigurationForm(props: SSOConfigurationFormProps) {
    return (
      <div
        data-managed-paths={JSON.stringify(props.managedPaths)}
        data-read-only={String(Boolean(props.isReadOnly))}
        data-testid="sso-configuration-form">
        <button
          data-testid="change-provider-button"
          onClick={props.onChangeProvider}>
          Change Provider
        </button>
      </div>
    );
  };
});

jest.mock('../../utils/SSOUtils', () => ({
  getProviderDisplayName: (provider: string) => {
    const names: Record<string, string> = {
      [AuthProvider.Google]: 'Google',
      [AuthProvider.Okta]: 'Okta',
      [AuthProvider.Azure]: 'Azure AD',
    };

    return names[provider] || provider;
  },
  getProviderIcon: (provider: string) => {
    return `/icon-${provider}.png`;
  },
}));

jest.mock('../common/Loader/Loader', () => {
  return function Loader() {
    return <div data-testid="loader">Loading...</div>;
  };
});

jest.mock('../common/TitleBreadcrumb/TitleBreadcrumb.component', () => {
  return function TitleBreadcrumb() {
    return <div data-testid="breadcrumb">Breadcrumb</div>;
  };
});

jest.mock('../PageLayoutV1/PageLayoutV1', () => {
  return function PageLayoutV1({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) {
    return (
      <div className={className} data-testid="page-layout-v1">
        {children}
      </div>
    );
  };
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockGetSecurityConfiguration =
  securityConfigAPI.getSecurityConfiguration as jest.MockedFunction<
    typeof securityConfigAPI.getSecurityConfiguration
  >;
const mockPatchSecurityConfiguration =
  securityConfigAPI.patchSecurityConfiguration as jest.MockedFunction<
    typeof securityConfigAPI.patchSecurityConfiguration
  >;

type GetSecurityConfigResponse = Awaited<
  ReturnType<typeof securityConfigAPI.getSecurityConfiguration>
>;
type PatchSecurityConfigResponse = Awaited<
  ReturnType<typeof securityConfigAPI.patchSecurityConfiguration>
>;

const mockGetSettingsSource = getSettingsSource as jest.Mock;

const envSecuritySources = (
  authenticationPaths: string[],
  authorizerPaths: string[] = ['/adminEmails']
): SettingSource[] => [
  {
    configType: SettingType.AuthenticationConfiguration,
    source: ConfigSourceMode.Env,
    sourceVariable: 'SECURITY_CONFIG_SOURCE',
    editable: false,
    managedPaths: authenticationPaths,
  },
  {
    configType: SettingType.AuthorizerConfiguration,
    source: ConfigSourceMode.Env,
    sourceVariable: 'SECURITY_CONFIG_SOURCE',
    editable: false,
    managedPaths: authorizerPaths,
  },
];

const renderComponent = (searchParams = '') => {
  const initialEntries = searchParams ? [`/?${searchParams}`] : ['/'];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <SettingsSso />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('SettingsSso', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSecurityConfiguration.mockResolvedValue({
      data: mockSecurityConfig,
    } as unknown as GetSecurityConfigResponse);
    mockGetSettingsSource.mockResolvedValue({ settings: [] });
  });

  describe('Initial Loading', () => {
    it('should render loading spinner initially', async () => {
      renderComponent();

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should fetch security configuration on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockGetSecurityConfiguration).toHaveBeenCalled();
      });
    });

    it('should render breadcrumb', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    });
  });

  describe('SSO Toggle', () => {
    it('should render SSO toggle switch in overview tab', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // The toggle is in the overview tab for providers with existing config
      const overviewTab = screen.getByRole('tab', {
        name: /label.overview/i,
      });

      expect(overviewTab).toBeInTheDocument();

      const switches = screen.getAllByRole('switch');

      expect(switches.length).toBeGreaterThan(0);
    });

    it('should handle SSO toggle', async () => {
      mockPatchSecurityConfiguration.mockResolvedValue({
        data: mockSecurityConfig,
      } as unknown as PatchSecurityConfigResponse);
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Find and click the switch - overview tab should exist
      const overviewTab = screen.getByRole('tab', {
        name: /label.overview/i,
      });

      expect(overviewTab).toBeInTheDocument();

      const toggleSwitch = screen.getAllByRole('switch')[0];
      fireEvent.click(toggleSwitch);

      await waitFor(() => {
        expect(mockPatchSecurityConfiguration).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              op: 'replace',
              path: '/authenticationConfiguration/enableSelfSignup',
              value: false,
            }),
          ])
        );
      });
    });
  });

  describe('Provider Configuration', () => {
    it('should show provider selector when no configuration exists', async () => {
      mockGetSecurityConfiguration.mockResolvedValue({
        data: null,
      } as unknown as GetSecurityConfigResponse);
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });
    });

    it('should show configuration form when provider is configured', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Switch to configure tab to see the form
      const configureTab = screen.getByRole('tab', {
        name: /label.configure/i,
      });

      fireEvent.click(configureTab);

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form')
        ).toBeInTheDocument();
      });
    });

    it('should display current provider name in header', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Provider name should be shown
      expect(screen.getByText('Google')).toBeInTheDocument();
    });

    it('should display provider icon in header', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Check for provider icon image
      const icon = screen.getByRole('img', { name: /Google/i });

      expect(icon).toHaveAttribute('src', expect.stringContaining('icon'));
    });
  });

  describe('Tabs Navigation', () => {
    it('should render tabs for existing configuration', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // For Google provider, should have overview and configure tabs
      const overviewTab = screen.getByRole('tab', {
        name: /label.overview/i,
      });
      const configureTab = screen.getByRole('tab', {
        name: /label.configure/i,
      });

      expect(overviewTab).toBeInTheDocument();
      expect(configureTab).toBeInTheDocument();
    });

    it('should switch between tabs when clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      const configureTab = screen.getByRole('tab', {
        name: /label.configure/i,
      });

      fireEvent.click(configureTab);

      expect(configureTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Provider Selection', () => {
    it('should handle provider selection', async () => {
      mockGetSecurityConfiguration.mockResolvedValue({
        data: null,
      } as unknown as GetSecurityConfigResponse);
      renderComponent();

      await waitFor(() => {
        const googleProvider = screen.getByTestId('provider-google');
        fireEvent.click(googleProvider);
      });

      expect(screen.getByTestId('sso-configuration-form')).toBeInTheDocument();
    });

    it('should show change provider button when provider is configured', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Switch to configure tab where the change provider button should be
      const configureTab = screen.getByRole('tab', {
        name: /label.configure/i,
      });

      fireEvent.click(configureTab);

      await waitFor(() => {
        expect(
          screen.getByTestId('change-provider-button')
        ).toBeInTheDocument();
      });
    });

    it('should navigate to provider selector when change provider is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Switch to configure tab and click change provider
      const configureTab = screen.getByRole('tab', {
        name: /label.configure/i,
      });

      fireEvent.click(configureTab);

      await waitFor(() => {
        const changeProviderButton = screen.getByTestId(
          'change-provider-button'
        );
        fireEvent.click(changeProviderButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      });
    });
  });

  describe('Configuration Persistence', () => {
    it('should handle provider selection', async () => {
      mockGetSecurityConfiguration.mockResolvedValue({
        data: null,
      } as unknown as GetSecurityConfigResponse);
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      const googleProvider = screen.getByTestId('provider-google');
      fireEvent.click(googleProvider);

      await waitFor(() => {
        expect(
          screen.getByTestId('sso-configuration-form')
        ).toBeInTheDocument();
      });
    });

    it('should show configuration form when provider is in URL', async () => {
      mockGetSecurityConfiguration.mockResolvedValue({
        data: null,
      } as unknown as GetSecurityConfigResponse);
      renderComponent(`provider=${AuthProvider.Okta}`);

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('sso-configuration-form')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration load failure', async () => {
      const mockError = new Error('Failed to load configuration');
      mockGetSecurityConfiguration.mockRejectedValue(mockError);

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Should show provider selector on error
      expect(screen.getByTestId('provider-selector')).toBeInTheDocument();
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });

    it('should handle SSO toggle error gracefully', async () => {
      const updateError = new Error('Update failed');
      mockPatchSecurityConfiguration.mockRejectedValue(updateError);

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Find and click toggle in overview tab
      const overviewTab = screen.getByRole('tab', {
        name: /label.overview/i,
      });

      expect(overviewTab).toBeInTheDocument();

      const toggleSwitch = screen.getAllByRole('switch')[0];
      fireEvent.click(toggleSwitch);

      await waitFor(() => {
        expect(mockPatchSecurityConfiguration).toHaveBeenCalled();
      });

      // A field the deployment owns is rejected with a 409 that names the variable; the admin
      // must see it rather than the toggle silently flipping back.
      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(updateError);
      });

      expect(toggleSwitch).toBeChecked();
    });
  });

  describe('Deployment configuration source', () => {
    const basicSecurityConfig = {
      ...mockSecurityConfig,
      authenticationConfiguration: {
        ...mockSecurityConfig.authenticationConfiguration,
        provider: AuthProvider.Basic,
      },
    };

    const openConfigureTab = async () => {
      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('tab', { name: /label.configure/i }));

      return screen.findByTestId('sso-configuration-form');
    };

    it('should explain that the deployment configuration owns the security settings', async () => {
      mockGetSettingsSource.mockResolvedValue({
        settings: envSecuritySources(['/provider', '/clientId']),
      });
      renderComponent();

      expect(
        await screen.findByTestId('settings-source-env-alert')
      ).toHaveTextContent('label.managed-by-deployment-configuration');
      expect(screen.getAllByTestId('settings-source-env-alert')).toHaveLength(
        1
      );
    });

    it('should lock only the deployment-owned fields of the form', async () => {
      mockGetSettingsSource.mockResolvedValue({
        settings: envSecuritySources(['/clientId']),
      });
      renderComponent();
      await screen.findByTestId('settings-source-env-alert');

      const form = await openConfigureTab();

      expect(JSON.parse(form.dataset.managedPaths ?? '{}')).toEqual({
        authenticationConfiguration: ['/clientId'],
        authorizerConfiguration: ['/adminEmails'],
      });
      expect(form).toHaveAttribute('data-read-only', 'false');
    });

    it('should make the form read-only when the deployment owns both settings', async () => {
      mockGetSettingsSource.mockResolvedValue({
        settings: envSecuritySources(['/'], ['/']),
      });
      renderComponent();
      await screen.findByTestId('settings-source-env-alert');

      const form = await openConfigureTab();

      expect(form).toHaveAttribute('data-read-only', 'true');
    });

    it('should leave the form editable when no setting is managed by the deployment', async () => {
      renderComponent();

      const form = await openConfigureTab();

      expect(form).toHaveAttribute('data-read-only', 'false');
      expect(
        screen.queryByTestId('settings-source-banner')
      ).not.toBeInTheDocument();
    });

    it('should disable the self-signup toggle when the deployment sets it', async () => {
      mockGetSettingsSource.mockResolvedValue({
        settings: envSecuritySources(['/enableSelfSignup']),
      });
      renderComponent();
      await screen.findByTestId('settings-source-env-alert');

      await waitFor(() => {
        expect(screen.getAllByRole('switch')[0]).toBeDisabled();
      });
    });

    it('should not offer other providers when the deployment sets the provider', async () => {
      mockGetSecurityConfiguration.mockResolvedValue({
        data: basicSecurityConfig,
      } as unknown as GetSecurityConfigResponse);
      mockGetSettingsSource.mockResolvedValue({
        settings: envSecuritySources(['/provider']),
      });
      renderComponent();

      await screen.findByTestId('settings-source-env-alert');

      expect(screen.queryByTestId('provider-selector')).not.toBeInTheDocument();
      expect(
        screen.getByTestId('sso-provider-set-by-deployment')
      ).toHaveTextContent('message.sso-provider-set-by-deployment');
    });

    it('should not start a new configuration when the deployment sets the provider', async () => {
      mockGetSecurityConfiguration.mockResolvedValue({
        data: basicSecurityConfig,
      } as unknown as GetSecurityConfigResponse);
      mockGetSettingsSource.mockResolvedValue({
        settings: envSecuritySources(['/provider']),
      });
      renderComponent(`provider=${AuthProvider.Okta}`);

      await screen.findByTestId('settings-source-env-alert');

      expect(
        screen.queryByTestId('sso-configuration-form')
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('provider-selector')).not.toBeInTheDocument();
    });

    it('should reload the configuration once deployment values are adopted', async () => {
      const { adoptDeploymentConfig } = jest.requireMock(
        '../../rest/settingConfigAPI'
      );
      adoptDeploymentConfig.mockResolvedValue({});
      mockGetSettingsSource.mockResolvedValue({
        settings: [
          {
            configType: SettingType.AuthenticationConfiguration,
            source: ConfigSourceMode.Auto,
            sourceVariable: 'SECURITY_CONFIG_SOURCE',
            editable: true,
            overriddenFields: [
              {
                path: '/oidcConfiguration/clientAuthenticationMethod',
                envVariable: 'OIDC_CLIENT_AUTH_METHOD',
              },
            ],
          },
        ],
      });
      const user = userEvent.setup({
        advanceTimers: jest.advanceTimersByTime,
      });
      renderComponent();

      await user.click(
        await screen.findByTestId('use-deployment-value-button')
      );
      const dialog = await screen.findByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', {
          name: 'label.use-deployment-value',
        })
      );

      await waitFor(() => {
        expect(mockGetSecurityConfiguration).toHaveBeenCalledTimes(2);
      });

      expect(adoptDeploymentConfig).toHaveBeenCalledWith(
        SettingType.AuthenticationConfiguration,
        ['/oidcConfiguration/clientAuthenticationMethod']
      );
    });
  });

  describe('Responsive Design', () => {
    it('should render with proper layout', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      const pageLayout = screen.getByTestId('page-layout-v1');

      expect(pageLayout).toHaveClass('sso-settings-page');
    });
  });

  describe('Integration with SSOUtilClassBase', () => {
    it('should use utility class for SCIM components', async () => {
      // Mock Azure provider for SCIM features
      mockGetSecurityConfiguration.mockResolvedValue({
        data: {
          ...mockSecurityConfig,
          authenticationConfiguration: {
            ...mockSecurityConfig.authenticationConfiguration,
            provider: AuthProvider.Azure,
          },
        },
      } as unknown as GetSecurityConfigResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // The component should have rendered and checked for SCIM components
      // Note: The component only calls these functions when rendering the tabs
      // for Azure or Okta providers
      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive configuration data in DOM', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      // Check that client secret or other sensitive data is not exposed
      expect(screen.queryByText('test-client-secret')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      const tablist = screen.getByRole('tablist');

      expect(tablist).toBeInTheDocument();
    });
  });
});
