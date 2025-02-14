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

import { Col, Row, Skeleton, Tabs, TabsProps } from 'antd';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import { EntityTags } from 'Models';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ActivityFeedProvider from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import EntityRightPanel from '../../components/Entity/EntityRightPanel/EntityRightPanel';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  getEntityDetailsPath,
  getVersionPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  ROUTES,
} from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../constants/ResizablePanel.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { APICollection } from '../../generated/entity/data/apiCollection';
import { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import { Include } from '../../generated/type/include';
import { TagLabel } from '../../generated/type/tagLabel';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import {
  getApiCollectionByFQN,
  patchApiCollection,
  restoreApiCollection,
  updateApiCollectionVote,
} from '../../rest/apiCollectionsAPI';
import {
  getApiEndPoints,
  GetApiEndPointsType,
} from '../../rest/apiEndpointsAPI';
import { getEntityMissingError, getFeedCounts } from '../../utils/CommonUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import APIEndpointsTab from './APIEndpointsTab';

const APICollectionPage: FunctionComponent = () => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const pagingInfo = usePaging(PAGE_SIZE);

  const {
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    currentPage,
  } = pagingInfo;

  const { tab: activeTab = EntityTabs.API_ENDPOINT } =
    useParams<{ tab: EntityTabs }>();
  const { fqn: decodedAPICollectionFQN } = useFqn();
  const history = useHistory();

  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const [apiCollection, setAPICollection] = useState<APICollection>(
    {} as APICollection
  );
  const [apiEndpoints, setAPIEndpoints] = useState<Array<APIEndpoint>>([]);
  const [apiEndpointsLoading, setAPIEndpointsLoading] = useState<boolean>(true);
  const [isAPICollectionLoading, setIsAPICollectionLoading] =
    useState<boolean>(true);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [apiCollectionPermission, setAPICollectionPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [showDeletedEndpoints, setShowDeletedEndpoints] =
    useState<boolean>(false);

  const extraDropdownContent = useMemo(
    () =>
      entityUtilClassBase.getManageExtraOptions(
        EntityType.API_COLLECTION,
        decodedAPICollectionFQN,
        apiCollectionPermission
      ),
    [apiCollectionPermission, decodedAPICollectionFQN]
  );

  const handleShowDeletedEndPoints = (value: boolean) => {
    setShowDeletedEndpoints(value);
    handlePageChange(INITIAL_PAGING_VALUE);
  };

  const { currentVersion, tags, tier, apiCollectionId } = useMemo(
    () => ({
      currentVersion: apiCollection?.version,
      tier: getTierTags(apiCollection.tags ?? []),
      tags: getTagsWithoutTier(apiCollection.tags ?? []),
      apiCollectionId: apiCollection?.id ?? '',
    }),
    [apiCollection]
  );

  const fetchAPICollectionPermission = useCallback(async () => {
    setIsPermissionsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.API_COLLECTION,
        decodedAPICollectionFQN
      );
      setAPICollectionPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPermissionsLoading(false);
    }
  }, [decodedAPICollectionFQN]);

  const viewAPICollectionPermission = useMemo(
    () => apiCollectionPermission.ViewAll || apiCollectionPermission.ViewBasic,
    [apiCollectionPermission?.ViewAll, apiCollectionPermission?.ViewBasic]
  );

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.API_COLLECTION,
      decodedAPICollectionFQN,
      handleFeedCount
    );
  };

  const fetchAPICollectionDetails = useCallback(async () => {
    try {
      setIsAPICollectionLoading(true);
      const response = await getApiCollectionByFQN(decodedAPICollectionFQN, {
        // eslint-disable-next-line max-len
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.DOMAIN},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION},${TabSpecificField.DATA_PRODUCTS}`,
        include: Include.All,
      });
      setAPICollection(response);
      setShowDeletedEndpoints(response.deleted ?? false);
    } catch (err) {
      // Error
      if ((err as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        history.replace(ROUTES.FORBIDDEN);
      }
    } finally {
      setIsAPICollectionLoading(false);
    }
  }, [decodedAPICollectionFQN]);

  const getAPICollectionEndpoints = useCallback(
    async (params?: Pick<GetApiEndPointsType, 'paging'>) => {
      if (!apiCollection) {
        return;
      }

      setAPIEndpointsLoading(true);
      try {
        const res = await getApiEndPoints({
          ...params,
          fields: TabSpecificField.OWNERS,
          apiCollection: decodedAPICollectionFQN,
          service: apiCollection?.service?.fullyQualifiedName ?? '',
          include: showDeletedEndpoints ? Include.Deleted : Include.NonDeleted,
        });
        setAPIEndpoints(res.data);
        handlePagingChange(res.paging);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setAPIEndpointsLoading(false);
      }
    },
    [decodedAPICollectionFQN, showDeletedEndpoints, apiCollection]
  );

  const saveUpdatedAPICollectionData = useCallback(
    (updatedData: APICollection) => {
      let jsonPatch: Operation[] = [];
      if (apiCollection) {
        jsonPatch = compare(apiCollection, updatedData);
      }

      return patchApiCollection(apiCollectionId, jsonPatch);
    },
    [apiCollectionId, apiCollection]
  );

  const onDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (apiCollection?.description !== updatedHTML && apiCollection) {
        const updatedAPICollectionDetails = {
          ...apiCollection,
          description: updatedHTML,
        };

        try {
          const response = await saveUpdatedAPICollectionData(
            updatedAPICollectionDetails
          );
          if (response) {
            setAPICollection(response);
          } else {
            throw t('server.unexpected-response');
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [apiCollection]
  );

  const activeTabHandler = useCallback(
    (activeKey: string) => {
      if (activeKey !== activeTab) {
        history.push({
          pathname: getEntityDetailsPath(
            EntityType.API_COLLECTION,
            decodedAPICollectionFQN,
            activeKey
          ),
        });
      }
    },
    [activeTab, decodedAPICollectionFQN]
  );

  const handleUpdateOwner = useCallback(
    async (owners: APICollection['owners']) => {
      try {
        const updatedData = {
          ...apiCollection,
          owners,
        };

        const response = await saveUpdatedAPICollectionData(
          updatedData as APICollection
        );

        setAPICollection(response);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.collection'),
          })
        );
      }
    },
    [apiCollection, apiCollection?.owners]
  );

  const handleTagsUpdate = async (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedData = { ...apiCollection, tags: updatedTags };

      try {
        const res = await saveUpdatedAPICollectionData(
          updatedData as APICollection
        );
        setAPICollection(res);
      } catch (error) {
        showErrorToast(error as AxiosError, t('server.api-error'));
      }
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);
    await handleTagsUpdate(updatedTags);
  };

  const handleUpdateTier = useCallback(
    async (newTier?: Tag) => {
      const tierTag = updateTierTag(apiCollection?.tags ?? [], newTier);
      const updateAPICollection = {
        ...apiCollection,
        tags: tierTag,
      };

      const res = await saveUpdatedAPICollectionData(
        updateAPICollection as APICollection
      );
      setAPICollection(res);
    },
    [saveUpdatedAPICollectionData, apiCollection]
  );

  const handleUpdateDisplayName = useCallback(
    async (data: EntityName) => {
      if (isUndefined(apiCollection)) {
        return;
      }
      const updatedData = { ...apiCollection, displayName: data.displayName };

      try {
        const res = await saveUpdatedAPICollectionData(updatedData);
        setAPICollection(res);
      } catch (error) {
        showErrorToast(error as AxiosError, t('server.api-error'));
      }
    },
    [apiCollection, saveUpdatedAPICollectionData]
  );

  const handleToggleDelete = (version?: number) => {
    setAPICollection((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });

    setShowDeletedEndpoints((prev) => !prev);
  };

  const handleRestoreAPICollection = useCallback(async () => {
    try {
      const { version: newVersion } = await restoreApiCollection(
        apiCollectionId
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.collection'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.collection'),
        })
      );
    }
  }, [apiCollectionId]);

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

  const versionHandler = useCallback(() => {
    currentVersion &&
      history.push(
        getVersionPath(
          EntityType.API_COLLECTION,
          decodedAPICollectionFQN,
          String(currentVersion),
          EntityTabs.API_ENDPOINT
        )
      );
  }, [currentVersion, decodedAPICollectionFQN]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data) => {
    const updatedData = data as APICollection;

    setAPICollection((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

  useEffect(() => {
    fetchAPICollectionPermission();
  }, [decodedAPICollectionFQN]);

  useEffect(() => {
    if (viewAPICollectionPermission) {
      fetchAPICollectionDetails();
      getEntityFeedCount();
    }
  }, [viewAPICollectionPermission]);

  useEffect(() => {
    if (viewAPICollectionPermission && decodedAPICollectionFQN) {
      getAPICollectionEndpoints({
        paging: { limit: pageSize },
      });
    }
  }, [
    showDeletedEndpoints,
    decodedAPICollectionFQN,
    viewAPICollectionPermission,
    apiCollection,
    pageSize,
  ]);

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (apiCollectionPermission.EditTags || apiCollectionPermission.EditAll) &&
        !apiCollection.deleted,
      editGlossaryTermsPermission:
        (apiCollectionPermission.EditGlossaryTerms ||
          apiCollectionPermission.EditAll) &&
        !apiCollection.deleted,
      editDescriptionPermission:
        (apiCollectionPermission.EditDescription ||
          apiCollectionPermission.EditAll) &&
        !apiCollection.deleted,
      editCustomAttributePermission:
        (apiCollectionPermission.EditAll ||
          apiCollectionPermission.EditCustomFields) &&
        !apiCollection.deleted,
      viewAllPermission: apiCollectionPermission.ViewAll,
    }),
    [apiCollectionPermission, apiCollection]
  );

  const handleExtensionUpdate = async (apiCollectionData: APICollection) => {
    const response = await saveUpdatedAPICollectionData({
      ...apiCollection,
      extension: apiCollectionData.extension,
    });
    setAPICollection((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        extension: response.extension,
      };
    });
  };

  const tabs: TabsProps['items'] = [
    {
      label: (
        <TabsLabel
          count={paging.total}
          id={EntityTabs.API_ENDPOINT}
          isActive={activeTab === EntityTabs.API_ENDPOINT}
          name={t('label.endpoint-plural')}
        />
      ),
      key: EntityTabs.API_ENDPOINT,
      children: (
        <Row gutter={[0, 16]} wrap={false}>
          <Col className="tab-content-height-with-resizable-panel" span={24}>
            <ResizablePanels
              firstPanel={{
                className: 'entity-resizable-panel-container',
                children: (
                  <div className="p-t-sm m-x-lg">
                    <APIEndpointsTab
                      apiCollectionDetails={apiCollection}
                      apiEndpoints={apiEndpoints}
                      apiEndpointsLoading={apiEndpointsLoading}
                      currentEndpointsPage={currentPage}
                      description={apiCollection?.description ?? ''}
                      editDescriptionPermission={editDescriptionPermission}
                      endpointPaginationHandler={endpointPaginationHandler}
                      pagingInfo={pagingInfo}
                      showDeletedEndpoints={showDeletedEndpoints}
                      onDescriptionUpdate={onDescriptionUpdate}
                      onShowDeletedEndpointsChange={handleShowDeletedEndPoints}
                    />
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
              }}
              secondPanel={{
                children: (
                  <div data-testid="entity-right-panel">
                    <EntityRightPanel<EntityType.API_COLLECTION>
                      editCustomAttributePermission={
                        editCustomAttributePermission
                      }
                      editGlossaryTermsPermission={editGlossaryTermsPermission}
                      editTagPermission={editTagsPermission}
                      entityType={EntityType.API_COLLECTION}
                      selectedTags={tags}
                      viewAllPermission={viewAllPermission}
                      onExtensionUpdate={handleExtensionUpdate}
                      onTagSelectionChange={handleTagSelection}
                    />
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
                className:
                  'entity-resizable-right-panel-container entity-resizable-panel-container',
              }}
            />
          </Col>
        </Row>
      ),
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedProvider>
          <ActivityFeedTab
            refetchFeed
            entityFeedTotalCount={feedCount.totalCount}
            entityType={EntityType.API_COLLECTION}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchAPICollectionDetails}
            onUpdateFeedCount={handleFeedCount}
          />
        </ActivityFeedProvider>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={t('label.custom-property-plural')}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: apiCollection && (
        <div className="m-sm">
          <CustomPropertyTable<EntityType.API_COLLECTION>
            className=""
            entityType={EntityType.API_COLLECTION}
            handleExtensionUpdate={handleExtensionUpdate}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
            isVersionView={false}
          />
        </div>
      ),
    },
  ];

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateApiCollectionVote(id, data);
      const response = await getApiCollectionByFQN(decodedAPICollectionFQN, {
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.VOTES}`,
        include: Include.All,
      });
      setAPICollection(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  if (isPermissionsLoading) {
    return <Loader />;
  }

  if (!viewAPICollectionPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(apiCollection),
      })}>
      {isEmpty(apiCollection) && !isAPICollectionLoading ? (
        <ErrorPlaceHolder className="m-0">
          {getEntityMissingError(
            EntityType.API_COLLECTION,
            decodedAPICollectionFQN
          )}
        </ErrorPlaceHolder>
      ) : (
        <Row gutter={[0, 12]}>
          <Col className="p-x-lg" span={24}>
            {isAPICollectionLoading ? (
              <Skeleton
                active
                className="m-b-md"
                paragraph={{
                  rows: 2,
                  width: ['20%', '80%'],
                }}
              />
            ) : (
              <DataAssetsHeader
                isRecursiveDelete
                afterDeleteAction={afterDeleteAction}
                afterDomainUpdateAction={afterDomainUpdateAction}
                dataAsset={apiCollection}
                entityType={EntityType.API_COLLECTION}
                extraDropdownContent={extraDropdownContent}
                permissions={apiCollectionPermission}
                onDisplayNameUpdate={handleUpdateDisplayName}
                onOwnerUpdate={handleUpdateOwner}
                onRestoreDataAsset={handleRestoreAPICollection}
                onTierUpdate={handleUpdateTier}
                onUpdateVote={updateVote}
                onVersionClick={versionHandler}
              />
            )}
          </Col>
          <Col span={24}>
            <Tabs
              activeKey={activeTab}
              className="entity-details-page-tabs"
              data-testid="tabs"
              items={tabs}
              onChange={activeTabHandler}
            />
          </Col>
        </Row>
      )}
    </PageLayoutV1>
  );
};

export default withActivityFeed(APICollectionPage);
