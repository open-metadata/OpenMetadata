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
import Icon, { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Col, Row, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import IconEdit from '../../../assets/svg/edit-new.svg?react';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import {
  GRAYED_OUT_COLOR,
  NO_DATA_PLACEHOLDER,
  ROUTES,
} from '../../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { LoginConfiguration } from '../../../generated/configuration/loginConfiguration';
import { AuthProvider } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getLoginConfig } from '../../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const LoginConfigurationPage = () => {
  const { t } = useTranslation();
  const { authConfig } = useApplicationStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [loginConfig, setLoginConfig] = useState<LoginConfiguration>();

  const isBasicAuth = useMemo(() => {
    return (
      authConfig?.provider === AuthProvider.Basic ||
      authConfig?.provider === AuthProvider.LDAP
    );
  }, [authConfig]);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.login-configuration')
      ),
    []
  );

  const fetchLoginConfig = async () => {
    try {
      setLoading(true);

      const loginConfig = await getLoginConfig();

      setLoginConfig(loginConfig);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    navigate(ROUTES.SETTINGS_EDIT_CUSTOM_LOGIN_CONFIG);
  };

  useEffect(() => {
    if (isBasicAuth) {
      fetchLoginConfig();
    }
  }, [isBasicAuth]);

  if (loading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.login-configuration')}>
      <Row className="p-lg bg-white border-radius-sm" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Row align="middle" justify="space-between">
            <Col>
              <PageHeader data={PAGE_HEADERS.LOGIN_CONFIGURATION} />
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
        <Col span={12}>
          <Row align="middle">
            <Col span={24}>
              <Typography.Text className="m-0 text-grey-muted">
                {t('label.max-login-fail-attempt-plural')}
                <Tooltip
                  placement="top"
                  title={t('message.login-fail-attempt-message')}
                  trigger="hover">
                  <InfoCircleOutlined
                    className="m-x-xss"
                    data-testid="max-login-fail-attampts-url-info"
                    style={{ color: GRAYED_OUT_COLOR }}
                  />
                </Tooltip>
              </Typography.Text>
            </Col>
            <Col span={24}>
              <Typography.Text data-testid="max-login-fail-attampts">
                {loginConfig?.maxLoginFailAttempts ?? NO_DATA_PLACEHOLDER}
              </Typography.Text>
            </Col>
          </Row>
        </Col>
        <Col span={12}>
          <Row align="middle">
            <Col span={24}>
              <Typography.Text className="m-0 text-grey-muted">
                {t('label.access-block-time')}
                <Tooltip
                  placement="top"
                  title={t('message.access-block-time-message')}
                  trigger="hover">
                  <InfoCircleOutlined
                    className="m-x-xss"
                    data-testid="access-block-time-info"
                    style={{ color: GRAYED_OUT_COLOR }}
                  />
                </Tooltip>
              </Typography.Text>
            </Col>
            <Col span={24}>
              <Typography.Text data-testid="access-block-time">
                {loginConfig?.accessBlockTime ?? NO_DATA_PLACEHOLDER}
              </Typography.Text>
            </Col>
          </Row>
        </Col>
        <Col span={12}>
          <Row align="middle">
            <Col span={24}>
              <Typography.Text className="m-0 text-grey-muted">
                {t('label.jwt-token-expiry-time')}
                <Tooltip
                  placement="top"
                  title={t('message.jwt-token-expiry-time-message')}
                  trigger="hover">
                  <InfoCircleOutlined
                    className="m-x-xss"
                    data-testid="jwt-token-expiry-time-info"
                    style={{ color: GRAYED_OUT_COLOR }}
                  />
                </Tooltip>
              </Typography.Text>
            </Col>
            <Col span={24}>
              <Typography.Text data-testid="jwt-token-expiry-time">
                {loginConfig?.jwtTokenExpiryTime ?? NO_DATA_PLACEHOLDER}{' '}
                {t('label.second-plural')}
              </Typography.Text>
            </Col>
          </Row>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default LoginConfigurationPage;
