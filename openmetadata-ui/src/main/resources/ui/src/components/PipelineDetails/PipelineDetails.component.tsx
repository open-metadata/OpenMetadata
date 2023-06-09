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

import { Col, Radio, Row, Space, Tabs, Tooltip, Typography } from 'antd';
import Card from 'antd/lib/card/Card';
import Table, { ColumnsType } from 'antd/lib/table';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { AxiosError } from 'axios';
import ActivityFeedList from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList';
import { ActivityFilters } from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList.interface';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityLineageComponent from 'components/EntityLineage/EntityLineage.component';
import ExecutionsTab from 'components/Execution/Execution.component';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import TableTags from 'components/TableTags/TableTags.component';
import TasksDAGView from 'components/TasksDAGView/TasksDAGView';
import { EntityField } from 'constants/Feeds.constants';
import { compare, Operation } from 'fast-json-patch';
import { TagSource } from 'generated/type/schema';
import { isEmpty, isUndefined, map, noop } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Redirect, useHistory, useParams } from 'react-router-dom';
import { getAllFeeds, postFeedById, postThread } from 'rest/feedsAPI';
import { restorePipeline } from 'rest/pipelineAPI';
import { fetchGlossaryTerms, getGlossaryTermlist } from 'utils/GlossaryUtils';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import AppState from '../../AppState';
import { ReactComponent as ExternalLinkIcon } from '../../assets/svg/external-link.svg';
import {
  getPipelineDetailsPath,
  NO_DATA_PLACEHOLDER,
  ROUTES,
} from '../../constants/constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { PIPELINE_TASK_TABS } from '../../constants/pipeline.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import {
  Pipeline,
  PipelineStatus,
  TagLabel,
  Task,
} from '../../generated/entity/data/pipeline';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useElementInView } from '../../hooks/useElementInView';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  getCountBadge,
  getCurrentUserId,
  getFeedCounts,
  refreshPage,
} from '../../utils/CommonUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import {
  deletePost,
  getEntityFieldThreadCounts,
  updateThreadData,
} from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { getClassifications, getTaglist } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../Loader/Loader';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import { PipeLineDetailsProp } from './PipelineDetails.interface';

const PipelineDetails = ({
  pipelineDetails,
  descriptionUpdateHandler,
  followers,
  followPipelineHandler,
  unfollowPipelineHandler,
  settingsUpdateHandler,
  taskUpdateHandler,
  versionHandler,
  pipelineFQN,
  onExtensionUpdate,
}: PipeLineDetailsProp) => {
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const { t } = useTranslation();
  const { deleted, owner, description, pipelineStatus, entityName } =
    useMemo(() => {
      return {
        deleted: pipelineDetails.deleted,
        owner: pipelineDetails.owner,
        serviceType: pipelineDetails.serviceType,
        description: pipelineDetails.description,
        version: pipelineDetails.version,
        pipelineStatus: pipelineDetails.pipelineStatus,
        tier: getTierTags(pipelineDetails.tags ?? []),
        tags: getTagsWithoutTier(pipelineDetails.tags ?? []),
        entityName: getEntityName(pipelineDetails),
      };
    }, [pipelineDetails]);

  // local state variables

  const [isEdit, setIsEdit] = useState(false);

  const [editTask, setEditTask] = useState<{
    task: Task;
    index: number;
  }>();
  const [entityThreadLoading, setEntityThreadLoading] = useState(false);
  const [entityThreads, setEntityThreads] = useState<Thread[]>([]);
  const [entityThreadPaging, setEntityThreadPaging] = useState<Paging>({
    total: 0,
  } as Paging);

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [threadLink, setThreadLink] = useState<string>('');

  const [elementRef, isInView] = useElementInView(observerOptions);
  const [selectedExecution] = useState<PipelineStatus | undefined>(
    pipelineStatus
  );
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const [pipelinePermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const [activeTab, setActiveTab] = useState(PIPELINE_TASK_TABS.LIST_VIEW);

  const [activityFilter, setActivityFilter] = useState<ActivityFilters>();

  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isGlossaryLoading, setIsGlossaryLoading] = useState<boolean>(false);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);
  const [glossaryTags, setGlossaryTags] = useState<TagOption[]>([]);
  const [classificationTags, setClassificationTags] = useState<TagOption[]>([]);

  // local state ends

  const USERId = getCurrentUserId();
  const { getEntityPermission } = usePermissionProvider();

  const tasksInternal = useMemo(
    () =>
      pipelineDetails.tasks
        ? pipelineDetails.tasks.map((t) => ({ ...t, tags: t.tags ?? [] }))
        : [],
    [pipelineDetails.tasks]
  );

  const loader = useMemo(
    () => (entityThreadLoading ? <Loader /> : null),
    [entityThreadLoading]
  );

  const hasTagEditAccess = useMemo(
    () => pipelinePermissions.EditAll || pipelinePermissions.EditTags,
    [pipelinePermissions]
  );

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.PIPELINE,
      pipelineFQN,
      setEntityFieldThreadCount,
      noop,
      setFeedCount
    );
  };

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.PIPELINE,
        pipelineDetails.id
      );
      setPipelinePermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    }
  }, [pipelineDetails.id, getEntityPermission, setPipelinePermissions]);

  const fetchGlossaryTags = async () => {
    setIsGlossaryLoading(true);
    try {
      const res = await fetchGlossaryTerms();

      const glossaryTerms: TagOption[] = getGlossaryTermlist(res).map(
        (tag) => ({ fqn: tag, source: TagSource.Glossary })
      );
      setGlossaryTags(glossaryTerms);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsGlossaryLoading(false);
    }
  };

  const fetchClassificationTags = async () => {
    setIsTagLoading(true);
    try {
      const res = await getClassifications();
      const tagList = await getTaglist(res.data);

      const classificationTag: TagOption[] = map(tagList, (tag) => ({
        fqn: tag,
        source: TagSource.Classification,
      }));

      setClassificationTags(classificationTag);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsTagLoading(false);
    }
  };

  useEffect(() => {
    if (pipelineDetails.id) {
      fetchResourcePermission();
    }
  }, [pipelineDetails.id]);

  const isFollowing = useMemo(
    () => followers.some(({ id }: { id: string }) => id === getCurrentUserId()),
    [followers]
  );

  const onTaskUpdate = async (taskDescription: string) => {
    if (editTask) {
      const updatedTasks = [...(pipelineDetails.tasks || [])];

      const updatedTask = {
        ...editTask.task,
        description: taskDescription,
      };
      updatedTasks[editTask.index] = updatedTask;

      const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
      const jsonPatch = compare(pipelineDetails, updatedPipeline);
      await taskUpdateHandler(jsonPatch);
      setEditTask(undefined);
    } else {
      setEditTask(undefined);
    }
  };

  const closeEditTaskModal = (): void => {
    setEditTask(undefined);
  };

  const onOwnerUpdate = useCallback(
    async (newOwner?: Pipeline['owner']) => {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        owner: newOwner ? { ...owner, ...newOwner } : undefined,
      };
      await settingsUpdateHandler(updatedPipelineDetails);
    },
    [owner]
  );

  const onTierUpdate = async (newTier?: string) => {
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
      await settingsUpdateHandler(updatedPipelineDetails);
    }
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedPipelineDetails = {
      ...pipelineDetails,
      displayName: data.displayName,
    };
    await settingsUpdateHandler(updatedPipelineDetails);
  };

  const handleRestorePipeline = async () => {
    try {
      await restorePipeline(pipelineDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.pipeline'),
        }),
        2000
      );
      refreshPage();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.pipeline'),
        })
      );
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        description: updatedHTML,
      };
      await descriptionUpdateHandler(updatedPipelineDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const followPipeline = async () => {
    if (isFollowing) {
      await unfollowPipelineHandler(getEntityFeedCount);
    } else {
      await followPipelineHandler(getEntityFeedCount);
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

  const getFeedData = (
    after?: string,
    feedFilter?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setEntityThreadLoading(true);
    getAllFeeds(
      getEntityFeedLink(EntityType.PIPELINE, pipelineFQN),
      after,
      threadType,
      feedFilter,
      undefined,
      USERId
    )
      .then((res) => {
        const { data, paging: pagingObj } = res;
        if (data) {
          setEntityThreadPaging(pagingObj);
          setEntityThreads((prevData) => [...(after ? prevData : []), ...data]);
        } else {
          showErrorToast(
            t('server.entity-fetch-error', {
              entity: t('label.feed-lowercase'),
            })
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.entity-feed-plural'),
          })
        );
      })
      .finally(() => setEntityThreadLoading(false));
  };

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (
      isElementInView &&
      pagingObj?.after &&
      !isLoading &&
      tab === EntityTabs.ACTIVITY_FEED
    ) {
      getFeedData(
        pagingObj.after,
        activityFilter?.feedFilter,
        activityFilter?.threadType
      );
    }
  };

  useEffect(() => {
    fetchMoreThread(isInView, entityThreadPaging, entityThreadLoading);
  }, [entityThreadPaging, entityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback((feedFilter, threadType) => {
    setActivityFilter({
      feedFilter,
      threadType,
    });
    getFeedData(undefined, feedFilter, threadType);
  }, []);

  const handleTableTagSelection = async (
    selectedTags: EntityTags[],
    editColumnTag: Task,
    otherTags: TagLabel[]
  ) => {
    const newSelectedTags: TagOption[] = map(
      [...selectedTags, ...otherTags],
      (tag) => ({ fqn: tag.tagFQN, source: tag.source })
    );

    const prevTags = editColumnTag.tags?.filter((tag) =>
      newSelectedTags.some((selectedTag) => selectedTag.fqn === tag.tagFQN)
    );

    const newTags = newSelectedTags
      .filter(
        (selectedTag) =>
          !editColumnTag.tags?.some((tag) => tag.tagFQN === selectedTag.fqn)
      )
      .map((tag) => ({
        labelType: 'Manual',
        state: 'Confirmed',
        source: tag.source,
        tagFQN: tag.fqn,
      }));

    const updatedTask = {
      ...editColumnTag,
      tags: [...(prevTags as TagLabel[]), ...newTags],
    } as Task;

    const updatedTasks: Task[] = [...(pipelineDetails.tasks ?? [])].map(
      (task) => (task.name === editColumnTag.name ? updatedTask : task)
    );

    const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
    const jsonPatch = compare(pipelineDetails, updatedPipeline);

    await taskUpdateHandler(jsonPatch);
  };

  const taskColumns: ColumnsType<Task> = useMemo(
    () => [
      {
        key: t('label.name'),
        dataIndex: 'name',
        title: t('label.name'),
        render: (_, record) =>
          isEmpty(record.taskUrl) ? (
            <span>{getEntityName(record)}</span>
          ) : (
            <Link
              className="flex items-center gap-2"
              target="_blank"
              to={{ pathname: record.taskUrl }}>
              <span>{getEntityName(record)}</span>
              <ExternalLinkIcon height={14} width={14} />
            </Link>
          ),
      },
      {
        key: t('label.type'),
        dataIndex: 'taskType',
        width: 180,
        title: t('label.type'),
        render: (text) => (
          <Typography.Text>{text || NO_DATA_PLACEHOLDER}</Typography.Text>
        ),
      },
      {
        key: t('label.description'),
        dataIndex: 'description',
        width: 350,
        title: t('label.description'),
        render: (text, record, index) => (
          <Space
            className="w-full tw-group cursor-pointer"
            data-testid="description">
            <div>
              {text ? (
                <RichTextEditorPreviewer markdown={text} />
              ) : (
                <span className="text-grey-muted">
                  {t('label.no-entity', {
                    entity: t('label.description'),
                  })}
                </span>
              )}
            </div>
            {!deleted && (
              <Tooltip
                title={
                  pipelinePermissions.EditDescription ||
                  pipelinePermissions.EditAll
                    ? t('label.edit-entity', { entity: t('label.description') })
                    : t('message.no-permission-for-action')
                }>
                <button
                  className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                  disabled={
                    !(
                      pipelinePermissions.EditDescription ||
                      pipelinePermissions.EditAll
                    )
                  }
                  onClick={() => setEditTask({ task: record, index })}>
                  <EditIcon width={16} />
                </button>
              </Tooltip>
            )}
          </Space>
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags, record, index) => (
          <TableTags<Task>
            dataTestId="classification-tags"
            fetchTags={fetchClassificationTags}
            handleTagSelection={handleTableTagSelection}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={deleted}
            isTagLoading={isTagLoading}
            record={record}
            tagFetchFailed={tagFetchFailed}
            tagList={classificationTags}
            tags={getFilterTags(tags)}
            type={TagSource.Classification}
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags, record, index) => (
          <TableTags<Task>
            dataTestId="glossary-tags"
            fetchTags={fetchGlossaryTags}
            handleTagSelection={handleTableTagSelection}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={deleted}
            isTagLoading={isGlossaryLoading}
            record={record}
            tagFetchFailed={tagFetchFailed}
            tagList={glossaryTags}
            tags={getFilterTags(tags)}
            type={TagSource.Glossary}
          />
        ),
      },
    ],
    [
      fetchGlossaryTags,
      fetchClassificationTags,
      handleTableTagSelection,
      classificationTags,
      hasTagEditAccess,
      pipelinePermissions,
      editTask,
      deleted,
      isTagLoading,
      isGlossaryLoading,
      tagFetchFailed,
      glossaryTags,
    ]
  );

  useEffect(() => {
    if (tab === EntityTabs.ACTIVITY_FEED) {
      getFeedData();
    }
  }, [tab, feedCount]);

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getPipelineDetailsPath(pipelineFQN, tabValue),
      });
    }
  };

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    } as Post;
    postFeedById(id, data)
      .then((res) => {
        if (res) {
          const { id, posts } = res;
          setEntityThreads((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res, posts: posts?.slice(-3) };
              } else {
                return thread;
              }
            });
          });
          getEntityFeedCount();
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.add-entity-error', { entity: t('label.feed-lowercase') })
        );
      });
  };

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res) => {
        if (res) {
          setEntityThreads((pre) => [...pre, res]);
          getEntityFeedCount();
        } else {
          showErrorToast(t('server.unexpected-response'));
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.create-entity-error', {
            entity: t('label.conversation-lowercase'),
          })
        );
      });
  };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setEntityThreads);
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThreads);
  };

  useEffect(() => {
    getEntityFeedCount();
  }, [pipelineFQN, description, pipelineDetails]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            dataAsset={pipelineDetails}
            entityType={EntityType.PIPELINE}
            permissions={pipelinePermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followPipeline}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestorePipeline}
            onTierUpdate={onTierUpdate}
            onVersionClick={versionHandler}
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={tab}
            className="h-full p-x-lg"
            onChange={handleTabChange}>
            <Tabs.TabPane
              key={EntityTabs.TASKS}
              tab={
                <span data-testid={EntityTabs.TASKS}>
                  {t('label.task-plural')}
                </span>
              }>
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    description={description}
                    entityFieldThreads={getEntityFieldThreadCounts(
                      EntityField.DESCRIPTION,
                      entityFieldThreadCount
                    )}
                    entityFqn={pipelineFQN}
                    entityName={entityName}
                    entityType={EntityType.PIPELINE}
                    hasEditAccess={
                      pipelinePermissions.EditAll ||
                      pipelinePermissions.EditDescription
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
                <Col span={24}>
                  <Radio.Group
                    buttonStyle="solid"
                    className="radio-switch"
                    data-testid="pipeline-task-switch"
                    optionType="button"
                    options={Object.values(PIPELINE_TASK_TABS)}
                    value={activeTab}
                    onChange={(e) => setActiveTab(e.target.value)}
                  />
                </Col>
                <Col span={24}>
                  {activeTab === PIPELINE_TASK_TABS.LIST_VIEW ? (
                    <Table
                      bordered
                      columns={taskColumns}
                      data-testid="task-table"
                      dataSource={tasksInternal}
                      pagination={false}
                      rowKey="name"
                      size="small"
                    />
                  ) : !isEmpty(pipelineDetails.tasks) &&
                    !isUndefined(pipelineDetails.tasks) ? (
                    <Card
                      headStyle={{ background: '#fafafa' }}
                      title={t('label.dag-view')}>
                      <div className="h-100">
                        <TasksDAGView
                          selectedExec={selectedExecution}
                          tasks={pipelineDetails.tasks}
                        />
                      </div>
                    </Card>
                  ) : (
                    <div
                      className="tw-mt-4 tw-ml-4 d-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8"
                      data-testid="no-tasks-data">
                      <span>{t('label.no-task-available')}</span>
                    </div>
                  )}
                </Col>
              </Row>
            </Tabs.TabPane>
            <Tabs.TabPane
              className="h-full"
              key={EntityTabs.ACTIVITY_FEED}
              tab={
                <span data-testid={EntityTabs.ACTIVITY_FEED}>
                  {t('label.activity-feed-and-task-plural')}{' '}
                  {getCountBadge(
                    feedCount,
                    '',
                    EntityTabs.ACTIVITY_FEED === tab
                  )}
                </span>
              }>
              <Row justify="center">
                <Col span={18}>
                  <div id="activityfeed">
                    <ActivityFeedList
                      isEntityFeed
                      withSidePanel
                      deletePostHandler={deletePostHandler}
                      entityName={entityName}
                      feedList={entityThreads}
                      isFeedLoading={entityThreadLoading}
                      postFeedHandler={postFeedHandler}
                      updateThreadHandler={updateThreadHandler}
                      onFeedFiltersUpdate={handleFeedFilterChange}
                    />
                  </div>
                </Col>
                {loader}
              </Row>
            </Tabs.TabPane>

            <Tabs.TabPane
              key={EntityTabs.EXECUTIONS}
              tab={
                <span data-testid={EntityTabs.EXECUTIONS}>
                  {t('label.execution-plural')}
                </span>
              }>
              <ExecutionsTab
                pipelineFQN={pipelineFQN}
                tasks={pipelineDetails.tasks ?? []}
              />
            </Tabs.TabPane>

            <Tabs.TabPane
              key={EntityTabs.LINEAGE}
              tab={
                <span data-testid={EntityTabs.LINEAGE}>
                  {t('label.lineage')}
                </span>
              }>
              <EntityLineageComponent
                deleted={deleted}
                entityType={EntityType.PIPELINE}
                hasEditAccess={
                  pipelinePermissions.EditAll || pipelinePermissions.EditLineage
                }
              />
            </Tabs.TabPane>

            <Tabs.TabPane
              key={EntityTabs.CUSTOM_PROPERTIES}
              tab={
                <span data-testid={EntityTabs.CUSTOM_PROPERTIES}>
                  {t('label.custom-property-plural')}
                </span>
              }>
              <CustomPropertyTable
                className="mt-0-important"
                entityDetails={
                  pipelineDetails as CustomPropertyProps['entityDetails']
                }
                entityType={EntityType.PIPELINE}
                handleExtensionUpdate={onExtensionUpdate}
                hasEditAccess={
                  pipelinePermissions.EditAll ||
                  pipelinePermissions.EditCustomFields
                }
              />
            </Tabs.TabPane>
            <Tabs.TabPane key="*" tab="">
              <Redirect to={ROUTES.NOT_FOUND} />
            </Tabs.TabPane>
          </Tabs>
        </Col>
      </Row>

      <div
        data-testid="observer-element"
        id="observer-element"
        ref={elementRef as RefObject<HTMLDivElement>}
      />

      {editTask && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', { entity: t('label.task') })}: "${
            editTask.task.displayName || editTask.task.name
          }"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.task-lowercase'),
          })}
          value={editTask.task.description || ''}
          visible={Boolean(editTask)}
          onCancel={closeEditTaskModal}
          onSave={onTaskUpdate}
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
    </PageLayoutV1>
  );
};

export default PipelineDetails;
