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
import { Pipeline, Task } from '../../generated/entity/data/pipeline';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { User } from '../../generated/entity/teams/user';
import { LabelType, State } from '../../generated/type/tagLabel';
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
import Entitylineage from '../EntityLineage/EntityLineage.component';
import ManageTabComponent from '../ManageTab/ManageTab.component';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { PipeLineDetailsProp } from './PipelineDetails.interface';

const PipelineDetails = ({
  entityName,
  owner,
  tagList,
  tier,
  slashedPipelineName,
  pipelineTags,
  activeTab,
  pipelineUrl,
  pipelineDetails,
  serviceType,
  setActiveTabHandler,
  description,
  descriptionUpdateHandler,
  entityLineage,
  followers,
  users,
  followPipelineHandler,
  unfollowPipelineHandler,
  tagUpdateHandler,
  settingsUpdateHandler,
  tasks,
  taskUpdateHandler,
  loadNodeHandler,
  lineageLeafNodes,
  isNodeLoading,
  version,
  deleted,
  versionHandler,
  addLineageHandler,
  removeLineageHandler,
  entityLineageHandler,
  isLineageLoading,
}: PipeLineDetailsProp) => {
  const { isAuthDisabled } = useAuth();
  const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editTask, setEditTask] = useState<{
    task: Task;
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
      name: 'Lineage',
      icon: {
        alt: 'lineage',
        name: 'icon-lineage',
        title: 'Lineage',
        selectedName: 'icon-lineagecolor',
      },
      isProtected: false,
      position: 2,
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
      isHidden: deleted,
      protectedState: !owner || hasEditAccess(),
      position: 3,
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
      value: pipelineUrl,
      placeholderText: entityName,
      isLink: true,
      openInNewTab: true,
    },
  ];

  const onTaskUpdate = (taskDescription: string) => {
    if (editTask) {
      const updatedTasks = [...(pipelineDetails.tasks || [])];

      const updatedTask = {
        ...editTask.task,
        description: taskDescription,
      };
      updatedTasks[editTask.index] = updatedTask;

      const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
      const jsonPatch = compare(pipelineDetails, updatedPipeline);
      taskUpdateHandler(jsonPatch);
      setEditTask(undefined);
    } else {
      setEditTask(undefined);
    }
  };

  const handleUpdateTask = (task: Task, index: number) => {
    setEditTask({ task, index });
  };

  const closeEditTaskModal = (): void => {
    setEditTask(undefined);
  };

  const onSettingsUpdate = (newOwner?: Pipeline['owner'], newTier?: string) => {
    if (newOwner || newTier) {
      const tierTag: Pipeline['tags'] = newTier
        ? [
            ...getTagsWithoutTier(pipelineDetails.tags as Array<EntityTags>),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : pipelineDetails.tags;
      const updatedPipelineDetails = {
        ...pipelineDetails,
        owner: newOwner
          ? {
              ...pipelineDetails.owner,
              ...newOwner,
            }
          : pipelineDetails.owner,
        tags: tierTag,
      };

      return settingsUpdateHandler(updatedPipelineDetails);
    } else {
      return Promise.reject();
    }
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags =
        pipelineDetails?.tags?.filter((tag) =>
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
      const updatedPipeline = { ...pipelineDetails, tags: updatedTags };
      tagUpdateHandler(updatedPipeline);
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        description: updatedHTML,
      };
      descriptionUpdateHandler(updatedPipelineDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const followPipeline = () => {
    if (isFollowing) {
      setFollowersCount((preValu) => preValu - 1);
      setIsFollowing(false);
      unfollowPipelineHandler();
    } else {
      setFollowersCount((preValu) => preValu + 1);
      setIsFollowing(true);
      followPipelineHandler();
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
        <div className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col">
          <EntityPageInfo
            isTagEditable
            deleted={deleted}
            entityName={entityName}
            extraInfo={extraInfo}
            followHandler={followPipeline}
            followers={followersCount}
            followersList={followers}
            hasEditAccess={hasEditAccess()}
            isFollowing={isFollowing}
            owner={owner}
            tagList={tagList}
            tags={pipelineTags}
            tagsHandler={onTagUpdate}
            tier={tier}
            titleLinks={slashedPipelineName}
            version={version}
            versionHandler={versionHandler}
          />
          <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
            <TabsPane
              activeTab={activeTab}
              setActiveTab={setActiveTabHandler}
              tabs={tabs}
            />

            <div className="tw-bg-white tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
              {activeTab === 1 && (
                <>
                  <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                    <div className="tw-col-span-full">
                      <Description
                        description={description}
                        entityName={entityName}
                        hasEditAccess={hasEditAccess()}
                        isEdit={isEdit}
                        isReadOnly={deleted}
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
                          <th className="tableHead-cell">Task Name</th>
                          <th className="tableHead-cell">Description</th>
                          <th className="tableHead-cell">Task Type</th>
                        </tr>
                      </thead>
                      <tbody className="tableBody">
                        {tasks.map((task, index) => (
                          <tr
                            className={classNames(
                              'tableBody-row',
                              !isEven(index + 1) ? 'odd-row' : null
                            )}
                            key={index}>
                            <td className="tableBody-cell">
                              <Link
                                target="_blank"
                                to={{ pathname: task.taskUrl }}>
                                <span className="tw-flex">
                                  <span className="tw-mr-1">
                                    {task.displayName}
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
                            <td className="tw-group tableBody-cell tw-relative">
                              <div
                                className="tw-cursor-pointer tw-flex"
                                data-testid="description">
                                <div>
                                  {task.description ? (
                                    <RichTextEditorPreviewer
                                      markdown={task.description}
                                    />
                                  ) : (
                                    <span className="tw-no-description">
                                      No description added
                                    </span>
                                  )}
                                </div>
                                {!deleted && (
                                  <NonAdminAction
                                    html={getHtmlForNonAdminAction(
                                      Boolean(owner)
                                    )}
                                    isOwner={hasEditAccess()}
                                    permission={Operation.UpdateDescription}
                                    position="top">
                                    <button
                                      className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                                      onClick={() =>
                                        handleUpdateTask(task, index)
                                      }>
                                      <SVGIcons
                                        alt="edit"
                                        icon="icon-edit"
                                        title="Edit"
                                        width="10px"
                                      />
                                    </button>
                                  </NonAdminAction>
                                )}
                              </div>
                            </td>
                            <td className="tableBody-cell">{task.taskType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {activeTab === 2 && (
                <div className="tw-h-full">
                  <Entitylineage
                    addLineageHandler={addLineageHandler}
                    deleted={deleted}
                    entityLineage={entityLineage}
                    entityLineageHandler={entityLineageHandler}
                    isLoading={isLineageLoading}
                    isNodeLoading={isNodeLoading}
                    lineageLeafNodes={lineageLeafNodes}
                    loadNodeHandler={loadNodeHandler}
                    removeLineageHandler={removeLineageHandler}
                  />
                </div>
              )}
              {activeTab === 3 && !deleted && (
                <div>
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
      {editTask && (
        <ModalWithMarkdownEditor
          header={`Edit Task: "${editTask.task.displayName}"`}
          placeholder="Enter Task Description"
          value={editTask.task.description || ''}
          onCancel={closeEditTaskModal}
          onSave={onTaskUpdate}
        />
      )}
    </>
  );
};

export default PipelineDetails;
