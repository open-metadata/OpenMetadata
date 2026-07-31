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
import { Button, Tooltip } from '@openmetadata/ui-core-components';
import { Col, Row, Space } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import ButtonSkeleton from '../../../components/common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import SettingItemCard from '../../../components/Settings/SettingItemCard/SettingItemCard.component';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ELASTIC_SEARCH_RE_INDEX_PAGE_TABS } from '../../../enums/ElasticSearch.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { TeamType } from '../../../generated/entity/teams/team';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useAuth } from '../../../hooks/authHooks';
import connectionsRouterClassBase from '../../../utils/ConnectionsRouterClassBase';
import globalSettingsClassBase from '../../../utils/GlobalSettingsClassBase';
import {
  getSettingPageEntityBreadCrumb,
  SettingMenuItem,
} from '../../../utils/GlobalSettingsUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  getSettingPath,
  getSettingsPathWithFqn,
  getTeamsWithFqnPath,
} from '../../../utils/RouterUtils';
import { getResourceEntityFromServiceCategory } from '../../../utils/ServicePureUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import '../global-setting-page.style.less';

const GlobalSettingCategoryPage = () => {
  const { t } = useTranslation();
  const { isFetchingStatus } = useAirflowStatus();
  const navigate = useNavigate();
  const { settingCategory } = useRequiredParams<{
    settingCategory: GlobalSettingsMenuCategory;
  }>();
  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();

  const { pathname } = useLocation();
  const isEmbedded = pathname.startsWith('/askCollate');
  const handleAddServiceClick = () => {
    navigate(
      connectionsRouterClassBase.getAddServicePath(
        ServiceCategory.DATABASE_SERVICES
      )
    );
  };

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(() => {
    const crumbs = getSettingPageEntityBreadCrumb(settingCategory);
    if (isEmbedded) {
      const categoryName = crumbs[crumbs.length - 1]?.name ?? '';

      return [
        {
          name: t('label.ask-collate'),
          url: '/askCollate',
        },
        {
          name: t('label.connection-plural'),
          url: '/askCollate/connections',
        },
        {
          name: categoryName,
          url: '',
          activeTitle: true,
        },
      ];
    }

    return crumbs;
  }, [settingCategory, isEmbedded, t]);

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

  const addServicePermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(
        Operation.Create,
        getResourceEntityFromServiceCategory(ServiceCategory.DATABASE_SERVICES),
        permissions
      ),
    [permissions]
  );

  const handleSettingItemClick = useCallback((key: string) => {
    const [category, option] = key.split('.');

    switch (option) {
      case GlobalSettingOptions.TEAMS:
        navigate(getTeamsWithFqnPath(TeamType.Organization));

        break;
      case GlobalSettingOptions.ONLINE_USERS:
        navigate(getSettingPath(category, option));

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
        if (
          connectionsRouterClassBase.isEmbeddedMode() &&
          category === GlobalSettingsMenuCategory.SERVICES
        ) {
          navigate(connectionsRouterClassBase.getSettingsServicesPath(option));
        } else {
          navigate(getSettingPath(category, option));
        }

        break;
    }
  }, []);

  return (
    <PageLayoutV1 pageTitle={t('label.setting-plural')}>
      {isEmbedded && <div className="tw:h-4" />}
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
            {settingCategoryData?.key ===
              GlobalSettingsMenuCategory.SERVICES && (
              <>
                {isFetchingStatus ? (
                  <ButtonSkeleton size="default" />
                ) : (
                  <Tooltip
                    placement="left"
                    title={
                      addServicePermission
                        ? t('label.add-entity', {
                            entity: t('label.service'),
                          })
                        : t(NO_PERMISSION_FOR_ACTION)
                    }>
                    {addServicePermission && (
                      <LimitWrapper resource="dataAssets">
                        <Button
                          className="m-b-xs"
                          data-testid="add-service-button"
                          type="primary"
                          onClick={handleAddServiceClick}>
                          {t('label.add-new-entity', {
                            entity: t('label.service'),
                          })}
                        </Button>
                      </LimitWrapper>
                    )}
                  </Tooltip>
                )}
              </>
            )}
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
