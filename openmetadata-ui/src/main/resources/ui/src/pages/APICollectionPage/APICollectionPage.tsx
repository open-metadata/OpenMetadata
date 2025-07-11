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
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
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
  getApiCollectionByFQN,
  patchApiCollection,
  restoreApiCollection,
  updateApiCollectionVote,
} from '../../rest/apiCollectionsAPI';
import { getApiEndPoints } from '../../rest/apiEndpointsAPI';
import apiCollectionClassBase from '../../utils/APICollection/APICollectionClassBase';
import { getEntityMissingError, getFeedCounts } from '../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
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
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const [apiCollection, setAPICollection] = useState<APICollection>(
    {} as APICollection
  );
  const [isAPICollectionLoading, setIsAPICollectionLoading] =
    useState<boolean>(true);
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

  const extraDropdownContent = useMemo(
    () =>
      entityUtilClassBase.getManageExtraOptions(
        EntityType.API_COLLECTION,
        decodedAPICollectionFQN,
        apiCollectionPermission,
        apiCollection,
        navigate
      ),
    [apiCollectionPermission, decodedAPICollectionFQN, apiCollection]
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

  const viewAPICollectionPermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        apiCollectionPermission,
        PermissionOperation.ViewBasic
      ),
    [apiCollectionPermission, getPrioritizedViewPermission]
  );

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

  const fetchAPICollectionDetails = useCallback(async () => {
    try {
      setIsAPICollectionLoading(true);
      const response = await getApiCollectionByFQN(decodedAPICollectionFQN, {
        // eslint-disable-next-line max-len
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.DOMAIN},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION},${TabSpecificField.DATA_PRODUCTS}`,
        include: Include.All,
      });
      setAPICollection(response);
      setFilters({
        showDeletedEndpoints: response.deleted ?? false,
      });
    } catch (err) {
      // Error
      if ((err as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      }
    } finally {
      setIsAPICollectionLoading(false);
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
    apiCollection,
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

      setFilters({
        showDeletedEndpoints: !prev.deleted,
      });

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });
  };

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
  }, [apiCollectionId]);

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
  }, [currentVersion, decodedAPICollectionFQN]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as APICollection;

    setAPICollection((data) => ({
      ...(updatedData ?? data),
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
  }, [
    viewAPICollectionPermission,
    fetchAPICollectionDetails,
    getEntityFeedCount,
  ]);

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

  const { editCustomAttributePermission, viewAllPermission } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(
          apiCollectionPermission,
          PermissionOperation.EditTags
        ) && !apiCollection.deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          apiCollectionPermission,
          PermissionOperation.EditGlossaryTerms
        ) && !apiCollection.deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          apiCollectionPermission,
          PermissionOperation.EditDescription
        ) && !apiCollection.deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          apiCollectionPermission,
          PermissionOperation.EditCustomFields
        ) && !apiCollection.deleted,
      viewAllPermission: apiCollectionPermission.ViewAll,
    }),
    [apiCollectionPermission, apiCollection, getPrioritizedEditPermission]
  );

  const handleAPICollectionUpdate = async (updatedData: APICollection) => {
    const response = await saveUpdatedAPICollectionData({
      ...apiCollection,
      ...updatedData,
    });
    setAPICollection(response);
  };

  const tabs: TabsProps['items'] = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = apiCollectionClassBase.getAPICollectionDetailPageTabs({
      activeTab: tab,
      feedCount,
      apiCollection,
      fetchAPICollectionDetails,
      getEntityFeedCount,
      handleFeedCount,
      editCustomAttributePermission,
      viewAllPermission,
      apiEndpointCount,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.API_ENDPOINT
    );
  }, [
    tab,
    customizedPage,
    feedCount,
    apiCollection,
    fetchAPICollectionDetails,
    getEntityFeedCount,
    handleFeedCount,
    editCustomAttributePermission,
    viewAllPermission,
    apiEndpointCount,
  ]);

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

  return (
    <PageLayoutV1
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
          <Col span={24}>
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
        </Row>
      )}
    </PageLayoutV1>
  );
};

export default withActivityFeed(APICollectionPage);
