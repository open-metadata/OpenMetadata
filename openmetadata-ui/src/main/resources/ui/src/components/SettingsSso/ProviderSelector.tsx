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

import {
  ArrowUpOutlined,
  LockOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Auth0Icon from '../../assets/img/icon-auth0.png';
import CognitoIcon from '../../assets/img/icon-aws-cognito.png';
import AzureIcon from '../../assets/img/icon-azure.png';
import GoogleIcon from '../../assets/img/icon-google.png';
import OktaIcon from '../../assets/img/icon-okta.png';
import { AuthProvider } from '../../generated/settings/settings';
import './ProviderSelector.less';

interface ProviderSelectorProps {
  selectedProvider?: AuthProvider;
  onProviderSelect: (provider: AuthProvider) => void;
}

interface ProviderOption {
  key: AuthProvider;
  label: string;
  icon: string | React.ReactNode;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider: initialSelectedProvider,
  onProviderSelect,
}) => {
  const { t } = useTranslation();
  const [selectedProvider, setSelectedProvider] = useState<
    AuthProvider | undefined
  >(initialSelectedProvider);
  const [hoveredProvider, setHoveredProvider] = useState<
    AuthProvider | undefined
  >();

  const providers: ProviderOption[] = [
    {
      key: AuthProvider.Google,
      label: 'Google',
      icon: GoogleIcon,
    },
    {
      key: AuthProvider.Azure,
      label: 'Azure AD',
      icon: AzureIcon,
    },
    {
      key: AuthProvider.Okta,
      label: 'Okta',
      icon: OktaIcon,
    },
    {
      key: AuthProvider.Saml,
      label: 'SAML',
      icon: <SafetyOutlined />,
    },
    {
      key: AuthProvider.AwsCognito,
      label: 'AWS-Cognito',
      icon: CognitoIcon,
    },
    {
      key: AuthProvider.CustomOidc,
      label: 'Custom-OIDC',
      icon: <LockOutlined />,
    },
    {
      key: AuthProvider.LDAP,
      label: 'Ldap',
      icon: <UserOutlined />,
    },
    {
      key: AuthProvider.Auth0,
      label: 'Auth0',
      icon: Auth0Icon,
    },
  ];

  const handleCardClick = (provider: AuthProvider) => {
    setSelectedProvider(provider);
  };

  const handleConfigureClick = () => {
    if (selectedProvider) {
      onProviderSelect(selectedProvider);
    }
  };

  return (
    <div className="provider-selector-container">
      <div className="provider-selector-header">
        <Typography.Title className="m-b-lg" level={5}>
          {t('label.choose-provider')}
        </Typography.Title>
        <Button
          disabled={!selectedProvider}
          type="primary"
          onClick={handleConfigureClick}>
          {t('label.configure')}
          <ArrowUpOutlined className="configure-arrow" height={12} width={12} />
        </Button>
      </div>

      <div
        className="provider-grid"
        onMouseLeave={() => setHoveredProvider(undefined)}>
        {providers.map((provider) => (
          <div
            className={`provider-item ${
              selectedProvider === provider.key &&
              (!hoveredProvider || hoveredProvider === provider.key)
                ? 'selected'
                : ''
            }`}
            key={provider.key}
            onClick={() => handleCardClick(provider.key)}
            onMouseEnter={() => setHoveredProvider(provider.key)}>
            <div className="provider-icon">
              <div className="provider-icon-inner">
                {typeof provider.icon === 'string' ? (
                  <img
                    alt={provider.label}
                    height="24"
                    src={provider.icon}
                    width="24"
                  />
                ) : (
                  provider.icon
                )}
              </div>
            </div>
            <span className="provider-name">{provider.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProviderSelector;
