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

import { Col, Row, Tabs } from 'antd';
import { capitalize, isEmpty, startCase } from 'lodash';
import qs from 'qs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { IngestionPipelineList } from '../../components/Settings/Services/Ingestion/IngestionPipelineList/IngestionPipelineList.component';
import Services from '../../components/Settings/Services/Services';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { SERVICE_CATEGORY } from '../../constants/Services.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { useAuth } from '../../hooks/authHooks';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { userPermissions } from '../../utils/PermissionsUtils';
import { getResourceEntityFromServiceCategory } from '../../utils/ServiceUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './service-page.less';

const ServicesPage = () => {
  const { tab } = useRequiredParams<{ tab: string }>();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const queryParams = qs.parse(
    location.search.startsWith('?')
      ? location.search.substring(1)
      : location.search
  );
  const search =
    queryParams.tab ??
    (tab === GlobalSettingOptions.DATA_OBSERVABILITY
      ? 'pipelines'
      : 'services');

  const serviceName = useMemo(
    () =>
      tab === GlobalSettingOptions.DATA_OBSERVABILITY
        ? 'dataObservabilityServices'
        : SERVICE_CATEGORY[tab] ?? ServiceCategory.DATABASE_SERVICES,
    [tab]
  );

  const { permissions } = usePermissionProvider();

  const viewAllPermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      userPermissions.hasViewPermissions(
        getResourceEntityFromServiceCategory(tab),
        permissions
      )
    );
  }, [permissions]);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.SERVICES,
        tab === GlobalSettingOptions.DATA_OBSERVABILITY
          ? t('label.data-observability')
          : capitalize(tab)
      ),
    []
  );

  return viewAllPermission ? (
    <PageLayoutV1 pageTitle={serviceName}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col className="h-full" span={24}>
          <Tabs
            destroyInactiveTabPane
            activeKey={search as string}
            className="tabs-new services-tabs"
            items={[
              ...(serviceName === 'dataObservabilityServices'
                ? []
                : [
                    {
                      key: 'services',
                      children: <Services serviceName={serviceName} />,
                      label: 'Services',
                    },
                  ]),
              ...(isAdminUser
                ? [
                    {
                      key: 'pipelines',
                      children: (
                        <IngestionPipelineList
                          serviceName={
                            serviceName === 'dataObservabilityServices'
                              ? 'testSuites'
                              : serviceName
                          }
                        />
                      ),
                      label: 'Pipelines',
                    },
                  ]
                : []),
            ]}
            onChange={(activeKey) => navigate({ search: `tab=${activeKey}` })}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  ) : (
    <Row>
      <Col span={24}>
        <ErrorPlaceHolder
          className="border-none h-min-80"
          permissionValue={t('label.view-entity', {
            entity: startCase(serviceName),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      </Col>
    </Row>
  );
};

export default ServicesPage;
