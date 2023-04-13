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

import { Card, Col, Row, Skeleton, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { ActivityFilters } from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList.interface';
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
import { restoreTable } from 'rest/tableAPI';
import { getEntityId, getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { ROUTES } from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { CSMode } from '../../enums/codemirror.enum';
import { EntityInfo, EntityType, FqnPart } from '../../enums/entity.enum';
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
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
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
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainerV1 from '../containers/PageContainerV1';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import FrequentlyJoinedTables from '../FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import Loader from '../Loader/Loader';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import SampleDataTable from '../SampleDataTable/SampleDataTable.component';
import SchemaEditor from '../schema-editor/SchemaEditor';
import SchemaTab from '../SchemaTab/SchemaTab.component';
import TableProfilerGraph from '../TableProfiler/TableProfilerGraph.component';
import TableProfilerV1 from '../TableProfiler/TableProfilerV1';
import TableQueries from '../TableQueries/TableQueries';
import { DatasetDetailsProps } from './DatasetDetails.interface';
import './datasetDetails.style.less';

const DatasetDetails: React.FC<DatasetDetailsProps> = ({
  datasetFQN,
  activeTab,
  setActiveTabHandler,
  tableProfile,
  followTableHandler,
  unfollowTableHandler,
  slashedTableName,
  tableDetails,
  descriptionUpdateHandler,
  columnsUpdateHandler,
  settingsUpdateHandler,
  versionHandler,
  dataModel,
  tagUpdateHandler,
  entityThread,
  isEntityThreadLoading,
  postFeedHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
  deletePostHandler,
  paging,
  fetchFeedHandler,
  handleExtensionUpdate,
  updateThreadHandler,
  entityFieldTaskCount,
  isTableProfileLoading,
}: DatasetDetailsProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [usage, setUsage] = useState('');
  const [weeklyUsageCount, setWeeklyUsageCount] = useState('');

  const [threadLink, setThreadLink] = useState<string>('');
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const [elementRef, isInView] = useInfiniteScroll(observerOptions);

  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const [activityFilter, setActivityFilter] = useState<ActivityFilters>();
  const {
    tier,
    tableTags,
    owner,
    tableType,
    version,
    followers = [],
    deleted,
    columns,
    description,
    usageSummary,
    joins,
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
        t('label.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    }
  }, [tableDetails.id, getEntityPermission, setTablePermissions]);

  useEffect(() => {
    if (tableDetails.id) {
      fetchResourcePermission();
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
    setWeeklyUsageCount(
      usageSummary?.weeklyStats?.count.toLocaleString() || '--'
    );
  };

  const { followersCount, isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === getCurrentUserId()),
      followersCount: followers?.length ?? 0,
    };
  }, [followers]);

  const tabs = useMemo(
    () => [
      {
        name: t('label.schema'),
        icon: {
          alt: 'schema',
          name: 'icon-schema',
          title: 'Schema',
          selectedName: 'icon-schemacolor',
        },
        isProtected: false,
        position: 1,
      },
      {
        name: t('label.activity-feed-and-task-plural'),
        icon: {
          alt: 'activity_feed',
          name: 'activity_feed',
          title: 'Activity Feed',
          selectedName: 'activity-feed-color',
        },
        isProtected: false,
        position: 2,
        count: feedCount,
      },
      {
        name: t('label.sample-data'),
        icon: {
          alt: 'sample_data',
          name: 'sample-data',
          title: 'Sample Data',
          selectedName: 'sample-data-color',
        },
        isProtected: false,
        isHidden: !(
          tablePermissions.ViewAll ||
          tablePermissions.ViewBasic ||
          tablePermissions.ViewSampleData
        ),
        position: 3,
      },
      {
        name: t('label.query-plural'),
        icon: {
          alt: 'table_queries',
          name: 'table_queries',
          title: 'Table Queries',
          selectedName: '',
        },
        isProtected: false,
        isHidden: !(
          tablePermissions.ViewAll ||
          tablePermissions.ViewBasic ||
          tablePermissions.ViewQueries
        ),
        position: 4,
      },
      {
        name: t('label.profiler-amp-data-quality'),
        icon: {
          alt: 'profiler',
          name: 'icon-profiler',
          title: 'Profiler',
          selectedName: 'icon-profilercolor',
        },
        isProtected: false,
        isHidden: !(
          tablePermissions.ViewAll ||
          tablePermissions.ViewBasic ||
          tablePermissions.ViewDataProfile ||
          tablePermissions.ViewTests
        ),
        position: 5,
      },
      {
        name: t('label.lineage'),
        icon: {
          alt: 'lineage',
          name: 'icon-lineage',
          title: 'Lineage',
          selectedName: 'icon-lineagecolor',
        },
        isProtected: false,
        position: 7,
      },
      {
        name: t('label.dbt-lowercase'),
        icon: {
          alt: 'dbt-model',
          name: 'dbtmodel-light-grey',
          title: 'DBT',
          selectedName: 'dbtmodel-primery',
        },
        isProtected: false,
        isHidden: !dataModel?.sql,
        position: 8,
      },
      {
        name: t('label.custom-property-plural'),
        isProtected: false,
        position: 9,
      },
    ],
    [tablePermissions, dataModel, feedCount]
  );

  const getFrequentlyJoinedWithTables = (): Array<
    JoinedWith & { name: string }
  > => {
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
    { value: `${weeklyUsageCount} ${t('label.query-plural')}` },
    {
      key: EntityInfo.COLUMNS,
      localizationKey: 'column-plural',
      value: prepareExtraInfoValues(
        EntityInfo.COLUMNS,
        isTableProfileLoading,
        tableProfile,
        columns.length
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
      await descriptionUpdateHandler(updatedTableDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onColumnsUpdate = async (updateColumns: Table['columns']) => {
    if (!isEqual(columns, updateColumns)) {
      const updatedTableDetails = {
        ...tableDetails,
        columns: updateColumns,
      };
      await columnsUpdateHandler(updatedTableDetails);
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
      settingsUpdateHandler(updatedTableDetails);
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

      return settingsUpdateHandler(updatedTableDetails);
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
      settingsUpdateHandler(updatedTableDetails);
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
      tagUpdateHandler(updatedTable);
    }
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
    if (isElementInView && pagingObj?.after && !isLoading && activeTab === 2) {
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
    fetchMoreThread(isInView as boolean, paging, isEntityThreadLoading);
  }, [paging, isEntityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback((feedType, threadType) => {
    setActivityFilter({ feedFilter: feedType, threadType });
    fetchFeedHandler(undefined, feedType, threadType);
  }, []);

  return (
    <PageContainerV1>
      <div className="entity-details-container">
        <EntityPageInfo
          canDelete={tablePermissions.Delete}
          currentOwner={tableDetails.owner}
          deleted={deleted}
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
          entityName={entityName}
          entityType={EntityType.TABLE}
          extraInfo={extraInfo}
          followHandler={followTable}
          followers={followersCount}
          followersList={followers}
          isFollowing={isFollowing}
          isTagEditable={tablePermissions.EditAll || tablePermissions.EditTags}
          removeTier={
            tablePermissions.EditAll || tablePermissions.EditTier
              ? onRemoveTier
              : undefined
          }
          tags={tableTags}
          tagsHandler={onTagUpdate}
          tier={tier}
          titleLinks={slashedTableName}
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
        />

        <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
          <TabsPane
            activeTab={activeTab}
            className="tw-flex-initial"
            setActiveTab={setActiveTabHandler}
            tabs={tabs}
          />
          <div className="h-full">
            {activeTab === 1 && (
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
                        tablePermissions.EditAll ||
                        tablePermissions.EditDescription
                      }
                      isEdit={isEdit}
                      isReadOnly={deleted}
                      owner={owner}
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
                      columns={columns}
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
                        tablePermissions.EditAll ||
                        tablePermissions.EditDescription
                      }
                      hasTagEditAccess={
                        tablePermissions.EditAll || tablePermissions.EditTags
                      }
                      isReadOnly={deleted}
                      joins={joins?.columnJoins || []}
                      tableConstraints={tableDetails.tableConstraints}
                      onThreadLinkSelect={onThreadLinkSelect}
                      onUpdate={onColumnsUpdate}
                    />
                  </Col>
                </Row>
              </Card>
            )}
            {activeTab === 2 && (
              <Card className="m-y-md h-min-full">
                <Row>
                  <Col data-testid="activityfeed" offset={3} span={18}>
                    <ActivityFeedList
                      isEntityFeed
                      withSidePanel
                      className=""
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
            )}
            {activeTab === 3 && (
              <Card className="m-y-md h-full" id="sampleDataDetails">
                <SampleDataTable
                  isTableDeleted={tableDetails.deleted}
                  tableId={tableDetails.id}
                />
              </Card>
            )}
            {activeTab === 4 && (
              <TableQueries
                isTableDeleted={tableDetails.deleted}
                tableId={tableDetails.id}
              />
            )}
            {activeTab === 5 && (
              <TableProfilerV1
                isTableDeleted={tableDetails.deleted}
                permissions={tablePermissions}
                tableFqn={tableDetails.fullyQualifiedName || ''}
              />
            )}

            {activeTab === 7 && (
              <Card
                className={classNames(
                  'card-body-full m-y-md',
                  location.pathname.includes(ROUTES.TOUR) ? 'h-70vh' : 'h-full'
                )}
                id="lineageDetails">
                <EntityLineageComponent
                  deleted={deleted}
                  entityType={EntityType.TABLE}
                  hasEditAccess={
                    tablePermissions.EditAll || tablePermissions.EditLineage
                  }
                />
              </Card>
            )}
            {activeTab === 8 && Boolean(dataModel?.sql) && (
              <Card className="m-y-md h-full">
                <SchemaEditor
                  className="tw-h-full"
                  mode={{ name: CSMode.SQL }}
                  value={dataModel?.sql || ''}
                />
              </Card>
            )}
            {activeTab === 9 && (
              <Card className="m-y-md h-full">
                <CustomPropertyTable
                  entityDetails={
                    tableDetails as CustomPropertyProps['entityDetails']
                  }
                  entityType={EntityType.TABLE}
                  handleExtensionUpdate={handleExtensionUpdate}
                  hasEditAccess={
                    tablePermissions.EditAll ||
                    tablePermissions.EditCustomFields
                  }
                />
              </Card>
            )}
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
      </div>
    </PageContainerV1>
  );
};

export default DatasetDetails;
