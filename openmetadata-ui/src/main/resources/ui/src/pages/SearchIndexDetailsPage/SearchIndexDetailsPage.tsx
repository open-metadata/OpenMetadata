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

import { Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import { EntityTags } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { SearchIndex, TagLabel } from '../../generated/entity/data/searchIndex';
import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../generated/system/ui/page';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import {
  addFollower,
  getSearchIndexDetailsByFQN,
  patchSearchIndexDetails,
  removeFollower,
  restoreSearchIndex,
  updateSearchIndexVotes,
} from '../../rest/SearchIndexAPI';
import { addToRecentViewed, getFeedCounts } from '../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import searchIndexClassBase from '../../utils/SearchIndexDetailsClassBase';
import { defaultFields } from '../../utils/SearchIndexUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { updateCertificationTag, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

function SearchIndexDetailsPage() {
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { tab: activeTab = EntityTabs.FIELDS } =
    useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: decodedSearchIndexFQN } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const [loading, setLoading] = useState<boolean>(true);
  const [searchIndexDetails, setSearchIndexDetails] = useState<SearchIndex>();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const { customizedPage, isLoading } = useCustomPages(PageType.SearchIndex);
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const [searchIndexPermissions, setSearchIndexPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const viewPermission = useMemo(
    () =>
      getPrioritizedViewPermission(searchIndexPermissions, Operation.ViewBasic),
    [searchIndexPermissions]
  );

  const fetchSearchIndexDetails = async () => {
    setLoading(true);
    try {
      const fields = defaultFields;
      const details = await getSearchIndexDetailsByFQN(decodedSearchIndexFQN, {
        fields,
      });

      setSearchIndexDetails(details);
      addToRecentViewed({
        displayName: getEntityName(details),
        entityType: EntityType.SEARCH_INDEX,
        fqn: details.fullyQualifiedName ?? '',
        serviceType: details.serviceType,
        timestamp: 0,
        id: details.id,
      });
    } catch {
      // Error here
    } finally {
      setLoading(false);
    }
  };

  const {
    searchIndexTags,
    owners,
    version,
    followers = [],
    description,
    entityName,
    deleted,
    id: searchIndexId = '',
  } = useMemo(() => {
    if (searchIndexDetails) {
      const { tags } = searchIndexDetails;

      return {
        ...searchIndexDetails,
        tier: getTierTags(tags ?? []),
        searchIndexTags: getTagsWithoutTier(tags ?? []),
        entityName: getEntityName(searchIndexDetails),
      };
    }

    return {} as SearchIndex & {
      tier: TagLabel;
      searchIndexTags: EntityTags[];
      entityName: string;
    };
  }, [searchIndexDetails, searchIndexDetails?.tags]);

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    viewSampleDataPermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(
          searchIndexPermissions,
          Operation.EditTags
        ) && !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          searchIndexPermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          searchIndexPermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          searchIndexPermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(
          searchIndexPermissions,
          Operation.EditLineage
        ) && !deleted,
      viewSampleDataPermission: getPrioritizedViewPermission(
        searchIndexPermissions,
        Operation.ViewSampleData
      ),
      viewAllPermission: searchIndexPermissions.ViewAll,
    }),
    [
      searchIndexPermissions,
      deleted,
      getPrioritizedEditPermission,
      getPrioritizedViewPermission,
    ]
  );

  const fetchResourcePermission = useCallback(
    async (entityFQN: string) => {
      try {
        const searchIndexPermission = await getEntityPermissionByFqn(
          ResourceEntity.SEARCH_INDEX,
          entityFQN
        );

        setSearchIndexPermissions(searchIndexPermission);
      } finally {
        setLoading(false);
      }
    },
    [getEntityPermissionByFqn]
  );

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(
      EntityType.SEARCH_INDEX,
      decodedSearchIndexFQN,
      handleFeedCount
    );

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(
          EntityType.SEARCH_INDEX,
          decodedSearchIndexFQN,
          activeKey
        ),
        { replace: true }
      );
    }
  };
  const saveUpdatedSearchIndexData = useCallback(
    (updatedData: SearchIndex) => {
      const jsonPatch = compare(
        omitBy(searchIndexDetails, isUndefined),
        updatedData
      );

      return patchSearchIndexDetails(searchIndexId, jsonPatch);
    },
    [searchIndexDetails, searchIndexId]
  );

  const onSearchIndexUpdate = async (
    updatedSearchIndex: SearchIndex,
    key?: keyof SearchIndex
  ) => {
    try {
      const res = await saveUpdatedSearchIndexData(updatedSearchIndex);

      setSearchIndexDetails((previous) => {
        if (!previous) {
          return;
        }

        return {
          ...previous,
          ...res,
          ...(key && { [key]: res[key] }),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (newOwners?: SearchIndex['owners']) => {
      if (!searchIndexDetails) {
        return;
      }
      const updatedSearchIndexDetails = {
        ...searchIndexDetails,
        owners: newOwners,
      };
      await onSearchIndexUpdate(updatedSearchIndexDetails, 'owners');
    },
    [owners, searchIndexDetails]
  );

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (!searchIndexDetails) {
      return;
    }
    if (description !== updatedHTML) {
      const updatedSearchIndexDetails = {
        ...searchIndexDetails,
        description: updatedHTML,
      };
      await onSearchIndexUpdate(updatedSearchIndexDetails, 'description');
    }
  };

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!searchIndexDetails) {
      return;
    }
    const updatedSearchIndex = {
      ...searchIndexDetails,
      displayName: data.displayName,
    };
    await onSearchIndexUpdate(updatedSearchIndex, 'displayName');
  };

  const onExtensionUpdate = useCallback(
    async (updatedData: SearchIndex) => {
      searchIndexDetails &&
        (await onSearchIndexUpdate(
          {
            ...searchIndexDetails,
            extension: updatedData.extension,
          },
          'extension'
        ));
    },
    [saveUpdatedSearchIndexData, searchIndexDetails]
  );

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);
    const allTabs = searchIndexClassBase.getSearchIndexDetailPageTabs({
      searchIndexDetails: searchIndexDetails ?? ({} as SearchIndex),
      viewAllPermission,
      feedCount,
      activeTab,
      getEntityFeedCount,
      fetchSearchIndexDetails,
      handleFeedCount,
      viewSampleDataPermission,
      deleted: deleted ?? false,
      editLineagePermission,
      editCustomAttributePermission,
      onExtensionUpdate,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      allTabs,
      customizedPage?.tabs,
      EntityTabs.FIELDS
    );
  }, [
    activeTab,
    searchIndexDetails,
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    entityName,
    onExtensionUpdate,
    handleFeedCount,
    getEntityFeedCount,
    viewSampleDataPermission,
    editLineagePermission,
    editCustomAttributePermission,
    viewAllPermission,
    searchIndexDetails,
    searchIndexDetails?.extension,
    onDescriptionUpdate,
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
  ]);

  const onTierUpdate = useCallback(
    async (newTier?: Tag) => {
      if (searchIndexDetails) {
        const tierTag: SearchIndex['tags'] = updateTierTag(
          searchIndexTags,
          newTier
        );
        const updatedSearchIndexDetails = {
          ...searchIndexDetails,
          tags: tierTag,
        };

        await onSearchIndexUpdate(updatedSearchIndexDetails, 'tags');
      }
    },
    [searchIndexDetails, onSearchIndexUpdate, searchIndexTags]
  );

  const handleToggleDelete = (version?: number) => {
    setSearchIndexDetails((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });
  };

  const handleRestoreSearchIndex = async () => {
    try {
      const { version: newVersion } = await restoreSearchIndex(searchIndexId);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.search-index'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.search-index'),
        })
      );
    }
  };

  const followSearchIndex = useCallback(async () => {
    try {
      const res = await addFollower(searchIndexId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setSearchIndexDetails((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, followers: newFollowers };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(searchIndexDetails),
        })
      );
    }
  }, [USERId, searchIndexId]);

  const unFollowSearchIndex = useCallback(async () => {
    try {
      const res = await removeFollower(searchIndexId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setSearchIndexDetails((pre) => {
        if (!pre) {
          return pre;
        }

        return {
          ...pre,
          followers: pre.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(searchIndexDetails),
        })
      );
    }
  }, [USERId, searchIndexId]);

  const onUpdateVote = async (data: QueryVote, id: string) => {
    try {
      await updateSearchIndexVotes(id, data);
      const details = await getSearchIndexDetailsByFQN(decodedSearchIndexFQN, {
        fields: defaultFields,
      });
      setSearchIndexDetails(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === USERId),
    };
  }, [followers, USERId]);

  const handleFollowSearchIndex = useCallback(async () => {
    isFollowing ? await unFollowSearchIndex() : await followSearchIndex();
  }, [isFollowing, unFollowSearchIndex, followSearchIndex]);

  const versionHandler = useCallback(() => {
    version &&
      navigate(
        getVersionPath(
          EntityType.SEARCH_INDEX,
          decodedSearchIndexFQN,
          version + ''
        )
      );
  }, [version]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as SearchIndex;

    setSearchIndexDetails((data) => ({
      ...(updatedData ?? data),
      version: updatedData.version,
    }));
  }, []);

  useEffect(() => {
    if (decodedSearchIndexFQN) {
      fetchResourcePermission(decodedSearchIndexFQN);
    }
  }, [decodedSearchIndexFQN]);

  useEffect(() => {
    if (viewPermission) {
      fetchSearchIndexDetails();
      getEntityFeedCount();
    }
  }, [decodedSearchIndexFQN, viewPermission]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (searchIndexDetails) {
        const certificationTag: SearchIndex['certification'] =
          updateCertificationTag(newCertification);
        const updatedTableDetails = {
          ...searchIndexDetails,
          certification: certificationTag,
        };

        await onSearchIndexUpdate(updatedTableDetails, 'certification');
      }
    },
    [onSearchIndexUpdate, searchIndexDetails]
  );

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.SearchIndex),
    [tabs[0], activeTab]
  );
  if (isLoading || loading) {
    return <Loader />;
  }

  if (!viewPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.search-index'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (!searchIndexDetails) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.search-index'),
      })}
      title={t('label.entity-detail-plural', {
        entity: t('label.search-index'),
      })}>
      <Row gutter={[0, 12]}>
        <Col data-testid="entity-page-header" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={afterDomainUpdateAction}
            dataAsset={searchIndexDetails}
            entityType={EntityType.SEARCH_INDEX}
            openTaskCount={feedCount.openTaskCount}
            permissions={searchIndexPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleDisplayNameUpdate}
            onFollowClick={handleFollowSearchIndex}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreSearchIndex}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>

        <GenericProvider<SearchIndex>
          customizedPage={customizedPage}
          data={searchIndexDetails}
          isTabExpanded={isTabExpanded}
          permissions={searchIndexPermissions}
          type={EntityType.SEARCH_INDEX}
          onUpdate={onSearchIndexUpdate}>
          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={activeTab}
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
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>

        <LimitWrapper resource="searchIndex">
          <></>
        </LimitWrapper>
      </Row>
    </PageLayoutV1>
  );
}

export default withActivityFeed(SearchIndexDetailsPage);
