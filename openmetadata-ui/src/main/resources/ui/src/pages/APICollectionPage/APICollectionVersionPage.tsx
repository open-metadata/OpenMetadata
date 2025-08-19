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

import { Col, Row, Space, Tabs } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isUndefined, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import DataAssetsVersionHeader from '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import DataProductsContainer from '../../components/DataProducts/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { APICollection } from '../../generated/entity/data/apiCollection';
import { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import { Operation } from '../../generated/entity/policies/policy';
import { ChangeDescription } from '../../generated/entity/type';
import { EntityHistory } from '../../generated/type/entityHistory';
import { Include } from '../../generated/type/include';
import { TagSource } from '../../generated/type/tagLabel';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import {
  getApiCollectionByFQN,
  getApiCollectionVersion,
  getApiCollectionVersions,
} from '../../rest/apiCollectionsAPI';
import {
  getApiEndPoints,
  GetApiEndPointsType,
} from '../../rest/apiEndpointsAPI';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getBasicEntityInfoFromVersionData,
  getCommonDiffsFromVersionData,
  getCommonExtraInfoForVersionDetails,
} from '../../utils/EntityVersionUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import APIEndpointsTab from './APIEndpointsTab';

const APICollectionVersionPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { version, tab } = useRequiredParams<{
    version: string;
    tab: string;
  }>();

  const { fqn: decodedEntityFQN } = useFqn();

  const pagingInfo = usePaging();

  const {
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    currentPage,
  } = pagingInfo;

  const [collectionPermissions, setCollectionPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVersionDataLoading, setIsVersionDataLoading] =
    useState<boolean>(true);

  const [collection, setCollection] = useState<APICollection>();
  const [currentVersionData, setCurrentVersionData] = useState<APICollection>(
    {} as APICollection
  );
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );

  const [apiEndpointsLoading, setAPIEndpointsLoading] = useState<boolean>(true);

  const [apiEndpoints, setAPIEndpoints] = useState<Array<APIEndpoint>>([]);

  const { tier, owners, breadcrumbLinks, changeDescription, deleted, domains } =
    useMemo(
      () =>
        getBasicEntityInfoFromVersionData(
          currentVersionData,
          EntityType.API_COLLECTION
        ),
      [currentVersionData]
    );

  const viewVersionPermission = useMemo(
    () =>
      getPrioritizedViewPermission(collectionPermissions, Operation.ViewBasic),
    [collectionPermissions]
  );

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          currentVersionData?.changeDescription as ChangeDescription,
          owners,
          tier,
          domains
        ),
      [currentVersionData?.changeDescription, owners, tier, domains]
    );

  const init = useCallback(async () => {
    try {
      setIsLoading(true);
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.API_COLLECTION,
        decodedEntityFQN
      );
      setCollectionPermissions(permission);

      if (permission.ViewAll || permission.ViewBasic) {
        const collectionResponse = await getApiCollectionByFQN(
          decodedEntityFQN,
          {
            include: Include.All,
          }
        );
        setCollection(collectionResponse);

        const versions = await getApiCollectionVersions(
          collectionResponse.id ?? ''
        );

        setVersionList(versions);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [decodedEntityFQN, getEntityPermissionByFqn]);

  const getAPICollectionEndpoints = useCallback(
    async (params?: Pick<GetApiEndPointsType, 'paging'>) => {
      if (isEmpty(collection)) {
        return;
      }

      setAPIEndpointsLoading(true);
      try {
        const res = await getApiEndPoints({
          ...params,
          fields: TabSpecificField.OWNERS,
          apiCollection: collection?.fullyQualifiedName ?? '',
          service: collection?.service?.fullyQualifiedName ?? '',
          include: Include.All,
        });
        setAPIEndpoints(res.data);
        handlePagingChange(res.paging);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setAPIEndpointsLoading(false);
      }
    },
    [collection]
  );

  const fetchCurrentVersionData = useCallback(
    async (collectionData: APICollection) => {
      try {
        setIsVersionDataLoading(true);
        if (viewVersionPermission) {
          const response = await getApiCollectionVersion(
            collectionData.id,
            version
          );

          setCurrentVersionData(response);
          await getAPICollectionEndpoints({
            paging: { limit: pageSize },
          });
        }
      } finally {
        setIsVersionDataLoading(false);
      }
    },
    [viewVersionPermission, version, getAPICollectionEndpoints, pageSize]
  );

  const handleTabChange = (activeKey: string) => {
    navigate(
      getVersionPath(
        EntityType.API_COLLECTION,
        decodedEntityFQN,
        String(version),
        activeKey
      )
    );
  };

  const endpointPaginationHandler = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        getAPICollectionEndpoints({
          paging: {
            [cursorType]: paging[cursorType],
          },
        });
      }
      handlePageChange(currentPage);
    },
    [paging, getAPICollectionEndpoints]
  );

  const { versionHandler, backHandler } = useMemo(
    () => ({
      versionHandler: (newVersion = version) => {
        navigate(
          getVersionPath(
            EntityType.API_COLLECTION,
            decodedEntityFQN,
            newVersion,
            tab
          )
        );
      },
      backHandler: () => {
        navigate(
          getEntityDetailsPath(EntityType.API_COLLECTION, decodedEntityFQN, tab)
        );
      },
    }),
    [decodedEntityFQN, decodedEntityFQN, tab]
  );

  const { displayName, tags, description } = useMemo(
    () => getCommonDiffsFromVersionData(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
  );

  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel
            count={paging.total}
            id={EntityTabs.API_ENDPOINT}
            isActive={tab === EntityTabs.API_ENDPOINT}
            name={t('label.endpoint-plural')}
          />
        ),
        key: EntityTabs.API_ENDPOINT,
        children: (
          <Row className="h-full" gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" span={24}>
              <DescriptionV1
                description={description}
                entityType={EntityType.API_COLLECTION}
                isDescriptionExpanded={isEmpty(apiEndpoints)}
                showActions={false}
              />
            </Col>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <APIEndpointsTab isVersionView />
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="220px">
              <Space className="w-full" direction="vertical" size="large">
                <DataProductsContainer
                  newLook
                  activeDomains={domains}
                  dataProducts={currentVersionData?.dataProducts ?? []}
                  hasPermission={false}
                />
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    newLook
                    displayType={DisplayType.READ_MORE}
                    entityType={EntityType.API_COLLECTION}
                    key={tagType}
                    permission={false}
                    selectedTags={tags}
                    showTaskHandler={false}
                    tagType={TagSource[tagType as TagSource]}
                  />
                ))}
              </Space>
            </Col>
          </Row>
        ),
      },

      {
        key: EntityTabs.CUSTOM_PROPERTIES,
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            isActive={tab === EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        children: (
          <CustomPropertyTable
            isVersionView
            entityType={EntityType.API_COLLECTION}
            hasEditAccess={false}
            hasPermission={viewVersionPermission}
          />
        ),
      },
    ],
    [
      tags,
      domains,
      description,
      currentVersionData,
      apiEndpoints,
      apiEndpointsLoading,
      currentPage,
      endpointPaginationHandler,
      viewVersionPermission,
    ]
  );

  const versionComponent = useMemo(() => {
    if (isLoading) {
      return <Loader />;
    }

    if (!viewVersionPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.api-collection'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
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
                  entityType={EntityType.API_COLLECTION}
                  ownerDisplayName={ownerDisplayName}
                  ownerRef={ownerRef}
                  tierDisplayName={tierDisplayName}
                  version={version}
                  onVersionClick={backHandler}
                />
              </Col>
              <GenericProvider
                isVersionView
                currentVersionData={currentVersionData}
                data={currentVersionData}
                permissions={collectionPermissions}
                type={EntityType.API_COLLECTION}
                onUpdate={() => Promise.resolve()}>
                <Col className="entity-version-page-tabs" span={24}>
                  <Tabs
                    className="tabs-new"
                    data-testid="tabs"
                    defaultActiveKey={tab}
                    items={tabs}
                    onChange={handleTabChange}
                  />
                </Col>
              </GenericProvider>
            </Row>
          </div>
        )}

        <EntityVersionTimeLine
          currentVersion={toString(version)}
          entityType={EntityType.API_COLLECTION}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </>
    );
  }, [
    isLoading,
    viewVersionPermission,
    isVersionDataLoading,
    breadcrumbLinks,
    currentVersionData,
    deleted,
    displayName,
    ownerDisplayName,
    ownerRef,
    tierDisplayName,
    version,
    backHandler,
    tabs,
    versionHandler,
    versionList,
    domainDisplayName,
  ]);

  useEffect(() => {
    if (!isEmpty(decodedEntityFQN)) {
      init();
    }
  }, [decodedEntityFQN]);

  useEffect(() => {
    if (!isUndefined(collection)) {
      fetchCurrentVersionData(collection);
    }
  }, [version, collection, pageSize]);

  return (
    <PageLayoutV1
      className="version-page-container"
      pageTitle={t('label.entity-version-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      {versionComponent}
    </PageLayoutV1>
  );
};

export default APICollectionVersionPage;
