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
import { Col, Row, Switch, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GRAYED_OUT_COLOR } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { SearchSettings } from '../../generated/configuration/searchSettings';
import { Settings, SettingType } from '../../generated/settings/settings';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const SearchRBACSettingsPage = () => {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [searchConfig, setSearchConfig] = useState<SearchSettings>();
  const [isUpdating, setIsUpdating] = useState(false);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.search')
      ),
    []
  );

  const fetchSearchConfig = async () => {
    try {
      setIsLoading(true);

      const loginConfig = await getSettingsByType(SettingType.SearchSettings);

      setSearchConfig(loginConfig as SearchSettings);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateClick = async (enabled: boolean) => {
    try {
      setIsUpdating(true);

      const configData = {
        config_type: SettingType.SearchSettings,
        config_value: { ...searchConfig, enableAccessControl: enabled },
      };
      const { data } = await updateSettingsConfig(configData as Settings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.search-rbac'),
        })
      );

      setSearchConfig(data.config_value as SearchSettings);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchSearchConfig();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.search-rbac')}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Row align="middle" justify="space-between">
            <Col>
              <PageHeader isBeta data={PAGE_HEADERS.SEARCH_RBAC} />
            </Col>
          </Row>
        </Col>
        <Col className="d-flex items-center" span={12}>
          <Typography.Text className="m-0 text-grey-muted">
            {t('label.enable-roles-polices-in-search')}
            <Tooltip
              placement="top"
              title={t('message.enable-access-control-description')}
              trigger="hover">
              <InfoCircleOutlined
                className="m-x-xss"
                data-testid="enable-access-control-info"
                style={{ color: GRAYED_OUT_COLOR }}
              />
            </Tooltip>
          </Typography.Text>
          <Switch
            checked={searchConfig?.globalSettings?.enableAccessControl}
            className="m-l-xlg"
            disabled={isUpdating}
            onChange={handleUpdateClick}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default SearchRBACSettingsPage;
