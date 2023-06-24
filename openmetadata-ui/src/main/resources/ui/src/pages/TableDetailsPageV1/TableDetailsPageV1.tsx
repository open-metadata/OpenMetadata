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
import { Card, Col, Row, Space, Tabs } from 'antd';
import { AxiosError } from 'axios';
import ActivityFeedProvider, {
  useActivityFeedProvider,
} from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from 'components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import DbtTab from 'components/DatasetDetails/DbtTab/DbtTab.component';
import EntityLineageComponent from 'components/EntityLineage/EntityLineage.component';
import Loader from 'components/Loader/Loader';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import SampleDataTableComponent from 'components/SampleDataTable/SampleDataTable.component';
import SchemaTab from 'components/SchemaTab/SchemaTab.component';
import TableProfilerV1 from 'components/TableProfiler/TableProfilerV1';
import TableQueries from 'components/TableQueries/TableQueries';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV1 from 'components/Tag/TagsContainerV1/TagsContainerV1';
import { useTourProvider } from 'components/TourProvider/TourProvider';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { getTableTabPath, getVersionPath } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { mockDatasetData } from 'constants/mockTourData.constants';
import { EntityTabs, EntityType, FqnPart } from 'enums/entity.enum';
import { compare } from 'fast-json-patch';
import { CreateThread } from 'generated/api/feed/createThread';
import { JoinedWith, Table } from 'generated/entity/data/table';
import { ThreadType } from 'generated/entity/feed/thread';
import { LabelType, State, TagLabel, TagSource } from 'generated/type/tagLabel';
import { EntityFieldThreadCount } from 'interface/feed.interface';
import { isEmpty, isEqual } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { postThread } from 'rest/feedsAPI';
import { getQueriesList } from 'rest/queryAPI';
import {
  addFollower,
  getTableDetailsByFQN,
  patchTableDetails,
  removeFollower,
  restoreTable,
} from 'rest/tableAPI';
import {
  getCurrentUserId,
  getFeedCounts,
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
  refreshPage,
  sortTagsCaseInsensitive,
} from 'utils/CommonUtils';
import { defaultFields } from 'utils/DatasetDetailsUtils';
import { getEntityName, getEntityThreadLink } from 'utils/EntityUtils';
import { getEntityFieldThreadCounts } from 'utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from 'utils/TableUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';
import { FrequentlyJoinedTables } from './FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import './table-details-page-v1.less';

const TableDetailsPageV1 = () => {
  const { isTourOpen, activeTabForTourDatasetPage, isTourPage } =
    useTourProvider();
  const [tableDetails, setTableDetails] = useState<Table>();
  const { datasetFQN, tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ datasetFQN: string; tab: string }>();
  const { t } = useTranslation();
  const history = useHistory();
  const USERId = getCurrentUserId();
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [isEdit, setIsEdit] = useState(false);
  const [threadLink, setThreadLink] = useState<string>('');
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [queryCount, setQueryCount] = useState(0);

  const [loading, setLoading] = useState(!isTourOpen);

  const fetchTableDetails = async () => {
    setLoading(true);
    try {
      const details = await getTableDetailsByFQN(datasetFQN, defaultFields);

      setTableDetails(details);
    } catch (error) {
      // Error here
    } finally {
      setLoading(false);
    }
  };

  const fetchQueryCount = async () => {
    if (!tableDetails?.id) {
      return;
    }
    try {
      const response = await getQueriesList({
        limit: 0,
        entityId: tableDetails.id,
      });
      setQueryCount(response.paging.total);
    } catch (error) {
      setQueryCount(0);
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const {
    tier,
    tableTags,
    owner,
    version,
    followers = [],
    description,
    entityName,
    joinedTables = [],
    id: tableId = '',
  } = useMemo(() => {
    if (tableDetails) {
      const { tags } = tableDetails;

      const { joins } = tableDetails ?? {};
      const tableFQNGrouping = [
        ...(joins?.columnJoins?.flatMap(
          (cjs) =>
            cjs.joinedWith?.map<JoinedWith>((jw) => ({
              fullyQualifiedName: getTableFQNFromColumnFQN(
                jw.fullyQualifiedName
              ),
              joinCount: jw.joinCount,
            })) ?? []
        ) ?? []),
        ...(joins?.directTableJoins ?? []),
      ].reduce(
        (result, jw) => ({
          ...result,
          [jw.fullyQualifiedName]:
            (result[jw.fullyQualifiedName] ?? 0) + jw.joinCount,
        }),
        {} as Record<string, number>
      );

      return {
        ...tableDetails,
        tier: getTierTags(tags ?? []),
        tableTags: getTagsWithoutTier(tags || []),
        entityName: getEntityName(tableDetails),
        joinedTables: Object.entries(tableFQNGrouping)
          .map<JoinedWith & { name: string }>(
            ([fullyQualifiedName, joinCount]) => ({
              fullyQualifiedName,
              joinCount,
              name: getPartialNameFromTableFQN(
                fullyQualifiedName,
                [FqnPart.Database, FqnPart.Table],
                FQN_SEPARATOR_CHAR
              ),
            })
          )
          .sort((a, b) => b.joinCount - a.joinCount),
      };
    }

    return {} as Table & {
      tier: TagLabel;
      tableTags: EntityTags[];
      entityName: string;
      joinedTables: Array<{
        fullyQualifiedName: string;
        joinCount: number;
        name: string;
      }>;
    };
  }, [tableDetails, tableDetails?.tags]);

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const fetchResourcePermission = useCallback(async () => {
    try {
      const tablePermission = await getEntityPermissionByFqn(
        ResourceEntity.TABLE,
        tableDetails?.id ?? ''
      );

      setTablePermissions(tablePermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    }
  }, [tableDetails?.id, getEntityPermissionByFqn, setTablePermissions]);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.TABLE,
      datasetFQN,
      setEntityFieldThreadCount,
      setEntityFieldTaskCount,
      setFeedCount
    );
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      if (!isTourOpen) {
        history.push(getTableTabPath(datasetFQN, activeKey));
      }
    }
  };

  const saveUpdatedTableData = useCallback(
    (updatedData: Table) => {
      if (!tableDetails) {
        return updatedData;
      }
      const jsonPatch = compare(tableDetails, updatedData);

      return patchTableDetails(tableId, jsonPatch);
    },
    [tableDetails, tableId]
  );

  const onTableUpdate = async (updatedTable: Table, key: keyof Table) => {
    try {
      const res = await saveUpdatedTableData(updatedTable);

      setTableDetails((previous) => {
        if (!previous) {
          return;
        }
        if (key === 'tags') {
          return {
            ...previous,
            version: res.version,
            [key]: sortTagsCaseInsensitive(res.tags ?? []),
          };
        }

        return {
          ...previous,
          version: res.version,
          [key]: res[key],
        };
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (newOwner?: Table['owner']) => {
      if (!tableDetails) {
        return;
      }
      const updatedTableDetails = {
        ...tableDetails,
        owner: newOwner
          ? {
              ...owner,
              ...newOwner,
            }
          : undefined,
      };
      await onTableUpdate(updatedTableDetails, 'owner');
    },
    [owner, tableDetails]
  );

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (!tableDetails) {
      return;
    }
    if (description !== updatedHTML) {
      const updatedTableDetails = {
        ...tableDetails,
        description: updatedHTML,
      };
      await onTableUpdate(updatedTableDetails, 'description');
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onColumnsUpdate = async (updateColumns: Table['columns']) => {
    if (tableDetails && !isEqual(tableDetails.columns, updateColumns)) {
      const updatedTableDetails = {
        ...tableDetails,
        columns: updateColumns,
      };
      await onTableUpdate(updatedTableDetails, 'columns');
    }
  };

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!tableDetails) {
      return;
    }
    const updatedTable = { ...tableDetails, displayName: data.displayName };
    await onTableUpdate(updatedTable, 'displayName');
  };

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const handleTagsUpdate = async (selectedTags?: Array<TagLabel>) => {
    if (selectedTags && tableDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...tableDetails, tags: updatedTags };
      await onTableUpdate(updatedTable, 'tags');
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = selectedTags?.map((tag) => {
      return {
        source: tag.source,
        tagFQN: tag.tagFQN,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
    });
    await handleTagsUpdate(updatedTags);
  };

  const onExtensionUpdate = async (updatedData: Table) => {
    await onTableUpdate(updatedData, 'extension');
  };

  const schemaTab = useMemo(
    () => (
      <Row gutter={[0, 16]} id="schemaDetails" wrap={false}>
        <Col className="p-t-sm m-l-lg" flex="auto">
          <div className="d-flex flex-col gap-4">
            <DescriptionV1
              description={tableDetails?.description}
              entityFieldThreads={getEntityFieldThreadCounts(
                EntityField.DESCRIPTION,
                entityFieldThreadCount
              )}
              entityFqn={datasetFQN}
              entityName={entityName}
              entityType={EntityType.TABLE}
              hasEditAccess={
                tablePermissions.EditAll || tablePermissions.EditDescription
              }
              isEdit={isEdit}
              isReadOnly={tableDetails?.deleted}
              owner={tableDetails?.owner}
              onCancel={onCancel}
              onDescriptionEdit={onDescriptionEdit}
              onDescriptionUpdate={onDescriptionUpdate}
              onThreadLinkSelect={onThreadLinkSelect}
            />
            <SchemaTab
              columnName={getPartialNameFromTableFQN(
                datasetFQN,
                [FqnPart['Column']],
                FQN_SEPARATOR_CHAR
              )}
              columns={tableDetails?.columns ?? []}
              entityFieldTasks={getEntityFieldThreadCounts(
                EntityField.COLUMNS,
                entityFieldTaskCount
              )}
              entityFieldThreads={getEntityFieldThreadCounts(
                EntityField.COLUMNS,
                entityFieldThreadCount
              )}
              entityFqn={datasetFQN}
              hasDescriptionEditAccess={
                tablePermissions.EditAll || tablePermissions.EditDescription
              }
              hasTagEditAccess={
                tablePermissions.EditAll || tablePermissions.EditTags
              }
              isReadOnly={tableDetails?.deleted}
              joins={tableDetails?.joins?.columnJoins || []}
              tableConstraints={tableDetails?.tableConstraints}
              onThreadLinkSelect={onThreadLinkSelect}
              onUpdate={onColumnsUpdate}
            />
          </div>
        </Col>
        <Col
          className="entity-tag-right-panel-container"
          data-testid="entity-right-panel"
          flex="320px">
          {!isEmpty(joinedTables) ? (
            <>
              <FrequentlyJoinedTables joinedTables={joinedTables} />
            </>
          ) : null}

          <Space className="w-full" direction="vertical" size="large">
            <TagsContainerV1
              entityFqn={datasetFQN}
              entityThreadLink={getEntityThreadLink(entityFieldThreadCount)}
              entityType={EntityType.TABLE}
              permission={
                (tablePermissions.EditAll || tablePermissions.EditTags) &&
                !tableDetails?.deleted
              }
              selectedTags={tableTags}
              tagType={TagSource.Classification}
              onSelectionChange={handleTagSelection}
              onThreadLinkSelect={onThreadLinkSelect}
            />

            <TagsContainerV1
              entityFqn={datasetFQN}
              entityThreadLink={getEntityThreadLink(entityFieldThreadCount)}
              entityType={EntityType.TABLE}
              permission={
                (tablePermissions.EditAll || tablePermissions.EditTags) &&
                !tableDetails?.deleted
              }
              selectedTags={tableTags}
              tagType={TagSource.Glossary}
              onSelectionChange={handleTagSelection}
              onThreadLinkSelect={onThreadLinkSelect}
            />
          </Space>
        </Col>
      </Row>
    ),
    [
      isEdit,
      tableDetails,
      tablePermissions,
      onDescriptionEdit,
      onDescriptionUpdate,
    ]
  );

  const tabs = useMemo(() => {
    const allTabs = [
      {
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        key: EntityTabs.SCHEMA,
        children: schemaTab,
      },
      {
        label: (
          <TabsLabel
            count={feedCount}
            id={EntityTabs.ACTIVITY_FEED}
            isActive={activeTab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedProvider>
            <ActivityFeedTab
              columns={tableDetails?.columns}
              description={tableDetails?.description}
              entityType={EntityType.TABLE}
              fqn={tableDetails?.fullyQualifiedName ?? ''}
              owner={tableDetails?.owner}
              tags={tableDetails?.tags}
              onFeedUpdate={getEntityFeedCount}
              onUpdateEntityDetails={fetchTableDetails}
            />
          </ActivityFeedProvider>
        ),
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.SAMPLE_DATA}
            name={t('label.sample-data')}
          />
        ),
        isHidden: !(
          tablePermissions.ViewAll ||
          tablePermissions.ViewBasic ||
          tablePermissions.ViewSampleData
        ),
        key: EntityTabs.SAMPLE_DATA,
        children: (
          <SampleDataTableComponent
            isTableDeleted={tableDetails?.deleted}
            tableId={tableDetails?.id ?? ''}
          />
        ),
      },
      {
        label: (
          <TabsLabel
            count={queryCount}
            id={EntityTabs.TABLE_QUERIES}
            isActive={activeTab === EntityTabs.TABLE_QUERIES}
            name={t('label.query-plural')}
          />
        ),
        isHidden: !(
          tablePermissions.ViewAll ||
          tablePermissions.ViewBasic ||
          tablePermissions.ViewQueries
        ),
        key: EntityTabs.TABLE_QUERIES,
        children: (
          <TableQueries
            isTableDeleted={tableDetails?.deleted}
            tableId={tableDetails?.id ?? ''}
          />
        ),
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.PROFILER}
            name={t('label.profiler-amp-data-quality')}
          />
        ),
        isHidden: !(
          tablePermissions.ViewAll ||
          tablePermissions.ViewBasic ||
          tablePermissions.ViewDataProfile ||
          tablePermissions.ViewTests
        ),
        key: EntityTabs.PROFILER,
        children: (
          <TableProfilerV1
            isTableDeleted={tableDetails?.deleted}
            permissions={tablePermissions}
            testSuite={tableDetails?.testSuite}
          />
        ),
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
        children: (
          <Card
            className="lineage-card card-body-full w-auto border-none"
            id="lineageDetails">
            <EntityLineageComponent
              deleted={tableDetails?.deleted}
              entityType={EntityType.TABLE}
              hasEditAccess={
                tablePermissions.EditAll || tablePermissions.EditLineage
              }
            />
          </Card>
        ),
      },
      ...(tableDetails?.dataModel
        ? [
            {
              label: (
                <TabsLabel
                  id={EntityTabs.DBT}
                  name={t('label.dbt-lowercase')}
                />
              ),
              // isHidden: !(dataModel?.sql ?? dataModel?.rawSql),
              key: EntityTabs.DBT,
              children: <DbtTab dataModel={tableDetails?.dataModel} />,
            },
          ]
        : []),
      {
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        key: EntityTabs.CUSTOM_PROPERTIES,
        children: (
          <CustomPropertyTable
            entityDetails={tableDetails as CustomPropertyProps['entityDetails']}
            entityType={EntityType.TABLE}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={
              tablePermissions.EditAll || tablePermissions.EditCustomFields
            }
          />
        ),
      },
    ];

    return allTabs.filter((data) => !data.isHidden);
  }, [
    schemaTab,
    tablePermissions,
    activeTab,
    schemaTab,
    tableDetails,
    feedCount,
    entityName,
    onExtensionUpdate,
    getEntityFeedCount,
  ]);

  const onTierUpdate = useCallback(
    async (newTier?: string) => {
      if (tableDetails) {
        const tierTag: Table['tags'] = newTier
          ? [
              ...getTagsWithoutTier(tableTags ?? []),
              {
                tagFQN: newTier,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
            ]
          : getTagsWithoutTier(tableTags ?? []);
        const updatedTableDetails = {
          ...tableDetails,
          tags: tierTag,
        };

        await onTableUpdate(updatedTableDetails, 'tags');
      }
    },
    [tableDetails, onTableUpdate, tableTags]
  );

  const handleRestoreTable = async () => {
    try {
      await restoreTable(tableDetails?.id ?? '');
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.table'),
        }),
        2000
      );
      refreshPage();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.table'),
        })
      );
    }
  };

  const followTable = useCallback(async () => {
    try {
      const res = await addFollower(tableId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setTableDetails((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, followers: newFollowers };
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(tableDetails),
        })
      );
    }
  }, [USERId, tableId, setTableDetails, getEntityFeedCount]);

  const unFollowTable = useCallback(async () => {
    try {
      const res = await removeFollower(tableId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setTableDetails((pre) => {
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
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(tableDetails),
        })
      );
    }
  }, [USERId, tableId, getEntityFeedCount, setTableDetails]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === USERId),
    };
  }, [followers, USERId]);

  const handleFollowTable = useCallback(async () => {
    isFollowing ? await unFollowTable() : await followTable();
  }, [isFollowing, unFollowTable, followTable]);

  const versionHandler = useCallback(() => {
    version &&
      history.push(getVersionPath(EntityType.TABLE, datasetFQN, version + ''));
  }, [version]);

  useEffect(() => {
    if (isTourOpen || isTourPage) {
      setTableDetails(mockDatasetData.tableDetails as unknown as Table);
    } else {
      fetchTableDetails();
      getEntityFeedCount();
    }
  }, [datasetFQN, isTourOpen, isTourPage]);

  useEffect(() => {
    if (tableDetails) {
      fetchQueryCount();
      fetchResourcePermission();
    }
  }, [tableDetails]);

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  if (loading) {
    return <Loader />;
  }

  if (!tableDetails) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row gutter={[0, 12]}>
        {/* Entity Heading */}
        <Col className="p-x-lg" data-testid="entity-page-header" span={24}>
          <DataAssetsHeader
            dataAsset={tableDetails}
            entityType={EntityType.TABLE}
            permissions={tablePermissions}
            onDisplayNameUpdate={handleDisplayNameUpdate}
            onFollowClick={handleFollowTable}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreTable}
            onTierUpdate={onTierUpdate}
            onVersionClick={versionHandler}
          />
        </Col>

        {/* Entity Tabs */}
        <Col span={24}>
          <Tabs
            activeKey={
              isTourOpen
                ? activeTabForTourDatasetPage
                : activeTab ?? EntityTabs.SCHEMA
            }
            className="table-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
        </Col>

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
      </Row>
    </PageLayoutV1>
  );
};

export default TableDetailsPageV1;
