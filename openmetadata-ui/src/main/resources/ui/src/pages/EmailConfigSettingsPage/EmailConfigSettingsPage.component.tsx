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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Card, Col, Row, Typography } from 'antd';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import EditEmailConfigModal from 'components/EditEmailConfigModal/EditEmailConfigModal.component';
import PageHeader from 'components/header/PageHeader.component';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { SMTPSettings } from 'generated/email/smtpSettings';
import { Settings, SettingType } from 'generated/settings/settings';
import { isBoolean, isEmpty, isNumber, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from 'rest/emailConfigAPI';
import { getEmailConfigFieldLabels } from 'utils/EmailConfigUtils';
import { ReactComponent as IconEdit } from '../../assets/svg/ic-edit.svg';

function EmailConfigSettingsPage() {
  const { t } = useTranslation();

  const [emailConfigValues, setEmailConfigValues] = useState<SMTPSettings>();
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  const toggleEditMode = () => setShowEditModal((value) => !value);

  const fetchEmailConfigValues = useCallback(async () => {
    const { data } = await getSettingsConfigFromConfigType(
      SettingType.EmailConfiguration
    );

    setEmailConfigValues(data.config_value as SMTPSettings);
  }, [setEmailConfigValues]);

  const updateEmailConfigValues = useCallback(
    async (configValues: SMTPSettings) => {
      const settingsConfigData: Settings = {
        config_type: SettingType.EmailConfiguration,
        config_value: configValues,
      };
      const { data } = await updateSettingsConfig(settingsConfigData);

      setEmailConfigValues(data.config_value as SMTPSettings);
    },
    [setEmailConfigValues]
  );

  const configValues = useMemo(() => {
    if (isUndefined(emailConfigValues)) {
      return null;
    }

    return Object.keys(emailConfigValues).map((configValue) => {
      const title = getEmailConfigFieldLabels(configValue);
      const emailConfigValue =
        emailConfigValues[configValue as keyof SMTPSettings];
      const displayValue =
        isBoolean(emailConfigValue) || isNumber(emailConfigValue)
          ? `${emailConfigValue}`
          : emailConfigValue;

      return (
        <Col key={title} span={12}>
          <Row align="middle">
            <Col span={24}>
              <Typography.Text className="m-0 text-grey-muted">
                {`${title}:`}
              </Typography.Text>
            </Col>
            <Col span={24}>
              <Typography.Text className="">
                {isEmpty(displayValue) ? '--' : displayValue}
              </Typography.Text>
            </Col>
          </Row>
        </Col>
      );
    });
  }, [emailConfigValues]);

  const configValuesContainer = useMemo(() => {
    if (isUndefined(emailConfigValues)) {
      return (
        <ErrorPlaceHolder
          classes="mt-24"
          heading={t('label.email-configuration-lowercase')}
          type={ERROR_PLACEHOLDER_TYPE.ADD}
        />
      );
    }

    return (
      <Card>
        <Typography.Title level={5}>
          {t('label.email-configuration')}
        </Typography.Title>
        <Row align="middle" className="m-t-md" gutter={[16, 16]}>
          {configValues}
        </Row>
      </Card>
    );
  }, [emailConfigValues, configValues]);

  useEffect(() => {
    fetchEmailConfigValues();
  }, []);

  return (
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <Row align="middle" justify="space-between">
          <Col>
            <PageHeader
              data={{
                header: t('label.email'),
                subHeader: t('message.email-configuration-message'),
              }}
            />
          </Col>
          <Col>
            <Button
              icon={
                !isUndefined(emailConfigValues) && (
                  <Icon component={IconEdit} size={12} />
                )
              }
              onClick={toggleEditMode}>
              {isUndefined(emailConfigValues)
                ? t('label.add')
                : t('label.edit')}
            </Button>
          </Col>
        </Row>
      </Col>
      <Col span={24}>{configValuesContainer}</Col>

      <EditEmailConfigModal
        emailConfigValues={emailConfigValues}
        showModal={showEditModal}
        onCancel={toggleEditMode}
        onSubmit={updateEmailConfigValues}
      />
    </Row>
  );
}

export default EmailConfigSettingsPage;
