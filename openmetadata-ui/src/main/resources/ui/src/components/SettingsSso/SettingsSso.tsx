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
import { Switch, Tabs, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { AuthProvider } from '../../generated/settings/settings';
import {
  getSecurityConfiguration,
  patchSecurityConfiguration,
  SecurityConfiguration,
} from '../../rest/securityConfigAPI';
import '../../styles/variables.less';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import ssoUtilClassBase from '../../utils/SSOUtilClassBase';
import { getProviderDisplayName, getProviderIcon } from '../../utils/SSOUtils';
import Loader from '../common/Loader/Loader';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../PageLayoutV1/PageLayoutV1';
import ProviderSelector from './ProviderSelector/ProviderSelector';
import './settings-sso.less';
import SSOConfigurationForm from './SSOConfigurationForm/SSOConfigurationForm';

const SettingsSso = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hasExistingConfig, setHasExistingConfig] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('configure');
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [showProviderSelector, setShowProviderSelector] =
    useState<boolean>(false);
  const [ssoEnabled, setSsoEnabled] = useState<boolean>(true);
  const [securityConfig, setSecurityConfig] =
    useState<SecurityConfiguration | null>(null);
  const configFetched = useRef<boolean>(false);

  const handleSSOToggle = useCallback(async (checked: boolean) => {
    setSsoEnabled(checked);

    try {
      const patches = [
        {
          op: 'replace' as const,
          path: '/authenticationConfiguration/enableSelfSignup',
          value: checked,
        },
      ];

      await patchSecurityConfiguration(patches);
    } catch (error) {
      setSsoEnabled(!checked);
    }
  }, []);

  const handleChangeProvider = useCallback(() => {
    setSearchParams({ provider: AuthProvider.Basic });
  }, [setSearchParams]);

  const breadcrumb = useMemo(() => {
    const baseBreadcrumb = getSettingPageEntityBreadCrumb(
      GlobalSettingsMenuCategory.SSO
    );

    const urlProvider = searchParams.get('provider');

    // Show provider name in breadcrumb for specific providers
    if (urlProvider && urlProvider !== AuthProvider.Basic) {
      const providerDisplayName = getProviderDisplayName(urlProvider);

      // For existing SSO configuration, replace SSO with provider name
      if (hasExistingConfig) {
        return [
          ...baseBreadcrumb.slice(0, -1),
          {
            name: providerDisplayName,
            url: '', // No URL for active/current page
            activeTitle: true,
          },
        ];
      } else {
        // For new configuration, show Settings > SSO > Provider hierarchy
        // First ensure the SSO breadcrumb is clickable
        const updatedBaseBreadcrumb = [...baseBreadcrumb];
        if (updatedBaseBreadcrumb.length > 1) {
          updatedBaseBreadcrumb[updatedBaseBreadcrumb.length - 1] = {
            ...updatedBaseBreadcrumb[updatedBaseBreadcrumb.length - 1],
            url: getSettingPath(GlobalSettingsMenuCategory.SSO),
            activeTitle: false, // SSO is not active when provider is selected
          };
        }

        // Add provider as additional breadcrumb item
        return [
          ...updatedBaseBreadcrumb,
          {
            name: providerDisplayName,
            url: '', // No URL for active/current page
            activeTitle: true,
          },
        ];
      }
    }

    // For base cases (provider selector, basic provider, or no provider),
    // ensure SSO breadcrumb is active (blue) since it's the current page
    const updatedBaseBreadcrumb = [...baseBreadcrumb];
    if (updatedBaseBreadcrumb.length > 1) {
      updatedBaseBreadcrumb[updatedBaseBreadcrumb.length - 1] = {
        ...updatedBaseBreadcrumb[updatedBaseBreadcrumb.length - 1],
        url: '', // No URL for active/current page
        activeTitle: true,
      };
    }

    return updatedBaseBreadcrumb;
  }, [searchParams, hasExistingConfig]);

  // If existing configuration, show tabs
  const tabItems = useMemo(() => {
    const items = [];

    // Overview tab for all SSO providers
    if (currentProvider && currentProvider !== AuthProvider.Basic) {
      const renderOverviewContent = () => {
        // Get the SCIM access token card component - only for Azure and Okta
        const SCIMAccessTokenCard =
          (currentProvider === AuthProvider.Azure ||
            currentProvider === AuthProvider.Okta) &&
          ssoUtilClassBase.getSCIMAccessTokenCardComponent?.();

        return (
          <div>
            {/* Enable SSO section */}
            <div className="enable-sso-card-container">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <Typography.Title className="enable-self-signup-header m-b-xs">
                    {t('label.enable-sso')}
                  </Typography.Title>
                  <Typography.Text className="enable-self-signup-desc">
                    {t('message.allow-user-to-login-via-sso')}
                  </Typography.Text>
                </div>
                <Switch
                  checked={ssoEnabled}
                  size="default"
                  onChange={handleSSOToggle}
                />
              </div>
            </div>

            {/* SCIM Provisioning section - only for Azure and Okta */}

            {/* SCIM Access Token Card - only show if available and for Azure/Okta */}
            {SCIMAccessTokenCard && <SCIMAccessTokenCard />}
          </div>
        );
      };

      items.push({
        key: 'overview',
        label: t('label.overview'),
        children: renderOverviewContent(),
      });
    }

    // Configure tab always present for existing configurations
    items.push({
      key: 'configure',
      label: t('label.configure'),
      children: (
        <div>
          <SSOConfigurationForm
            hideBorder
            forceEditMode={activeTab === 'configure'}
            securityConfig={securityConfig}
            onChangeProvider={handleChangeProvider}
          />
        </div>
      ),
    });

    // Group Mapping tab - only for Azure and Okta with SCIM (Collate-specific feature)
    const ScimGroupMappingComponent =
      ssoUtilClassBase.getScimGroupMappingComponent?.();
    if (
      ScimGroupMappingComponent &&
      (currentProvider === AuthProvider.Azure ||
        currentProvider === AuthProvider.Okta)
    ) {
      items.push({
        key: 'group-mapping',
        label: 'Group Mapping',
        children: <ScimGroupMappingComponent />,
      });
    }

    return items;
  }, [
    currentProvider,
    t,
    ssoEnabled,
    handleSSOToggle,
    activeTab,
    securityConfig,
    handleChangeProvider,
  ]);

  // Combined effect to handle URL parameters and existing configuration
  useEffect(() => {
    const providerParam = searchParams.get('provider');

    // If URL explicitly shows provider=basic, show provider selector immediately
    if (providerParam === AuthProvider.Basic) {
      setCurrentProvider(providerParam);
      setHasExistingConfig(false);
      setShowProviderSelector(true);
      setActiveTab('configure');
      setIsLoading(false);

      return;
    }

    // If there's a valid provider in URL, set it and check existing config
    if (
      providerParam &&
      Object.values(AuthProvider).includes(providerParam as AuthProvider)
    ) {
      setCurrentProvider(providerParam);
      setShowProviderSelector(false);
    } else {
      setShowProviderSelector(true);
      setCurrentProvider('');
    }

    // Check for existing SSO configuration
    const checkExistingConfig = async () => {
      // Prevent duplicate API calls
      if (configFetched.current) {
        return;
      }
      configFetched.current = true;

      try {
        const response = await getSecurityConfiguration();
        const config = response.data;
        setSecurityConfig(config);

        if (config?.authenticationConfiguration?.provider) {
          if (
            config.authenticationConfiguration.provider !== AuthProvider.Basic
          ) {
            setHasExistingConfig(true);
            setSsoEnabled(
              config.authenticationConfiguration.enableSelfSignup || false
            );

            // Set default tab based on provider - Overview for Google, Azure and Okta
            const provider = config.authenticationConfiguration.provider;
            if (
              provider === AuthProvider.Azure ||
              provider === AuthProvider.Okta ||
              provider === AuthProvider.Google
            ) {
              setActiveTab('overview');
            } else {
              setActiveTab('configure');
            }

            // Set current provider for breadcrumb display only if no URL parameter
            if (!providerParam) {
              setCurrentProvider(config.authenticationConfiguration.provider);
              setSearchParams({
                provider: config.authenticationConfiguration.provider,
              });
            }
            setShowProviderSelector(false);
          } else {
            setHasExistingConfig(false);
            setActiveTab('configure');
            // Only show provider selector if no specific provider in URL
            if (!providerParam) {
              setShowProviderSelector(true);
              setCurrentProvider('');
            }
          }
        } else {
          setHasExistingConfig(false);
          setActiveTab('configure');
          // Only show provider selector if no specific provider in URL
          if (!providerParam) {
            setShowProviderSelector(true);
            setCurrentProvider('');
          }
        }
      } catch (error) {
        configFetched.current = false; // Reset on error to allow retry
        setHasExistingConfig(false);
        setActiveTab('configure');
        // Only show provider selector if no specific provider in URL
        if (!providerParam) {
          setShowProviderSelector(true);
          setCurrentProvider('');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingConfig();
  }, [searchParams, setSearchParams]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  const handleProviderSelect = useCallback(
    (provider: AuthProvider) => {
      setCurrentProvider(provider);
      setShowProviderSelector(false);

      setSearchParams({ provider });

      setHasExistingConfig(false);
    },
    [setSearchParams]
  );

  // Show loading state first to prevent flickering
  if (isLoading) {
    return (
      <PageLayoutV1 className="sso-settings-page" pageTitle={t('label.sso')}>
        <TitleBreadcrumb
          useCustomArrow
          className="m-b-xs"
          titleLinks={breadcrumb}
        />
        <Loader />
      </PageLayoutV1>
    );
  }

  // If showing provider selector
  if (showProviderSelector) {
    return (
      <PageLayoutV1 className="sso-settings-page" pageTitle={t('label.sso')}>
        <TitleBreadcrumb
          useCustomArrow
          className="m-b-xs"
          titleLinks={breadcrumb}
        />

        <div className="m-t-lg sso-provider-selection">
          <ProviderSelector
            selectedProvider={currentProvider as AuthProvider | undefined}
            onProviderSelect={handleProviderSelect}
          />
        </div>
      </PageLayoutV1>
    );
  }

  // If no existing configuration, show the form directly without tabs
  if (!hasExistingConfig) {
    return (
      <PageLayoutV1 className="sso-settings-page" pageTitle={t('label.sso')}>
        <TitleBreadcrumb
          useCustomArrow
          className="m-b-xs"
          titleLinks={breadcrumb}
        />

        <SSOConfigurationForm
          securityConfig={securityConfig}
          selectedProvider={currentProvider}
          onChangeProvider={handleChangeProvider}
          onProviderSelect={handleProviderSelect}
        />
      </PageLayoutV1>
    );
  }

  return (
    <PageLayoutV1 className="sso-settings-page" pageTitle={t('label.sso')}>
      <TitleBreadcrumb
        useCustomArrow
        className="m-b-xs"
        titleLinks={breadcrumb}
      />

      <div className="settings-sso" style={{ background: 'white' }}>
        {currentProvider && currentProvider !== AuthProvider.Basic && (
          <div className="sso-provider-header">
            <div className="flex align-items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="provider-icon-container">
                  {getProviderIcon(currentProvider) && (
                    <img
                      alt={getProviderDisplayName(currentProvider)}
                      height="22"
                      src={getProviderIcon(currentProvider) as string}
                      width="22"
                    />
                  )}
                </div>
                <Typography.Title className="m-0 sso-form-header text-md">
                  {getProviderDisplayName(currentProvider)}
                </Typography.Title>
              </div>
            </div>
          </div>
        )}

        <Tabs
          activeKey={activeTab}
          items={tabItems}
          onChange={handleTabChange}
        />
      </div>
    </PageLayoutV1>
  );
};

export default SettingsSso;
