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
import Icon from '@ant-design/icons';
import { Button, Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { NO_DATA_PLACEHOLDER, ROUTES } from '../../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { OpenMetadataBaseURLConfiguration } from '../../../generated/configuration/openMetadataBaseUrlConfiguration';
import { SettingType } from '../../../generated/settings/settings';
import { getSettingsConfigFromConfigType } from '../../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const UrlConfigurationPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [urlConfig, setUrlConfig] =
    useState<OpenMetadataBaseURLConfiguration>();

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.entity-configuration', {
          entity: t('label.open-metadata-url'),
        })
      ),
    []
  );

  const fetchUrlConfig = async () => {
    try {
      setLoading(true);

      const { data } = await getSettingsConfigFromConfigType(
        SettingType.OpenMetadataBaseURLConfiguration
      );

      setUrlConfig(data.config_value as OpenMetadataBaseURLConfiguration);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    navigate(ROUTES.SETTINGS_OM_URL_CONFIG);
  };

  useEffect(() => {
    fetchUrlConfig();
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-configuration', {
        entity: t('label.url-uppercase'),
      })}>
      <Row className="bg-white p-lg border-radius-sm" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Row align="middle" justify="space-between">
            <Col>
              <PageHeader data={PAGE_HEADERS.OM_URL_CONFIG} />
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
                {t('label.open-metadata-url')}
              </Typography.Text>
            </Col>
            <Col span={24}>
              <Typography.Text data-testid="open-metadata-url">
                {urlConfig?.openMetadataUrl
                  ? urlConfig.openMetadataUrl
                  : NO_DATA_PLACEHOLDER}
              </Typography.Text>
            </Col>
          </Row>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default UrlConfigurationPage;
