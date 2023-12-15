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
import { Button, Col, Row, Skeleton, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isBoolean, isEmpty, isNumber, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { ROUTES } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { SMTPSettings } from '../../generated/email/smtpSettings';
import { SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  testEmailConnection,
} from '../../rest/settingConfigAPI';
import { getEmailConfigFieldLabels } from '../../utils/EmailConfigUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

function EmailConfigSettingsPage() {
  const { t } = useTranslation();
  const history = useHistory();

  const [emailConfigValues, setEmailConfigValues] = useState<SMTPSettings>();
  const [loading, setLoading] = useState<boolean>(false);

  const fetchEmailConfigValues = useCallback(async () => {
    try {
      setLoading(true);

      const { data } = await getSettingsConfigFromConfigType(
        SettingType.EmailConfiguration
      );

      setEmailConfigValues(data.config_value as SMTPSettings);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.email-configuration-lowercase'),
        })
      );
    } finally {
      setLoading(false);
    }
  }, [setEmailConfigValues]);

  const handleEditClick = () => {
    history.push(ROUTES.SETTINGS_EDIT_EMAIL_CONFIG);
  };

  const handleTestEmailConnection = async () => {
    try {
      const res = await testEmailConnection(
        emailConfigValues?.senderMail ?? ''
      );

      showSuccessToast(res.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const configValues = useMemo(() => {
    if (isUndefined(emailConfigValues)) {
      return null;
    }

    const emailConfigFieldsArray = Object.keys(emailConfigValues).sort();

    return emailConfigFieldsArray.map((configValue) => {
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
    if (isUndefined(emailConfigValues) && !loading) {
      return (
        <ErrorPlaceHolder
          className="mt-24"
          heading={t('label.email-configuration-lowercase')}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
        />
      );
    }

    return (
      <>
        {loading ? (
          <Skeleton title paragraph={{ rows: 8 }} />
        ) : (
          <>
            <Row align="middle" gutter={[16, 16]}>
              {configValues}
            </Row>
          </>
        )}
      </>
    );
  }, [loading, emailConfigValues, configValues]);

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
            <Space>
              <Button type="primary" onClick={handleTestEmailConnection}>
                {t('label.test-email')}
              </Button>

              <Button
                icon={
                  !isUndefined(emailConfigValues) && (
                    <Icon component={IconEdit} size={12} />
                  )
                }
                onClick={handleEditClick}>
                {isUndefined(emailConfigValues)
                  ? t('label.add')
                  : t('label.edit')}
              </Button>
            </Space>
          </Col>
        </Row>
      </Col>
      <Col span={24}>{configValuesContainer}</Col>
    </Row>
  );
}

export default EmailConfigSettingsPage;
