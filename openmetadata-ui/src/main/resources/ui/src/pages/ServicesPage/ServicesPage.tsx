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

import { Box, Tabs } from '@openmetadata/ui-core-components';
import { capitalize, isEmpty, startCase } from 'lodash';
import qs from 'qs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { IngestionPipelineList } from '../../components/Settings/Services/Ingestion/IngestionPipelineList/IngestionPipelineList.component';
import Services from '../../components/Settings/Services/Services';
import { ROUTES } from '../../constants/constants';
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
import { getRenderedActiveTab } from '../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { userPermissions } from '../../utils/PermissionsUtils';
import { getResourceEntityFromServiceCategory } from '../../utils/ServicePureUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

const isValidServiceTab = (
  tab: string,
  serviceCategoryValues: Set<string>
): boolean =>
  tab === GlobalSettingOptions.DATA_OBSERVABILITY ||
  Boolean(SERVICE_CATEGORY[tab]) ||
  serviceCategoryValues.has(tab);

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

  const serviceCategoryValues = useMemo(
    () => new Set<string>(Object.values(ServiceCategory)),
    []
  );

  const isValidTab = isValidServiceTab(tab, serviceCategoryValues);

  const serviceName = useMemo(() => {
    if (tab === GlobalSettingOptions.DATA_OBSERVABILITY) {
      return 'dataObservabilityServices';
    }

    if (SERVICE_CATEGORY[tab]) {
      return SERVICE_CATEGORY[tab];
    }

    if (serviceCategoryValues.has(tab)) {
      return tab as ServiceCategory;
    }

    return ServiceCategory.DATABASE_SERVICES;
  }, [tab, serviceCategoryValues]);

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

  const isEmbedded = location.pathname.startsWith('/askCollate');

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(() => {
    const crumbs = getSettingPageEntityBreadCrumb(
      GlobalSettingsMenuCategory.SERVICES,
      tab === GlobalSettingOptions.DATA_OBSERVABILITY
        ? t('label.data-observability')
        : capitalize(tab)
    );

    if (isEmbedded) {
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
          name:
            tab === GlobalSettingOptions.DATA_OBSERVABILITY
              ? t('label.data-observability')
              : capitalize(tab),
          url: '',
          activeTitle: true,
        },
      ];
    }

    return crumbs;
  }, [tab, t, isEmbedded]);

  const tabItems = useMemo(
    () => [
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
    ],
    [serviceName, isAdminUser]
  );

  if (!isValidTab) {
    return <Navigate replace to={ROUTES.NOT_FOUND} />;
  }

  return viewAllPermission ? (
    <PageLayoutV1 pageTitle={startCase(serviceName)}>
      {isEmbedded && <div className="tw:h-4" />}
      <Box direction="col" gap={isEmbedded ? 2 : 4}>
        <TitleBreadcrumb titleLinks={breadcrumbs} />
        <Tabs
          className="tw:gap-3"
          selectedKey={getRenderedActiveTab(tabItems, search as string)}
          onSelectionChange={(activeKey) =>
            navigate({ search: `tab=${String(activeKey)}` })
          }>
          <Tabs.List size="sm" type="underline" variant="card">
            {tabItems.map(({ key, label }) => (
              <Tabs.Item id={key} key={key}>
                {label}
              </Tabs.Item>
            ))}
          </Tabs.List>
          {tabItems.map(({ key, children }) => (
            <Tabs.Panel
              className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-5"
              id={key}
              key={key}>
              {children}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Box>
    </PageLayoutV1>
  ) : (
    <div>
      <ErrorPlaceHolder
        className="border-none h-min-80"
        permissionValue={t('label.view-entity', {
          entity: startCase(serviceName),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    </div>
  );
};

export default ServicesPage;
