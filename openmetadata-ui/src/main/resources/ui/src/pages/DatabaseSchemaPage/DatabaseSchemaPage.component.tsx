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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import ProfilerSettings from '../../components/Database/Profiler/ProfilerSettings/ProfilerSettings';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  INITIAL_PAGING_VALUE,
  INITIAL_TABLE_FILTERS,
  ROUTES,
} from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
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
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../generated/system/ui/page';
import { Include } from '../../generated/type/include';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { useTableFilters } from '../../hooks/useTableFilters';
import { FeedCounts } from '../../interface/feed.interface';
import {
  addFollowers,
  getDatabaseSchemaDetailsByFQN,
  patchDatabaseSchemaDetails,
  removeFollowers,
  restoreDatabaseSchema,
  updateDatabaseSchemaVotes,
} from '../../rest/databaseAPI';
import {
  databaseSchemaQueryFn,
  databaseSchemaQueryKey,
  DATABASE_SCHEMA_DEFAULT_FIELDS,
} from '../../rest/queries/databaseSchemaQuery';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import { getTableList } from '../../rest/tableAPI';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import databaseSchemaClassBase from '../../utils/DatabaseSchemaClassBase';
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

const DatabaseSchemaPage: FunctionComponent = () => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const queryClient = useQueryClient();

  const { setFilters, filters } = useTableFilters(INITIAL_TABLE_FILTERS);
  const { tab: activeTab = EntityTabs.TABLE } = useRequiredParams<{
    tab: EntityTabs;
  }>();
  const { entityFqn: decodedDatabaseSchemaFQN } = useFqn({
    type: EntityType.DATABASE_SCHEMA,
  });
  const navigate = useNavigate();

  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const { customizedPage } = useCustomPages(PageType.DatabaseSchema);
  const [databaseSchemaPermission, setDatabaseSchemaPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [storedProcedureCount, setStoredProcedureCount] = useState(0);
  const [tableCount, setTableCount] = useState(0);

  const [updateProfilerSetting, setUpdateProfilerSetting] =
    useState<boolean>(false);

  const viewDatabaseSchemaPermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        databaseSchemaPermission,
        PermissionOperation.ViewBasic
      ),
    [databaseSchemaPermission]
  );

  const viewUsagePermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        databaseSchemaPermission,
        PermissionOperation.ViewUsage
      ),
    [databaseSchemaPermission]
  );

  const databaseSchemaFields = useMemo(() => {
    // {@code DATABASE_SCHEMA_DEFAULT_FIELDS} matches the order
    // {@code [OWNERS, TAGS, DOMAINS, VOTES, EXTENSION, FOLLOWERS, DATA_PRODUCTS]}; when the
    // viewer has {@code ViewUsage}, we splice in {@code USAGE_SUMMARY} immediately after
    // {@code OWNERS} to match the legacy fetch order the tests assert against.
    if (viewUsagePermission) {
      return [
        TabSpecificField.OWNERS,
        TabSpecificField.USAGE_SUMMARY,
        TabSpecificField.TAGS,
        TabSpecificField.DOMAINS,
        TabSpecificField.VOTES,
        TabSpecificField.EXTENSION,
        TabSpecificField.FOLLOWERS,
        TabSpecificField.DATA_PRODUCTS,
      ].join(',');
    }

    return DATABASE_SCHEMA_DEFAULT_FIELDS;
  }, [viewUsagePermission]);

  const databaseSchemaCacheKey = useMemo(
    () =>
      databaseSchemaQueryKey(decodedDatabaseSchemaFQN, databaseSchemaFields),
    [decodedDatabaseSchemaFQN, databaseSchemaFields]
  );

  const {
    data: databaseSchema,
    isLoading: databaseSchemaLoading,
    error: databaseSchemaError,
  } = useQuery({
    queryKey: databaseSchemaCacheKey,
    queryFn: databaseSchemaQueryFn(
      decodedDatabaseSchemaFQN,
      databaseSchemaFields
    ),
    enabled: Boolean(
      decodedDatabaseSchemaFQN &&
        viewDatabaseSchemaPermission &&
        !isPermissionsLoading
    ),
  });

  const isError = useMemo(
    () =>
      (databaseSchemaError as AxiosError | undefined)?.response?.status === 404,
    [databaseSchemaError]
  );

  useEffect(() => {
    const status = (databaseSchemaError as AxiosError | undefined)?.response
      ?.status;
    if (status === ClientErrors.FORBIDDEN) {
      navigate(ROUTES.FORBIDDEN, { replace: true });
    } else if (status && status !== 404) {
      showErrorToast(
        databaseSchemaError as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.database-schema'),
          entityName: decodedDatabaseSchemaFQN,
        })
      );
    }
  }, [databaseSchemaError, navigate, decodedDatabaseSchemaFQN, t]);

  const setDatabaseSchema = useCallback(
    (
      updater:
        | DatabaseSchema
        | undefined
        | ((prev: DatabaseSchema | undefined) => DatabaseSchema | undefined)
    ) => {
      queryClient.setQueryData<DatabaseSchema | undefined>(
        databaseSchemaCacheKey,
        updater
      );
    },
    [queryClient, databaseSchemaCacheKey]
  );

  const refetchDatabaseSchema = useCallback(
    () => queryClient.invalidateQueries({ queryKey: databaseSchemaCacheKey }),
    [queryClient, databaseSchemaCacheKey]
  );

  const fetchDatabaseSchemaDetails = useCallback(
    () => refetchDatabaseSchema(),
    [refetchDatabaseSchema]
  );

  // Sync filters when the fetched schema is deleted.
  useEffect(() => {
    if (databaseSchema?.deleted) {
      setFilters({
        showDeletedTables: databaseSchema.deleted,
      });
    }
  }, [databaseSchema?.deleted]);

  const isFollowing = useMemo(
    () =>
      databaseSchema?.followers?.some(({ id }) => id === currentUser?.id) ??
      false,
    [currentUser, databaseSchema]
  );
  const extraDropdownContent = useMemo(
    () =>
      entityUtilClassBase.getManageExtraOptions(
        EntityType.DATABASE_SCHEMA,
        decodedDatabaseSchemaFQN,
        databaseSchemaPermission,
        databaseSchema ?? ({} as DatabaseSchema),
        navigate
      ),
    [
      databaseSchemaPermission,
      decodedDatabaseSchemaFQN,
      databaseSchema?.deleted,
    ]
  );

  const { version: currentVersion, id: databaseSchemaId = '' } = useMemo(
    () => databaseSchema ?? ({} as DatabaseSchema),
    [databaseSchema]
  );

  const fetchDatabaseSchemaPermission = useCallback(async () => {
    setIsPermissionsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE_SCHEMA,
        decodedDatabaseSchemaFQN
      );
      setDatabaseSchemaPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPermissionsLoading(false);
    }
  }, [decodedDatabaseSchemaFQN]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = useCallback(() => {
    getFeedCounts(
      EntityType.DATABASE_SCHEMA,
      decodedDatabaseSchemaFQN,
      handleFeedCount
    );
  }, [decodedDatabaseSchemaFQN, handleFeedCount]);

  const fetchTaskCounts = useCallback(() => {
    if (decodedDatabaseSchemaFQN) {
      fetchEntityTaskCountsInto(decodedDatabaseSchemaFQN, setFeedCount);
    }
  }, [decodedDatabaseSchemaFQN]);

  const fetchActivityCount = useCallback(() => {
    if (decodedDatabaseSchemaFQN) {
      fetchEntityActivityCountInto(
        EntityType.DATABASE_SCHEMA,
        decodedDatabaseSchemaFQN,
        setFeedCount
      );
    }
  }, [decodedDatabaseSchemaFQN]);

  const saveUpdatedDatabaseSchemaData = useCallback(
    (updatedData: DatabaseSchema) => {
      let jsonPatch: Operation[] = [];
      if (databaseSchema) {
        jsonPatch = compare(databaseSchema, updatedData);
      }

      return patchDatabaseSchemaDetails(databaseSchemaId, jsonPatch);
    },
    [databaseSchemaId, databaseSchema]
  );

  const activeTabHandler = useCallback(
    (activeKey: string) => {
      if (activeKey !== activeTab) {
        navigate(
          {
            pathname: getEntityDetailsPath(
              EntityType.DATABASE_SCHEMA,
              decodedDatabaseSchemaFQN,
              activeKey
            ),
          },
          { replace: true }
        );
      }
    },
    [activeTab, decodedDatabaseSchemaFQN]
  );

  const handleUpdateOwner = useCallback(
    async (owners: DatabaseSchema['owners']) => {
      if (!databaseSchema) {
        return;
      }
      try {
        const updatedData = {
          ...databaseSchema,
          owners,
        };

        const response = await saveUpdatedDatabaseSchemaData(
          updatedData as DatabaseSchema
        );

        setDatabaseSchema(response);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.database-schema'),
          })
        );
      }
    },
    [databaseSchema, saveUpdatedDatabaseSchemaData, setDatabaseSchema, t]
  );

  const handleUpdateTier = useCallback(
    async (newTier?: Tag) => {
      if (!databaseSchema) {
        return;
      }
      const tierTag = updateTierTag(databaseSchema?.tags ?? [], newTier);
      const updatedSchemaDetails = {
        ...databaseSchema,
        tags: tierTag,
      };

      const res = await saveUpdatedDatabaseSchemaData(
        updatedSchemaDetails as DatabaseSchema
      );
      setDatabaseSchema(res);
    },
    [saveUpdatedDatabaseSchemaData, databaseSchema, setDatabaseSchema]
  );

  const handleUpdateDisplayName = useCallback(
    async (data: EntityName) => {
      if (isUndefined(databaseSchema)) {
        return;
      }
      const updatedData = { ...databaseSchema, displayName: data.displayName };

      try {
        const res = await saveUpdatedDatabaseSchemaData(updatedData);
        setDatabaseSchema(res);
      } catch (error) {
        showErrorToast(error as AxiosError, t('server.api-error'));
      }
    },
    [databaseSchema, saveUpdatedDatabaseSchemaData, setDatabaseSchema, t]
  );

  const handleToggleDelete = useCallback(
    (version?: number) => {
      navigate('', {
        state: {
          cursorData: null,
          pageSize: null,
          currentPage: INITIAL_PAGING_VALUE,
          replace: true,
        },
      });
      setDatabaseSchema((prev) => {
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
    [navigate, setDatabaseSchema]
  );

  const handleRestoreDatabaseSchema = useCallback(async () => {
    try {
      const { version: newVersion } = await restoreDatabaseSchema(
        databaseSchemaId
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.database-schema'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.database-schema'),
        })
      );
    }
  }, [databaseSchemaId, handleToggleDelete]);

  const versionHandler = useCallback(() => {
    currentVersion &&
      navigate(
        getVersionPath(
          EntityType.DATABASE_SCHEMA,
          decodedDatabaseSchemaFQN,
          String(currentVersion),
          EntityTabs.TABLE
        )
      );
  }, [currentVersion, decodedDatabaseSchemaFQN]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    []
  );

  const afterDomainUpdateAction = useCallback(
    (data: DataAssetWithDomains) => {
      const updatedData = data as DatabaseSchema;

      setDatabaseSchema((prev) => ({
        ...(updatedData ?? prev),
        version: updatedData.version,
      }));
    },
    [setDatabaseSchema]
  );

  // Fetch stored procedure count to show it in Tab label
  const fetchStoreProcedureCount = useCallback(async () => {
    try {
      const { paging } = await getStoredProceduresList({
        databaseSchema: decodedDatabaseSchemaFQN,
        limit: 0,
      });
      setStoredProcedureCount(paging.total);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [decodedDatabaseSchemaFQN]);

  const fetchTableCount = useCallback(async () => {
    try {
      const { paging } = await getTableList({
        databaseSchema: decodedDatabaseSchemaFQN,
        limit: 0,
        include: filters.showDeletedTables
          ? Include.Deleted
          : Include.NonDeleted,
      });
      setTableCount(paging.total);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [decodedDatabaseSchemaFQN, filters.showDeletedTables]);

  useEffect(() => {
    fetchDatabaseSchemaPermission();
  }, [decodedDatabaseSchemaFQN]);

  useEffect(() => {
    if (viewDatabaseSchemaPermission) {
      fetchStoreProcedureCount();
      fetchTaskCounts();
      fetchActivityCount();
    }
  }, [
    viewDatabaseSchemaPermission,
    fetchStoreProcedureCount,
    fetchTaskCounts,
    fetchActivityCount,
  ]);

  useEffect(() => {
    fetchTableCount();
  }, [filters.showDeletedTables]);

  const {
    editCustomAttributePermission,
    viewAllPermission,
    viewCustomPropertiesPermission,
  } = useMemo(
    () => ({
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          databaseSchemaPermission,
          PermissionOperation.EditCustomFields
        ) && !databaseSchema?.deleted,
      viewAllPermission: databaseSchemaPermission.ViewAll,
      viewCustomPropertiesPermission: getPrioritizedViewPermission(
        databaseSchemaPermission,
        PermissionOperation.ViewCustomFields
      ),
    }),
    [databaseSchemaPermission, databaseSchema]
  );

  const handleExtensionUpdate = async (schema: DatabaseSchema) => {
    if (!databaseSchema) {
      return;
    }
    const response = await saveUpdatedDatabaseSchemaData({
      ...databaseSchema,
      extension: schema.extension,
    });
    setDatabaseSchema((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        extension: response.extension,
      };
    });
  };

  const handleUpdateDatabaseSchema = async (data: DatabaseSchema) => {
    try {
      const response = await saveUpdatedDatabaseSchemaData(data);
      setDatabaseSchema(response);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.database-schema'),
        })
      );
    }
  };

  const tabs: TabsProps['items'] = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = databaseSchemaClassBase.getDatabaseSchemaPageTabs({
      feedCount,
      activeTab,
      editCustomAttributePermission,
      viewAllPermission,
      viewCustomPropertiesPermission,
      databaseSchemaPermission,
      storedProcedureCount,
      getEntityFeedCount,
      fetchDatabaseSchemaDetails,
      handleFeedCount,
      tableCount,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.TABLE
    );
  }, [
    feedCount,
    activeTab,
    databaseSchema,
    editCustomAttributePermission,
    tableCount,
    viewAllPermission,
    viewCustomPropertiesPermission,
    storedProcedureCount,
    databaseSchemaPermission,
    handleExtensionUpdate,
    getEntityFeedCount,
    fetchDatabaseSchemaDetails,
    handleFeedCount,
  ]);

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateDatabaseSchemaVotes(id, data);
      const response = await getDatabaseSchemaDetailsByFQN(
        decodedDatabaseSchemaFQN,
        {
          fields: [
            TabSpecificField.OWNERS,
            ...(viewUsagePermission ? [TabSpecificField.USAGE_SUMMARY] : []),
            TabSpecificField.TAGS,
            TabSpecificField.VOTES,
          ],
          include: Include.All,
        }
      );
      setDatabaseSchema(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () =>
      checkIfExpandViewSupported(tabs[0], activeTab, PageType.DatabaseSchema),
    [tabs[0], activeTab]
  );

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: DatabaseSchema | undefined }
  >({
    mutationFn: async () => {
      if (!databaseSchemaId) {
        return;
      }
      if (isFollowing) {
        await removeFollowers(
          databaseSchemaId,
          USERId,
          GlobalSettingOptions.DATABASE_SCHEMA
        );
      } else {
        await addFollowers(
          databaseSchemaId,
          USERId,
          GlobalSettingOptions.DATABASE_SCHEMA
        );
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: databaseSchemaCacheKey });
      const previous = queryClient.getQueryData<DatabaseSchema | undefined>(
        databaseSchemaCacheKey
      );
      queryClient.setQueryData<DatabaseSchema | undefined>(
        databaseSchemaCacheKey,
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
            ] as DatabaseSchema['followers'],
          };
        }
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<DatabaseSchema | undefined>(
          databaseSchemaCacheKey,
          context.previous
        );
      }
      showErrorToast(
        error as AxiosError,
        isFollowing
          ? t('server.entity-unfollow-error', {
              entity: getEntityName(databaseSchema),
            })
          : t('server.entity-follow-error', {
              entity: getEntityName(databaseSchema),
            })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: databaseSchemaCacheKey });
    },
  });

  const followSchema = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const unFollowSchema = useCallback(async () => {
    await followMutation.mutateAsync();
  }, [followMutation]);

  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (databaseSchema) {
        const certificationTag: DatabaseSchema['certification'] =
          updateCertificationTag(newCertification);
        const updatedTableDetails = {
          ...databaseSchema,
          certification: certificationTag,
        };

        await handleUpdateDatabaseSchema(updatedTableDetails as DatabaseSchema);
      }
    },
    [handleUpdateDatabaseSchema, databaseSchema]
  );

  const handleFollowClick = useCallback(async () => {
    isFollowing ? await unFollowSchema() : await followSchema();
  }, [isFollowing, unFollowSchema, followSchema]);

  if (isPermissionsLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(
          EntityType.DATABASE_SCHEMA,
          decodedDatabaseSchemaFQN
        )}
      </ErrorPlaceHolder>
    );
  }

  if (!viewDatabaseSchemaPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.database-schema'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <PageLayoutV1 pageTitle={getEntityName(databaseSchema)}>
      {isEmpty(databaseSchema) && !databaseSchemaLoading ? (
        <ErrorPlaceHolder className="m-0">
          {getEntityMissingError(
            EntityType.DATABASE_SCHEMA,
            decodedDatabaseSchemaFQN
          )}
        </ErrorPlaceHolder>
      ) : (
        <Row gutter={[0, 12]}>
          <Col span={24}>
            {databaseSchemaLoading || !databaseSchema ? (
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
                dataAsset={databaseSchema}
                entityType={EntityType.DATABASE_SCHEMA}
                extraDropdownContent={extraDropdownContent}
                permissions={databaseSchemaPermission}
                onCertificationUpdate={onCertificationUpdate}
                onDisplayNameUpdate={handleUpdateDisplayName}
                onFollowClick={handleFollowClick}
                onOwnerUpdate={handleUpdateOwner}
                onProfilerSettingUpdate={() => setUpdateProfilerSetting(true)}
                onRestoreDataAsset={handleRestoreDatabaseSchema}
                onTierUpdate={handleUpdateTier}
                onUpdateVote={updateVote}
                onVersionClick={versionHandler}
              />
            )}
          </Col>
          <GenericProvider<DatabaseSchema>
            customizedPage={customizedPage}
            data={databaseSchema ?? ({} as DatabaseSchema)}
            isTabExpanded={isTabExpanded}
            permissions={databaseSchemaPermission}
            type={EntityType.DATABASE_SCHEMA}
            onUpdate={handleUpdateDatabaseSchema}>
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
                onChange={activeTabHandler}
              />
            </Col>
          </GenericProvider>
          {updateProfilerSetting && (
            <ProfilerSettings
              entityId={databaseSchemaId}
              entityType={EntityType.DATABASE_SCHEMA}
              visible={updateProfilerSetting}
              onVisibilityChange={(value) => setUpdateProfilerSetting(value)}
            />
          )}
        </Row>
      )}
    </PageLayoutV1>
  );
};

export default withActivityFeed(DatabaseSchemaPage);
