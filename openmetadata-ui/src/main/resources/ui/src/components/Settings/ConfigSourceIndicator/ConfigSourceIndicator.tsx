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

import { Alert } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigSourceIndicatorProps } from './ConfigSourceIndicator.interface';

const ConfigSourceIndicator: React.FC<ConfigSourceIndicatorProps> = ({
  configSource,
}) => {
  const { t } = useTranslation();

  if (configSource !== 'ENV') {
    return null;
  }

  return (
    <Alert
      showIcon
      description={t('message.setting-managed-by-env-description')}
      message={t('label.managed-by-env')}
      type="info"
    />
  );
};

export default ConfigSourceIndicator;
