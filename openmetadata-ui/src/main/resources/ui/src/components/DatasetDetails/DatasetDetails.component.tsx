/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isEqual, isNil, isUndefined } from 'lodash';
import { ColumnJoins, EntityTags, ExtraInfo } from 'Models';
import React, { RefObject, useEffect, useState } from 'react';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { getTeamDetailsPath, ROUTES } from '../../constants/constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { CSMode } from '../../enums/codemirror.enum';
import { EntityType } from '../../enums/entity.enum';
import {
  JoinedWith,
  Table,
  TableJoins,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import {
  getCurrentUserId,
  getEntityName,
  getEntityPlaceHolder,
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
  getUserTeams,
} from '../../utils/CommonUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import { getDefaultValue } from '../../utils/FeedElementUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import {
  getTableTestsValue,
  getTagsWithoutTier,
  getUsagePercentile,
} from '../../utils/TableUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import DataQualityTab from '../DataQualityTab/DataQualityTab';
import Entitylineage from '../EntityLineage/EntityLineage.component';
import FrequentlyJoinedTables from '../FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import Loader from '../Loader/Loader';
import ManageTab from '../ManageTab/ManageTab.component';
import RequestDescriptionModal from '../Modals/RequestDescriptionModal/RequestDescriptionModal';
import SampleDataTable, {
  SampleColumns,
} from '../SampleDataTable/SampleDataTable.component';
import SchemaEditor from '../schema-editor/SchemaEditor';
import SchemaTab from '../SchemaTab/SchemaTab.component';
import TableProfiler from '../TableProfiler/TableProfiler.component';
import TableProfilerGraph from '../TableProfiler/TableProfilerGraph.component';
import TableQueries from '../TableQueries/TableQueries';
import { DatasetDetailsProps } from './DatasetDetails.interface';

const DatasetDetails: React.FC<DatasetDetailsProps> = ({
  entityName,
  datasetFQN,
  activeTab,
  setActiveTabHandler,
  owner,
  description,
  tableProfile,
  columns,
  tier,
  sampleData,
  entityLineage,
  followTableHandler,
  unfollowTableHandler,
  followers,
  slashedTableName,
  tableTags,
  tableDetails,
  descriptionUpdateHandler,
  columnsUpdateHandler,
  settingsUpdateHandler,
  users,
  usageSummary,
  joins,
  tableType,
  version,
  versionHandler,
  loadNodeHandler,
  lineageLeafNodes,
  isNodeLoading,
  dataModel,
  deleted,
  tagUpdateHandler,
  addLineageHandler,
  removeLineageHandler,
  entityLineageHandler,
  isLineageLoading,
  isSampleDataLoading,
  isQueriesLoading,
  tableQueries,
  entityThread,
  isentityThreadLoading,
  postFeedHandler,
  feedCount,
  entityFieldThreadCount,
  testMode,
  tableTestCase,
  handleTestModeChange,
  createThread,
  handleAddTableTestCase,
  handleAddColumnTestCase,
  showTestForm,
  handleShowTestForm,
  handleRemoveTableTest,
  handleRemoveColumnTest,
  qualityTestFormHandler,
  handleSelectedColumn,
  selectedColumn,
  deletePostHandler,
  paging,
  fetchFeedHandler,
}: DatasetDetailsProps) => {
  const { isAuthDisabled } = useAuthContext();
  const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [usage, setUsage] = useState('');
  const [weeklyUsageCount, setWeeklyUsageCount] = useState('');
  const [tableJoinData, setTableJoinData] = useState<TableJoins>({
    startDate: new Date(),
    dayCount: 0,
    columnJoins: [],
  });

  const [threadLink, setThreadLink] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');

  const [elementRef, isInView] = useInfiniteScroll(observerOptions);

  const onEntityFieldSelect = (value: string) => {
    setSelectedField(value);
  };
  const closeRequestModal = () => {
    setSelectedField('');
  };

  const setUsageDetails = (
    usageSummary: TypeUsedToReturnUsageDetailsOfAnEntity
  ) => {
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
  const hasEditAccess = () => {
    if (owner?.type === 'user') {
      return owner.id === getCurrentUserId();
    } else {
      return getUserTeams().some((team) => team.id === owner?.id);
    }
  };
  const setFollowersData = (followers: Array<EntityReference>) => {
    setIsFollowing(
      followers.some(({ id }: { id: string }) => id === getCurrentUserId())
    );
    setFollowersCount(followers?.length);
  };
  const tabs = [
    {
      name: 'Schema',
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
      name: 'Activity Feed',
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
      name: 'Sample Data',
      icon: {
        alt: 'sample_data',
        name: 'sample-data',
        title: 'Sample Data',
        selectedName: 'sample-data-color',
      },
      isProtected: false,
      position: 3,
    },
    {
      name: 'Queries',
      icon: {
        alt: 'table_queries',
        name: 'table_queries',
        title: 'Table Queries',
        selectedName: '',
      },
      isProtected: false,
      position: 4,
    },
    {
      name: 'Profiler',
      icon: {
        alt: 'profiler',
        name: 'icon-profiler',
        title: 'Profiler',
        selectedName: 'icon-profilercolor',
      },
      isProtected: false,
      position: 5,
    },
    {
      name: 'Data Quality',
      icon: {
        alt: 'data-quality',
        name: 'icon-quality',
        title: 'Data Quality',
        selectedName: '',
      },
      isProtected: false,
      position: 6,
    },
    {
      name: 'Lineage',
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
      name: 'DBT',
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
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
        selectedName: 'icon-managecolor',
      },
      isProtected: false,
      isHidden: deleted,
      protectedState: !owner || hasEditAccess(),
      position: 9,
    },
  ];

  const getFrequentlyJoinedWithTables = (): Array<
    JoinedWith & { name: string }
  > => {
    let freqJoin: Array<JoinedWith & { name: string }> = [];
    for (const joinData of tableJoinData.columnJoins as ColumnJoins[]) {
      freqJoin = [
        ...freqJoin,
        ...(joinData?.joinedWith?.map((joinedCol) => {
          const tableFQN = getTableFQNFromColumnFQN(
            joinedCol?.fullyQualifiedName as string
          );

          return {
            name: getPartialNameFromTableFQN(
              tableFQN,
              ['database', 'table'],
              FQN_SEPARATOR_CHAR
            ),
            fullyQualifiedName: tableFQN,
            joinCount: joinedCol.joinCount,
          };
        }) as Array<JoinedWith & { name: string }>),
      ].sort((a, b) =>
        (a?.joinCount as number) > (b?.joinCount as number)
          ? 1
          : (b?.joinCount as number) > (a?.joinCount as number)
          ? -1
          : 0
      );
    }

    return freqJoin;
  };

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        owner?.type === 'team'
          ? getTeamDetailsPath(owner?.name || '')
          : getEntityName(owner),
      placeholderText: getEntityPlaceHolder(
        getEntityName(owner),
        owner?.deleted
      ),
      isLink: owner?.type === 'team',
      openInNewTab: false,
    },
    {
      key: 'Tier',
      value: tier?.tagFQN ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1] : '',
    },
    { key: 'Type', value: `${tableType}`, showLabel: true },
    { value: usage },
    { value: `${weeklyUsageCount} queries` },
    {
      key: 'Columns',
      value:
        tableProfile && tableProfile[0]?.columnCount
          ? `${tableProfile[0].columnCount} columns`
          : columns.length
          ? `${columns.length} columns`
          : '',
    },
    {
      key: 'Rows',
      value:
        !isUndefined(tableProfile) && tableProfile.length > 0 ? (
          <div className="tw-flex">
            <TableProfilerGraph
              className="tw--mt-4"
              data={
                tableProfile
                  ?.map((d) => ({
                    date: d.profileDate,
                    value: d.rowCount ?? 0,
                  }))
                  .reverse() as Array<{
                  date: Date;
                  value: number;
                }>
              }
              height={38}
              toolTipPos={{ x: 20, y: -30 }}
            />
            <span className="tw--ml-6">{`${
              tableProfile[0].rowCount || 0
            } rows`}</span>
          </div>
        ) : (
          ''
        ),
    },
    { key: 'Tests', value: getTableTestsValue(tableTestCase) },
  ];

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedTableDetails = {
        ...tableDetails,
        description: updatedHTML,
      };
      descriptionUpdateHandler(updatedTableDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onColumnsUpdate = (updateColumns: Table['columns']) => {
    if (!isEqual(columns, updateColumns)) {
      const updatedTableDetails = {
        ...tableDetails,
        columns: updateColumns,
      };
      columnsUpdateHandler(updatedTableDetails);
    }
  };

  const onSettingsUpdate = (newOwner?: Table['owner'], newTier?: string) => {
    if (newOwner || newTier) {
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
        owner: newOwner
          ? {
              ...tableDetails.owner,
              ...newOwner,
            }
          : tableDetails.owner,
        tags: tierTag,
      };

      return settingsUpdateHandler(updatedTableDetails);
    } else {
      return Promise.reject();
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
    if (isFollowing) {
      setFollowersCount((preValu) => preValu - 1);
      setIsFollowing(false);
      unfollowTableHandler();
    } else {
      setFollowersCount((preValu) => preValu + 1);
      setIsFollowing(true);
      followTableHandler();
    }
  };

  const getSampleDataWithType = () => {
    const updatedColumns = sampleData?.columns?.map((column) => {
      const matchedColumn = columns.find((col) => col.name === column);

      if (matchedColumn) {
        return {
          name: matchedColumn.name,
          dataType: matchedColumn.dataType,
        };
      } else {
        return {
          name: column,
          dataType: '',
        };
      }
    });

    return {
      columns: updatedColumns as SampleColumns[] | undefined,
      rows: sampleData?.rows,
    };
  };

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const getLoader = () => {
    return isentityThreadLoading ? <Loader /> : null;
  };

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (isElementInView && pagingObj?.after && !isLoading) {
      fetchFeedHandler(pagingObj.after);
    }
  };

  useEffect(() => {
    if (isAuthDisabled && users.length && followers.length) {
      setFollowersData(followers);
    }
  }, [users, followers]);

  useEffect(() => {
    setFollowersData(followers);
  }, [followers]);
  useEffect(() => {
    setUsageDetails(usageSummary);
  }, [usageSummary]);

  useEffect(() => {
    setTableJoinData(joins);
  }, [joins]);

  useEffect(() => {
    fetchMoreThread(isInView as boolean, paging, isentityThreadLoading);
  }, [paging, isentityThreadLoading, isInView]);

  return (
    <PageContainer>
      <div className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col">
        <EntityPageInfo
          isTagEditable
          deleted={deleted}
          entityFieldThreads={getEntityFieldThreadCounts(
            'tags',
            entityFieldThreadCount
          )}
          entityFqn={datasetFQN}
          entityName={entityName}
          entityType={EntityType.TABLE}
          extraInfo={extraInfo}
          followHandler={followTable}
          followers={followersCount}
          followersList={followers}
          hasEditAccess={hasEditAccess()}
          isFollowing={isFollowing}
          tags={tableTags}
          tagsHandler={onTagUpdate}
          tier={tier}
          titleLinks={slashedTableName}
          version={version}
          versionHandler={versionHandler}
          onThreadLinkSelect={onThreadLinkSelect}
        />

        <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
          <TabsPane
            activeTab={activeTab}
            className="tw-flex-initial"
            setActiveTab={setActiveTabHandler}
            tabs={tabs}
          />

          <div className="tw-bg-white tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
            {activeTab === 1 && (
              <div
                className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full"
                id="schemaDetails">
                <div className="tw-col-span-3">
                  <Description
                    description={description}
                    entityFieldThreads={getEntityFieldThreadCounts(
                      'description',
                      entityFieldThreadCount
                    )}
                    entityFqn={datasetFQN}
                    entityName={entityName}
                    entityType={EntityType.TABLE}
                    hasEditAccess={hasEditAccess()}
                    isEdit={isEdit}
                    isReadOnly={deleted}
                    owner={owner}
                    onCancel={onCancel}
                    onDescriptionEdit={onDescriptionEdit}
                    onDescriptionUpdate={onDescriptionUpdate}
                    onEntityFieldSelect={onEntityFieldSelect}
                    onThreadLinkSelect={onThreadLinkSelect}
                  />
                </div>
                <div className="tw-col-span-1 tw-border tw-border-main tw-rounded-md">
                  <FrequentlyJoinedTables
                    header="Frequently Joined Tables"
                    tableList={getFrequentlyJoinedWithTables()}
                  />
                </div>
                <div className="tw-col-span-full">
                  <SchemaTab
                    columnName={getPartialNameFromTableFQN(
                      datasetFQN,
                      ['column'],
                      FQN_SEPARATOR_CHAR
                    )}
                    columns={columns}
                    entityFieldThreads={getEntityFieldThreadCounts(
                      'columns',
                      entityFieldThreadCount
                    )}
                    entityFqn={datasetFQN}
                    hasEditAccess={hasEditAccess()}
                    isReadOnly={deleted}
                    joins={tableJoinData.columnJoins as ColumnJoins[]}
                    owner={owner}
                    sampleData={sampleData}
                    onEntityFieldSelect={onEntityFieldSelect}
                    onThreadLinkSelect={onThreadLinkSelect}
                    onUpdate={onColumnsUpdate}
                  />
                </div>

                {threadLink ? (
                  <ActivityThreadPanel
                    createThread={createThread}
                    deletePostHandler={deletePostHandler}
                    open={Boolean(threadLink)}
                    postFeedHandler={postFeedHandler}
                    threadLink={threadLink}
                    onCancel={onThreadPanelClose}
                  />
                ) : null}
                {selectedField ? (
                  <RequestDescriptionModal
                    createThread={createThread}
                    defaultValue={getDefaultValue(owner)}
                    header="Request description"
                    threadLink={getEntityFeedLink(
                      EntityType.TABLE,
                      datasetFQN,
                      selectedField
                    )}
                    onCancel={closeRequestModal}
                  />
                ) : null}
              </div>
            )}
            {activeTab === 2 && (
              <div
                className="tw-py-4 tw-px-7 tw-grid tw-grid-cols-3 entity-feed-list tw--mx-7 tw--my-4"
                id="activityfeed">
                <div />
                <ActivityFeedList
                  isEntityFeed
                  withSidePanel
                  className=""
                  deletePostHandler={deletePostHandler}
                  entityName={entityName}
                  feedList={entityThread}
                  postFeedHandler={postFeedHandler}
                />
                <div />
              </div>
            )}
            {activeTab === 3 && (
              <div id="sampleDataDetails">
                <SampleDataTable
                  isLoading={isSampleDataLoading}
                  sampleData={getSampleDataWithType()}
                />
              </div>
            )}
            {activeTab === 4 && (
              <div
                className="tw-py-4 tw-px-7 tw-grid tw-grid-cols-3 entity-feed-list"
                id="tablequeries">
                <div />
                <TableQueries
                  isLoading={isQueriesLoading}
                  queries={tableQueries}
                />
                <div />
              </div>
            )}
            {activeTab === 5 && (
              <div>
                <TableProfiler
                  columns={columns.map((col) => ({
                    constraint: col.constraint as string,
                    colName: col.name,
                    colType: col.dataTypeDisplay as string,
                    dataType: col.dataType as string,
                    colTests: col.columnTests,
                  }))}
                  isTableDeleted={deleted}
                  qualityTestFormHandler={qualityTestFormHandler}
                  tableProfiles={tableProfile}
                />
              </div>
            )}

            {activeTab === 6 && (
              <DataQualityTab
                columnOptions={columns}
                handleAddColumnTestCase={handleAddColumnTestCase}
                handleAddTableTestCase={handleAddTableTestCase}
                handleRemoveColumnTest={handleRemoveColumnTest}
                handleRemoveTableTest={handleRemoveTableTest}
                handleSelectedColumn={handleSelectedColumn}
                handleShowTestForm={handleShowTestForm}
                handleTestModeChange={handleTestModeChange}
                isTableDeleted={deleted}
                selectedColumn={selectedColumn}
                showTestForm={showTestForm}
                tableTestCase={tableTestCase}
                testMode={testMode}
              />
            )}

            {activeTab === 7 && (
              <div
                className={classNames(
                  location.pathname.includes(ROUTES.TOUR)
                    ? 'tw-h-70vh'
                    : 'tw-h-full'
                )}
                id="lineageDetails">
                <Entitylineage
                  addLineageHandler={addLineageHandler}
                  deleted={deleted}
                  entityLineage={entityLineage}
                  entityLineageHandler={entityLineageHandler}
                  isLoading={isLineageLoading}
                  isNodeLoading={isNodeLoading}
                  isOwner={hasEditAccess()}
                  lineageLeafNodes={lineageLeafNodes}
                  loadNodeHandler={loadNodeHandler}
                  removeLineageHandler={removeLineageHandler}
                />
              </div>
            )}
            {activeTab === 8 && Boolean(dataModel?.sql) && (
              <div className="tw-border tw-border-main tw-rounded-md tw-py-4 tw-h-full cm-h-full">
                <SchemaEditor
                  className="tw-h-full"
                  mode={{ name: CSMode.SQL }}
                  value={dataModel?.sql || ''}
                />
              </div>
            )}
            {activeTab === 9 && !deleted && (
              <div>
                <ManageTab
                  currentTier={tier?.tagFQN}
                  currentUser={owner?.id}
                  hasEditAccess={hasEditAccess()}
                  onSave={onSettingsUpdate}
                />
              </div>
            )}
            <div
              data-testid="observer-element"
              id="observer-element"
              ref={elementRef as RefObject<HTMLDivElement>}>
              {getLoader()}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default DatasetDetails;
