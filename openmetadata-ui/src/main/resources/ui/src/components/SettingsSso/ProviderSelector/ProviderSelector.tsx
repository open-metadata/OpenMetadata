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
import {
  getDefaultProviderForProtocol,
  PROTOCOL_OPTIONS,
  SsoProtocol,
} from '../../../utils/SSOUtils';
import './provider-selector.less';
import { ProviderSelectorProps } from './ProviderSelector.interface';

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider: initialSelectedProvider,
  onProviderSelect,
}) => {
  const { t } = useTranslation();
  const [selectedProtocol, setSelectedProtocol] = useState<
    SsoProtocol | undefined
  >();

  const handleCardClick = (protocol: SsoProtocol) => {
    setSelectedProtocol(protocol);
  };

  const handleConfigureClick = () => {
    if (selectedProtocol) {
      const provider = getDefaultProviderForProtocol(selectedProtocol);

      onProviderSelect(provider);
    }
  };

  return (
    <div className="provider-selector-container">
      <div className="provider-selector-header">
        <Typography.Title className="m-b-lg" level={5}>
          {t('label.choose-protocol')}
        </Typography.Title>
        <Button
          disabled={!selectedProtocol}
          type="primary"
          onClick={handleConfigureClick}>
          {t('label.configure')}
          <ArrowUpOutlined className="configure-arrow" height={12} width={12} />
        </Button>
      </div>

      <div className="provider-selection-container d-flex flex-wrap">
        {PROTOCOL_OPTIONS.map((protocol) => (
          <div
            className={`provider-item ${
              selectedProtocol === protocol.key ? 'selected' : ''
            }`}
            key={protocol.key}
            onClick={() => handleCardClick(protocol.key)}>
            <div className="provider-icon">
              <div className="provider-icon-inner">
                <img
                  alt={protocol.label}
                  height="24"
                  src={protocol.icon}
                  width="24"
                />
              </div>
            </div>
            <span className="provider-name">{protocol.label}</span>
            <span className="provider-description">{protocol.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProviderSelector;
