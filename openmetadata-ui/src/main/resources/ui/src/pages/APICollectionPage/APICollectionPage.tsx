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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Col, Row, Skeleton, Tabs, TabsProps } from 'antd';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../components/common/IconButtons/EditIconButton';
import Loader from '../../components/common/Loader/Loader';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { APICollection } from '../../generated/entity/data/apiCollection';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../generated/system/ui/page';
import { Include } from '../../generated/type/include';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { useTableFilters } from '../../hooks/useTableFilters';
import { FeedCounts } from '../../interface/feed.interface';
import {
  patchApiCollection,
  restoreApiCollection,
  updateApiCollectionVote,
} from '../../rest/apiCollectionsAPI';
import { getApiEndPoints } from '../../rest/apiEndpointsAPI';
import {
  apiCollectionQueryFn,
  apiCollectionQueryKey,
  API_COLLECTION_DEFAULT_FIELDS,
} from '../../rest/queries/apiCollectionQuery';
import apiCollectionClassBase from '../../utils/APICollection/APICollectionClassBase';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import { getEntityMissingError } from '../../utils/EntityDisplayUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import {
  fetchEntityActivityCountInto,
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../utils/FeedUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import { updateCertificationTag, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

const APICollectionPage: FunctionComponent = () => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { customizedPage, isLoading } = useCustomPages(PageType.APICollection);
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: decodedAPICollectionFQN } = useFqn();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [apiEndpointCount, setApiEndpointCount] = useState<number>(0);
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const [apiCollectionPermission, setAPICollectionPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const { filters, setFilters } = useTableFilters({
    showDeletedEndpoints: false,
  });

  const viewAPICollectionPermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        apiCollectionPermission,
        PermissionOperation.ViewBasic
      ),
    [apiCollectionPermission]
  );

  const apiCollectionCacheKey = useMemo(
    () =>
      apiCollectionQueryKey(
        decodedAPICollectionFQN,
        API_COLLECTION_DEFAULT_FIELDS
      ),
    [decodedAPICollectionFQN]
  );

  const {
    data: apiCollection,
    isLoading: isAPICollectionLoading,
    isFetching: isAPICollectionFetching,
    error: apiCollectionError,
  } = useQuery({
    queryKey: apiCollectionCacheKey,
    queryFn: apiCollectionQueryFn(
      decodedAPICollectionFQN,
      API_COLLECTION_DEFAULT_FIELDS
    ),
    enabled: Boolean(
      decodedAPICollectionFQN &&
        viewAPICollectionPermission &&
        !isPermissionsLoading
    ),
  });

  const isError = useMemo(
    () =>
      (apiCollectionError as AxiosError | undefined)?.response?.status === 404,
    [apiCollectionError]
  );

  useEffect(() => {
    const status = (apiCollectionError as AxiosError | undefined)?.response
      ?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (status && status !== 404) {
      showErrorToast(
        apiCollectionError as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.api-collection'),
          entityName: decodedAPICollectionFQN,
        })
      );
    }
  }, [apiCollectionError, navigate, decodedAPICollectionFQN, t]);

  // Soft-deleted collections need the endpoint list to flip include modes; mirror the
  // soft-delete state into the table-filter store once the fetched entity lands.
  useEffect(() => {
    if (apiCollection) {
      setFilters({
        showDeletedEndpoints: apiCollection.deleted ?? false,
      });
    }
    // {@code setFilters} is a stable zustand setter; including it would re-run the effect
    // each render. {@code apiCollection.deleted} is the only signal that matters.
  }, [apiCollection?.deleted]);

  const setAPICollection = useCallback(
    (
      updater:
        | APICollection
        | undefined
        | ((prev: APICollection | undefined) => APICollection | undefined)
    ) => {
      queryClient.setQueryData<APICollection | undefined>(
        apiCollectionCacheKey,
        updater
      );
    },
    [queryClient, apiCollectionCacheKey]
  );

  const refetchAPICollection = useCallback(
    () => queryClient.invalidateQueries({ queryKey: apiCollectionCacheKey }),
    [queryClient, apiCollectionCacheKey]
  );

  const extraDropdownContent = useMemo(
    () =>
      apiCollection
        ? entityUtilClassBase.getManageExtraOptions(
            EntityType.API_COLLECTION,
            decodedAPICollectionFQN,
            apiCollectionPermission,
            apiCollection,
            navigate
          )
        : [],
    [apiCollectionPermission, decodedAPICollectionFQN, apiCollection, navigate]
  );

  const { currentVersion, apiCollectionId } = useMemo(
    () => ({
      currentVersion: apiCollection?.version,
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

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = useCallback(() => {
    getFeedCounts(
      EntityType.API_COLLECTION,
      decodedAPICollectionFQN,
      handleFeedCount
    );
  }, [handleFeedCount, decodedAPICollectionFQN]);

  const fetchTaskCounts = useCallback(() => {
    if (decodedAPICollectionFQN) {
      fetchEntityTaskCountsInto(decodedAPICollectionFQN, setFeedCount);
    }
  }, [decodedAPICollectionFQN]);

  const fetchActivityCount = useCallback(() => {
    if (decodedAPICollectionFQN) {
      fetchEntityActivityCountInto(
        EntityType.API_COLLECTION,
        decodedAPICollectionFQN,
        setFeedCount
      );
    }
  }, [decodedAPICollectionFQN]);

  const getApiEndpointCount = useCallback(async () => {
    const res = await getApiEndPoints({
      apiCollection: decodedAPICollectionFQN,
      service: apiCollection?.service?.fullyQualifiedName ?? '',
      paging: { limit: 0 },
      include: filters.showDeletedEndpoints
        ? Include.Deleted
        : Include.NonDeleted,
    });
    setApiEndpointCount(res.paging.total);
  }, [
    decodedAPICollectionFQN,
    filters.showDeletedEndpoints,
    apiCollection?.service?.fullyQualifiedName,
  ]);

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

  const activeTabHandler = useCallback(
    (activeKey: string) => {
      if (activeKey !== tab) {
        navigate(
          {
            pathname: getEntityDetailsPath(
              EntityType.API_COLLECTION,
              decodedAPICollectionFQN,
              activeKey
            ),
          },
          { replace: true }
        );
      }
    },
    [tab, decodedAPICollectionFQN]
  );

  const handleUpdateOwner = useCallback(
    async (owners: APICollection['owners']) => {
      if (!apiCollection) {
        return;
      }
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
    [apiCollection, saveUpdatedAPICollectionData, setAPICollection, t]
  );

  const handleUpdateTier = useCallback(
    async (newTier?: Tag) => {
      if (!apiCollection) {
        return;
      }
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
    [saveUpdatedAPICollectionData, apiCollection, setAPICollection]
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
    [apiCollection, saveUpdatedAPICollectionData, setAPICollection, t]
  );

  const handleToggleDelete = useCallback(
    (version?: number) => {
      setAPICollection((prev) => {
        if (!prev) {
          return prev;
        }

        setFilters({
          showDeletedEndpoints: !prev.deleted,
        });

        return {
          ...prev,
          deleted: !prev?.deleted,
          ...(version ? { version } : {}),
        };
      });
    },
    [setAPICollection, setFilters]
  );

  const handleRestoreAPICollection = useCallback(async () => {
    try {
      const { version: newVersion } = await restoreApiCollection(
        apiCollectionId
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.collection'),
        })
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
  }, [apiCollectionId, handleToggleDelete, t]);

  const versionHandler = useCallback(() => {
    currentVersion &&
      navigate(
        getVersionPath(
          EntityType.API_COLLECTION,
          decodedAPICollectionFQN,
          String(currentVersion),
          EntityTabs.API_ENDPOINT
        )
      );
  }, [currentVersion, decodedAPICollectionFQN, navigate]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    [navigate]
  );

  const afterDomainUpdateAction = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as APICollection;
      setAPICollection((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setAPICollection]
  );

  useEffect(() => {
    fetchAPICollectionPermission();
  }, [decodedAPICollectionFQN]);

  useEffect(() => {
    if (viewAPICollectionPermission) {
      fetchTaskCounts();
      fetchActivityCount();
    }
  }, [viewAPICollectionPermission, fetchTaskCounts, fetchActivityCount]);

  useEffect(() => {
    if (viewAPICollectionPermission && decodedAPICollectionFQN) {
      getApiEndpointCount();
    }
  }, [
    filters.showDeletedEndpoints,
    decodedAPICollectionFQN,
    viewAPICollectionPermission,
    apiCollection,
  ]);

  const {
    editCustomAttributePermission,
    viewAllPermission,
    viewCustomPropertiesPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(
          apiCollectionPermission,
          PermissionOperation.EditTags
        ) && !apiCollection?.deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          apiCollectionPermission,
          PermissionOperation.EditGlossaryTerms
        ) && !apiCollection?.deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          apiCollectionPermission,
          PermissionOperation.EditDescription
        ) && !apiCollection?.deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          apiCollectionPermission,
          PermissionOperation.EditCustomFields
        ) && !apiCollection?.deleted,
      viewAllPermission: apiCollectionPermission.ViewAll,
      viewCustomPropertiesPermission: getPrioritizedViewPermission(
        apiCollectionPermission,
        PermissionOperation.ViewCustomFields
      ),
    }),
    [apiCollectionPermission, apiCollection]
  );

  const handleAPICollectionUpdate = useCallback(
    async (updatedData: APICollection) => {
      if (!apiCollection) {
        return;
      }
      const response = await saveUpdatedAPICollectionData({
        ...apiCollection,
        ...updatedData,
      });
      setAPICollection(response);
    },
    [apiCollection, saveUpdatedAPICollectionData, setAPICollection]
  );

  const tabs: TabsProps['items'] = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabsList = apiCollectionClassBase.getAPICollectionDetailPageTabs({
      activeTab: tab,
      feedCount,
      apiCollection: apiCollection ?? ({} as APICollection),
      fetchAPICollectionDetails: refetchAPICollection,
      getEntityFeedCount,
      handleFeedCount,
      editCustomAttributePermission,
      viewAllPermission,
      viewCustomPropertiesPermission,
      apiEndpointCount,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabsList,
      customizedPage?.tabs,
      EntityTabs.API_ENDPOINT
    );
  }, [
    tab,
    customizedPage,
    feedCount,
    apiCollection,
    refetchAPICollection,
    getEntityFeedCount,
    handleFeedCount,
    editCustomAttributePermission,
    viewAllPermission,
    apiEndpointCount,
    viewCustomPropertiesPermission,
  ]);

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateApiCollectionVote(id, data);
      await queryClient.invalidateQueries({
        queryKey: apiCollectionCacheKey,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (apiCollection) {
        const certificationTag: APICollection['certification'] =
          updateCertificationTag(newCertification);
        const updatedTableDetails = {
          ...apiCollection,
          certification: certificationTag,
        };

        await handleAPICollectionUpdate(updatedTableDetails as APICollection);
      }
    },
    [handleAPICollectionUpdate, apiCollection]
  );

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], tab, PageType.APICollection),
    [tabs[0], tab]
  );
  if (isPermissionsLoading || isLoading) {
    return <Loader />;
  }

  if (!viewAPICollectionPermission) {
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

  if (isError) {
    return (
      <ErrorPlaceHolder className="m-0">
        {getEntityMissingError(
          EntityType.API_COLLECTION,
          decodedAPICollectionFQN
        )}
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageLayoutV1 pageTitle={getEntityName(apiCollection)}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          {isAPICollectionLoading ||
          isAPICollectionFetching ||
          !apiCollection ? (
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
              onCertificationUpdate={onCertificationUpdate}
              onDisplayNameUpdate={handleUpdateDisplayName}
              onOwnerUpdate={handleUpdateOwner}
              onRestoreDataAsset={handleRestoreAPICollection}
              onTierUpdate={handleUpdateTier}
              onUpdateVote={updateVote}
              onVersionClick={versionHandler}
            />
          )}
        </Col>
        {apiCollection && (
          <GenericProvider<APICollection>
            customizedPage={customizedPage}
            data={apiCollection}
            isTabExpanded={isTabExpanded}
            isVersionView={false}
            permissions={apiCollectionPermission}
            type={EntityType.API_COLLECTION}
            onUpdate={handleAPICollectionUpdate}>
            <Col className="entity-details-page-tabs" span={24}>
              <Tabs
                activeKey={tab}
                className="tabs-new"
                data-testid="tabs"
                items={tabs}
                tabBarExtraContent={
                  isExpandViewSupported && (
                    <AlignRightIconButton
                      className={isTabExpanded ? 'rotate-180' : ''}
                      title={
                        isTabExpanded ? t('label.collapse') : t('label.expand')
                      }
                      onClick={toggleTabExpanded}
                    />
                  )
                }
                onChange={activeTabHandler}
              />
            </Col>
          </GenericProvider>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default withActivityFeed(APICollectionPage);
