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

import { Card, Col, Row, Skeleton, Space, Tabs, Typography } from 'antd';
import AppState from 'AppState';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { ActivityFilters } from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList.interface';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { getTableTabPath, ROUTES } from 'constants/constants';
import { mockTablePermission } from 'constants/mockTourData.constants';
import { SearchIndex } from 'enums/search.enum';
import { isEqual, isNil, isUndefined } from 'lodash';
import { EntityTags, ExtraInfo } from 'Models';
import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { searchQuery } from 'rest/searchAPI';
import { restoreTable } from 'rest/tableAPI';
import {
  getEntityBreadcrumbs,
  getEntityId,
  getEntityName,
} from 'utils/EntityUtils';
import { createQueryFilter } from 'utils/Query/QueryUtils';
import {
  FQN_SEPARATOR_CHAR,
  WILD_CARD_CHAR,
} from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import {
  EntityInfo,
  EntityTabs,
  EntityType,
  FqnPart,
} from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import {
  JoinedWith,
  Table,
  TableProfile,
  UsageDetails,
} from '../../generated/entity/data/table';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useElementInView } from '../../hooks/useElementInView';
import {
  getCurrentUserId,
  getEntityPlaceHolder,
  getOwnerValue,
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
  refreshPage,
} from '../../utils/CommonUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getTagsWithoutTier,
  getTierTags,
  getUsagePercentile,
} from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import FrequentlyJoinedTables from '../FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import Loader from '../Loader/Loader';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import SampleDataTable from '../SampleDataTable/SampleDataTable.component';
import SchemaTab from '../SchemaTab/SchemaTab.component';
import TableProfilerGraph from '../TableProfiler/TableProfilerGraph.component';
import TableProfilerV1 from '../TableProfiler/TableProfilerV1';
import TableQueries from '../TableQueries/TableQueries';
import { DatasetDetailsProps } from './DatasetDetails.interface';
import './datasetDetails.style.less';
import DbtTab from './DbtTab/DbtTab.component';

const DatasetDetails: React.FC<DatasetDetailsProps> = ({
  tableProfile,
  followTableHandler,
  unfollowTableHandler,
  tableDetails,
  versionHandler,
  dataModel,
  entityThread,
  isEntityThreadLoading,
  postFeedHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
  deletePostHandler,
  paging,
  fetchFeedHandler,
  updateThreadHandler,
  entityFieldTaskCount,
  isTableProfileLoading,
  onTableUpdate,
}: DatasetDetailsProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { datasetFQN, tab } =
    useParams<{ datasetFQN: string; tab: EntityTabs }>();
  const history = useHistory();
  const [isEdit, setIsEdit] = useState(false);
  const [usage, setUsage] = useState('');
  const [threadLink, setThreadLink] = useState<string>('');
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [queryCount, setQueryCount] = useState(0);

  const [elementRef, isInView] = useElementInView(observerOptions);

  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  // For tour we have to maintain state
  const [activeTab, setActiveTab] = useState(tab ?? EntityTabs.SCHEMA);

  const [activityFilter, setActivityFilter] = useState<ActivityFilters>();
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
  } = useMemo(() => {
    const { tags } = tableDetails;

    return {
      ...tableDetails,
      tier: getTierTags(tags ?? []),
      tableTags: getTagsWithoutTier(tags || []),
      entityName: getEntityName(tableDetails),
    };
  }, [tableDetails]);
  const breadcrumb = useMemo(
    () => getEntityBreadcrumbs(tableDetails, EntityType.TABLE),
    [tableDetails]
  );
  const isTourPage = location.pathname.includes(ROUTES.TOUR);

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = useCallback(async () => {
    try {
      const tablePermission = await getEntityPermission(
        ResourceEntity.TABLE,
        tableDetails.id
      );

      setTablePermissions(tablePermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    }
  }, [tableDetails.id, getEntityPermission, setTablePermissions]);

  const fetchQueryCount = async () => {
    try {
      const response = await searchQuery({
        query: WILD_CARD_CHAR,
        pageNumber: 0,
        pageSize: 0,
        queryFilter: createQueryFilter([], tableDetails.id),
        searchIndex: SearchIndex.QUERY,
        includeDeleted: false,
        trackTotalHits: true,
        fetchSource: false,
      });
      setQueryCount(response.hits.total.value);
    } catch (error) {
      setQueryCount(0);
    }
  };

  useEffect(() => {
    if (tableDetails.id && !isTourPage) {
      fetchQueryCount();
      fetchResourcePermission();
    }

    if (isTourPage) {
      setTablePermissions(mockTablePermission as OperationPermission);
    }
  }, [tableDetails.id]);

  const setUsageDetails = (usageSummary: UsageDetails) => {
    if (!isNil(usageSummary?.weeklyStats?.percentileRank)) {
      const percentile = getUsagePercentile(
        usageSummary?.weeklyStats?.percentileRank || 0,
        true
      );
      setUsage(percentile);
    } else {
      setUsage('--');
    }
  };

  const { followersCount, isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === getCurrentUserId()),
      followersCount: followers?.length ?? 0,
    };
  }, [followers]);

  const tabs = useMemo(() => {
    const allTabs = [
      {
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        key: EntityTabs.SCHEMA,
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
        isHidden: !(dataModel?.sql ?? dataModel?.rawSql),
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
  }, [tablePermissions, dataModel, feedCount, queryCount, activeTab]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      if (!isTourPage) {
        history.push(getTableTabPath(datasetFQN, activeKey));
      }
      setActiveTab(activeKey as EntityTabs);
    }
  };

  const getFrequentlyJoinedWithTables = (): Array<
    JoinedWith & { name: string }
  > => {
    const { joins } = tableDetails;
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

  const prepareExtraInfoValues = (
    key: EntityInfo,
    isTableProfileLoading?: boolean,
    tableProfile?: TableProfile,
    numberOfColumns?: number
  ) => {
    const { columns } = tableDetails;

    if (isTableProfileLoading) {
      return (
        <Skeleton active paragraph={{ rows: 1, width: 50 }} title={false} />
      );
    }
    switch (key) {
      case EntityInfo.COLUMNS: {
        const columnCount =
          tableProfile && tableProfile?.columnCount
            ? tableProfile?.columnCount
            : numberOfColumns
            ? numberOfColumns
            : undefined;

        return columnCount
          ? `${columns.length} ${t('label.column-plural')}`
          : null;
      }

      case EntityInfo.ROWS: {
        const rowData =
          ([
            {
              date: new Date(tableProfile?.timestamp || 0),
              value: tableProfile?.rowCount ?? 0,
            },
          ] as Array<{
            date: Date;
            value: number;
          }>) ?? [];

        return isUndefined(tableProfile) ? null : (
          <Space align="center">
            {rowData.length > 1 && (
              <TableProfilerGraph
                data={rowData}
                height={32}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                toolTipPos={{ x: 20, y: 30 }}
                width={120}
              />
            )}
            <Typography.Paragraph className="m-0">{`${
              tableProfile?.rowCount?.toLocaleString() || 0
            } rows`}</Typography.Paragraph>
          </Space>
        );
      }
      default:
        return null;
    }
  };

  const extraInfo: Array<ExtraInfo> = [
    {
      key: EntityInfo.OWNER,
      value: getOwnerValue(owner),
      placeholderText: getEntityPlaceHolder(
        getEntityName(owner),
        owner?.deleted
      ),
      id: getEntityId(owner),
      isEntityDetails: true,
      isLink: true,
      openInNewTab: false,
      profileName: owner?.type === OwnerType.USER ? owner?.name : undefined,
    },
    {
      key: EntityInfo.TIER,
      value: tier?.tagFQN ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1] : '',
    },
    { key: EntityInfo.TYPE, value: `${tableType}`, showLabel: true },
    { value: usage },
    {
      key: EntityInfo.COLUMNS,
      localizationKey: 'column-plural',
      value: prepareExtraInfoValues(
        EntityInfo.COLUMNS,
        isTableProfileLoading,
        tableProfile,
        tableDetails.columns.length
      ),
    },
    {
      key: EntityInfo.ROWS,
      value: prepareExtraInfoValues(
        EntityInfo.ROWS,
        isTableProfileLoading,
        tableProfile
      ),
    },
  ];

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
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
    if (!isEqual(tableDetails.columns, updateColumns)) {
      const updatedTableDetails = {
        ...tableDetails,
        columns: updateColumns,
      };
      await onTableUpdate(updatedTableDetails, 'columns');
    }
  };

  const onOwnerUpdate = useCallback(
    (newOwner?: Table['owner']) => {
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

  const onTierUpdate = (newTier?: string) => {
    if (newTier) {
      const tierTag: Table['tags'] = newTier
        ? [
            ...getTagsWithoutTier(tableDetails.tags as Array<EntityTags>),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : tableDetails.tags;
      const updatedTableDetails = {
        ...tableDetails,
        tags: tierTag,
      };

      return onTableUpdate(updatedTableDetails, 'tags');
    } else {
      return Promise.reject();
    }
  };

  const onRemoveTier = () => {
    if (tableDetails) {
      const updatedTableDetails = {
        ...tableDetails,
        tags: getTagsWithoutTier(tableDetails.tags ?? []),
      };
      onTableUpdate(updatedTableDetails, 'tags').catch(() => {
        // do nothing
      });
    }
  };

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const onTagUpdate = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...tableDetails, tags: updatedTags };
      onTableUpdate(updatedTable, 'tags').catch(() => {
        // do nothing
      });
    }
  };

  const handleDisplayNameUpdate = async (data: EntityName) => {
    const updatedTable = { ...tableDetails, displayName: data.displayName };
    await onTableUpdate(updatedTable, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Table) => {
    await onTableUpdate(updatedData, 'extension');
  };

  const followTable = () => {
    isFollowing ? unfollowTableHandler() : followTableHandler();
  };

  const handleRestoreTable = async () => {
    try {
      await restoreTable(tableDetails.id);
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

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const loader = useMemo(
    () => (isEntityThreadLoading ? <Loader /> : null),
    [isEntityThreadLoading]
  );

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (
      isElementInView &&
      pagingObj?.after &&
      !isLoading &&
      activeTab === EntityTabs.ACTIVITY_FEED
    ) {
      fetchFeedHandler(
        pagingObj.after,
        activityFilter?.feedFilter,
        activityFilter?.threadType
      );
    }
  };

  useEffect(() => {
    usageSummary && setUsageDetails(usageSummary);
  }, [usageSummary]);

  useEffect(() => {
    fetchMoreThread(isInView, paging, isEntityThreadLoading);
  }, [paging, isEntityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback((feedType, threadType) => {
    setActivityFilter({ feedFilter: feedType, threadType });
    fetchFeedHandler(undefined, feedType, threadType);
  }, []);

  useEffect(() => {
    if (isTourPage) {
      setActiveTab(AppState.activeTabforTourDatasetPage);
    } else {
      setActiveTab(tab);
    }
  }, [tab, AppState.activeTabforTourDatasetPage]);

  const tabDetails = useMemo(() => {
    switch (activeTab) {
      case EntityTabs.CUSTOM_PROPERTIES:
        return (
          <CustomPropertyTable
            entityDetails={tableDetails as CustomPropertyProps['entityDetails']}
            entityType={EntityType.TABLE}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={
              tablePermissions.EditAll || tablePermissions.EditCustomFields
            }
          />
        );
      case EntityTabs.DBT:
        return <DbtTab dataModel={dataModel} />;
      case EntityTabs.LINEAGE:
        return (
          <Card className="card-body-full m-y-md h-70vh" id="lineageDetails">
            <EntityLineageComponent
              deleted={tableDetails.deleted}
              entityType={EntityType.TABLE}
              hasEditAccess={
                tablePermissions.EditAll || tablePermissions.EditLineage
              }
            />
          </Card>
        );
      case EntityTabs.PROFILER:
        return (
          <TableProfilerV1
            isTableDeleted={tableDetails.deleted}
            permissions={tablePermissions}
            tableFqn={tableDetails.fullyQualifiedName || ''}
          />
        );
      case EntityTabs.TABLE_QUERIES:
        return (
          <TableQueries
            isTableDeleted={tableDetails.deleted}
            tableId={tableDetails.id}
          />
        );
      case EntityTabs.SAMPLE_DATA:
        return (
          <SampleDataTable
            isTableDeleted={tableDetails.deleted}
            tableId={tableDetails.id}
          />
        );
      case EntityTabs.ACTIVITY_FEED:
        return (
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
        );
      case EntityTabs.SCHEMA:
      default:
        return (
          <Card className="m-y-md h-full">
            <Row id="schemaDetails">
              <Col span={17}>
                <Description
                  description={description}
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
                  isReadOnly={tableDetails.deleted}
                  owner={tableDetails.owner}
                  onCancel={onCancel}
                  onDescriptionEdit={onDescriptionEdit}
                  onDescriptionUpdate={onDescriptionUpdate}
                  onThreadLinkSelect={onThreadLinkSelect}
                />
              </Col>
              <Col offset={1} span={6}>
                <div className="global-border rounded-4">
                  <FrequentlyJoinedTables
                    header={t('label.frequently-joined-table-plural')}
                    tableList={getFrequentlyJoinedWithTables()}
                  />
                </div>
              </Col>
              <Col className="m-t-md" span={24}>
                <SchemaTab
                  columnName={getPartialNameFromTableFQN(
                    datasetFQN,
                    [FqnPart['Column']],
                    FQN_SEPARATOR_CHAR
                  )}
                  columns={tableDetails.columns}
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
                  isReadOnly={tableDetails.deleted}
                  joins={tableDetails.joins?.columnJoins || []}
                  tableConstraints={tableDetails.tableConstraints}
                  onThreadLinkSelect={onThreadLinkSelect}
                  onUpdate={onColumnsUpdate}
                />
              </Col>
            </Row>
          </Card>
        );
    }
  }, [
    activeTab,
    tableDetails,
    tablePermissions,
    entityFieldThreadCount,
    entityFieldTaskCount,
    isEdit,
    entityName,
    datasetFQN,
    description,
    entityThread,
    isEntityThreadLoading,
    dataModel,
  ]);

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(tableDetails),
      })}>
      <EntityPageInfo
        canDelete={tablePermissions.Delete}
        currentOwner={tableDetails.owner}
        deleted={tableDetails.deleted}
        displayName={tableDetails.displayName}
        entityFieldTasks={getEntityFieldThreadCounts(
          EntityField.TAGS,
          entityFieldTaskCount
        )}
        entityFieldThreads={getEntityFieldThreadCounts(
          EntityField.TAGS,
          entityFieldThreadCount
        )}
        entityFqn={datasetFQN}
        entityId={tableDetails.id}
        entityName={tableDetails.name}
        entityType={EntityType.TABLE}
        extraInfo={extraInfo}
        followHandler={followTable}
        followers={followersCount}
        followersList={followers}
        isFollowing={isFollowing}
        permission={tablePermissions}
        removeTier={
          tablePermissions.EditAll || tablePermissions.EditTier
            ? onRemoveTier
            : undefined
        }
        serviceType={tableDetails.serviceType ?? ''}
        tags={tableTags}
        tagsHandler={onTagUpdate}
        tier={tier}
        titleLinks={breadcrumb}
        updateOwner={
          tablePermissions.EditAll || tablePermissions.EditOwner
            ? onOwnerUpdate
            : undefined
        }
        updateTier={
          tablePermissions.EditAll || tablePermissions.EditTier
            ? onTierUpdate
            : undefined
        }
        version={version}
        versionHandler={versionHandler}
        onRestoreEntity={handleRestoreTable}
        onThreadLinkSelect={onThreadLinkSelect}
        onUpdateDisplayName={handleDisplayNameUpdate}
      />

      <div className="m-t-md">
        <Tabs
          activeKey={activeTab ?? EntityTabs.SCHEMA}
          data-testid="tabs"
          items={tabs}
          onChange={handleTabChange}
        />
        <div
          className={classNames(
            // when tour its active its scroll's down to bottom and highligh whole panel so popup comes in center,
            // to prevent scroll h-70vh is added
            isTourPage ? 'h-70vh overflow-hidden' : 'h-full'
          )}
          id="tab-details">
          {tabDetails}
        </div>

        <div
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}
        />
        {threadLink ? (
          <ActivityThreadPanel
            createThread={createThread}
            deletePostHandler={deletePostHandler}
            open={Boolean(threadLink)}
            postFeedHandler={postFeedHandler}
            threadLink={threadLink}
            threadType={threadType}
            updateThreadHandler={updateThreadHandler}
            onCancel={onThreadPanelClose}
          />
        ) : null}
      </div>
    </PageLayoutV1>
  );
};

export default DatasetDetails;
