/*
 *  Copyright 2024 Collate.
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
import { Col, Row, Space } from 'antd';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import SettingItemCard from '../../../components/Settings/SettingItemCard/SettingItemCard.component';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ELASTIC_SEARCH_RE_INDEX_PAGE_TABS } from '../../../enums/ElasticSearch.enum';
import { TeamType } from '../../../generated/entity/teams/team';
import { useAuth } from '../../../hooks/authHooks';
import globalSettingsClassBase from '../../../utils/GlobalSettingsClassBase';
import {
  getSettingPageEntityBreadCrumb,
  SettingMenuItem,
} from '../../../utils/GlobalSettingsUtils';
import {
  getSettingPath,
  getSettingsPathWithFqn,
  getTeamsWithFqnPath,
} from '../../../utils/RouterUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import '../global-setting-page.style.less';

const GlobalSettingCategoryPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settingCategory } =
    useRequiredParams<{ settingCategory: GlobalSettingsMenuCategory }>();
  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () => getSettingPageEntityBreadCrumb(settingCategory),
    [settingCategory]
  );

  const settingCategoryData: SettingMenuItem | undefined = useMemo(() => {
    let categoryItem = globalSettingsClassBase
      .getGlobalSettingsMenuWithPermission(permissions, isAdminUser)
      .find((item) => item.key === settingCategory);

    if (categoryItem) {
      categoryItem = {
        ...categoryItem,
        items: categoryItem?.items?.filter((item) => item.isProtected),
      };
    }

    return categoryItem;
  }, [settingCategory, permissions, isAdminUser]);

  const handleSettingItemClick = useCallback((key: string) => {
    const [category, option] = key.split('.');

    switch (option) {
      case GlobalSettingOptions.TEAMS:
        navigate(getTeamsWithFqnPath(TeamType.Organization));

        break;
      case GlobalSettingOptions.SEARCH:
        if (category === GlobalSettingsMenuCategory.PREFERENCES) {
          navigate(
            getSettingsPathWithFqn(
              category,
              option,
              ELASTIC_SEARCH_RE_INDEX_PAGE_TABS.ON_DEMAND
            )
          );
        } else {
          navigate(getSettingPath(category, option));
        }

        break;
      default:
        navigate(getSettingPath(category, option));

        break;
    }
  }, []);

  return (
    <PageLayoutV1 pageTitle={t('label.setting-plural')}>
      <Row gutter={[0, 20]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>

        <Col span={24}>
          <Space className="w-full d-flex justify-between">
            <PageHeader
              data={{
                header: settingCategoryData?.category,
                subHeader: settingCategoryData?.description ?? '',
              }}
            />
          </Space>
        </Col>

        <Col span={24}>
          <Row className={settingCategoryData?.key} gutter={[20, 20]}>
            {settingCategoryData?.items?.map((category) => (
              <Col key={category?.key} lg={8} md={12} sm={24}>
                <SettingItemCard
                  className="global-setting-card"
                  data={category}
                  onClick={handleSettingItemClick}
                />
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default GlobalSettingCategoryPage;
