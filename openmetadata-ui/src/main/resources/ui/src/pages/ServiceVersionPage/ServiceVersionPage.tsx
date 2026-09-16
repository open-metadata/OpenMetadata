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

import { EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { Lock } from '@openmetadata/ui-core-components/icons';
import { Col, Row, Tabs, TabsProps } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, toString } from 'lodash';
import { PagingWithoutTotal, ServiceTypes } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import DataAssetsVersionHeader from '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { EntityField } from '../../constants/Feeds.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { Directory } from '../../generated/entity/data/directory';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { ChangeDescription } from '../../generated/entity/type';
import { EntityHistory } from '../../generated/type/entityHistory';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../hooks/useFqn';
import { ServicesType } from '../../interface/service.interface';
import { ServicePageData } from '../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { getApiCollections } from '../../rest/apiCollectionsAPI';
import { getDashboards } from '../../rest/dashboardAPI';
import { getDatabases } from '../../rest/databaseAPI';
import { getDriveAssets } from '../../rest/driveAPI';
import { getMlModels } from '../../rest/mlModelAPI';
import { getPipelines } from '../../rest/pipelineAPI';
import { getSearchIndexes } from '../../rest/SearchIndexAPI';
import {
  getServiceByFQN,
  getServiceVersionData,
  getServiceVersions,
} from '../../rest/serviceAPI';
import { getContainers } from '../../rest/storageAPI';
import { getTopics } from '../../rest/topicsAPI';
import { commonTableFields } from '../../utils/DatasetDetailsUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  getBasicEntityInfoFromVersionData,
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
} from '../../utils/EntityVersionUtilsPure';
import { Transi18next } from '../../utils/i18next/LocalUtil';
import { getPrioritizedViewPermission } from '../../utils/PermissionsUtils';
import {
  getServiceDetailsPath,
  getServiceVersionPath,
} from '../../utils/RouterUtils';
import {
  getCountLabel,
  getEntityTypeFromServiceCategory,
  getResourceEntityFromServiceCategory,
} from '../../utils/ServicePureUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import ServiceVersionMainTabContent from './ServiceVersionMainTabContent';

function ServiceVersionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { permissions } = usePermissionProvider();
  const { serviceCategory, version } = useRequiredParams<{
    serviceCategory: ServiceTypes;
    version: string;
  }>();

  const { fqn: decodedServiceFQN } = useFqn();
  const {
    paging,
    pageSize,
    pagingCursor,
    handlePagingChange,
    currentPage,
    handlePageChange,
  } = usePaging();
  const [data, setData] = useState<Array<ServicePageData>>([]);
  const [isVersionsListLoading, setIsVersionsListLoading] =
    useState<boolean>(true);
  const [isVersionDataLoading, setIsVersionDataLoading] =
    useState<boolean>(true);
  const [isOtherDataLoading, setIsOtherDataLoading] = useState<boolean>(true);
  const [serviceId, setServiceId] = useState<string>('');
  const [currentVersionData, setCurrentVersionData] = useState<ServicesType>(
    {} as ServicesType
  );
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );

  const [entityType, resourceEntity] = useMemo(
    () => [
      getEntityTypeFromServiceCategory(serviceCategory),
      getResourceEntityFromServiceCategory(serviceCategory),
    ],
    [serviceCategory]
  );

  const { tier, owners, breadcrumbLinks, changeDescription, deleted, domains } =
    useMemo(
      () => getBasicEntityInfoFromVersionData(currentVersionData, entityType),
      [currentVersionData, entityType]
    );

  // Fetch-owner, by fqn — reads-only conversion, mechanism preserved
  // (APICollectionVersionPage.tsx precedent). `resourceEntity` varies per service category
  // (computed above from the URL's serviceCategory param, known synchronously at mount — no
  // ordering cycle), so a single call suffices. `hasViewAccess` is a byte-for-byte match of
  // the old bare `servicePermissions.ViewAll || servicePermissions.ViewBasic` OR.
  const {
    isLoading: isPermissionsLoading,
    error: permissionsError,
    hasViewAccess: viewVersionPermission,
  } = useEntityPermissions(resourceEntity, decodedServiceFQN, {
    enabled: Boolean(decodedServiceFQN),
  });

  useEffect(() => {
    if (permissionsError) {
      showErrorToast(permissionsError as AxiosError);
    }
  }, [permissionsError]);

  // Combined loading flag: this page's old `isLoading` state doubled as both the
  // permission-fetch loading flag AND the version-list-fetch loading flag (both set it true
  // at their own start, false in their own finally) — same general-page-loading shape as
  // TeamsPage.tsx's `isPageLoading` (Task 8 Batch 7 precedent). Permission loading now comes
  // from the hook; `isVersionsListLoading` keeps the version-list fetch's own half. Gated on
  // `viewVersionPermission`: fetchVersionsList only ever runs when view access is granted
  // (see the effect below), so `isVersionsListLoading`'s initial `true` must NOT be counted
  // while denied — the old code's `isLoading` settled back to `false` as soon as the
  // permission fetch alone resolved in the denied case (fetchVersionsList's own setIsLoading
  // calls never ran to re-flip it), and this preserves that.
  const isLoading =
    isPermissionsLoading || (viewVersionPermission && isVersionsListLoading);

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          currentVersionData.changeDescription as ChangeDescription,
          owners,
          tier,
          domains
        ),
      [currentVersionData.changeDescription, owners, tier, domains]
    );

  const fetchVersionsList = useCallback(async () => {
    try {
      setIsVersionsListLoading(true);

      const { id } = await getServiceByFQN(serviceCategory, decodedServiceFQN, {
        include: Include.All,
      });
      setServiceId(id);

      const versions = await getServiceVersions(serviceCategory, id);

      setVersionList(versions);
    } finally {
      setIsVersionsListLoading(false);
    }
  }, [viewVersionPermission, serviceCategory, decodedServiceFQN]);

  const fetchDatabases = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const databaseUsagePermission = getPrioritizedViewPermission(
        permissions.database,
        PermissionOperation.ViewUsage
      );
      const { data, paging: resPaging } = await getDatabases(
        decodedServiceFQN,
        databaseUsagePermission
          ? `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.USAGE_SUMMARY},${TabSpecificField.CERTIFICATION}`
          : `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.CERTIFICATION}`,
        paging
      );

      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, handlePagingChange, permissions.database]
  );

  const fetchTopics = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const { data, paging: resPaging } = await getTopics(
        decodedServiceFQN,
        `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.CERTIFICATION}`,
        paging
      );
      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, handlePagingChange]
  );

  const fetchDashboards = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const dashboardUsagePermission = getPrioritizedViewPermission(
        permissions.dashboard,
        PermissionOperation.ViewUsage
      );
      const { data, paging: resPaging } = await getDashboards(
        decodedServiceFQN,
        dashboardUsagePermission
          ? `${TabSpecificField.OWNERS},${TabSpecificField.USAGE_SUMMARY},${TabSpecificField.TAGS},${TabSpecificField.CERTIFICATION}`
          : `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.CERTIFICATION}`,
        paging
      );
      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, handlePagingChange, permissions.dashboard]
  );

  const fetchPipeLines = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const { data, paging: resPaging } = await getPipelines(
        decodedServiceFQN,
        `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.CERTIFICATION}`,
        paging
      );
      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, handlePagingChange]
  );

  const fetchMlModal = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const { data, paging: resPaging } = await getMlModels(
        decodedServiceFQN,
        `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.CERTIFICATION}`,
        paging
      );
      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, handlePagingChange]
  );

  const fetchContainers = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const response = await getContainers({
        service: decodedServiceFQN,
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.CERTIFICATION,
        ].join(','),
        paging,
        root: true,
        include: Include.NonDeleted,
      });

      setData(response.data);
      handlePagingChange(response.paging);
    },
    [decodedServiceFQN, handlePagingChange]
  );

  const fetchSearchIndexes = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const response = await getSearchIndexes({
        service: decodedServiceFQN,
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.CERTIFICATION,
        ].join(','),
        paging,
        root: true,
        include: Include.NonDeleted,
      });

      setData(response.data);
      handlePagingChange(response.paging);
    },
    [decodedServiceFQN, handlePagingChange]
  );

  const fetchCollections = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const response = await getApiCollections({
        service: decodedServiceFQN,
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.CERTIFICATION}`,
        paging,
      });

      setData(response.data);
      handlePagingChange(response.paging);
    },
    [decodedServiceFQN, handlePagingChange]
  );

  const fetchDirectories = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const response = await getDriveAssets<Directory>(EntityType.DIRECTORY, {
        service: decodedServiceFQN,
        fields: commonTableFields,
        paging,
      });

      setData(response.data);
      handlePagingChange(response.paging);
    },
    [decodedServiceFQN, handlePagingChange]
  );

  const getOtherDetails = useCallback(
    async (paging?: PagingWithoutTotal) => {
      try {
        setIsOtherDataLoading(true);
        switch (serviceCategory) {
          case ServiceCategory.DATABASE_SERVICES: {
            await fetchDatabases(paging);

            break;
          }
          case ServiceCategory.MESSAGING_SERVICES: {
            await fetchTopics(paging);

            break;
          }
          case ServiceCategory.DASHBOARD_SERVICES: {
            await fetchDashboards(paging);

            break;
          }
          case ServiceCategory.PIPELINE_SERVICES: {
            await fetchPipeLines(paging);

            break;
          }
          case ServiceCategory.ML_MODEL_SERVICES: {
            await fetchMlModal(paging);

            break;
          }
          case ServiceCategory.STORAGE_SERVICES: {
            await fetchContainers(paging);

            break;
          }
          case ServiceCategory.SEARCH_SERVICES: {
            await fetchSearchIndexes(paging);

            break;
          }
          case ServiceCategory.API_SERVICES: {
            await fetchCollections(paging);

            break;
          }
          case ServiceCategory.DRIVE_SERVICES: {
            await fetchDirectories(paging);

            break;
          }
          default:
            break;
        }
      } catch {
        setData([]);
      } finally {
        setIsOtherDataLoading(false);
      }
    },
    [
      serviceCategory,
      fetchDatabases,
      fetchTopics,
      fetchDashboards,
      fetchPipeLines,
      fetchMlModal,
      fetchContainers,
      fetchCollections,
    ]
  );

  const fetchCurrentVersionData = useCallback(
    async (id: string) => {
      try {
        setIsVersionDataLoading(true);
        if (viewVersionPermission) {
          const response = await getServiceVersionData(
            serviceCategory,
            id,
            version
          );

          setCurrentVersionData(response);
        }
      } finally {
        setIsVersionDataLoading(false);
      }
    },
    [
      viewVersionPermission,
      serviceCategory,
      entityType,
      version,
      getOtherDetails,
    ]
  );

  const versionHandler = useCallback(
    (newVersion = version) => {
      navigate(
        getServiceVersionPath(
          serviceCategory,
          decodedServiceFQN,
          toString(newVersion)
        )
      );
    },
    [serviceCategory, decodedServiceFQN]
  );

  const backHandler = useCallback(() => {
    navigate(getServiceDetailsPath(decodedServiceFQN, serviceCategory));
  }, [decodedServiceFQN, serviceCategory]);

  const pagingHandler = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        getOtherDetails({
          [cursorType]: paging[cursorType],
        });
        handlePageChange(
          currentPage,
          {
            cursorType,
            cursorValue: paging[cursorType],
          },
          pageSize
        );
      }
    },
    [paging, getOtherDetails, handlePageChange]
  );

  const tabs: TabsProps['items'] = useMemo(() => {
    const tabs =
      serviceCategory === ServiceCategory.METADATA_SERVICES
        ? []
        : [
            {
              name: getCountLabel(serviceCategory),
              key: getCountLabel(serviceCategory).toLowerCase(),
              count: paging.total,
              children: (
                <ServiceVersionMainTabContent
                  changeDescription={changeDescription}
                  currentPage={currentPage}
                  data={data}
                  entityType={entityType}
                  isServiceLoading={isOtherDataLoading}
                  paging={paging}
                  pagingHandler={pagingHandler}
                  serviceDetails={currentVersionData}
                  serviceName={serviceCategory}
                />
              ),
            },
          ];

    return tabs.map((tab) => ({
      label: <TabsLabel count={tab.count} id={tab.key} name={tab.name} />,
      key: tab.key,
      children: tab.children,
    }));
  }, [
    currentVersionData,
    serviceCategory,
    paging,
    data,
    isOtherDataLoading,
    getOtherDetails,
  ]);

  const displayName = useMemo(() => {
    return getEntityVersionByField(
      changeDescription,
      EntityField.DISPLAYNAME,
      currentVersionData.displayName
    );
  }, [currentVersionData, changeDescription]);

  const versionComponent = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (!viewVersionPermission) {
      return (
        <div className="tw:relative tw:flex-1 tw:h-[calc(100vh-80px)]">
          <EmptyPlaceholder
            description={
              <Transi18next
                i18nKey="message.no-access-placeholder"
                renderElement={<b />}
                values={{
                  entity: t('label.view-entity', {
                    entity: `${getEntityName(currentVersionData)} ${t(
                      'label.service'
                    )}`,
                  }),
                }}
              />
            }
            icon={<Lock className="tw:text-secondary" />}
            title={t('label.access-denied')}
          />
        </div>
      );
    }

    return (
      <>
        {isVersionDataLoading ? (
          <Loader />
        ) : (
          <div className={classNames('version-data')}>
            <Row gutter={[0, 12]}>
              <Col span={24}>
                <DataAssetsVersionHeader
                  breadcrumbLinks={breadcrumbLinks}
                  currentVersionData={currentVersionData}
                  deleted={deleted}
                  displayName={displayName}
                  domainDisplayName={domainDisplayName}
                  entityType={entityType}
                  ownerDisplayName={ownerDisplayName}
                  ownerRef={ownerRef}
                  tierDisplayName={tierDisplayName}
                  version={version}
                  onVersionClick={backHandler}
                />
              </Col>
              <Col className="entity-version-page-tabs" span={24}>
                <Tabs className="tabs-new" data-testid="tabs" items={tabs} />
              </Col>
            </Row>
          </div>
        )}

        <EntityVersionTimeLine
          currentVersion={toString(version)}
          entityType={entityType}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </>
    );
  };

  useEffect(() => {
    if (viewVersionPermission) {
      fetchVersionsList();
    }
  }, [decodedServiceFQN, viewVersionPermission]);

  useEffect(() => {
    if (serviceId) {
      fetchCurrentVersionData(serviceId);
    }
  }, [version, serviceId]);

  useEffect(() => {
    if (!isEmpty(currentVersionData)) {
      const { cursorType, cursorValue } = pagingCursor ?? {};

      if (cursorType && cursorValue) {
        getOtherDetails({
          [cursorType]: cursorValue,
        });
      } else {
        getOtherDetails();
      }
    }
  }, [currentVersionData, pagingCursor]);

  return (
    <PageLayoutV1
      className="version-page-container"
      pageTitle={t('label.entity-version-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      {versionComponent()}
    </PageLayoutV1>
  );
}

export default ServiceVersionPage;
