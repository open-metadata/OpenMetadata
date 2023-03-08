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

import { Card, Col, Radio, Row, Space, Table, Tabs, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import { EntityTags, ExtraInfo, TagOption } from 'Models';
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
import { getLineageByFQN } from 'rest/lineageAPI';
import { restorePipeline } from 'rest/pipelineAPI';
import AppState from '../../AppState';
import { ReactComponent as ExternalLinkIcon } from '../../assets/svg/external-link.svg';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { getPipelineDetailsPath, ROUTES } from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import {
  PIPELINE_DETAILS_TABS,
  PIPELINE_TASK_TABS,
} from '../../constants/pipeline.constants';
import { EntityInfo, EntityType } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { OwnerType } from '../../enums/user.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import {
  Pipeline,
  PipelineStatus,
  TagLabel,
  Task,
} from '../../generated/entity/data/pipeline';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  getCountBadge,
  getCurrentUserId,
  getEntityName,
  getEntityPlaceHolder,
  getFeedCounts,
  getOwnerValue,
  refreshPage,
} from '../../utils/CommonUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import {
  deletePost,
  getEntityFieldThreadCounts,
  updateThreadData,
} from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getLineageViewPath } from '../../utils/RouterUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { fetchTagsAndGlossaryTerms } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from '../common/CustomPropertyTable/CustomPropertyTable.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import PageContainerV1 from '../containers/PageContainerV1';
import EntityLineageComponent from '../EntityLineage/EntityLineage.component';
import ExecutionsTab from '../Execution/Execution.component';
import Loader from '../Loader/Loader';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import TagsContainer from '../Tag/TagsContainer/tags-container';
import TagsViewer from '../Tag/TagsViewer/tags-viewer';
import TasksDAGView from '../TasksDAGView/TasksDAGView';
import { PipeLineDetailsProp } from './PipelineDetails.interface';

const PipelineDetails = ({
  entityName,
  slashedPipelineName,
  pipelineDetails,
  descriptionUpdateHandler,
  followers,
  followPipelineHandler,
  unfollowPipelineHandler,
  tagUpdateHandler,
  settingsUpdateHandler,
  pipelineHostPort,
  taskUpdateHandler,
  loadNodeHandler,
  lineageLeafNodes,
  isNodeLoading,
  versionHandler,
  addLineageHandler,
  removeLineageHandler,
  entityLineageHandler,
  pipelineFQN,
  onExtensionUpdate,
}: PipeLineDetailsProp) => {
  const history = useHistory();
  const { tab } = useParams<{ tab: PIPELINE_DETAILS_TABS }>();
  const { t } = useTranslation();
  const {
    tier,
    deleted,
    owner,
    serviceType,
    description,
    version,
    pipelineStatus,
    tags,
  } = useMemo(() => {
    return {
      deleted: pipelineDetails.deleted,
      owner: pipelineDetails.owner,
      serviceType: pipelineDetails.serviceType,
      description: pipelineDetails.description,
      version: pipelineDetails.version,
      pipelineStatus: pipelineDetails.pipelineStatus,
      tier: getTierTags(pipelineDetails.tags ?? []),
      tags: getTagsWithoutTier(pipelineDetails.tags ?? []),
    };
  }, [pipelineDetails]);

  // local state variables
  const [editTaskTags, setEditTaskTags] = useState<{
    task: Task;
    index: number;
  }>();
  const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editTask, setEditTask] = useState<{
    task: Task;
    index: number;
  }>();
  const [lineageLoading, setLineageLoading] = useState(false);
  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const [entityThreadLoading, setEntityThreadLoading] = useState(false);
  const [entityThreads, setEntityThreads] = useState<Thread[]>([]);
  const [entityThreadPaging, setEntityThreadPaging] = useState<Paging>({
    total: 0,
  } as Paging);

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [tagList, setTagList] = useState<TagOption[]>();

  const [threadLink, setThreadLink] = useState<string>('');

  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
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

  useEffect(() => {
    if (pipelineDetails.id) {
      fetchResourcePermission();
    }
  }, [pipelineDetails.id]);

  const setFollowersData = (followers: Array<EntityReference>) => {
    setIsFollowing(
      followers.some(({ id }: { id: string }) => id === getCurrentUserId())
    );
    setFollowersCount(followers?.length);
  };

  const extraInfo: Array<ExtraInfo> = [
    {
      key: EntityInfo.OWNER,
      value: owner && getOwnerValue(owner),
      placeholderText: getEntityPlaceHolder(
        getEntityName(owner),
        owner?.deleted
      ),
      isLink: true,
      openInNewTab: false,
      profileName: owner?.type === OwnerType.USER ? owner?.name : undefined,
    },
    {
      key: EntityInfo.TIER,
      value: tier?.tagFQN ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1] : '',
    },
    ...(pipelineDetails.pipelineUrl && pipelineHostPort
      ? [
          {
            key: `${serviceType} ${EntityInfo.URL}`,
            value: pipelineHostPort + pipelineDetails.pipelineUrl,
            placeholderText: entityName,
            isLink: true,
            openInNewTab: true,
          },
        ]
      : []),
  ];

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
    return entityThreadLoading ? <Loader /> : null;
  };

  const getFeedData = (
    after?: string,
    feedFilter?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setEntityThreadLoading(true);
    !after && setEntityThreads([]);
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
          setEntityThreads((prevData) => [...prevData, ...data]);
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
            entity: t('label.feed-lowercase'),
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
    if (isElementInView && pagingObj?.after && !isLoading) {
      getFeedData(pagingObj.after);
    }
  };

  useEffect(() => {
    setFollowersData(followers);
  }, [followers]);

  useEffect(() => {
    fetchMoreThread(
      isInView as boolean,
      entityThreadPaging,
      entityThreadLoading
    );
  }, [entityThreadPaging, entityThreadLoading, isInView]);

  const handleFeedFilterChange = useCallback(
    (feedFilter, threadType) => {
      getFeedData(entityThreadPaging.after, feedFilter, threadType);
    },
    [entityThreadPaging]
  );

  const handleEditTaskTag = (task: Task, index: number): void => {
    setEditTaskTags({ task: { ...task, tags: [] }, index });
  };

  const handleTableTagSelection = (
    selectedTags: Array<EntityTags> = [],
    task: {
      task: Task;
      index: number;
    }
  ) => {
    const selectedTask = isUndefined(editTask) ? task : editTask;
    const prevTags = selectedTask.task.tags?.filter((tag) =>
      selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
    );

    const newTags = selectedTags
      .filter(
        (selectedTag) =>
          !selectedTask.task.tags?.some(
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
      ...selectedTask.task,
      tags: [...(prevTags as TagLabel[]), ...newTags],
    } as Task;

    updatedTasks[selectedTask.index] = updatedTask;

    const updatedPipeline = { ...pipelineDetails, tasks: updatedTasks };
    const jsonPatch = compare(pipelineDetails, updatedPipeline);

    taskUpdateHandler(jsonPatch);
    setEditTaskTags(undefined);
  };

  useMemo(() => {
    fetchTagsAndGlossaryTerms().then((response) => {
      setTagList(response);
    });
  }, [setTagList]);

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
            editable={editTaskTags?.index === index}
            selectedTags={text as EntityTags[]}
            showAddTagButton={
              pipelinePermissions.EditAll || pipelinePermissions.EditTags
            }
            size="small"
            tagList={tagList ?? []}
            type="label"
            onCancel={() => {
              setEditTask(undefined);
            }}
            onSelectionChange={(tags) => {
              handleTableTagSelection(tags, {
                task: record,
                index: index,
              });
            }}
          />
        )}
      </div>
    ),
    [
      tagList,
      editTaskTags,
      pipelinePermissions.EditAll,
      pipelinePermissions.EditTags,
      deleted,
    ]
  );

  const taskColumns: ColumnsType<Task> = useMemo(
    () => [
      {
        key: t('label.name'),
        dataIndex: 'name',
        title: t('label.name'),
        render: (name, record) =>
          isEmpty(record.taskUrl) || isUndefined(pipelineHostPort) ? (
            <span>{name}</span>
          ) : (
            <Link
              className="flex items-center gap-2"
              target="_blank"
              to={{ pathname: pipelineHostPort + record.taskUrl }}>
              <span>{name}</span>
              <ExternalLinkIcon height={14} width={14} />
            </Link>
          ),
      },
      {
        key: t('label.type'),
        dataIndex: 'taskType',
        width: 180,
        title: t('label.type'),
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
                <span className="tw-no-description">
                  {t('label.no-entity', {
                    entity: t('label.description'),
                  })}
                </span>
              )}
            </div>
            {!deleted && (
              <Tooltip
                title={
                  pipelinePermissions.EditAll
                    ? t('label.edit-entity', { entity: t('label.description') })
                    : t('message.no-permission-for-action')
                }>
                <button
                  className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                  disabled={!pipelinePermissions.EditAll}
                  onClick={() => setEditTask({ task: record, index })}>
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
        key: t('label.tag-plural'),
        dataIndex: 'tags',
        title: t('label.tag-plural'),
        width: 350,
        render: renderTags,
      },
    ],
    [
      pipelinePermissions,
      editTask,
      editTaskTags,
      tagList,
      deleted,
      pipelineHostPort,
    ]
  );

  const getLineageData = () => {
    setLineageLoading(true);
    getLineageByFQN(pipelineFQN, EntityType.PIPELINE)
      .then((res) => {
        if (res) {
          setEntityLineage(res);
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.lineage-lowercase'),
          })
        );
      })
      .finally(() => {
        setLineageLoading(false);
      });
  };

  useEffect(() => {
    switch (tab) {
      case PIPELINE_DETAILS_TABS.Lineage:
        !deleted && isEmpty(entityLineage) && getLineageData();

        break;
      case PIPELINE_DETAILS_TABS.ActivityFeedsAndTasks:
        getFeedData();

        break;
      default:
        break;
    }
  }, [tab]);

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getPipelineDetailsPath(pipelineFQN, tabValue),
      });
    }
  };

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.PIPELINE,
      pipelineFQN,
      setEntityFieldThreadCount,
      setEntityFieldTaskCount,
      setFeedCount
    );
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
    <PageContainerV1>
      <div className="entity-details-container">
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
          tags={tags}
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
          version={version + ''}
          versionHandler={versionHandler}
          onRestoreEntity={handleRestorePipeline}
          onThreadLinkSelect={onThreadLinkSelect}
        />

        <Tabs activeKey={tab} className="h-full" onChange={handleTabChange}>
          <Tabs.TabPane
            key={PIPELINE_DETAILS_TABS.Tasks}
            tab={
              <span data-testid={PIPELINE_DETAILS_TABS.Tasks}>
                {t('label.task-plural')}
              </span>
            }>
            <Card className="h-full">
              <Row gutter={[0, 16]}>
                <Col span={24}>
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
                      className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8"
                      data-testid="no-tasks-data">
                      <span>{t('label.no-task-available')}</span>
                    </div>
                  )}
                </Col>
              </Row>
            </Card>
          </Tabs.TabPane>
          <Tabs.TabPane
            className="h-full"
            key={PIPELINE_DETAILS_TABS.ActivityFeedsAndTasks}
            tab={
              <span data-testid={PIPELINE_DETAILS_TABS.ActivityFeedsAndTasks}>
                {t('label.activity-feed-and-task-plural')}{' '}
                {getCountBadge(
                  feedCount,
                  '',
                  PIPELINE_DETAILS_TABS.ActivityFeedsAndTasks === tab
                )}
              </span>
            }>
            <Card className="h-full">
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
                    <div
                      data-testid="observer-element"
                      id="observer-element"
                      ref={elementRef as RefObject<HTMLDivElement>}>
                      {getLoader()}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane
            key={PIPELINE_DETAILS_TABS.Executions}
            tab={
              <span data-testid={PIPELINE_DETAILS_TABS.Tasks}>
                {t('label.execution-plural')}
              </span>
            }>
            <ExecutionsTab
              pipelineFQN={pipelineFQN}
              tasks={pipelineDetails.tasks ?? []}
            />
          </Tabs.TabPane>

          <Tabs.TabPane
            key={PIPELINE_DETAILS_TABS.Lineage}
            tab={<span data-testid="Lineage">{t('label.lineage')}</span>}>
            <Card className="h-full card-body-full">
              <EntityLineageComponent
                addLineageHandler={addLineageHandler}
                deleted={deleted}
                entityLineage={entityLineage}
                entityLineageHandler={entityLineageHandler}
                entityType={EntityType.PIPELINE}
                hasEditAccess={
                  pipelinePermissions.EditAll || pipelinePermissions.EditLineage
                }
                isLoading={lineageLoading}
                isNodeLoading={isNodeLoading}
                lineageLeafNodes={lineageLeafNodes}
                loadNodeHandler={loadNodeHandler}
                removeLineageHandler={removeLineageHandler}
                onFullScreenClick={handleFullScreenClick}
              />
            </Card>
          </Tabs.TabPane>

          <Tabs.TabPane
            key={PIPELINE_DETAILS_TABS.CustomProperties}
            tab={
              <span data-testid="Custom Properties">
                {t('label.custom-property-plural')}
              </span>
            }>
            <Card className="h-full">
              <CustomPropertyTable
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
            </Card>
          </Tabs.TabPane>
          <Tabs.TabPane key="*" tab="">
            <Redirect to={ROUTES.NOT_FOUND} />
          </Tabs.TabPane>
        </Tabs>
      </div>

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
    </PageContainerV1>
  );
};

export default PipelineDetails;
