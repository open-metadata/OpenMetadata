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
import { InfoCircleOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Col, Row, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageHeader from '../../components/header/PageHeader.component';
import Loader from '../../components/Loader/Loader';
import { GRAYED_OUT_COLOR, ROUTES } from '../../constants/constants';
import { CUSTOM_LOGO_DOCS } from '../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { LogoConfiguration } from '../../generated/configuration/applicationConfiguration';
import { SettingType } from '../../generated/settings/settings';
import { getSettingsConfigFromConfigType } from '../../rest/settingConfigAPI';
import { showErrorToast } from '../../utils/ToastUtils';

const CustomLogoConfigSettingsPage = () => {
  const { t } = useTranslation();
  const history = useHistory();

  const [loading, setLoading] = useState<boolean>(false);
  const [config, setConfig] = useState<LogoConfiguration>();

  const fetchCustomLogoConfig = async () => {
    try {
      setLoading(true);

      const { data } = await getSettingsConfigFromConfigType(
        SettingType.CustomLogoConfiguration
      );

      setConfig(data.config_value as LogoConfiguration);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };
  const handleEditClick = () => {
    history.push(ROUTES.SETTINGS_EDIT_CUSTOM_LOGO_CONFIG);
  };

  useEffect(() => {
    fetchCustomLogoConfig();
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (isUndefined(config)) {
    return (
      <ErrorPlaceHolder
        permission
        doc={CUSTOM_LOGO_DOCS}
        heading={t('label.custom-logo')}
        type={ERROR_PLACEHOLDER_TYPE.CREATE}
        onClick={handleEditClick}
      />
    );
  }

  return (
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <Row align="middle" justify="space-between">
          <Col>
            <PageHeader
              data={{
                header: t('label.custom-logo'),
                subHeader: t('message.custom-logo-configuration-message'),
              }}
            />
          </Col>
          <Col>
            <Button
              data-testid="edit-button"
              icon={<Icon component={IconEdit} size={12} />}
              onClick={handleEditClick}>
              {t('label.edit')}
            </Button>
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        <Row align="middle" gutter={[16, 16]}>
          <Col span={12}>
            <Row align="middle">
              <Col span={24}>
                <Typography.Text className="m-0 text-grey-muted">
                  {t('label.logo-url')}
                  <Tooltip
                    placement="top"
                    title={t('message.custom-logo-url-path-message')}
                    trigger="hover">
                    <InfoCircleOutlined
                      className="m-x-xss"
                      data-testid="logo-url-info"
                      style={{ color: GRAYED_OUT_COLOR }}
                    />
                  </Tooltip>
                </Typography.Text>
              </Col>
              <Col span={24}>
                <Typography.Text data-testid="logo-url">
                  {isEmpty(config?.customLogoUrlPath)
                    ? '--'
                    : config?.customLogoUrlPath}
                </Typography.Text>
              </Col>
            </Row>
          </Col>
          <Col span={12}>
            <Row align="middle">
              <Col span={24}>
                <Typography.Text className="m-0 text-grey-muted">
                  {t('label.monogram-url')}
                  <Tooltip
                    placement="top"
                    title={t('message.custom-monogram-url-path-message')}
                    trigger="hover">
                    <InfoCircleOutlined
                      className="m-x-xss"
                      data-testid="monogram-url-info"
                      style={{ color: GRAYED_OUT_COLOR }}
                    />
                  </Tooltip>
                </Typography.Text>
              </Col>
              <Col span={24}>
                <Typography.Text data-testid="monogram-url">
                  {isEmpty(config?.customMonogramUrlPath)
                    ? '--'
                    : config?.customMonogramUrlPath}
                </Typography.Text>
              </Col>
            </Row>
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default CustomLogoConfigSettingsPage;
