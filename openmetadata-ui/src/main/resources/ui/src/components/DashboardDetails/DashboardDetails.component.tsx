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

import { Space, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { EntityTags, ExtraInfo, TagOption } from 'Models';
import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/feed.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { observerOptions } from '../../constants/Mydata.constants';
import { SettledStatus } from '../../enums/axios.enum';
import { EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { ThreadType } from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import jsonData from '../../jsons/en';
import {
  getCurrentUserId,
  getEntityName,
  getEntityPlaceHolder,
  getOwnerValue,
} from '../../utils/CommonUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import { getDefaultValue } from '../../utils/FeedElementUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagsWithoutTier } from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import Loader from '../Loader/Loader';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import RequestDescriptionModal from '../Modals/RequestDescriptionModal/RequestDescriptionModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import TagsContainer from '../tags-container/tags-container';
import TagsViewer from '../tags-viewer/tags-viewer';
import { ChartType, DashboardDetailsProps } from './DashboardDetails.interface';

const DashboardDetails = ({
  entityName,
  followers,
  followDashboardHandler,
  unfollowDashboardHandler,
  owner,
  tier,
  slashedDashboardName,
  activeTab,
  setActiveTabHandler,
  description,
  serviceType,
  dashboardUrl,
  dashboardTags,
  dashboardDetails,
  descriptionUpdateHandler,
  settingsUpdateHandler,
  tagUpdateHandler,
  charts,
  chartDescriptionUpdateHandler,
  chartTagUpdateHandler,
  entityLineage,
  isNodeLoading,
  lineageLeafNodes,
  loadNodeHandler,
  versionHandler,
  version,
  deleted,
  addLineageHandler,
  removeLineageHandler,
  entityLineageHandler,
  isLineageLoading,
  entityThread,
  isentityThreadLoading,
  postFeedHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
  dashboardFQN,
  deletePostHandler,
  paging,
  fetchFeedHandler,
  updateThreadHandler,
  entityFieldTaskCount,
  onExtensionUpdate,
}: DashboardDetailsProps) => {
  const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editChart, setEditChart] = useState<{
    chart: ChartType;
    index: number;
  }>();
  const [editChartTags, setEditChartTags] = useState<{
    chart: ChartType;
    index: number;
  }>();
  const [tagList, setTagList] = useState<Array<TagOption>>([]);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [threadLink, setThreadLink] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.DASHBOARD,
        dashboardDetails.id
      );
      setDashboardPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        jsonData['api-error-messages']['fetch-entity-permissions-error']
      );
    }
  }, [dashboardDetails.id, getEntityPermission, setDashboardPermissions]);

  useEffect(() => {
    if (dashboardDetails.id) {
      fetchResourcePermission();
    }
  }, [dashboardDetails.id]);

  const onEntityFieldSelect = (value: string) => {
    setSelectedField(value);
  };
  const closeRequestModal = () => {
    setSelectedField('');
  };

  const setFollowersData = (followers: Array<EntityReference>) => {
    setIsFollowing(
      followers.some(({ id }: { id: string }) => id === getCurrentUserId())
    );
    setFollowersCount(followers?.length);
  };
  const tabs = [
    {
      name: 'Details',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Details',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 1,
    },
    {
      name: 'Activity Feeds & Tasks',
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
      name: 'Lineage',
      icon: {
        alt: 'lineage',
        name: 'icon-lineage',
        title: 'Lineage',
        selectedName: 'icon-lineagecolor',
      },
      isProtected: false,
      position: 3,
    },
    {
      name: 'Custom Properties',
      isProtected: false,
      position: 4,
    },
  ];

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value: getOwnerValue(owner),
      placeholderText: getEntityPlaceHolder(
        getEntityName(owner),
        owner?.deleted
      ),
      isLink: true,
      openInNewTab: false,
      profileName: owner?.type === OwnerType.USER ? owner?.name : undefined,
    },
    {
      key: 'Tier',
      value: tier?.tagFQN ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1] : '',
    },
    {
      key: `${serviceType} Url`,
      value: dashboardUrl,
      placeholderText: entityName,
      isLink: true,
      openInNewTab: true,
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
      const updatedDashboardDetails = {
        ...dashboardDetails,
        description: updatedHTML,
      };
      try {
        await descriptionUpdateHandler(updatedDashboardDetails);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    } else {
      setIsEdit(false);
    }
  };

  const onOwnerUpdate = (newOwner?: Dashboard['owner']) => {
    if (newOwner) {
      const updatedDashboardDetails = {
        ...dashboardDetails,
        owner: newOwner
          ? { ...dashboardDetails.owner, ...newOwner }
          : dashboardDetails.owner,
      };
      settingsUpdateHandler(updatedDashboardDetails);
    }
  };
  const onTierUpdate = (newTier?: string) => {
    if (newTier) {
      const tierTag: Dashboard['tags'] = newTier
        ? [
            ...getTagsWithoutTier(dashboardDetails.tags as Array<EntityTags>),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : dashboardDetails.tags;
      const updatedDashboardDetails = {
        ...dashboardDetails,
        tags: tierTag,
      };
      settingsUpdateHandler(updatedDashboardDetails);
    }
  };

  const onTagUpdate = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedDashboard = { ...dashboardDetails, tags: updatedTags };
      tagUpdateHandler(updatedDashboard);
    }
  };
  const followDashboard = () => {
    if (isFollowing) {
      setFollowersCount((preValu) => preValu - 1);
      setIsFollowing(false);
      unfollowDashboardHandler();
    } else {
      setFollowersCount((preValu) => preValu + 1);
      setIsFollowing(true);
      followDashboardHandler();
    }
  };
  const handleUpdateChart = (chart: ChartType, index: number) => {
    setEditChart({ chart, index });
  };
  const handleEditChartTag = (chart: ChartType, index: number): void => {
    setEditChartTags({ chart, index });
  };

  const closeEditChartModal = (): void => {
    setEditChart(undefined);
  };
  const onChartUpdate = async (chartDescription: string) => {
    if (editChart) {
      const updatedChart = {
        ...editChart.chart,
        description: chartDescription,
      };
      const jsonPatch = compare(charts[editChart.index], updatedChart);

      try {
        await chartDescriptionUpdateHandler(
          editChart.index,
          editChart.chart.id,
          jsonPatch
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setEditChart(undefined);
      }
    } else {
      setEditChart(undefined);
    }
  };

  const handleChartTagSelection = (
    selectedTags?: Array<EntityTags>,
    chart?: {
      chart: ChartType;
      index: number;
    }
  ) => {
    const chartTag = isUndefined(editChartTags) ? chart : editChartTags;
    if (selectedTags && chartTag) {
      const prevTags = chartTag.chart.tags?.filter((tag) =>
        selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
      );
      const newTags = selectedTags
        .filter(
          (selectedTag) =>
            !chartTag.chart.tags?.some(
              (tag) => tag.tagFQN === selectedTag.tagFQN
            )
        )
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          source: tag.source,
          tagFQN: tag.tagFQN,
        }));

      const updatedChart = {
        ...chartTag.chart,
        tags: [...(prevTags as TagLabel[]), ...newTags],
      };
      const jsonPatch = compare(charts[chartTag.index], updatedChart);
      chartTagUpdateHandler(chartTag.index, chartTag.chart.id, jsonPatch);
    }
    setEditChartTags(undefined);
  };

  const fetchTagsAndGlossaryTerms = () => {
    setIsTagLoading(true);
    Promise.allSettled([getTagCategories(), fetchGlossaryTerms()])
      .then((values) => {
        let tagsAndTerms: TagOption[] = [];
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[0].value.data
        ) {
          tagsAndTerms = getTaglist(values[0].value.data).map((tag) => {
            return { fqn: tag, source: 'Tag' };
          });
        }
        if (
          values[1].status === SettledStatus.FULFILLED &&
          values[1].value &&
          values[1].value.length > 0
        ) {
          const glossaryTerms: TagOption[] = getGlossaryTermlist(
            values[1].value
          ).map((tag) => {
            return { fqn: tag, source: 'Glossary' };
          });
          tagsAndTerms = [...tagsAndTerms, ...glossaryTerms];
        }
        setTagList(tagsAndTerms);
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[1].status === SettledStatus.FULFILLED
        ) {
          setTagFetchFailed(false);
        } else {
          setTagFetchFailed(true);
        }
      })
      .catch(() => {
        setTagList([]);
        setTagFetchFailed(true);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
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

  const handleTagContainerClick = (chart: ChartType, index: number) => {
    if (!editChartTags) {
      // Fetch tags and terms only once
      if (tagList.length === 0 || tagFetchFailed) {
        fetchTagsAndGlossaryTerms();
      }
      handleEditChartTag(chart, index);
    }
  };

  useEffect(() => {
    setFollowersData(followers);
  }, [followers]);

  useEffect(() => {
    fetchMoreThread(isInView as boolean, paging, isentityThreadLoading);
  }, [paging, isentityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback(
    (feedType, threadType) => {
      fetchFeedHandler(paging.after, feedType, threadType);
    },
    [paging]
  );

  const tableColumn: ColumnsType<ChartType> = useMemo(
    () => [
      {
        title: 'Chart Name',
        dataIndex: 'chartName',
        key: 'chartName',
        width: 200,
        render: (_, record) => (
          <Link target="_blank" to={{ pathname: record.chartUrl }}>
            <Space>
              <span>{getEntityName(record as unknown as EntityReference)}</span>
              <SVGIcons
                alt="external-link"
                className="tw-align-middle"
                icon="external-link"
                width="16px"
              />
            </Space>
          </Link>
        ),
      },
      {
        title: 'Chart Type',
        dataIndex: 'chartType',
        key: 'chartType',
        width: 100,
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (text, record, index) => (
          <Space
            className="w-full tw-group cursor-pointer"
            data-testid="description">
            <div>
              {text ? (
                <RichTextEditorPreviewer markdown={text} />
              ) : (
                <span className="tw-no-description">No description</span>
              )}
            </div>
            {!deleted && (
              <Tooltip
                title={
                  dashboardPermissions.EditAll
                    ? 'Edit Description'
                    : NO_PERMISSION_FOR_ACTION
                }>
                <button
                  className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                  disabled={!dashboardPermissions.EditAll}
                  onClick={() => handleUpdateChart(record, index)}>
                  <SVGIcons
                    alt="edit"
                    icon="icon-edit"
                    title="Edit"
                    width="16px"
                  />
                </button>
              </Tooltip>
            )}
          </Space>
        ),
      },
      {
        title: 'Tags',
        dataIndex: 'tags',
        key: 'tags',
        width: 300,
        render: (text, record, index) => (
          <div
            className="relative tableBody-cell"
            data-testid="tags-wrapper"
            onClick={() => handleTagContainerClick(record, index)}>
            {deleted ? (
              <div className="tw-flex tw-flex-wrap">
                <TagsViewer sizeCap={-1} tags={text || []} />
              </div>
            ) : (
              <TagsContainer
                editable={editChartTags?.index === index}
                isLoading={isTagLoading && editChartTags?.index === index}
                selectedTags={text as EntityTags[]}
                showAddTagButton={
                  dashboardPermissions.EditAll || dashboardPermissions.EditTags
                }
                size="small"
                tagList={tagList}
                type="label"
                onCancel={() => {
                  handleChartTagSelection();
                }}
                onSelectionChange={(tags) => {
                  handleChartTagSelection(tags, {
                    chart: record,
                    index,
                  });
                }}
              />
            )}
          </div>
        ),
      },
    ],
    [
      dashboardPermissions.EditAll,
      dashboardPermissions.EditTags,
      editChartTags,
      tagList,
      deleted,
    ]
  );

  return (
    <PageContainer>
      <div className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col">
        <EntityPageInfo
          canDelete={dashboardPermissions.Delete}
          deleted={deleted}
          entityFieldTasks={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldTaskCount
          )}
          entityFieldThreads={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldThreadCount
          )}
          entityFqn={dashboardFQN}
          entityId={dashboardDetails.id}
          entityName={entityName}
          entityType={EntityType.DASHBOARD}
          extraInfo={extraInfo}
          followHandler={followDashboard}
          followers={followersCount}
          followersList={followers}
          isFollowing={isFollowing}
          isTagEditable={
            dashboardPermissions.EditAll || dashboardPermissions.EditTags
          }
          tags={dashboardTags}
          tagsHandler={onTagUpdate}
          tier={tier || ''}
          titleLinks={slashedDashboardName}
          updateOwner={
            dashboardPermissions.EditAll || dashboardPermissions.EditOwner
              ? onOwnerUpdate
              : undefined
          }
          updateTier={
            dashboardPermissions.EditAll || dashboardPermissions.EditTier
              ? onTierUpdate
              : undefined
          }
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

          <div className="tw-flex-grow tw-flex tw-flex-col tw--mx-6 tw-px-7 tw-py-4">
            <div className="tw-bg-white tw-flex-grow tw-p-4 tw-shadow tw-rounded-md">
              {activeTab === 1 && (
                <>
                  <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                    <div className="tw-col-span-full tw--ml-5">
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
                        entityFqn={dashboardFQN}
                        entityName={entityName}
                        entityType={EntityType.DASHBOARD}
                        hasEditAccess={
                          dashboardPermissions.EditAll ||
                          dashboardPermissions.EditDescription
                        }
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
                  </div>
                  <Table
                    columns={tableColumn}
                    data-testid="charts-table"
                    dataSource={charts}
                    pagination={false}
                    rowKey="id"
                    size="small"
                  />
                </>
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
                    updateThreadHandler={updateThreadHandler}
                    onFeedFiltersUpdate={handleFeedFilterChange}
                  />
                  <div />
                </div>
              )}
              {activeTab === 3 && (
                <div className="tw-h-full tw-px-3">
                  <EntityLineageComponent
                    addLineageHandler={addLineageHandler}
                    deleted={deleted}
                    entityLineage={entityLineage}
                    entityLineageHandler={entityLineageHandler}
                    entityType={EntityType.DASHBOARD}
                    hasEditAccess={
                      dashboardPermissions.EditAll ||
                      dashboardPermissions.EditLineage
                    }
                    isLoading={isLineageLoading}
                    isNodeLoading={isNodeLoading}
                    lineageLeafNodes={lineageLeafNodes}
                    loadNodeHandler={loadNodeHandler}
                    removeLineageHandler={removeLineageHandler}
                  />
                </div>
              )}
              {activeTab === 4 && (
                <CustomPropertyTable
                  entityDetails={
                    dashboardDetails as CustomPropertyProps['entityDetails']
                  }
                  entityType={EntityType.DASHBOARD}
                  handleExtentionUpdate={onExtensionUpdate}
                />
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
      </div>
      {editChart && (
        <ModalWithMarkdownEditor
          header={`Edit Chart: "${editChart.chart.displayName}"`}
          placeholder="Enter Chart Description"
          value={editChart.chart.description || ''}
          onCancel={closeEditChartModal}
          onSave={onChartUpdate}
        />
      )}
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
      {selectedField ? (
        <RequestDescriptionModal
          createThread={createThread}
          defaultValue={getDefaultValue(owner as EntityReference)}
          header="Request description"
          threadLink={getEntityFeedLink(
            EntityType.DASHBOARD,
            dashboardFQN,
            selectedField
          )}
          onCancel={closeRequestModal}
        />
      ) : null}
    </PageContainer>
  );
};

export default DashboardDetails;
