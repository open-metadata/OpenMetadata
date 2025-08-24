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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import Auth0Icon from '../../assets/img/icon-auth0.png';
import CognitoIcon from '../../assets/img/icon-aws-cognito.png';
import AzureIcon from '../../assets/img/icon-azure.png';
import GoogleIcon from '../../assets/img/icon-google.png';
import OktaIcon from '../../assets/img/icon-okta.png';
import SSOIcon from '../../assets/svg/sso-settings.svg';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { AuthProvider } from '../../generated/settings/settings';
import { getSecurityConfiguration } from '../../rest/securityConfigAPI';
import '../../styles/variables.less';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import ssoUtilClassBase from '../../utils/SSOUtilClassBase';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../PageLayoutV1/PageLayoutV1';
import ProviderSelector from './ProviderSelector';
import './SettingsSso.less';
import SSOConfigurationForm from './SSOConfigurationForm';

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

  const getProviderDisplayName = (provider: string) => {
    return provider === AuthProvider.Azure
      ? 'Azure AD'
      : provider === AuthProvider.Google
      ? 'Google'
      : provider === AuthProvider.Okta
      ? 'Okta'
      : provider === AuthProvider.Auth0
      ? 'Auth0'
      : provider === AuthProvider.AwsCognito
      ? 'AWS Cognito'
      : provider?.charAt(0).toUpperCase() + provider?.slice(1);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case AuthProvider.Azure:
        return AzureIcon;
      case AuthProvider.Google:
        return GoogleIcon;
      case AuthProvider.Okta:
        return OktaIcon;
      case AuthProvider.Auth0:
        return Auth0Icon;
      case AuthProvider.AwsCognito:
        return CognitoIcon;
      case AuthProvider.LDAP:
        return SSOIcon;
      case AuthProvider.Saml:
        return SSOIcon;
      default:
        return null;
    }
  };

  const breadcrumb = useMemo(() => {
    const baseBreadcrumb = getSettingPageEntityBreadCrumb(
      GlobalSettingsMenuCategory.SSO
    );

    // For configured SSO providers, show "Settings > Provider Name"
    if (
      currentProvider &&
      currentProvider !== AuthProvider.Basic &&
      hasExistingConfig
    ) {
      const providerDisplayName = getProviderDisplayName(currentProvider);

      const updatedBreadcrumb = [...baseBreadcrumb];
      updatedBreadcrumb[updatedBreadcrumb.length - 1] = {
        name: providerDisplayName,
        url: '',
        activeTitle: true,
      };

      return updatedBreadcrumb;
    }

    // For new provider configuration, show "Settings > SSO > Provider Name"
    if (
      currentProvider &&
      currentProvider !== AuthProvider.Basic &&
      !hasExistingConfig
    ) {
      const providerDisplayName = getProviderDisplayName(currentProvider);

      const updatedBaseBreadcrumb = baseBreadcrumb.map((item, index) => {
        if (index === baseBreadcrumb.length - 1) {
          return {
            ...item,
            url: getSettingPath(GlobalSettingsMenuCategory.SSO),
            activeTitle: false,
          };
        }

        return item;
      });

      return [
        ...updatedBaseBreadcrumb,
        {
          name: providerDisplayName,
          url: '',
          activeTitle: true,
        },
      ];
    }

    return baseBreadcrumb;
  }, [currentProvider, hasExistingConfig]);

  // Check URL parameters for provider selection
  useEffect(() => {
    const providerParam = searchParams.get('provider');
    if (
      providerParam &&
      Object.values(AuthProvider).includes(providerParam as AuthProvider)
    ) {
      setCurrentProvider(providerParam);
      setShowProviderSelector(false);
    } else {
      setShowProviderSelector(false);
      setCurrentProvider('');
    }
  }, [searchParams]);

  // Check for existing SSO configuration
  useEffect(() => {
    const checkExistingConfig = async () => {
      try {
        const response = await getSecurityConfiguration();
        const config = response.data;

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
          } else {
            setHasExistingConfig(false);
            setActiveTab('configure');
          }
          // Set current provider for breadcrumb display only if no URL parameter
          const providerParam = searchParams.get('provider');
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
          setShowProviderSelector(true);
        }
      } catch (error) {
        setHasExistingConfig(false);
        setActiveTab('configure');
        setShowProviderSelector(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingConfig();
  }, [searchParams]);

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

  const handleSSOToggle = useCallback(async (checked: boolean) => {
    setSsoEnabled(checked);

    try {
      const response = await getSecurityConfiguration();
      const config = response.data;

      if (config?.authenticationConfiguration) {
        const updatedConfig = {
          ...config,
          authenticationConfiguration: {
            ...config.authenticationConfiguration,
            enableSelfSignup: checked,
          },
        };

        // Apply the updated configuration
        const { applySecurityConfiguration } = await import(
          '../../rest/securityConfigAPI'
        );
        await applySecurityConfiguration(updatedConfig);
      }
    } catch (error) {
      setSsoEnabled(!checked);
    }
  }, []);

  const handleChangeProvider = useCallback(() => {
    setSearchParams({});

    setShowProviderSelector(true);
    setCurrentProvider('');
    setHasExistingConfig(false);
    setActiveTab('configure');
    setSsoEnabled(true);
  }, [setSearchParams]);

  // If showing provider selector
  if (showProviderSelector) {
    return (
      <PageLayoutV1 className="sso-settings-page" pageTitle={t('label.sso')}>
        <TitleBreadcrumb className="m-b-xs" titleLinks={breadcrumb} />

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
  if (!isLoading && !hasExistingConfig) {
    return (
      <PageLayoutV1 className="sso-settings-page" pageTitle={t('label.sso')}>
        <TitleBreadcrumb className="m-b-xs" titleLinks={breadcrumb} />

        <SSOConfigurationForm
          selectedProvider={currentProvider}
          onProviderSelect={handleProviderSelect}
        />
      </PageLayoutV1>
    );
  }

  if (isLoading) {
    return (
      <PageLayoutV1 className="sso-settings-page" pageTitle={t('label.sso')}>
        <TitleBreadcrumb className="m-b-xs" titleLinks={breadcrumb} />

        <SSOConfigurationForm />
      </PageLayoutV1>
    );
  }

  // If existing configuration, show tabs
  const tabItems = [];

  // Overview tab for Google, Azure and Okta providers
  if (
    currentProvider === AuthProvider.Azure ||
    currentProvider === AuthProvider.Okta
  ) {
    const renderOverviewContent = () => {
      // Get the SCIM access token card component
      const SCIMAccessTokenCard =
        ssoUtilClassBase.getSCIMAccessTokenCardComponent?.();

      return (
        <div>
          {/* Enable SSO section */}
          <div className="enable-sso-card-container">
            <div className="flex justify-between items-center">
              <div className="flex flex-col  gap-2">
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

          {/* SCIM Provisioning section */}

          {/* SCIM Access Token Card - only show if available */}
          {SCIMAccessTokenCard && <SCIMAccessTokenCard />}
        </div>
      );
    };

    tabItems.push({
      key: 'overview',
      label: t('label.overview'),
      children: renderOverviewContent(),
    });
  }

  // Configure tab always present for existing configurations
  tabItems.push({
    key: 'configure',
    label: t('label.configure'),
    children: (
      <div>
        <SSOConfigurationForm
          hideBorder
          forceEditMode={activeTab === 'configure'}
          onChangeProvider={handleChangeProvider}
        />
      </div>
    ),
  });

  return (
    <PageLayoutV1 className="sso-settings-page" pageTitle={t('label.sso')}>
      <TitleBreadcrumb className="m-b-xs" titleLinks={breadcrumb} />

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
                      src={getProviderIcon(currentProvider)}
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
