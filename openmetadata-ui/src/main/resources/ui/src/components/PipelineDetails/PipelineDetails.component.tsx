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

import {
  Card,
  Col,
  Radio,
  Row,
  Space,
  Table,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { AxiosError } from 'axios';
import { ActivityFilters } from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList.interface';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import TableTags from 'components/TableTags/TableTags.component';
import { compare, Operation } from 'fast-json-patch';
import { TagSource } from 'generated/type/schema';
import { isEmpty, isUndefined, map } from 'lodash';
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
import { restorePipeline } from 'rest/pipelineAPI';
import { fetchGlossaryTerms, getGlossaryTermlist } from 'utils/GlossaryUtils';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import AppState from '../../AppState';
import { ReactComponent as ExternalLinkIcon } from '../../assets/svg/external-link.svg';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getPipelineDetailsPath,
  NO_DATA_PLACEHOLDER,
  ROUTES,
} from '../../constants/constants';
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
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useElementInView } from '../../hooks/useElementInView';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  getCountBadge,
  getCurrentUserId,
  getEntityPlaceHolder,
  getFeedCounts,
  getOwnerValue,
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
import TasksDAGView from '../TasksDAGView/TasksDAGView';
import { PipeLineDetailsProp } from './PipelineDetails.interface';

const PipelineDetails = ({
  slashedPipelineName,
  pipelineDetails,
  descriptionUpdateHandler,
  followers,
  followPipelineHandler,
  unfollowPipelineHandler,
  tagUpdateHandler,
  settingsUpdateHandler,
  taskUpdateHandler,
  versionHandler,
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
    entityName,
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
      entityName: getEntityName(pipelineDetails),
    };
  }, [pipelineDetails]);

  // local state variables

  const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
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
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
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
      setEntityFieldTaskCount,
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
    setIsTagLoading(true);
    try {
      const res = await fetchGlossaryTerms();

      const glossaryTerms: TagOption[] = getGlossaryTermlist(res).map(
        (tag) => ({ fqn: tag, source: TagSource.Glossary })
      );
      setGlossaryTags(glossaryTerms);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsTagLoading(false);
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
    ...(pipelineDetails.pipelineUrl
      ? [
          {
            key: `${serviceType} ${EntityInfo.URL}`,
            value: pipelineDetails.pipelineUrl,
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

  const onOwnerUpdate = useCallback(
    (newOwner?: Pipeline['owner']) => {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        owner: newOwner ? { ...owner, ...newOwner } : undefined,
      };
      settingsUpdateHandler(updatedPipelineDetails);
    },
    [owner]
  );

  const onTierRemove = () => {
    if (pipelineDetails) {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        tags: getTagsWithoutTier(pipelineDetails.tags ?? []),
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

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedPipelineDetails = {
      ...pipelineDetails,
      displayName: data.displayName,
    };
    await settingsUpdateHandler(updatedPipelineDetails);
  };

  const onTagUpdate = async (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedPipeline = { ...pipelineDetails, tags: updatedTags };
      tagUpdateHandler(updatedPipeline, getEntityFeedCount);
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
      unfollowPipelineHandler(getEntityFeedCount);
    } else {
      setFollowersCount((preValu) => preValu + 1);
      setIsFollowing(true);
      followPipelineHandler(getEntityFeedCount);
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
      tab === PIPELINE_DETAILS_TABS.ActivityFeedsAndTasks
    ) {
      getFeedData(
        pagingObj.after,
        activityFilter?.feedFilter,
        activityFilter?.threadType
      );
    }
  };

  useEffect(() => {
    setFollowersData(followers);
  }, [followers]);

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
            isTagLoading={isTagLoading}
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
      tagFetchFailed,
      glossaryTags,
    ]
  );

  useEffect(() => {
    if (tab === PIPELINE_DETAILS_TABS.ActivityFeedsAndTasks) {
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
    <PageContainerV1>
      <div className="entity-details-container">
        <EntityPageInfo
          canDelete={pipelinePermissions.Delete}
          currentOwner={pipelineDetails.owner}
          deleted={deleted}
          displayName={pipelineDetails.displayName}
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
          entityName={pipelineDetails.name}
          entityType={EntityType.PIPELINE}
          extraInfo={extraInfo}
          followHandler={followPipeline}
          followers={followersCount}
          followersList={followers}
          isFollowing={isFollowing}
          permission={pipelinePermissions}
          removeTier={
            pipelinePermissions.EditAll || pipelinePermissions.EditTier
              ? onTierRemove
              : undefined
          }
          serviceType={pipelineDetails.serviceType ?? ''}
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
          version={version}
          versionHandler={versionHandler}
          onRestoreEntity={handleRestorePipeline}
          onThreadLinkSelect={onThreadLinkSelect}
          onUpdateDisplayName={handleUpdateDisplayName}
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
                  </div>
                </Col>
              </Row>
              {loader}
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
                deleted={deleted}
                entityType={EntityType.PIPELINE}
                hasEditAccess={
                  pipelinePermissions.EditAll || pipelinePermissions.EditLineage
                }
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
      </div>

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
    </PageContainerV1>
  );
};

export default PipelineDetails;
