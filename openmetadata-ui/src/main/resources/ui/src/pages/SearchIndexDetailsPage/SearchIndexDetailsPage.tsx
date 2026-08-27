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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { PageLoader } from '../../components/common/Loader/Loader';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { SearchIndex, TagLabel } from '../../generated/entity/data/searchIndex';
import { PageType } from '../../generated/system/ui/page';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import {
  searchIndexQueryFn,
  searchIndexQueryKey,
} from '../../rest/queries/searchIndexQuery';
import {
  addFollower,
  patchSearchIndexDetails,
  removeFollower,
  restoreSearchIndex,
  updateSearchIndexVotes,
} from '../../rest/SearchIndexAPI';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  fetchEntityActivityCountInto,
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../utils/FeedUtilsPure';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import searchIndexClassBase from '../../utils/SearchIndexDetailsClassBase';
import { defaultFields } from '../../utils/SearchIndexUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TablePureUtils';
import {
  updateCertificationTag,
  updateTierTag,
} from '../../utils/TagsPureUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

function SearchIndexDetailsPage() {
  const { tab: activeTab = EntityTabs.FIELDS } = useRequiredParams<{
    tab: EntityTabs;
  }>();
  const { entityFqn: decodedSearchIndexFQN } = useFqn({
    type: EntityType.SEARCH_INDEX,
  });
  const { t } = useTranslation();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const { customizedPage, isLoading } = useCustomPages(PageType.SearchIndex);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  // Two useEntityPermissions calls in this component, partitioned by deleted-sensitivity —
  // see the analogous comment in TableDetailsPageV1.tsx for the general pattern. This
  // view-tier call must run before {@code searchIndexDetails} exists: {@code viewPermission}
  // gates the entity {@code useQuery}'s `enabled` below, and {@code searchIndexDetails} is
  // that query's own result — a real ordering cycle, not a shortcut. The edit-tier call
  // (only the two canEdit* flags that need `deleted`) lives further down, at the earliest
  // point `deleted` exists; see the comment there. Both calls share one React Query cache
  // entry (same queryKey), so having two costs an extra derivation, not an extra fetch —
  // never diverges into two fetches as long as both pass the identical (resource,
  // identifier) pair.
  const {
    permissions: searchIndexPermissions, // children consume the raw OperationPermission prop
    isLoading: isPermissionsLoading,
    canViewBasic: viewPermission,
    canViewAll: viewAllPermission,
    canViewCustomFields: viewCustomPropertiesPermission,
    canViewSampleData: viewSampleDataPermission,
  } = useEntityPermissions(ResourceEntity.SEARCH_INDEX, decodedSearchIndexFQN);

  const searchIndexCacheKey = useMemo(
    () => searchIndexQueryKey(decodedSearchIndexFQN, defaultFields),
    [decodedSearchIndexFQN]
  );

  const {
    data: searchIndexDetails,
    isLoading: searchIndexLoading,
    error: searchIndexError,
  } = useQuery({
    queryKey: searchIndexCacheKey,
    queryFn: searchIndexQueryFn(decodedSearchIndexFQN, defaultFields),
    enabled: Boolean(
      decodedSearchIndexFQN && viewPermission && !isPermissionsLoading
    ),
  });

  useEffect(() => {
    if (!searchIndexDetails) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(searchIndexDetails),
      entityType: EntityType.SEARCH_INDEX,
      fqn: searchIndexDetails.fullyQualifiedName ?? '',
      serviceType: searchIndexDetails.serviceType,
      timestamp: 0,
      id: searchIndexDetails.id,
    });
  }, [searchIndexDetails]);

  const setSearchIndexDetails = useCallback(
    (
      updater:
        | SearchIndex
        | undefined
        | ((prev: SearchIndex | undefined) => SearchIndex | undefined)
    ) => {
      queryClient.setQueryData<SearchIndex | undefined>(
        searchIndexCacheKey,
        updater
      );
    },
    [queryClient, searchIndexCacheKey]
  );

  const refetchSearchIndexDetails = useCallback(
    () => queryClient.invalidateQueries({ queryKey: searchIndexCacheKey }),
    [queryClient, searchIndexCacheKey]
  );

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

  // Edit-tier useEntityPermissions call — the counterpart to the view-tier call near the
  // top of this component (see its comment for why this component calls the hook twice).
  // This is the earliest point `deleted` exists (destructured just above, from
  // {@code searchIndexDetails} resolved by the entity useQuery): both canEdit* flags this
  // page uses are gated on it — don't destructure a canEdit* flag or `can` from the
  // view-tier call above, it was captured before `deleted` existed and would silently
  // return an ungated edit permission.
  const {
    canEditCustomFields: editCustomAttributePermission,
    canEditLineage: editLineagePermission,
  } = useEntityPermissions(ResourceEntity.SEARCH_INDEX, decodedSearchIndexFQN, {
    deleted: Boolean(deleted),
  });

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(
      EntityType.SEARCH_INDEX,
      decodedSearchIndexFQN,
      handleFeedCount
    );

  const fetchTaskCounts = useCallback(() => {
    if (decodedSearchIndexFQN) {
      fetchEntityTaskCountsInto(decodedSearchIndexFQN, setFeedCount);
    }
  }, [decodedSearchIndexFQN]);

  const fetchActivityCount = useCallback(() => {
    if (decodedSearchIndexFQN) {
      fetchEntityActivityCountInto(
        EntityType.SEARCH_INDEX,
        decodedSearchIndexFQN,
        setFeedCount
      );
    }
  }, [decodedSearchIndexFQN]);

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
      viewCustomPropertiesPermission,
      feedCount,
      activeTab,
      getEntityFeedCount,
      fetchSearchIndexDetails: refetchSearchIndexDetails,
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
    viewCustomPropertiesPermission,
    searchIndexDetails,
    searchIndexDetails?.extension,
    onDescriptionUpdate,
    refetchSearchIndexDetails,
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

  const isFollowing = useMemo(
    () => followers?.some(({ id }) => id === USERId),
    [followers, USERId]
  );

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: SearchIndex | undefined }
  >({
    mutationFn: async () => {
      if (!searchIndexId) {
        return;
      }
      if (isFollowing) {
        await removeFollower(searchIndexId, USERId);
      } else {
        await addFollower(searchIndexId, USERId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: searchIndexCacheKey });
      const previous = queryClient.getQueryData<SearchIndex | undefined>(
        searchIndexCacheKey
      );
      queryClient.setQueryData<SearchIndex | undefined>(
        searchIndexCacheKey,
        (prev) => {
          if (!prev) {
            return prev;
          }
          const currentFollowers = prev.followers ?? [];
          if (isFollowing) {
            return {
              ...prev,
              followers: currentFollowers.filter(({ id }) => id !== USERId),
            };
          }

          return {
            ...prev,
            followers: [
              ...currentFollowers,
              { id: USERId, type: 'user' },
            ] as SearchIndex['followers'],
          };
        }
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<SearchIndex | undefined>(
          searchIndexCacheKey,
          context.previous
        );
      }
      showErrorToast(
        error as AxiosError,
        isFollowing
          ? t('server.entity-unfollow-error', {
              entity: getEntityName(searchIndexDetails),
            })
          : t('server.entity-follow-error', {
              entity: getEntityName(searchIndexDetails),
            })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: searchIndexCacheKey });
    },
  });

  const handleFollowSearchIndex = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const onUpdateVote = async (data: QueryVote, id: string) => {
    try {
      await updateSearchIndexVotes(id, data);
      await queryClient.invalidateQueries({ queryKey: searchIndexCacheKey });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

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

  const afterDomainUpdateAction = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as SearchIndex;

      setSearchIndexDetails((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setSearchIndexDetails]
  );

  useEffect(() => {
    if (viewPermission) {
      fetchTaskCounts();
      fetchActivityCount();
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
  if (isLoading || isPermissionsLoading || searchIndexLoading) {
    return <PageLoader />;
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

  if (searchIndexError || !searchIndexDetails) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <PageLayoutV1
      pageTitle={entityName}
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
