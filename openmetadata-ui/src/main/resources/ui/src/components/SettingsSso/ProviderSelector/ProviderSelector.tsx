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

import { ArrowUpOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../generated/settings/settings';
import { PROVIDER_OPTIONS } from '../../../utils/SSOUtils';
import './provider-selector.less';
import { ProviderSelectorProps } from './ProviderSelector.interface';

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider: initialSelectedProvider,
  onProviderSelect,
}) => {
  const { t } = useTranslation();
  const [selectedProvider, setSelectedProvider] = useState<
    AuthProvider | undefined
  >(initialSelectedProvider);

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

      <div className="provider-selection-container d-flex flex-wrap">
        {PROVIDER_OPTIONS.map((provider) => (
          <div
            className={`provider-item ${
              selectedProvider === provider.key ? 'selected' : ''
            }`}
            key={provider.key}
            onClick={() => handleCardClick(provider.key)}>
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
