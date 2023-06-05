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
import Icon from '@ant-design/icons';
import { Button, Col, Divider, Row, Space, Tabs, Typography } from 'antd';
import Tooltip from 'antd/es/tooltip';
import ButtonGroup from 'antd/lib/button/button-group';
import Card from 'antd/lib/card/Card';
import AppState from 'AppState';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as StarFilledIcon } from 'assets/svg/ic-star-filled.svg';
import { ReactComponent as StarIcon } from 'assets/svg/ic-star.svg';
import { ReactComponent as VersionIcon } from 'assets/svg/ic-version.svg';
import { AxiosError } from 'axios';
import ActivityFeedList from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList';
import { ActivityFilters } from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList.interface';
import Description from 'components/common/description/Description';
import AnnouncementCard from 'components/common/entityPageInfo/AnnouncementCard/AnnouncementCard';
import AnnouncementDrawer from 'components/common/entityPageInfo/AnnouncementDrawer/AnnouncementDrawer';
import ManageButton from 'components/common/entityPageInfo/ManageButton/ManageButton';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import TierCard from 'components/common/TierCard/TierCard';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import EntityHeaderTitle from 'components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import Loader from 'components/Loader/Loader';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import SampleDataTableComponent from 'components/SampleDataTable/SampleDataTable.component';
import SchemaTab from 'components/SchemaTab/SchemaTab.component';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import {
  getTableTabPath,
  getVersionPath,
  pagingObject,
  ROUTES,
} from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { mockTablePermission } from 'constants/mockTourData.constants';
import { EntityTabs, EntityType, FqnPart } from 'enums/entity.enum';
import { FeedFilter } from 'enums/mydata.enum';
import { compare, Operation } from 'fast-json-patch';
import { JoinedWith, Table } from 'generated/entity/data/table';
import { Post, Thread, ThreadType } from 'generated/entity/feed/thread';
import { Paging } from 'generated/type/paging';
import { LabelType, State, TagLabel } from 'generated/type/tagLabel';
import { EntityFieldThreadCount } from 'interface/feed.interface';
import { isEmpty, isEqual } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getActiveAnnouncement,
  getAllFeeds,
  postFeedById,
} from 'rest/feedsAPI';
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
import {
  getBreadcrumbForTable,
  getEntityFeedLink,
  getEntityName,
} from 'utils/EntityUtils';
import {
  deletePost,
  getEntityFieldThreadCounts,
  updateThreadData,
} from 'utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import {
  getTagsWithoutTier,
  getTierTags,
  getUsagePercentile,
} from 'utils/TableUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';

const TableDetailsPageV1 = () => {
  const [tableDetails, setTableDetails] = useState<Table>();
  const { datasetFQN, tab } = useParams<{ datasetFQN: string; tab: string }>();
  const { t } = useTranslation();
  const history = useHistory();
  const [isEntityThreadLoading, setIsEntityThreadLoading] =
    useState<boolean>(false);
  const USERId = getCurrentUserId();
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [isEdit, setIsEdit] = useState(false);
  const [, setThreadLink] = useState<string>('');
  const [, setThreadType] = useState<ThreadType>(ThreadType.Conversation);
  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [, setActivityFilter] = useState<ActivityFilters>();

  const [, setPaging] = useState<Paging>(pagingObject);

  const fetchTableDetails = async () => {
    const details = await getTableDetailsByFQN(datasetFQN, defaultFields);

    setTableDetails(details);
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
  // For tour we have to maintain state
  const [activeTab, setActiveTab] = useState(tab ?? EntityTabs.SCHEMA);

  const isTourPage = location.pathname.includes(ROUTES.TOUR);
  const [isAnnouncementDrawerOpen, setIsAnnouncementDrawer] =
    useState<boolean>(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Thread>();

  const {
    tier,
    tableTags,
    owner,
    tableType,
    version,
    followers = [],
    description,
    usageSummary,
    entityName,
    displayName,
    deleted,
    id: tableId = '',
  } = useMemo(() => {
    if (tableDetails) {
      const { tags } = tableDetails;

      return {
        ...tableDetails,
        tier: getTierTags(tags ?? []),
        tableTags: getTagsWithoutTier(tags || []),
        entityName: getEntityName(tableDetails),
        usageSummary: getUsagePercentile(
          tableDetails.usageSummary?.weeklyStats?.percentileRank || 0,
          true
        ),
      };
    }

    return {} as Table & {
      tier: TagLabel;
      tableTags: EntityTags[];
      entityName: string;
    };
  }, [tableDetails, tableDetails?.tags]);

  const icon = useMemo(
    () =>
      tableDetails?.serviceType ? (
        <img className="h-9" src={serviceTypeLogo(tableDetails.serviceType)} />
      ) : null,
    [tableDetails]
  );

  const getFrequentlyJoinedWithTables = (): Array<
    JoinedWith & { name: string }
  > => {
    const { joins } = tableDetails ?? {};
    const tableFQNGrouping = [
      ...(joins?.columnJoins?.flatMap(
        (cjs) =>
          cjs.joinedWith?.map<JoinedWith>((jw) => ({
            fullyQualifiedName: getTableFQNFromColumnFQN(jw.fullyQualifiedName),
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

    return Object.entries(tableFQNGrouping)
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
      .sort((a, b) => b.joinCount - a.joinCount);
  };

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = useCallback(async () => {
    try {
      const tablePermission = await getEntityPermission(
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
  }, [tableDetails?.id, getEntityPermission, setTablePermissions]);

  useEffect(() => {
    if (tableDetails?.id && !isTourPage) {
      //   fetchQueryCount();
      fetchResourcePermission();
    }

    if (isTourPage) {
      setTablePermissions(mockTablePermission as OperationPermission);
    }
  }, [tableDetails?.id]);

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
      if (!isTourPage) {
        history.push(getTableTabPath(datasetFQN, activeKey));
      }
      setActiveTab(activeKey as EntityTabs);
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
    (newOwner?: Table['owner']) => {
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
      onTableUpdate(updatedTableDetails, 'owner').catch(() => {
        // do nothing
      });
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

  const postFeedHandler = async (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    } as Post;

    try {
      const res = await postFeedById(id, data);
      const { id: responseId, posts } = res;
      setEntityThread((pre) => {
        return pre.map((thread) => {
          if (thread.id === responseId) {
            return { ...res, posts: posts?.slice(-3) };
          } else {
            return thread;
          }
        });
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.add-entity-error', {
          entity: t('label.feed-plural'),
        })
      );
    }
  };

  const getFeedData = async (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setIsEntityThreadLoading(true);
    try {
      const { data, paging: pagingObj } = await getAllFeeds(
        getEntityFeedLink(EntityType.TABLE, datasetFQN),
        after,
        threadType,
        feedType,
        undefined,
        USERId
      );
      setPaging(pagingObj);
      setEntityThread((prevData) => [...(after ? prevData : []), ...data]);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.entity-feed-plural'),
        })
      );
    } finally {
      setIsEntityThreadLoading(false);
    }
  };

  const handleFeedFetchFromFeedList = (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    !after && setEntityThread([]);
    getFeedData(after, feedType, threadType);
  };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setEntityThread);
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThread);
  };

  const handleFeedFilterChange = useCallback((feedType, threadType) => {
    setActivityFilter({ feedFilter: feedType, threadType });
    handleFeedFetchFromFeedList(undefined, feedType, threadType);
  }, []);

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!tableDetails) {
      return;
    }
    const updatedTable = { ...tableDetails, displayName: data.displayName };
    await onTableUpdate(updatedTable, 'displayName');
  };

  const loader = useMemo(
    () => (isEntityThreadLoading ? <Loader /> : null),
    [isEntityThreadLoading]
  );

  const tabs = useMemo(() => {
    const allTabs = [
      {
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        key: EntityTabs.SCHEMA,
        children: (
          <Row gutter={[16, 16]} wrap={false}>
            <Col span={20}>
              <div className="d-flex flex-col gap-4">
                <Description
                  description={tableDetails?.description}
                  entityFieldTasks={getEntityFieldThreadCounts(
                    EntityField.DESCRIPTION,
                    entityFieldTaskCount
                  )}
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
              span={4}
              style={{ borderLeft: '1px solid rgba(0, 0, 0, 0.1)' }}>
              <Typography.Text>
                {t('label.frequently-joined-table-plural')}
              </Typography.Text>
              {getFrequentlyJoinedWithTables()}
              <Divider className="m-y-sm" />
              <Typography.Text>{t('label.tag-plural')}</Typography.Text>
              <TagsViewer
                showNoDataPlaceholder={false}
                sizeCap={5}
                tags={tableTags}
                type="border"
              />
            </Col>
          </Row>
        ),
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
          <Card className="m-y-md h-min-full">
            <Row>
              <Col data-testid="activityfeed" offset={3} span={18}>
                <ActivityFeedList
                  isEntityFeed
                  withSidePanel
                  deletePostHandler={deletePostHandler}
                  entityName={entityName}
                  feedList={entityThread}
                  isFeedLoading={isEntityThreadLoading}
                  postFeedHandler={postFeedHandler}
                  updateThreadHandler={updateThreadHandler}
                  onFeedFiltersUpdate={handleFeedFilterChange}
                />
              </Col>
            </Row>

            {loader}
          </Card>
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
            // count={queryCount}
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
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
      },
      {
        label: (
          <TabsLabel id={EntityTabs.DBT} name={t('label.dbt-lowercase')} />
        ),
        // isHidden: !(dataModel?.sql ?? dataModel?.rawSql),
        key: EntityTabs.DBT,
      },
      {
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        key: EntityTabs.CUSTOM_PROPERTIES,
      },
    ];

    return allTabs.filter((data) => !data.isHidden);
  }, [tablePermissions, activeTab]);

  const onTierUpdate = useCallback(
    (newTier?: string) => {
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

        onTableUpdate(updatedTableDetails, 'tags');
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

  const handleFollowTable = useCallback(() => {
    isFollowing ? unFollowTable() : followTable();
  }, [isFollowing, unFollowTable, followTable]);

  const versionHandler = useCallback(() => {
    version &&
      history.push(getVersionPath(EntityType.TABLE, datasetFQN, version + ''));
  }, [version]);

  const fetchActiveAnnouncement = async () => {
    try {
      const announcements = await getActiveAnnouncement(
        getEntityFeedLink(EntityType.TABLE, datasetFQN)
      );

      if (!isEmpty(announcements.data)) {
        setActiveAnnouncement(announcements.data[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchTableDetails();
    fetchActiveAnnouncement();
  }, [datasetFQN]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row className="p-b-lg" gutter={[16, 12]}>
        <Col span={24}>
          {tableDetails && (
            <Row gutter={[8, 12]}>
              <Col className="self-center" span={18}>
                <Row gutter={[16, 12]}>
                  <Col span={24}>
                    <TitleBreadcrumb
                      titleLinks={getBreadcrumbForTable(tableDetails)}
                    />
                  </Col>
                  <Col span={24}>
                    <EntityHeaderTitle
                      deleted={tableDetails?.deleted}
                      displayName={tableDetails.displayName}
                      icon={icon}
                      name={tableDetails?.name}
                      serviceName={tableDetails.service?.name ?? ''}
                    />
                  </Col>
                  <Col span={24}>
                    <div className="d-flex no-wrap">
                      <OwnerLabel
                        hasPermission={
                          tablePermissions.EditAll || tablePermissions.EditOwner
                        }
                        owner={tableDetails?.owner}
                        onUpdate={handleUpdateOwner}
                      />
                      <Divider className="self-center m-x-md" type="vertical" />
                      <TierCard
                        currentTier={tier?.tagFQN}
                        updateTier={onTierUpdate}>
                        <Space>
                          {tier
                            ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1]
                            : t('label.no-entity', { entity: t('label.tier') })}
                          <Tooltip
                            placement="topRight"
                            title={
                              tablePermissions.EditAll ||
                              tablePermissions.EditTags
                                ? ''
                                : NO_PERMISSION_FOR_ACTION
                            }>
                            <Button
                              className="flex-center p-0"
                              data-testid="edit-owner"
                              disabled={
                                !(
                                  tablePermissions.EditAll ||
                                  tablePermissions.EditTags
                                )
                              }
                              icon={<EditIcon width="14px" />}
                              size="small"
                              type="text"
                            />
                          </Tooltip>
                        </Space>
                      </TierCard>

                      {tableType && (
                        <>
                          <Divider
                            className="self-center m-x-md"
                            type="vertical"
                          />
                          <Typography.Text className="self-center">
                            {t('label.type')}{' '}
                            <span className="font-medium">{tableType}</span>
                          </Typography.Text>{' '}
                        </>
                      )}
                      {tableDetails?.profile?.profileSample && (
                        <>
                          <Divider
                            className="self-center m-x-md"
                            type="vertical"
                          />
                          <Typography.Text className="self-center">
                            {t('label.usage')}{' '}
                            <span className="font-medium">
                              {usageSummary}
                              {t('label.pctile-lowercase')}
                            </span>
                          </Typography.Text>
                        </>
                      )}
                      {tableDetails?.profile?.columnCount && (
                        <>
                          <Divider
                            className="self-center m-x-md"
                            type="vertical"
                          />
                          <Typography.Text className="self-center">
                            {t('label.column-plural')}{' '}
                            <span className="font-medium">
                              {tableDetails?.profile?.columnCount}
                            </span>
                          </Typography.Text>
                        </>
                      )}
                      {tableDetails?.profile?.rowCount && (
                        <>
                          <Divider
                            className="self-center m-x-md"
                            type="vertical"
                          />
                          <Typography.Text className="self-center">
                            {t('label.row-plural')}{' '}
                            <span className="font-medium">
                              {tableDetails?.profile?.rowCount}
                            </span>
                          </Typography.Text>
                        </>
                      )}
                    </div>
                  </Col>
                </Row>
              </Col>
              <Col className="text-right" span={6}>
                <div className="text-right">
                  <ButtonGroup size="small">
                    <Button
                      icon={<Icon component={VersionIcon} />}
                      onClick={versionHandler}
                    />
                    <Button
                      icon={
                        <Icon
                          component={isFollowing ? StarFilledIcon : StarIcon}
                        />
                      }
                      onClick={handleFollowTable}
                    />
                    <ManageButton
                      allowSoftDelete={!deleted}
                      canDelete={tablePermissions.Delete}
                      deleted={deleted}
                      displayName={displayName}
                      editDisplayNamePermission={
                        tablePermissions?.EditAll ||
                        tablePermissions?.EditDisplayName
                      }
                      entityFQN={tableDetails.fullyQualifiedName}
                      entityId={tableId}
                      entityName={entityName}
                      entityType={EntityType.TABLE}
                      onAnnouncementClick={
                        tablePermissions?.EditAll
                          ? () => setIsAnnouncementDrawer(true)
                          : undefined
                      }
                      onEditDisplayName={handleDisplayNameUpdate}
                      onRestoreEntity={handleRestoreTable}
                    />
                  </ButtonGroup>
                  <div>
                    {activeAnnouncement && (
                      <AnnouncementCard
                        announcement={activeAnnouncement}
                        onClick={() => setIsAnnouncementDrawer(true)}
                      />
                    )}
                  </div>
                </div>
              </Col>
            </Row>
          )}
        </Col>

        <Col span={24}>
          <Tabs
            activeKey={activeTab ?? EntityTabs.SCHEMA}
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
        </Col>
      </Row>

      {isAnnouncementDrawerOpen && (
        <AnnouncementDrawer
          createPermission={tablePermissions?.EditAll}
          entityFQN={datasetFQN || ''}
          entityName={entityName || ''}
          entityType={EntityType.TABLE || ''}
          open={isAnnouncementDrawerOpen}
          onClose={() => setIsAnnouncementDrawer(false)}
        />
      )}
    </PageLayoutV1>
  );
};

export default TableDetailsPageV1;
