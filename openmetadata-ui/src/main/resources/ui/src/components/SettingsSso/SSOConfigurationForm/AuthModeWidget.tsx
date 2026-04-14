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

import { WidgetProps } from '@rjsf/utils';
import { Alert, Radio, Space, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const AuthModeWidget: React.FC<WidgetProps> = ({
  value,
  onChange,
  disabled,
  readonly,
}) => {
  const { t } = useTranslation();

  return (
    <div className="m-b-md">
      <Typography.Text strong className="m-b-xs d-block">
        {t('label.authentication-mode')}
      </Typography.Text>
      <Radio.Group
        disabled={disabled || readonly}
        value={value ?? 'confidential'}
        onChange={(e) => onChange(e.target.value)}>
        <Space direction="vertical">
          <Radio value="confidential">
            <Typography.Text strong>
              {t('label.with-client-secret')}
            </Typography.Text>
            <Typography.Text className="text-grey-muted d-block text-xs">
              {t('message.with-client-secret-description')}
            </Typography.Text>
          </Radio>
          <Radio value="public">
            <Typography.Text>{t('label.without-client-secret')}</Typography.Text>
            <Typography.Text className="text-grey-muted d-block text-xs">
              {t('message.without-client-secret-description')}
            </Typography.Text>
          </Radio>
        </Space>
      </Radio.Group>
      {value === 'public' && (
        <Alert
          className="m-t-sm"
          message={t('message.public-client-warning')}
          showIcon
          type="warning"
        />
      )}
    </div>
  );
};

export default AuthModeWidget;
