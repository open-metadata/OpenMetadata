/*
 *  Copyright 2022 Collate.
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
import { Button, Col, Form, Row, Switch, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GRAYED_OUT_COLOR, ROUTES } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { SearchSettings } from '../../generated/configuration/searchSettings';
import { getSearchSettings } from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const SearchRBACSettingsPage = () => {
  const { t } = useTranslation();
  const history = useHistory();

  const [isLoading, setIsLoading] = useState(true);
  const [searchConfig, setSearchConfig] = useState<SearchSettings>();

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.ACCESS,
        t('label.search-rbac')
      ),
    []
  );

  const fetchSearchConfig = async () => {
    try {
      setIsLoading(true);

      const loginConfig = await getSearchSettings();

      setSearchConfig(loginConfig);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateClick = () => {
    history.push(ROUTES.SETTINGS_EDIT_CUSTOM_LOGIN_CONFIG);
  };

  useEffect(() => {
    fetchSearchConfig();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.login')}>
      <Form
        initialValues={{ ...searchConfig }}
        layout="inline"
        onFinish={handleUpdateClick}>
        <Row className="page-container" gutter={[0, 16]}>
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
                  data-testid="save-button"
                  htmlType="submit"
                  type="primary">
                  {t('label.update')}
                </Button>
              </Col>
            </Row>
          </Col>
          <Col span={12}>
            <Row align="middle">
              <Col span={24}>
                <Typography.Text className="m-0 text-grey-muted">
                  {t('label.enable-access-control')}
                  <Tooltip
                    placement="top"
                    title={t('message.enable-access-control')}
                    trigger="hover">
                    <InfoCircleOutlined
                      className="m-x-xss"
                      data-testid="enable-access-control-info"
                      style={{ color: GRAYED_OUT_COLOR }}
                    />
                  </Tooltip>
                </Typography.Text>
                <Form.Item name="enableAccessControl">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
          </Col>
        </Row>
      </Form>
    </PageLayoutV1>
  );
};

export default SearchRBACSettingsPage;
