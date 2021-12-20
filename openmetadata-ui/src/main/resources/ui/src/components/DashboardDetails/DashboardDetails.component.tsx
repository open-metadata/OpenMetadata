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
import { EntityTags } from 'Models';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTeamDetailsPath } from '../../constants/constants';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { User } from '../../generated/entity/teams/user';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import { useAuth } from '../../hooks/authHooks';
import {
  getCurrentUserId,
  getHtmlForNonAdminAction,
  getUserTeams,
  isEven,
} from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagsWithoutTier } from '../../utils/TableUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import ManageTabComponent from '../ManageTab/ManageTab.component';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';
import { ChartType, DashboardDetailsProps } from './DashboardDetails.interface';

const DashboardDetails = ({
  entityName,
  followers,
  followDashboardHandler,
  unfollowDashboardHandler,
  owner,
  tagList,
  tier,
  slashedDashboardName,
  activeTab,
  setActiveTabHandler,
  description,
  serviceType,
  dashboardUrl,
  dashboardTags,
  dashboardDetails,
  users,
  descriptionUpdateHandler,
  settingsUpdateHandler,
  tagUpdateHandler,
  charts,
  chartDescriptionUpdateHandler,
  chartTagUpdateHandler,
}: DashboardDetailsProps) => {
  const { isAuthDisabled } = useAuth();
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
  const hasEditAccess = () => {
    if (owner?.type === 'user') {
      return owner.id === getCurrentUserId();
    } else {
      return getUserTeams().some((team) => team.id === owner?.id);
    }
  };
  const setFollowersData = (followers: Array<User>) => {
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
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
        selectedName: 'icon-managecolor',
      },
      isProtected: true,
      protectedState: !owner || hasEditAccess(),
      position: 2,
    },
  ];

  const extraInfo = [
    {
      key: 'Owner',
      value:
        owner?.type === 'team'
          ? getTeamDetailsPath(owner?.name || '')
          : owner?.name || '',
      placeholderText: owner?.displayName || '',
      isLink: owner?.type === 'team',
      openInNewTab: false,
    },
    { key: 'Tier', value: tier?.tagFQN ? tier.tagFQN.split('.')[1] : '' },
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
          ? {
              ...dashboardDetails.owner,
              ...newOwner,
            }
          : dashboardDetails.owner,
        tags: tierTag,
      };

      return settingsUpdateHandler(updatedDashboardDetails);
    } else {
      return Promise.reject();
    }
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags =
        dashboardDetails?.tags?.filter((tag) =>
          selectedTags.includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          tagFQN: tag,
        }));
      const updatedTags = [...prevTags, ...newTags];
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

  const handleChartTagSelection = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags && editChartTags) {
      const prevTags = editChartTags.chart.tags?.filter((tag) =>
        selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
      );
      const newTags = selectedTags
        .filter(
          (selectedTag) =>
            !editChartTags.chart.tags?.some(
              (tag) => tag.tagFQN === selectedTag.tagFQN
            )
        )
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          tagFQN: tag.tagFQN,
        }));

      const updatedChart = {
        ...editChartTags.chart,
        tags: [...(prevTags as TagLabel[]), ...newTags],
      };
      const jsonPatch = compare(charts[editChartTags.index], updatedChart);
      chartTagUpdateHandler(
        editChartTags.index,
        editChartTags.chart.id,
        jsonPatch
      );
      setEditChartTags(undefined);
    } else {
      setEditChartTags(undefined);
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

  return (
    <>
      <PageContainer>
        <div className="tw-px-4 tw-w-full tw-h-full tw-flex tw-flex-col">
          <EntityPageInfo
            isTagEditable
            entityName={entityName}
            extraInfo={extraInfo}
            followers={followersCount}
            followersList={followers}
            followHandler={followDashboard}
            hasEditAccess={hasEditAccess()}
            isFollowing={isFollowing}
            owner={owner}
            tagList={tagList}
            tags={dashboardTags}
            tagsHandler={onTagUpdate}
            tier={tier || ''}
            titleLinks={slashedDashboardName}
          />
          <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
            <TabsPane
              activeTab={activeTab}
              className="tw-flex-initial"
              setActiveTab={setActiveTabHandler}
              tabs={tabs}
            />

            <div className="tw-bg-white tw-flex-grow tw-mx-1">
              {activeTab === 1 && (
                <>
                  <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full tw-mt-4">
                    <div className="tw-col-span-full">
                      <Description
                        description={description}
                        entityName={entityName}
                        hasEditAccess={hasEditAccess()}
                        isEdit={isEdit}
                        owner={owner}
                        onCancel={onCancel}
                        onDescriptionEdit={onDescriptionEdit}
                        onDescriptionUpdate={onDescriptionUpdate}
                      />
                    </div>
                  </div>
                  <div className="tw-table-responsive tw-my-6">
                    <table className="tw-w-full" data-testid="schema-table">
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
                                    {chart.displayName}
                                  </span>
                                  <SVGIcons
                                    alt="external-link"
                                    className="tw-align-middle"
                                    icon="external-link"
                                    width="12px"
                                  />
                                </span>
                              </Link>
                            </td>
                            <td className="tableBody-cell">
                              {chart.chartType}
                            </td>
                            <td className="tw-group tableBody-cell tw-relative">
                              <NonAdminAction
                                html={getHtmlForNonAdminAction(Boolean(owner))}
                                isOwner={hasEditAccess()}
                                position="top">
                                <div className="tw-inline-block">
                                  <div
                                    className="tw-cursor-pointer hover:tw-underline tw-flex"
                                    data-testid="description"
                                    onClick={() =>
                                      handleUpdateChart(chart, index)
                                    }>
                                    <div>
                                      {chart.description ? (
                                        <RichTextEditorPreviewer
                                          markdown={chart.description}
                                        />
                                      ) : (
                                        <span className="tw-no-description">
                                          No description added
                                        </span>
                                      )}
                                    </div>
                                    <button className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                      <SVGIcons
                                        alt="edit"
                                        icon="icon-edit"
                                        title="Edit"
                                        width="10px"
                                      />
                                    </button>
                                  </div>
                                </div>
                              </NonAdminAction>
                            </td>
                            <td
                              className="tw-group tw-relative tableBody-cell"
                              onClick={() => {
                                if (!editChartTags) {
                                  handleEditChartTag(chart, index);
                                }
                              }}>
                              <NonAdminAction
                                html={getHtmlForNonAdminAction(Boolean(owner))}
                                isOwner={hasEditAccess()}
                                position="left"
                                trigger="click">
                                <TagsContainer
                                  editable={editChartTags?.index === index}
                                  selectedTags={chart.tags as EntityTags[]}
                                  tagList={tagList}
                                  type="label"
                                  onCancel={() => {
                                    handleChartTagSelection();
                                  }}
                                  onSelectionChange={(tags) => {
                                    handleChartTagSelection(tags);
                                  }}>
                                  {chart.tags?.length ? (
                                    <button
                                      className="tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                                      data-testid="edit-tags">
                                      <SVGIcons
                                        alt="edit"
                                        icon="icon-edit"
                                        title="Edit"
                                        width="10px"
                                      />
                                    </button>
                                  ) : (
                                    <span className="tw-opacity-60 group-hover:tw-opacity-100 tw-text-grey-muted group-hover:tw-text-primary">
                                      <Tags
                                        startWith="+ "
                                        tag="Add tag"
                                        type="outlined"
                                      />
                                    </span>
                                  )}
                                </TagsContainer>
                              </NonAdminAction>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {activeTab === 2 && (
                <div className="tw-mt-4">
                  <ManageTabComponent
                    currentTier={tier?.tagFQN}
                    currentUser={owner?.id}
                    hasEditAccess={hasEditAccess()}
                    onSave={onSettingsUpdate}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
      {editChart && (
        <ModalWithMarkdownEditor
          header={`Edit Chart: "${editChart.chart.displayName}"`}
          placeholder="Enter Chart Description"
          value={editChart.chart.description || ''}
          onCancel={closeEditChartModal}
          onSave={onChartUpdate}
        />
      )}
    </>
  );
};

export default DashboardDetails;
