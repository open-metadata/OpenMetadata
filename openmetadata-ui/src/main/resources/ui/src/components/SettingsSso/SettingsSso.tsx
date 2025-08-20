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
import Auth0Icon from '../../assets/img/icon-auth0.png';
import CognitoIcon from '../../assets/img/icon-aws-cognito.png';
import AzureIcon from '../../assets/img/icon-azure.png';
import GoogleIcon from '../../assets/img/icon-google.png';
import OktaIcon from '../../assets/img/icon-okta.png';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { AuthProvider } from '../../generated/settings/settings';
import { getSecurityConfiguration } from '../../rest/securityConfigAPI';
import '../../styles/variables.less';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import ssoUtilClassBase from '../../utils/SSOUtilClassBase';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../PageLayoutV1/PageLayoutV1';
import ProviderSelector from './ProviderSelector';
import './SettingsSso.less';
import SSOConfigurationFormRJSF from './SSOConfigurationForm';

const SettingsSso = () => {
  const { t } = useTranslation();
  const [hasExistingConfig, setHasExistingConfig] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('configure');
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [showProviderSelector, setShowProviderSelector] =
    useState<boolean>(false);
  const [ssoEnabled, setSsoEnabled] = useState<boolean>(true);

  const getProviderDisplayName = (provider: string) => {
    return provider === 'azure'
      ? 'Azure AD'
      : provider === 'google'
      ? 'Google'
      : provider === 'okta'
      ? 'Okta'
      : provider === 'auth0'
      ? 'Auth0'
      : provider === 'awsCognito'
      ? 'AWS Cognito'
      : provider?.charAt(0).toUpperCase() + provider?.slice(1);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'azure':
        return AzureIcon;
      case 'google':
        return GoogleIcon;
      case 'okta':
        return OktaIcon;
      case 'auth0':
        return Auth0Icon;
      case 'awsCognito':
        return CognitoIcon;
      default:
        return null;
    }
  };

  const breadcrumb = useMemo(() => {
    const baseBreadcrumb = getSettingPageEntityBreadCrumb(
      GlobalSettingsMenuCategory.SSO
    );

    // Add provider name to breadcrumb if we have a current provider (existing or newly selected)
    if (currentProvider) {
      const providerDisplayName = getProviderDisplayName(currentProvider);

      return [
        ...baseBreadcrumb,
        {
          name: providerDisplayName,
          url: '',
        },
      ];
    }

    return baseBreadcrumb;
  }, [currentProvider]);

  // Check for existing SSO configuration
  useEffect(() => {
    const checkExistingConfig = async () => {
      try {
        const response = await getSecurityConfiguration();
        const config = response.data;

        if (config?.authenticationConfiguration?.provider) {
          if (config.authenticationConfiguration.provider !== 'basic') {
            setHasExistingConfig(true);
            setSsoEnabled(
              config.authenticationConfiguration.enableSelfSignup || false
            );

            // Set default tab based on provider - Overview for Google, Azure and Okta
            const provider =
              config.authenticationConfiguration.provider.toLowerCase();
            if (
              provider === 'azure' ||
              provider === 'okta' ||
              provider === 'google'
            ) {
              setActiveTab('overview');
            } else {
              setActiveTab('configure');
            }
          } else {
            setHasExistingConfig(false);
            setActiveTab('configure');
          }
          // Always set current provider for breadcrumb display
          setCurrentProvider(config.authenticationConfiguration.provider);
        } else {
          setHasExistingConfig(false);
          setActiveTab('configure');
        }
      } catch (error) {
        setHasExistingConfig(false);
        setActiveTab('configure');
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingConfig();
  }, []);

  const renderAccessTokenCard = () => {
    const AccessTokenCardComponent =
      ssoUtilClassBase.getAccessTokenCardComponent();
    if (!AccessTokenCardComponent) {
      return null;
    }

    return (
      <div className="m-t-md m-b-md">
        <AccessTokenCardComponent />
      </div>
    );
  };

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  const handleProviderSelect = useCallback((provider: AuthProvider) => {
    setCurrentProvider(provider);
    setShowProviderSelector(false);

    // Clear existing configuration state since we're changing providers
    setHasExistingConfig(false);
  }, []);

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

  // If showing provider selector
  if (showProviderSelector) {
    return (
      <PageLayoutV1 pageTitle={t('label.sso')}>
        <TitleBreadcrumb
          titleLinks={getSettingPageEntityBreadCrumb(
            GlobalSettingsMenuCategory.SSO
          )}
        />
        {renderAccessTokenCard()}
        <div className="m-t-lg">
          <ProviderSelector
            selectedProvider={currentProvider as AuthProvider}
            onProviderSelect={handleProviderSelect}
          />
        </div>
      </PageLayoutV1>
    );
  }

  // If no existing configuration, show the form directly without tabs
  if (!isLoading && !hasExistingConfig) {
    return (
      <PageLayoutV1 pageTitle={t('label.sso')}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
        {renderAccessTokenCard()}

        {/* Show provider header if we have a selected provider (from change provider flow) */}
        {currentProvider && (
          <div className="sso-provider-header">
            <div className="flex align-items-center gap-3">
              <div className="provider-icon-container">
                {getProviderIcon(currentProvider) && (
                  <img
                    alt={getProviderDisplayName(currentProvider)}
                    height="32"
                    src={getProviderIcon(currentProvider)}
                    width="32"
                  />
                )}
              </div>
              <Typography.Title className="m-0" level={4}>
                {getProviderDisplayName(currentProvider)}
              </Typography.Title>
            </div>
          </div>
        )}

        <SSOConfigurationFormRJSF selectedProvider={currentProvider} />
      </PageLayoutV1>
    );
  }

  // If loading, show loading state
  if (isLoading) {
    return (
      <PageLayoutV1 pageTitle={t('label.sso')}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
        {renderAccessTokenCard()}

        <SSOConfigurationFormRJSF />
      </PageLayoutV1>
    );
  }

  // If existing configuration, show tabs
  const tabItems = [];

  // Overview tab for Google, Azure and Okta providers
  const providerLower = currentProvider.toLowerCase();
  if (
    providerLower === 'azure' ||
    providerLower === 'okta' ||
    providerLower === 'google'
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
              <div>
                <Typography.Title className="m-b-xs" level={5}>
                  {t('label.enable-sso')}
                </Typography.Title>
                <Typography.Text type="secondary">
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
        <SSOConfigurationFormRJSF
          hideBorder
          forceEditMode={activeTab === 'configure'}
        />
      </div>
    ),
  });

  // For all configured SSO providers, show tabs
  return (
    <PageLayoutV1 pageTitle={t('label.sso')}>
      <TitleBreadcrumb titleLinks={breadcrumb} />

      <div className="settings-sso" style={{ background: 'white' }}>
        {/* Provider Header - Outside tabs */}
        {!hasExistingConfig && !currentProvider && (
          <div className="sso-provider-header">
            <div className="flex align-items-center gap-3">
              <div className="provider-icon-container">
                {getProviderIcon(currentProvider) && (
                  <img
                    alt={getProviderDisplayName(currentProvider)}
                    height="32"
                    src={getProviderIcon(currentProvider)}
                    width="32"
                  />
                )}
              </div>
              <Typography.Title className="m-0" level={4}>
                {getProviderDisplayName(currentProvider)}
              </Typography.Title>
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
