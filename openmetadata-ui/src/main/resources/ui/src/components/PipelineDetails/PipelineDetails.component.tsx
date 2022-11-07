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

import { Space, Table, Tabs, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { compare } from 'fast-json-patch';
import { EntityTags, ExtraInfo, TagOption } from 'Models';
import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/feed.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { observerOptions } from '../../constants/Mydata.constants';
import { EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import {
  Pipeline,
  PipelineStatus,
  TagLabel,
  Task,
} from '../../generated/entity/data/pipeline';
import { ThreadType } from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
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
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getLineageViewPath } from '../../utils/RouterUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagsWithoutTier } from '../../utils/TableUtils';
import { fetchTagsAndGlossaryTerms } from '../../utils/TagsUtils';
import { getDateTimeByTimeStamp } from '../../utils/TimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import PageContainer from '../containers/PageContainer';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import Loader from '../Loader/Loader';
import RequestDescriptionModal from '../Modals/RequestDescriptionModal/RequestDescriptionModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import PipelineStatusList from '../PipelineStatusList/PipelineStatusList.component';
import TagsContainer from '../tags-container/tags-container';
import TagsViewer from '../tags-viewer/tags-viewer';
import { PipeLineDetailsProp } from './PipelineDetails.interface';

const PipelineDetails = ({
  entityName,
  owner,
  tier,
  slashedPipelineName,
  pipelineTags,
  pipelineUrl,
  pipelineDetails,
  serviceType,
  entityLineage,
  followers,
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
  isentityThreadLoading,
  entityThread,
  postFeedHandler,
  entityFieldThreadCount,
  createThread,
  pipelineFQN,
  deletePostHandler,
  paging,
  fetchFeedHandler,
  pipelineStatus,
  updateThreadHandler,
  entityFieldTaskCount,
  onExtensionUpdate,
}: PipeLineDetailsProp) => {
  const history = useHistory();
  //   const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editTask, setEditTask] = useState<{
    task: Task;
    index: number;
  }>();

  const { t } = useTranslation();

  const [tags, setTags] = useState<TagOption[]>();

  const [threadLink, setThreadLink] = useState<string>('');

  const [selectedField, setSelectedField] = useState<string>('');

  const [elementRef, isInView] = useInfiniteScroll(observerOptions);

  const [selectedExecution, setSelectedExecution] = useState<PipelineStatus>(
    () => {
      if (pipelineStatus) {
        return pipelineStatus;
      } else {
        return {} as PipelineStatus;
      }
    }
  );
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const [pipelinePermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermission } = usePermissionProvider();

  const tasksInternal = useMemo(
    () => tasks.map((t) => ({ ...t, tags: t.tags ?? [] })),
    [tasks]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.PIPELINE,
        pipelineDetails.id
      );
      setPipelinePermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        jsonData['api-error-messages']['fetch-entity-permissions-error']
      );
    }
  }, [pipelineDetails.id, getEntityPermission, setPipelinePermissions]);

  useEffect(() => {
    if (pipelineDetails.id) {
      fetchResourcePermission();
    }
  }, [pipelineDetails.id]);

  const closeRequestModal = () => {
    setSelectedField('');
  };

  const setFollowersData = (followers: Array<EntityReference>) => {
    setIsFollowing(
      followers.some(({ id }: { id: string }) => id === getCurrentUserId())
    );
    setFollowersCount(followers?.length);
  };

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
      value: pipelineUrl,
      placeholderText: entityName,
      isLink: true,
      openInNewTab: true,
    },
  ];

  //   const onTaskUpdate = async (taskDescription: string) => {
  //     if (editTask) {
  //       const updatedTasks = [...(pipelineDetails.tasks || [])];

  //       const updatedTask = {
  //         ...editTask.task,
  //         description: taskDescription,
  //       };
  //       updatedTasks[editTask.index] = updatedTask;

  //       const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
  //       const jsonPatch = compare(pipelineDetails, updatedPipeline);
  //       await taskUpdateHandler(jsonPatch);
  //       setEditTask(undefined);
  //     } else {
  //       setEditTask(undefined);
  //     }
  //   };

  //   const closeEditTaskModal = (): void => {
  //     setEditTask(undefined);
  //   };

  const onOwnerUpdate = (newOwner?: Pipeline['owner']) => {
    if (newOwner) {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        owner: newOwner
          ? { ...pipelineDetails.owner, ...newOwner }
          : pipelineDetails.owner,
      };
      settingsUpdateHandler(updatedPipelineDetails);
    }
  };

  const onOwnerRemove = () => {
    if (pipelineDetails) {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        owner: undefined,
      };
      settingsUpdateHandler(updatedPipelineDetails);
    }
  };

  const onTierRemove = () => {
    if (pipelineDetails) {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        tags: undefined,
      };
      settingsUpdateHandler(updatedPipelineDetails);
    }
  };

  const onTierUpdate = (newTier?: string) => {
    if (newTier) {
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
        tags: tierTag,
      };
      settingsUpdateHandler(updatedPipelineDetails);
    }
  };

  const onTagUpdate = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedPipeline = { ...pipelineDetails, tags: updatedTags };
      tagUpdateHandler(updatedPipeline);
    }
  };

  //   const onDescriptionEdit = (): void => {
  //     setIsEdit(true);
  //   };
  //   const onCancel = () => {
  //     setIsEdit(false);
  //   };

  //   const onDescriptionUpdate = async (updatedHTML: string) => {
  //     if (description !== updatedHTML) {
  //       const updatedPipelineDetails = {
  //         ...pipelineDetails,
  //         description: updatedHTML,
  //       };
  //       await descriptionUpdateHandler(updatedPipelineDetails);
  //       setIsEdit(false);
  //     } else {
  //       setIsEdit(false);
  //     }
  //   };

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

  const handleFullScreenClick = () => {
    history.push(getLineageViewPath(EntityType.PIPELINE, pipelineFQN));
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

  useEffect(() => {
    setFollowersData(followers);
  }, [followers]);

  useEffect(() => {
    fetchMoreThread(isInView as boolean, paging, isentityThreadLoading);
  }, [paging, isentityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback(
    (feedFilter, threadType) => {
      fetchFeedHandler(paging.after, feedFilter, threadType);
    },
    [paging]
  );

  const handleEditTaskTag = (task: Task, index: number): void => {
    setEditTask({ task: { ...task, tags: [] }, index });
  };

  const handleTableTagSelection = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags && editTask) {
      const prevTags = editTask.task.tags?.filter((tag) =>
        selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
      );

      const newTags = selectedTags
        .filter(
          (selectedTag) =>
            !editTask.task.tags?.some(
              (tag) => tag.tagFQN === selectedTag.tagFQN
            )
        )
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          source: tag.source,
          tagFQN: tag.tagFQN,
        }));

      const updatedTasks: Task[] = [...(pipelineDetails.tasks || [])];

      const updatedTask = {
        ...editTask.task,
        tags: [...(prevTags as TagLabel[]), ...newTags],
      } as Task;

      updatedTasks[editTask.index] = updatedTask;

      const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
      const jsonPatch = compare(pipelineDetails, updatedPipeline);

      taskUpdateHandler(jsonPatch);
    }
    setEditTask(undefined);
  };

  useMemo(() => {
    fetchTagsAndGlossaryTerms().then((response) => {
      setTags(response);
    });
  }, [setTags]);

  const renderTags = useCallback(
    (text, record, index) => (
      <div
        className="relative tableBody-cell"
        data-testid="tags-wrapper"
        onClick={() => handleEditTaskTag(record, index)}>
        {deleted ? (
          <div className="tw-flex tw-flex-wrap">
            <TagsViewer sizeCap={-1} tags={text || []} />
          </div>
        ) : (
          <TagsContainer
            editable={editTask?.index === index}
            selectedTags={text as EntityTags[]}
            showAddTagButton={
              pipelinePermissions.EditAll || pipelinePermissions.EditTags
            }
            size="small"
            tagList={tags ?? []}
            type="label"
            onCancel={() => {
              handleTableTagSelection();
            }}
            onSelectionChange={(tags) => {
              handleTableTagSelection(tags);
            }}
          />
        )}
      </div>
    ),
    [
      tags,
      editTask,
      pipelinePermissions.EditAll,
      pipelinePermissions.EditTags,
      deleted,
    ]
  );

  const taskColumns: ColumnsType<Task> = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('label.name'),
        render: (name, record) => (
          <Link target="_blank" to={{ pathname: record.taskUrl }}>
            <Space>
              <span>{name}</span>
              <SVGIcons
                alt="external-link"
                className="align-middle"
                icon="external-link"
                width="16px"
              />
            </Space>
          </Link>
        ),
      },
      {
        key: 'type',
        dataIndex: 'taskType',
        title: t('label.type'),
      },
      {
        key: 'startDate',
        dataIndex: 'startDate',
        title: t('label.start-date'),
        render: (startDate: string) =>
          getDateTimeByTimeStamp(new Date(startDate).valueOf()),
      },
      {
        key: 'description',
        dataIndex: 'description',
        title: t('label.description'),
        render: (text) => (
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
                  pipelinePermissions.EditAll
                    ? 'Edit Description'
                    : NO_PERMISSION_FOR_ACTION
                }>
                <button
                  className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                  disabled={!pipelinePermissions.EditAll}>
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
        key: 'tags',
        dataIndex: 'tags',
        title: t('label.tags'),
        render: renderTags,
      },
    ],
    [pipelinePermissions, editTask, tags, deleted]
  );

  return (
    <PageContainer>
      <div className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col">
        <EntityPageInfo
          canDelete={pipelinePermissions.Delete}
          currentOwner={pipelineDetails.owner}
          deleted={deleted}
          entityFieldTasks={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldTaskCount
          )}
          entityFieldThreads={getEntityFieldThreadCounts(
            EntityField.TAGS,
            entityFieldThreadCount
          )}
          entityFqn={pipelineFQN}
          entityId={pipelineDetails.id}
          entityName={entityName}
          entityType={EntityType.PIPELINE}
          extraInfo={extraInfo}
          followHandler={followPipeline}
          followers={followersCount}
          followersList={followers}
          isFollowing={isFollowing}
          isTagEditable={
            pipelinePermissions.EditAll || pipelinePermissions.EditTags
          }
          removeOwner={
            pipelinePermissions.EditAll || pipelinePermissions.EditOwner
              ? onOwnerRemove
              : undefined
          }
          removeTier={
            pipelinePermissions.EditAll || pipelinePermissions.EditTier
              ? onTierRemove
              : undefined
          }
          tags={pipelineTags}
          tagsHandler={onTagUpdate}
          tier={tier}
          titleLinks={slashedPipelineName}
          updateOwner={
            pipelinePermissions.EditAll || pipelinePermissions.EditOwner
              ? onOwnerUpdate
              : undefined
          }
          updateTier={
            pipelinePermissions.EditAll || pipelinePermissions.EditTier
              ? onTierUpdate
              : undefined
          }
          version={version}
          versionHandler={versionHandler}
          onThreadLinkSelect={onThreadLinkSelect}
        />

        <Tabs>
          <Tabs.TabPane key="tasks" tab="Tasks">
            <Table
              bordered
              columns={taskColumns}
              dataSource={tasksInternal}
              pagination={false}
              rowKey="name"
              size="small"
            />
          </Tabs.TabPane>
          <Tabs.TabPane key="activity-feeds-tasks" tab="Activity Feeds & Tasks">
            <div
              className="tw-py-4 tw-px-7 tw-grid tw-grid-cols-3 entity-feed-list tw--mx-7 tw--my-4"
              id="activityfeed">
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
              <div
                data-testid="observer-element"
                id="observer-element"
                ref={elementRef as RefObject<HTMLDivElement>}>
                {getLoader()}
              </div>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane key="executions" tab="Executions">
            <PipelineStatusList
              pipelineFQN={pipelineFQN}
              pipelineStatus={pipelineStatus}
              selectedExec={selectedExecution}
              onSelectExecution={(exec) => {
                setSelectedExecution(exec);
              }}
            />
          </Tabs.TabPane>

          <Tabs.TabPane key="entity-lineage" tab="Entity Lineage">
            <div className="h-full">
              <EntityLineageComponent
                addLineageHandler={addLineageHandler}
                deleted={deleted}
                entityLineage={entityLineage}
                entityLineageHandler={entityLineageHandler}
                entityType={EntityType.PIPELINE}
                hasEditAccess={
                  pipelinePermissions.EditAll || pipelinePermissions.EditLineage
                }
                isLoading={isLineageLoading}
                isNodeLoading={isNodeLoading}
                lineageLeafNodes={lineageLeafNodes}
                loadNodeHandler={loadNodeHandler}
                removeLineageHandler={removeLineageHandler}
                onFullScreenClick={handleFullScreenClick}
              />
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane key="custom-properties" tab="Custom Properties">
            <CustomPropertyTable
              entityDetails={
                pipelineDetails as CustomPropertyProps['entityDetails']
              }
              entityType={EntityType.PIPELINE}
              handleExtentionUpdate={onExtensionUpdate}
            />
          </Tabs.TabPane>
        </Tabs>
      </div>
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
            EntityType.PIPELINE,
            pipelineFQN,
            selectedField
          )}
          onCancel={closeRequestModal}
        />
      ) : null}
    </PageContainer>
  );
};

export default PipelineDetails;
