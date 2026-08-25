/*
 *  Copyright 2023 Collate.
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
import { Typography } from 'antd';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../generated/settings/settings';
import {
  getProviderDisplayName,
  getProviderIcon,
} from '../../../utils/SSOUtils';
import ServiceDocPanel from '../../common/ServiceDocPanel/ServiceDocPanel';
import './sso-doc-panel.less';
import { FIELD_MAPPINGS, PROVIDER_FILE_MAP } from './SSODocPanel.constants';

interface SSODocPanelProp {
  serviceName: string;
  activeField?: string;
}

/**
 * Resolves an SSO schema field name to its documentation data-id via FIELD_MAPPINGS.
 * Schema field names (e.g. "secret", "redirectUrl") often differ from the data-id
 * values used in the markdown docs (e.g. "clientSecret", "callbackUrl").
 */
const resolveActiveField = (activeField?: string): string | undefined => {
  if (!activeField) {
    return activeField;
  }

  const parts = activeField.split('/');
  const fieldName = parts[parts.length - 1] ?? '';
  const lowerFieldName = fieldName.toLowerCase();

  if (FIELD_MAPPINGS[fieldName]) {
    return FIELD_MAPPINGS[fieldName];
  }

  for (const [key, value] of Object.entries(FIELD_MAPPINGS)) {
    if (
      lowerFieldName.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(lowerFieldName)
    ) {
      return value;
    }
  }

  return activeField;
};

const SSODocPanel: FC<SSODocPanelProp> = ({ serviceName, activeField }) => {
  const { t } = useTranslation();

  const resolvedField = useMemo(
    () => resolveActiveField(activeField),
    [activeField]
  );

  const resolvedServiceName = PROVIDER_FILE_MAP[serviceName] ?? serviceName;

  return (
    <div className="sso-doc-panel">
      <div className="sso-doc-header">
        {getProviderIcon(serviceName) && (
          <div className="sso-provider-icon">
            <img
              alt={`${serviceName} icon`}
              height={22}
              src={getProviderIcon(serviceName) as string}
              width={22}
            />
          </div>
        )}
        <Typography.Title className="sso-provider-title text-md">
          {serviceName === AuthProvider.Basic
            ? t('label.basic-configuration')
            : `${getProviderDisplayName(serviceName)} ${t(
                'label.sso-configuration'
              )}`}
        </Typography.Title>
      </div>
      <ServiceDocPanel
        activeField={resolvedField}
        serviceName={resolvedServiceName}
        serviceType="SSO"
      />
    </div>
  );
};

export default SSODocPanel;
