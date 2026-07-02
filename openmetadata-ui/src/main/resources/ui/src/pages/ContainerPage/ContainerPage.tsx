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
import { isEmpty, isUndefined, omitBy, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../components/common/IconButtons/EditIconButton';
import Loader from '../../components/common/Loader/Loader';
import { ContainerChildrenCountContext } from '../../components/Container/ContainerChildren/ContainerChildrenCountContext';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../constants/constants';
import { CustomizeEntityType } from '../../constants/Customize.constants';
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
import { Container } from '../../generated/entity/data/container';
import { Column } from '../../generated/entity/data/table';
import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../generated/system/ui/page';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import {
  containerQueryFn,
  containerQueryKey,
  CONTAINER_DEFAULT_FIELDS,
} from '../../rest/queries/containerQuery';
import {
  addContainerFollower,
  getContainerByName,
  getContainerChildrenByName,
  patchContainerDetails,
  removeContainerFollower,
  restoreContainer,
  updateContainerVotes,
} from '../../rest/storageAPI';
import containerDetailsClassBase from '../../utils/ContainerDetailsClassBase';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  fetchEntityActivityCountInto,
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../utils/FeedUtilsPure';
import Fqn from '../../utils/Fqn';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { addToRecentViewed } from '../../utils/RecentActivityUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import { flattenColumns } from '../../utils/TablePureUtils';
import {
  updateCertificationTag,
  updateTierTag,
} from '../../utils/TagsPureUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
const ContainerPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const { customizedPage, isLoading: loading } = useCustomPages(
    PageType.Container
  );
  const { entityFqn: decodedEntityFqn } = useFqn({
    type: EntityType.CONTAINER,
  });
  const queryClient = useQueryClient();

  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  // {@code resolvedEntityFqn} is the FQN we successfully resolved permissions for. When a
  // deep link points at a column ({@code container.column}), the initial permission lookup
  // 404s and we walk up to the parent container; this stores the parent we ultimately
  // landed on so {@code useQuery} keys cleanly against a stable FQN.
  const [resolvedEntityFqn, setResolvedEntityFqn] = useState<string>('');
  const [activeColumnFqn, setActiveColumnFqn] = useState<string | undefined>(
    undefined
  );

  const [containerPermissions, setContainerPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [childrenCount, setChildrenCount] = useState<number>(0);

  const viewBasicPermission = useMemo(
    () =>
      getPrioritizedViewPermission(containerPermissions, Operation.ViewBasic),
    [containerPermissions]
  );

  const containerCacheKey = useMemo(
    () => containerQueryKey(resolvedEntityFqn, CONTAINER_DEFAULT_FIELDS),
    [resolvedEntityFqn]
  );

  const {
    data: containerData,
    isLoading: containerLoading,
    error: containerError,
  } = useQuery({
    queryKey: containerCacheKey,
    queryFn: containerQueryFn(resolvedEntityFqn, CONTAINER_DEFAULT_FIELDS),
    enabled: Boolean(
      resolvedEntityFqn && viewBasicPermission && !permissionsLoading
    ),
  });

  const isError = useMemo(
    () => (containerError as AxiosError | undefined)?.response?.status === 404,
    [containerError]
  );

  useEffect(() => {
    if (!containerError) {
      return;
    }
    const status = (containerError as AxiosError | undefined)?.response?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });

      return;
    }
    // Column-deep-link fallback: the URL was a column FQN like
    // {@code service.container.column}. Permission resolution succeeded for the column
    // FQN (the permission backend returns an empty permission object rather than a 404),
    // so {@code resolvedEntityFqn} was committed as the column FQN and the {@link
    // useQuery} fired a GET that 404'd because columns aren't containers. Walk up to
    // the parent container FQN and re-resolve, marking the original FQN as the active
    // column so {@code GenericProvider} can deep-link the side panel.
    if (
      status === ClientErrors.NOT_FOUND &&
      !activeColumnFqn &&
      resolvedEntityFqn === decodedEntityFqn
    ) {
      const parentParts = Fqn.split(resolvedEntityFqn).slice(0, -1);
      if (parentParts.length > 0) {
        setActiveColumnFqn(resolvedEntityFqn);
        setResolvedEntityFqn(Fqn.build(...parentParts));

        return;
      }
    }
    if (status !== ClientErrors.NOT_FOUND) {
      showErrorToast(containerError as AxiosError);
    }
    setHasError(true);
  }, [
    containerError,
    navigate,
    activeColumnFqn,
    resolvedEntityFqn,
    decodedEntityFqn,
  ]);

  useEffect(() => {
    if (!containerData) {
      return;
    }
    addToRecentViewed({
      displayName: getEntityName(containerData),
      entityType: EntityType.CONTAINER,
      fqn: containerData.fullyQualifiedName ?? '',
      serviceType: containerData.serviceType,
      timestamp: 0,
      id: containerData.id,
    });
  }, [containerData]);

  const setContainerData = useCallback(
    (
      updater:
        | Container
        | undefined
        | ((prev: Container | undefined) => Container | undefined)
    ) => {
      queryClient.setQueryData<Container | undefined>(
        containerCacheKey,
        updater
      );
    },
    [queryClient, containerCacheKey]
  );

  const refetchContainerData = useCallback(
    () => queryClient.invalidateQueries({ queryKey: containerCacheKey }),
    [queryClient, containerCacheKey]
  );

  const fetchContainerDetail = useCallback(
    () => refetchContainerData(),
    [refetchContainerData]
  );

  const handleFeedCount = useCallback(
    (data: FeedCounts) => setFeedCount(data),
    []
  );

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.CONTAINER, resolvedEntityFqn, handleFeedCount);

  const fetchTaskCounts = useCallback(() => {
    if (resolvedEntityFqn) {
      fetchEntityTaskCountsInto(resolvedEntityFqn, setFeedCount);
    }
  }, [resolvedEntityFqn]);

  const fetchActivityCount = useCallback(() => {
    if (resolvedEntityFqn) {
      fetchEntityActivityCountInto(
        EntityType.CONTAINER,
        resolvedEntityFqn,
        setFeedCount
      );
    }
  }, [resolvedEntityFqn]);

  const fetchResourcePermission = async (
    containerFQN: string,
    isFallback = false
  ) => {
    setPermissionsLoading(true);
    setHasError(false);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.CONTAINER,
        containerFQN
      );

      setContainerPermissions(entityPermission);
      setResolvedEntityFqn(containerFQN);

      // If we successfully resolved using fallback, the remainder is the column
      if (isFallback) {
        // decodedEntityFqn is the full FQN "A.B.Column", containerFQN is "A.B"
        setActiveColumnFqn(decodedEntityFqn);
      } else {
        setActiveColumnFqn(undefined);
      }
    } catch (error) {
      if (
        (error as AxiosError)?.response?.status === ClientErrors.NOT_FOUND &&
        !isFallback
      ) {
        const parentParts = Fqn.split(containerFQN).slice(0, -1);
        if (parentParts.length > 0) {
          const parentFqn = Fqn.build(...parentParts);
          await fetchResourcePermission(parentFqn, true);

          return;
        }
      }

      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
      setHasError(true);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const { deleted, version, isUserFollowing } = useMemo(() => {
    return {
      deleted: containerData?.deleted,
      version: containerData?.version,
      isUserFollowing: containerData?.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
    };
  }, [containerData]);

  const {
    editCustomAttributePermission,
    editLineagePermission,
    viewAllPermission,
    viewCustomPropertiesPermission,
    viewSampleDataPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditTags
        ) && !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditLineage
        ) && !deleted,
      viewAllPermission: containerPermissions.ViewAll,
      viewCustomPropertiesPermission: getPrioritizedViewPermission(
        containerPermissions,
        Operation.ViewCustomFields
      ),
      viewSampleDataPermission: getPrioritizedViewPermission(
        containerPermissions,
        Operation.ViewSampleData
      ),
    }),
    [containerPermissions, deleted]
  );

  const isDataModelEmpty = useMemo(
    () => isEmpty(containerData?.dataModel),
    [containerData]
  );

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      navigate(
        {
          pathname: getEntityDetailsPath(
            EntityType.CONTAINER,
            decodedEntityFqn,
            tabValue
          ),
        },
        { replace: true }
      );
    }
  };

  const handleUpdateContainerData = useCallback(
    async (updatedData: Container) => {
      const jsonPatch = compare(
        omitBy(containerData, isUndefined),
        updatedData
      );

      return patchContainerDetails(containerData?.id ?? '', jsonPatch);
    },
    [containerData]
  );

  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isUndefined(containerData)) {
      return;
    }
    try {
      const { displayName, version } = await handleUpdateContainerData({
        ...containerData,
        displayName: data.displayName,
      });

      setContainerData((prev) => {
        if (isUndefined(prev)) {
          return;
        }

        return {
          ...prev,
          displayName,
          version,
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followContainerMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: Container | undefined }
  >({
    mutationFn: async () => {
      const containerId = containerData?.id ?? '';
      const followerId = currentUser?.id ?? '';
      if (!containerId) {
        return;
      }
      if (isUserFollowing) {
        await removeContainerFollower(containerId, followerId);
      } else {
        await addContainerFollower(containerId, followerId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: containerCacheKey });
      const previous = queryClient.getQueryData<Container | undefined>(
        containerCacheKey
      );
      queryClient.setQueryData<Container | undefined>(
        containerCacheKey,
        (prev) => {
          if (!prev) {
            return prev;
          }
          const currentFollowers = prev.followers ?? [];
          const userId = currentUser?.id ?? '';
          if (isUserFollowing) {
            return {
              ...prev,
              followers: currentFollowers.filter(({ id }) => id !== userId),
            };
          }

          return {
            ...prev,
            followers: [
              ...currentFollowers,
              { id: userId, type: 'user' },
            ] as Container['followers'],
          };
        }
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Container | undefined>(
          containerCacheKey,
          context.previous
        );
      }
      showErrorToast(error as AxiosError);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: containerCacheKey });
    },
  });

  const handleFollowContainer = useCallback(async () => {
    await followContainerMutation.mutateAsync();
  }, [followContainerMutation]);

  const handleUpdateOwner = useCallback(
    async (updatedOwner?: Container['owners']) => {
      if (!containerData) {
        return;
      }
      try {
        const { owners: newOwner, version } = await handleUpdateContainerData({
          ...containerData,
          owners: updatedOwner,
        });

        setContainerData((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            owners: newOwner,
            version,
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [containerData, handleUpdateContainerData, setContainerData]
  );

  const handleUpdateTier = async (updatedTier?: Tag) => {
    if (!containerData) {
      return;
    }
    try {
      const tierTag = updateTierTag(containerData.tags ?? [], updatedTier);
      const { tags: newTags, version } = await handleUpdateContainerData({
        ...containerData,
        tags: tierTag,
      });

      setContainerData((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          tags: newTags,
          version,
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleToggleDelete = useCallback(
    (version?: number) => {
      setContainerData((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          deleted: !prev?.deleted,
          ...(version ? { version } : {}),
        };
      });
    },
    [setContainerData]
  );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    []
  );

  const afterDomainUpdateAction = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as Container;

      setContainerData((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setContainerData]
  );

  const handleRestoreContainer = async () => {
    try {
      const { version: newVersion } = await restoreContainer(
        containerData?.id ?? ''
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.container'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.container'),
        })
      );
    }
  };

  const handleExtensionUpdate = useCallback(
    async (updatedContainer: Container) => {
      if (isUndefined(containerData)) {
        return;
      }

      try {
        const response = await handleUpdateContainerData({
          ...containerData,
          extension: updatedContainer.extension,
        });
        setContainerData(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [containerData, handleUpdateContainerData, setContainerData]
  );

  const versionHandler = () =>
    navigate(
      getVersionPath(EntityType.CONTAINER, decodedEntityFqn, toString(version))
    );

  const handleContainerUpdate = async (updatedData: Container) => {
    try {
      const updatedContainer = await handleUpdateContainerData(updatedData);
      setContainerData((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, ...updatedContainer };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onContainerUpdateCertification = async (
    updatedContainer: Container,
    key?: keyof Container
  ) => {
    try {
      const response = await handleUpdateContainerData(updatedContainer);
      setContainerData((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          version: response.version,
          ...(key ? { [key]: response[key] } : response),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = containerDetailsClassBase.getContainerDetailPageTabs({
      isDataModelEmpty,
      decodedContainerName: decodedEntityFqn,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      viewCustomPropertiesPermission,
      viewSampleDataPermission,
      feedCount: feedCount ?? { totalCount: 0 },
      getEntityFeedCount,
      handleFeedCount,
      tab,
      deleted: deleted ?? false,
      containerData,
      containerPermissions,
      fetchContainerDetail,
      labelMap: tabLabelMap,
      childrenCount,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      isDataModelEmpty ? EntityTabs.CHILDREN : EntityTabs.SCHEMA
    );
  }, [
    isDataModelEmpty,
    containerData,
    containerPermissions,
    decodedEntityFqn,
    editLineagePermission,
    editCustomAttributePermission,
    viewAllPermission,
    viewCustomPropertiesPermission,
    viewSampleDataPermission,
    deleted,
    feedCount.totalCount,
    handleFeedCount,
    handleExtensionUpdate,
    customizedPage?.tabs,
    childrenCount,
  ]);

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateContainerVotes(id, data);

      const details = await getContainerByName(decodedEntityFqn, {
        fields: [
          TabSpecificField.PARENT,
          TabSpecificField.DATAMODEL,
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.EXTENSION,
          TabSpecificField.VOTES,
        ],
      });

      setContainerData(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    // Optimization: check if we are navigating to a column of the current container
    if (resolvedEntityFqn && containerData?.dataModel?.columns) {
      const columns = flattenColumns(
        containerData.dataModel.columns as Column[]
      );
      const matchedColumn = columns.find(
        (col) => col.fullyQualifiedName === decodedEntityFqn
      );

      if (matchedColumn) {
        if (activeColumnFqn !== decodedEntityFqn) {
          setActiveColumnFqn(decodedEntityFqn);
        }

        return;
      }
    }

    // If we are already on the resolved entity, ensure column is cleared and skip fetch
    if (resolvedEntityFqn === decodedEntityFqn) {
      if (activeColumnFqn) {
        setActiveColumnFqn(undefined);
      }

      return;
    }

    // Column-deep-link already resolved: the fallback in {@link fetchResourcePermission}
    // walked up to a parent that owns this column and set {@code activeColumnFqn} to the
    // URL's full FQN. When the React Query container fetch is still in flight, this effect
    // re-runs (because {@code containerData} reference changes) — without this guard it
    // would re-fire {@code fetchResourcePermission}, which flips {@code permissionsLoading}
    // true and cancels the in-flight container fetch, looping until 15s test timeout.
    if (resolvedEntityFqn && activeColumnFqn === decodedEntityFqn) {
      return;
    }

    // On mount or when URL FQN changes, start permission fetch
    fetchResourcePermission(decodedEntityFqn);
  }, [decodedEntityFqn, resolvedEntityFqn, containerData, activeColumnFqn]);

  useEffect(() => {
    if (!resolvedEntityFqn) {
      return;
    }
    // Reset so a stale value from the previous container isn't shown.
    setChildrenCount(0);
    fetchTaskCounts();
    fetchActivityCount();

    // Eager-fetch the children total so the tab badge is correct even before
    // the user opens the Children tab. ContainerChildren is lazily mounted, so
    // its onChildrenCountChange callback only fires once the tab is clicked —
    // for containers that default to a different tab (e.g. dataModel-bearing
    // ones that open the Schema tab), the badge would otherwise stay at 0
    // until the user navigates. limit=0 returns just paging.total without any
    // row payload.
    let cancelled = false;
    getContainerChildrenByName(resolvedEntityFqn, { limit: 0 })
      .then((resp) => {
        if (!cancelled) {
          setChildrenCount(resp?.paging?.total ?? 0);
        }
      })
      .catch(() => {
        // Non-critical; the count will populate when the user opens the tab
        // and ContainerChildren reports it via the context setter.
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedEntityFqn]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], tab, PageType.Container),
    [tabs[0], tab]
  );

  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (containerData) {
        const certificationTag: Container['certification'] =
          updateCertificationTag(newCertification);
        const updatedTableDetails = {
          ...containerData,
          certification: certificationTag,
        };

        await onContainerUpdateCertification(
          updatedTableDetails,
          'certification'
        );
      }
    },
    [containerData, handleContainerUpdate]
  );
  // Rendering
  if (permissionsLoading || containerLoading || loading) {
    return <Loader />;
  }

  if (hasError || isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.container'), decodedEntityFqn)}
      </ErrorPlaceHolder>
    );
  }

  if (!viewBasicPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.container'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (!containerData) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1 pageTitle={getEntityName(containerData)}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={afterDomainUpdateAction}
            dataAsset={containerData}
            entityType={EntityType.CONTAINER}
            openTaskCount={feedCount.openTaskCount}
            permissions={containerPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={handleFollowContainer}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreContainer}
            onTierUpdate={handleUpdateTier}
            onUpdateVote={updateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Container>
          columnFqn={activeColumnFqn}
          customizedPage={customizedPage}
          data={containerData}
          isTabExpanded={isTabExpanded}
          permissions={containerPermissions}
          type={EntityType.CONTAINER as CustomizeEntityType}
          onUpdate={handleContainerUpdate}>
          <ContainerChildrenCountContext.Provider value={setChildrenCount}>
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
                onChange={handleTabChange}
              />
            </Col>
          </ContainerChildrenCountContext.Provider>
        </GenericProvider>

        <LimitWrapper resource="container">
          <></>
        </LimitWrapper>
      </Row>
    </PageLayoutV1>
  );
};

export default withActivityFeed(ContainerPage);
