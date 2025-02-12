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
import { useActivityFeedProvider } from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadPanel from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import ProfilerSettings from '../../components/Database/Profiler/ProfilerSettings/ProfilerSettings';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  getEntityDetailsPath,
  getVersionPath,
  INITIAL_PAGING_VALUE,
  INITIAL_TABLE_FILTERS,
  PAGE_SIZE,
  ROUTES,
} from '../../constants/constants';
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
import { CreateThread } from '../../generated/api/feed/createThread';
import { Tag } from '../../generated/entity/classification/tag';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Table } from '../../generated/entity/data/table';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Include } from '../../generated/type/include';
import { TagLabel } from '../../generated/type/tagLabel';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { useTableFilters } from '../../hooks/useTableFilters';
import { FeedCounts } from '../../interface/feed.interface';
import {
  getDatabaseSchemaDetailsByFQN,
  patchDatabaseSchemaDetails,
  restoreDatabaseSchema,
  updateDatabaseSchemaVotes,
} from '../../rest/databaseAPI';
import { postThread } from '../../rest/feedsAPI';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import { getTableList, TableListParams } from '../../rest/tableAPI';
import {
  getEntityMissingError,
  getFeedCounts,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import databaseSchemaClassBase from '../../utils/DatabaseSchemaClassBase';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const DatabaseSchemaPage: FunctionComponent = () => {
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const pagingInfo = usePaging(PAGE_SIZE);

  const {
    paging,
    pageSize,
    handlePagingChange,
    currentPage,
    handlePageChange,
    pagingCursor,
  } = pagingInfo;

  const { filters: tableFilters, setFilters } = useTableFilters(
    INITIAL_TABLE_FILTERS
  );
  const { tab: activeTab = EntityTabs.TABLE } =
    useParams<{ tab: EntityTabs }>();
  const { fqn: decodedDatabaseSchemaFQN } = useFqn();
  const history = useHistory();
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema>(
    {} as DatabaseSchema
  );
  const [tableData, setTableData] = useState<Array<Table>>([]);
  const [tableDataLoading, setTableDataLoading] = useState<boolean>(true);
  const [isSchemaDetailsLoading, setIsSchemaDetailsLoading] =
    useState<boolean>(true);
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [threadLink, setThreadLink] = useState<string>('');
  const [databaseSchemaPermission, setDatabaseSchemaPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [storedProcedureCount, setStoredProcedureCount] = useState(0);

  const [updateProfilerSetting, setUpdateProfilerSetting] =
    useState<boolean>(false);

  const extraDropdownContent = useMemo(
    () =>
      entityUtilClassBase.getManageExtraOptions(
        EntityType.DATABASE_SCHEMA,
        decodedDatabaseSchemaFQN,
        databaseSchemaPermission
      ),
    [databaseSchemaPermission, decodedDatabaseSchemaFQN]
  );

  const handleShowDeletedTables = (value: boolean) => {
    setFilters({ showDeletedTables: value });
    handlePageChange(INITIAL_PAGING_VALUE);
  };

  const { version: currentVersion, deleted } = useMemo(
    () => databaseSchema,
    [databaseSchema]
  );

  const { tags, tier } = useMemo(
    () => ({
      tier: getTierTags(databaseSchema.tags ?? []),
      tags: getTagsWithoutTier(databaseSchema.tags ?? []),
    }),
    [databaseSchema]
  );

  const databaseSchemaId = useMemo(
    () => databaseSchema?.id ?? '',
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

  const viewDatabaseSchemaPermission = useMemo(
    () =>
      databaseSchemaPermission.ViewAll || databaseSchemaPermission.ViewBasic,
    [databaseSchemaPermission?.ViewAll, databaseSchemaPermission?.ViewBasic]
  );

  const onThreadLinkSelect = useCallback(
    (link: string, threadType?: ThreadType) => {
      setThreadLink(link);
      if (threadType) {
        setThreadType(threadType);
      }
    },
    []
  );

  const onThreadPanelClose = useCallback(() => {
    setThreadLink('');
  }, []);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.DATABASE_SCHEMA,
      decodedDatabaseSchemaFQN,
      handleFeedCount
    );
  };

  const fetchDatabaseSchemaDetails = useCallback(async () => {
    try {
      setIsSchemaDetailsLoading(true);
      const response = await getDatabaseSchemaDetailsByFQN(
        decodedDatabaseSchemaFQN,
        {
          // eslint-disable-next-line max-len
          fields: `${TabSpecificField.OWNERS},${TabSpecificField.USAGE_SUMMARY},${TabSpecificField.TAGS},${TabSpecificField.DOMAIN},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION},${TabSpecificField.DATA_PRODUCTS}`,
          include: Include.All,
        }
      );
      const { description: schemaDescription = '' } = response;
      setDatabaseSchema(response);
      setDescription(schemaDescription);
      if (response.deleted) {
        setFilters({
          showDeletedTables: response.deleted,
        });
      }
    } catch (err) {
      // Error
      if ((err as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        history.replace(ROUTES.FORBIDDEN);
      }
    } finally {
      setIsSchemaDetailsLoading(false);
    }
  }, [decodedDatabaseSchemaFQN]);

  const getSchemaTables = useCallback(
    async (params?: TableListParams) => {
      setTableDataLoading(true);
      try {
        const res = await getTableList({
          ...params,
          databaseSchema: decodedDatabaseSchemaFQN,
          limit: pageSize,
          include: tableFilters.showDeletedTables
            ? Include.Deleted
            : Include.NonDeleted,
        });
        setTableData(res.data);
        handlePagingChange(res.paging);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setTableDataLoading(false);
      }
    },
    [decodedDatabaseSchemaFQN, tableFilters.showDeletedTables, pageSize]
  );

  const onDescriptionEdit = useCallback((): void => {
    setIsEdit(true);
  }, []);

  const onEditCancel = useCallback(() => {
    setIsEdit(false);
  }, []);

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

  const onDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (description !== updatedHTML && databaseSchema) {
        const updatedDatabaseSchemaDetails = {
          ...databaseSchema,
          description: updatedHTML,
        };

        try {
          const response = await saveUpdatedDatabaseSchemaData(
            updatedDatabaseSchemaDetails
          );
          if (response) {
            setDatabaseSchema(response);
            setDescription(updatedHTML);
          } else {
            throw t('server.unexpected-response');
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setIsEdit(false);
        }
      } else {
        setIsEdit(false);
      }
    },
    [description, databaseSchema]
  );

  const activeTabHandler = useCallback(
    (activeKey: string) => {
      if (activeKey !== activeTab) {
        history.push({
          pathname: getEntityDetailsPath(
            EntityType.DATABASE_SCHEMA,
            decodedDatabaseSchemaFQN,
            activeKey
          ),
        });
      }
    },
    [activeTab, decodedDatabaseSchemaFQN]
  );

  const handleUpdateOwner = useCallback(
    async (owners: DatabaseSchema['owners']) => {
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
    [databaseSchema, databaseSchema?.owners]
  );

  const handleTagsUpdate = async (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedData = { ...databaseSchema, tags: updatedTags };

      try {
        const res = await saveUpdatedDatabaseSchemaData(
          updatedData as DatabaseSchema
        );
        setDatabaseSchema({
          ...res,
          tags: sortTagsCaseInsensitive(res.tags ?? []),
        });
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
    [saveUpdatedDatabaseSchemaData, databaseSchema]
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
    [databaseSchema, saveUpdatedDatabaseSchemaData]
  );

  const createThread = useCallback(
    async (data: CreateThread) => {
      try {
        await postThread(data);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.create-entity-error', {
            entity: t('label.conversation'),
          })
        );
      }
    },
    [getEntityFeedCount]
  );

  const handleToggleDelete = (version?: number) => {
    history.replace({
      state: {
        cursorData: null,
        pageSize: null,
        currentPage: INITIAL_PAGING_VALUE,
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
  };

  const handleRestoreDatabaseSchema = useCallback(async () => {
    try {
      const { version: newVersion } = await restoreDatabaseSchema(
        databaseSchemaId
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.database-schema'),
        }),
        2000
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
  }, [databaseSchemaId]);

  const tablePaginationHandler = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        getSchemaTables({ [cursorType]: paging[cursorType] });
        handlePageChange(
          currentPage,
          {
            cursorType: cursorType,
            cursorValue: paging[cursorType]!,
          },
          pageSize
        );
      }
      handlePageChange(currentPage);
    },
    [paging, getSchemaTables, handlePageChange]
  );

  const versionHandler = useCallback(() => {
    currentVersion &&
      history.push(
        getVersionPath(
          EntityType.DATABASE_SCHEMA,
          decodedDatabaseSchemaFQN,
          String(currentVersion),
          EntityTabs.TABLE
        )
      );
  }, [currentVersion, decodedDatabaseSchemaFQN]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data) => {
    const updatedData = data as DatabaseSchema;

    setDatabaseSchema((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

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

  useEffect(() => {
    fetchDatabaseSchemaPermission();
  }, [decodedDatabaseSchemaFQN]);

  useEffect(() => {
    if (viewDatabaseSchemaPermission) {
      fetchDatabaseSchemaDetails();
      fetchStoreProcedureCount();
      getEntityFeedCount();
    }
  }, [viewDatabaseSchemaPermission]);

  useEffect(() => {
    if (viewDatabaseSchemaPermission && decodedDatabaseSchemaFQN) {
      if (pagingCursor?.cursorData?.cursorType) {
        // Fetch data if cursorType is present in state with cursor Value to handle browser back navigation
        getSchemaTables({
          [pagingCursor?.cursorData?.cursorType]:
            pagingCursor?.cursorData?.cursorValue,
        });
      } else {
        // Otherwise, just fetch the data without cursor value
        getSchemaTables({ limit: pageSize });
      }
    }
  }, [
    tableFilters.showDeletedTables,
    decodedDatabaseSchemaFQN,
    viewDatabaseSchemaPermission,
    deleted,
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
        (databaseSchemaPermission.EditTags ||
          databaseSchemaPermission.EditAll) &&
        !databaseSchema.deleted,
      editGlossaryTermsPermission:
        (databaseSchemaPermission.EditGlossaryTerms ||
          databaseSchemaPermission.EditAll) &&
        !databaseSchema.deleted,
      editDescriptionPermission:
        (databaseSchemaPermission.EditDescription ||
          databaseSchemaPermission.EditAll) &&
        !databaseSchema.deleted,
      editCustomAttributePermission:
        (databaseSchemaPermission.EditAll ||
          databaseSchemaPermission.EditCustomFields) &&
        !databaseSchema.deleted,
      viewAllPermission: databaseSchemaPermission.ViewAll,
    }),
    [databaseSchemaPermission, databaseSchema]
  );

  const handleExtensionUpdate = async (schema: DatabaseSchema) => {
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

  const tabs: TabsProps['items'] = useMemo(
    () =>
      databaseSchemaClassBase.getDatabaseSchemaPageTabs({
        feedCount,
        tableData,
        activeTab,
        currentTablesPage: currentPage,
        databaseSchema,
        description,
        editDescriptionPermission,
        isEdit,
        showDeletedTables: tableFilters.showDeletedTables,
        tableDataLoading,
        editCustomAttributePermission,
        editTagsPermission,
        editGlossaryTermsPermission,
        tags,
        viewAllPermission,
        databaseSchemaPermission,
        storedProcedureCount,
        onEditCancel,
        handleExtensionUpdate,
        handleTagSelection,
        onThreadLinkSelect,
        tablePaginationHandler,
        onDescriptionEdit,
        onDescriptionUpdate,
        handleShowDeletedTables,
        getEntityFeedCount,
        fetchDatabaseSchemaDetails,
        handleFeedCount,
        pagingInfo,
      }),
    [
      feedCount,
      tableData,
      activeTab,
      currentPage,
      databaseSchema,
      description,
      editDescriptionPermission,
      isEdit,
      tableFilters.showDeletedTables,
      tableDataLoading,
      editCustomAttributePermission,
      editTagsPermission,
      editGlossaryTermsPermission,
      tags,
      viewAllPermission,
      storedProcedureCount,
      databaseSchemaPermission,
      handleExtensionUpdate,
      handleTagSelection,
      onThreadLinkSelect,
      tablePaginationHandler,
      onEditCancel,
      onDescriptionEdit,
      onDescriptionUpdate,
      handleShowDeletedTables,
      getEntityFeedCount,
      fetchDatabaseSchemaDetails,
      handleFeedCount,
      pagingInfo,
    ]
  );

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateDatabaseSchemaVotes(id, data);
      const response = await getDatabaseSchemaDetailsByFQN(
        decodedDatabaseSchemaFQN,
        {
          fields: [
            TabSpecificField.OWNERS,
            TabSpecificField.USAGE_SUMMARY,
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

  if (isPermissionsLoading) {
    return <Loader />;
  }

  if (!viewDatabaseSchemaPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(databaseSchema),
      })}>
      {isEmpty(databaseSchema) && !isSchemaDetailsLoading ? (
        <ErrorPlaceHolder className="m-0">
          {getEntityMissingError(
            EntityType.DATABASE_SCHEMA,
            decodedDatabaseSchemaFQN
          )}
        </ErrorPlaceHolder>
      ) : (
        <Row gutter={[0, 12]}>
          <Col className="p-x-lg" span={24}>
            {isSchemaDetailsLoading ? (
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
                onDisplayNameUpdate={handleUpdateDisplayName}
                onOwnerUpdate={handleUpdateOwner}
                onProfilerSettingUpdate={() => setUpdateProfilerSetting(true)}
                onRestoreDataAsset={handleRestoreDatabaseSchema}
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
          <Col span={24}>
            {threadLink ? (
              <ActivityThreadPanel
                createThread={createThread}
                deletePostHandler={deleteFeed}
                open={Boolean(threadLink)}
                postFeedHandler={postFeed}
                threadLink={threadLink}
                threadType={threadType}
                updateThreadHandler={updateFeed}
                onCancel={onThreadPanelClose}
              />
            ) : null}
          </Col>
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
