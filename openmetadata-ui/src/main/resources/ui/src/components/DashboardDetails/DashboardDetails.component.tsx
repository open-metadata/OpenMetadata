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
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { EntityTags, ExtraInfo, TagOption } from 'Models';
import React, { RefObject, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { getTeamAndUserDetailsPath } from '../../constants/constants';
import { EntityField } from '../../constants/feed.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { SettledStatus } from '../../enums/axios.enum';
import { EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import {
  getCurrentUserId,
  getEntityDeleteMessage,
  getEntityName,
  getEntityPlaceHolder,
  getHtmlForNonAdminAction,
  isEven,
  pluralize,
} from '../../utils/CommonUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import { getDefaultValue } from '../../utils/FeedElementUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagsWithoutTier } from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import Entitylineage from '../EntityLineage/EntityLineage.component';
import Loader from '../Loader/Loader';
import ManageTabComponent from '../ManageTab/ManageTab.component';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import RequestDescriptionModal from '../Modals/RequestDescriptionModal/RequestDescriptionModal';
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

  const onEntityFieldSelect = (value: string) => {
    setSelectedField(value);
  };
  const closeRequestModal = () => {
    setSelectedField('');
  };
  const hasEditAccess = () => {
    const loggedInUser = AppState.getCurrentUserDetails();
    if (owner?.type === 'user') {
      return owner.id === loggedInUser?.id;
    } else {
      return Boolean(
        loggedInUser?.teams?.length &&
          loggedInUser?.teams?.some((team) => team.id === owner?.id)
      );
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
      name: 'Activity Feed & Task',
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
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
        selectedName: 'icon-managecolor',
      },
      isProtected: true,
      protectedState: !owner || hasEditAccess(),
      position: 4,
    },
  ];

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        owner?.type === 'team'
          ? getTeamAndUserDetailsPath(owner?.name || '')
          : getEntityName(owner),
      placeholderText: getEntityPlaceHolder(
        getEntityName(owner),
        owner?.deleted
      ),
      isLink: owner?.type === 'team',
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

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedDashboardDetails = {
        ...dashboardDetails,
        description: updatedHTML,
      };
      descriptionUpdateHandler(updatedDashboardDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onSettingsUpdate = (
    newOwner?: Dashboard['owner'],
    newTier?: string
  ) => {
    if (newOwner || newTier) {
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
        owner: newOwner
          ? { ...dashboardDetails.owner, ...newOwner }
          : dashboardDetails.owner,
        tags: tierTag,
      };

      return settingsUpdateHandler(updatedDashboardDetails);
    } else {
      return Promise.reject();
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
  const onChartUpdate = (chartDescription: string) => {
    if (editChart) {
      const updatedChart = {
        ...editChart.chart,
        description: chartDescription,
      };
      const jsonPatch = compare(charts[editChart.index], updatedChart);
      chartDescriptionUpdateHandler(
        editChart.index,
        editChart.chart.id,
        jsonPatch
      );
      setEditChart(undefined);
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

  const getDeleteEntityMessage = () => {
    if (!charts.length) {
      return;
    }

    return getEntityDeleteMessage(
      EntityType.DASHBOARD,
      pluralize(charts.length, 'Chart')
    );
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

  return (
    <PageContainer>
      <div className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col">
        <EntityPageInfo
          isTagEditable
          deleted={deleted}
          entityFieldThreads={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldThreadCount
          )}
          entityFqn={dashboardFQN}
          entityName={entityName}
          entityType={EntityType.DASHBOARD}
          extraInfo={extraInfo}
          followHandler={followDashboard}
          followers={followersCount}
          followersList={followers}
          hasEditAccess={hasEditAccess()}
          isFollowing={isFollowing}
          owner={owner}
          tags={dashboardTags}
          tagsHandler={onTagUpdate}
          tier={tier || ''}
          titleLinks={slashedDashboardName}
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
                  </div>
                  <div className="tw-table-responsive tw-my-6">
                    <table className="tw-w-full" data-testid="charts-table">
                      <thead>
                        <tr className="tableHead-row">
                          <th className="tableHead-cell">Chart Name</th>
                          <th className="tableHead-cell">Chart Type</th>
                          <th className="tableHead-cell">Description</th>
                          <th className="tableHead-cell tw-w-60">Tags</th>
                        </tr>
                      </thead>
                      <tbody className="tableBody">
                        {charts.map((chart, index) => (
                          <tr
                            className={classNames(
                              'tableBody-row',
                              !isEven(index + 1) ? 'odd-row' : null
                            )}
                            key={index}>
                            <td className="tableBody-cell">
                              <Link
                                target="_blank"
                                to={{ pathname: chart.chartUrl }}>
                                <span className="tw-flex">
                                  <span className="tw-mr-1">
                                    {getEntityName(
                                      chart as unknown as EntityReference
                                    )}
                                  </span>
                                  <SVGIcons
                                    alt="external-link"
                                    className="tw-align-middle"
                                    icon="external-link"
                                    width="16px"
                                  />
                                </span>
                              </Link>
                            </td>
                            <td className="tableBody-cell">
                              {chart.chartType}
                            </td>
                            <td className="tw-group tableBody-cell tw-relative">
                              <div className="tw-inline-block">
                                <div
                                  className="tw-cursor-pointer tw-flex"
                                  data-testid="description">
                                  <div>
                                    {chart.description ? (
                                      <RichTextEditorPreviewer
                                        markdown={chart.description}
                                      />
                                    ) : (
                                      <span className="tw-no-description">
                                        No description
                                      </span>
                                    )}
                                  </div>
                                  {!deleted && (
                                    <NonAdminAction
                                      html={getHtmlForNonAdminAction(
                                        Boolean(owner)
                                      )}
                                      isOwner={hasEditAccess()}
                                      permission={Operation.EditDescription}
                                      position="top">
                                      <button
                                        className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                                        onClick={() =>
                                          handleUpdateChart(chart, index)
                                        }>
                                        <SVGIcons
                                          alt="edit"
                                          icon="icon-edit"
                                          title="Edit"
                                          width="16px"
                                        />
                                      </button>
                                    </NonAdminAction>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td
                              className="tw-group tw-relative tableBody-cell"
                              data-testid="tags-wrapper"
                              onClick={() => {
                                if (!editChartTags) {
                                  // Fetch tags and terms only once
                                  if (tagList.length === 0 || tagFetchFailed) {
                                    fetchTagsAndGlossaryTerms();
                                  }
                                  handleEditChartTag(chart, index);
                                }
                              }}>
                              {deleted ? (
                                <div className="tw-flex tw-flex-wrap">
                                  <TagsViewer
                                    sizeCap={-1}
                                    tags={chart.tags || []}
                                  />
                                </div>
                              ) : (
                                <NonAdminAction
                                  html={getHtmlForNonAdminAction(
                                    Boolean(owner)
                                  )}
                                  isOwner={hasEditAccess()}
                                  permission={Operation.EditTags}
                                  position="left"
                                  trigger="click">
                                  <TagsContainer
                                    showAddTagButton
                                    editable={editChartTags?.index === index}
                                    isLoading={
                                      isTagLoading &&
                                      editChartTags?.index === index
                                    }
                                    selectedTags={chart.tags as EntityTags[]}
                                    size="small"
                                    tagList={tagList}
                                    type="label"
                                    onCancel={() => {
                                      handleChartTagSelection();
                                    }}
                                    onSelectionChange={(tags) => {
                                      handleChartTagSelection(tags, {
                                        chart,
                                        index,
                                      });
                                    }}
                                  />
                                </NonAdminAction>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
              {activeTab === 4 && (
                <div>
                  <ManageTabComponent
                    allowDelete
                    allowSoftDelete={!deleted}
                    currentTier={tier?.tagFQN}
                    currentUser={owner}
                    deletEntityMessage={getDeleteEntityMessage()}
                    entityId={dashboardDetails.id}
                    entityName={dashboardDetails.name}
                    entityType={EntityType.DASHBOARD}
                    hasEditAccess={hasEditAccess()}
                    hideOwner={deleted}
                    hideTier={deleted}
                    manageSectionType={EntityType.DASHBOARD}
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
