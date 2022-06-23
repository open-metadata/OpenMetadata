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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Card, Layout, Tabs } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isEqual, isUndefined, toLower } from 'lodash';
import { observer } from 'mobx-react';
import { EditorContentRef, EntityTags } from 'Models';
import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppState from '../../../AppState';
import { useAuthContext } from '../../../authentication/auth-provider/AuthProvider';
import {
  getFeedById,
  getTask,
  postFeedById,
  postThread,
  updatePost,
  updateTask,
  updateThread,
} from '../../../axiosAPIs/feedsAPI';
import ActivityFeedEditor from '../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import FeedPanelBody from '../../../components/ActivityFeed/ActivityFeedPanel/FeedPanelBody';
import ActivityThreadPanelBody from '../../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanelBody';
import Ellipses from '../../../components/common/Ellipses/Ellipses';
import ErrorPlaceHolder from '../../../components/common/error-with-placeholder/ErrorPlaceHolder';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { TaskOperation } from '../../../constants/feed.constants';
import { EntityType } from '../../../enums/entity.enum';
import { CreateThread } from '../../../generated/api/feed/createThread';
import { Column } from '../../../generated/entity/data/table';
import {
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { useAuth } from '../../../hooks/authHooks';
import { getEntityName } from '../../../utils/CommonUtils';
import { ENTITY_LINK_SEPARATOR } from '../../../utils/EntityUtils';
import {
  deletePost,
  getEntityField,
  getEntityFQN,
  getEntityType,
  updateThreadData,
} from '../../../utils/FeedUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import {
  fetchEntityDetail,
  fetchOptions,
  getBreadCrumbList,
  getColumnObject,
} from '../../../utils/TasksUtils';
import { getDayTimeByTimeStamp } from '../../../utils/TimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Assignees from '../shared/Assignees';
import { DescriptionTabs } from '../shared/DescriptionTabs';
import { background, cardStyles, contentStyles } from '../TaskPage.styles';
import { EntityData, Option } from '../TasksPage.interface';

const TaskDetailPage = () => {
  const { Content, Sider } = Layout;
  const { TabPane } = Tabs;
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  const { taskId } = useParams<{ [key: string]: string }>();

  const markdownRef = useRef<EditorContentRef>();

  const [taskDetail, setTaskDetail] = useState<Thread>({} as Thread);
  const [taskFeedDetail, setTaskFeedDetail] = useState<Thread>({} as Thread);
  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignees, setAssignees] = useState<Array<Option>>([]);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [editAssignee, setEditAssignee] = useState<boolean>(false);

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const entityTier = useMemo(() => {
    const tierFQN = getTierTags(entityData.tags || [])?.tagFQN;

    return tierFQN?.split(FQN_SEPARATOR_CHAR)[1];
  }, [entityData.tags]);

  const entityTags = useMemo(() => {
    const tags: EntityTags[] = getTagsWithoutTier(entityData.tags || []) || [];

    return tags.map((tag) => `#${tag.tagFQN}`).join('  ');
  }, [entityData.tags]);

  const entityType = useMemo(() => {
    return getEntityType(taskDetail.about);
  }, [taskDetail]);

  const entityField = useMemo(() => {
    return getEntityField(taskDetail.about);
  }, [taskDetail]);

  const columnObject = useMemo(() => {
    const column = entityField?.split(ENTITY_LINK_SEPARATOR)?.slice(-2)?.[0];
    const columnValue = column?.replaceAll(/^"|"$/g, '') || '';
    const columnName = columnValue.split(FQN_SEPARATOR_CHAR).pop();

    return getColumnObject(columnName as string, entityData.columns || []);
  }, [taskDetail, entityData]);

  const currentDescription = () => {
    if (entityField) {
      return columnObject.description || '';
    } else {
      return entityData.description || '';
    }
  };

  const fetchTaskDetail = () => {
    getTask(taskId)
      .then((res: AxiosResponse) => {
        setTaskDetail(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, '', 5000, setError);
      });
  };

  const fetchTaskFeed = (id: string) => {
    setIsLoading(true);
    getFeedById(id)
      .then((res: AxiosResponse) => {
        setTaskFeedDetail(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      })
      .finally(() => setIsLoading(false));
  };

  const onPostTaskFeed = (value: string) => {
    const data = {
      message: value,
      from: currentUser?.name,
    };
    postFeedById(taskFeedDetail.id, data)
      .then((res: AxiosResponse) => {
        const { posts } = res.data;
        setTaskFeedDetail((prev) => ({ ...prev, posts }));
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  const onTaskFeedUpdate = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    if (isThread) {
      updateThread(threadId, data)
        .then((res: AxiosResponse) => {
          setTaskFeedDetail((prev) => ({
            ...prev,
            reactions: res.data.reactions,
          }));
        })
        .catch((err: AxiosError) => {
          showErrorToast(err);
        });
    } else {
      updatePost(threadId, postId, data)
        .then((res: AxiosResponse) => {
          setTaskFeedDetail((prev) => {
            const updatedPosts = (prev.posts || []).map((post) => {
              if (isEqual(postId, post.id)) {
                return { ...post, reactions: res.data.reactions };
              } else {
                return post;
              }
            });

            return { ...prev, posts: updatedPosts };
          });
        })
        .catch((err: AxiosError) => {
          showErrorToast(err);
        });
    }
  };

  const onTaskUpdate = () => {
    const newAssignees = assignees.map((assignee) => ({
      id: assignee.value,
      type: assignee.type,
    }));

    const updatedTask = {
      ...taskDetail,
      task: { ...(taskDetail.task || {}), assignees: newAssignees },
    };

    const patch = compare(taskDetail, updatedTask);
    updateThread(taskDetail.id, patch)
      .then((res: AxiosResponse) => {
        setTaskDetail(res.data);
      })
      .catch((err: AxiosError) => showErrorToast(err));
    setEditAssignee(false);
  };

  const onTaskResolve = () => {
    const description =
      markdownRef.current?.getEditorContent() || taskDetail.task?.suggestion;

    updateTask(TaskOperation.RESOLVE, taskDetail.task?.id, {
      newValue: description,
    })
      .then((res: AxiosResponse) => {
        showSuccessToast('Task Resolved Successfully');
        setTaskDetail(res.data);
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const onTaskReject = () => {
    if (showEdit) {
      setShowEdit(false);
    } else {
      updateTask(TaskOperation.RESOLVE, taskDetail.task?.id, {
        newValue: '',
      })
        .then((res: AxiosResponse) => {
          showSuccessToast('Task Closed Successfully');
          setTaskDetail(res.data);
        })
        .catch((err: AxiosError) => showErrorToast(err));
    }
  };

  const createThread = (data: CreateThread) => {
    postThread(data).catch((err: AxiosError) => {
      showErrorToast(err);
    });
  };

  const deletePostHandler = (threadId: string, postId: string) => {
    deletePost(threadId, postId).catch((error: AxiosError) => {
      showErrorToast(error);
    });
  };

  const postFeedHandler = (value: string, id: string) => {
    const data = {
      message: value,
      from: currentUser?.name,
    };
    postFeedById(id, data).catch((err: AxiosError) => {
      showErrorToast(err);
    });
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    const callback = () => {
      return;
    };

    updateThreadData(threadId, postId, isThread, data, callback);
  };

  const onSearch = (query: string) => {
    fetchOptions(query, setOptions);
  };

  const onTabChange = (key: string) => {
    if (isEqual(key, '1')) {
      fetchTaskFeed(taskDetail.id);
    }
  };

  const onTaskDetailChange = () => {
    if (!isEmpty(taskDetail)) {
      const entityFQN = getEntityFQN(taskDetail.about);

      entityFQN &&
        fetchEntityDetail(
          entityType as EntityType,
          entityFQN as string,
          setEntityData
        );
      fetchTaskFeed(taskDetail.id);

      const taskAssignees = taskDetail.task?.assignees || [];
      if (taskAssignees.length) {
        const assigneesArr = taskAssignees.map((assignee) => ({
          label: assignee.name as string,
          value: assignee.id,
          type: assignee.type as string,
        }));
        setAssignees(assigneesArr);
        setOptions(assigneesArr);
      }
    }
  };

  useEffect(() => {
    fetchTaskDetail();
  }, [taskId]);

  useEffect(() => {
    onTaskDetailChange();
  }, [taskDetail]);

  const TaskStatusElement = ({ status }: { status: ThreadTaskStatus }) => {
    return (
      <Fragment>
        <span
          className={classNames(
            'tw-inline-block tw-w-2 tw-h-2 tw-rounded-full tw-self-center',
            {
              'tw-bg-green-500': status === ThreadTaskStatus.Open,
            },
            {
              'tw-bg-gray-500': status === ThreadTaskStatus.Closed,
            }
          )}
        />
        <span className="tw-ml-1">{status}</span>
      </Fragment>
    );
  };

  const ColumnDetail = ({ column }: { column: Column }) => {
    return !isEmpty(column) && !isUndefined(column) ? (
      <div className="tw-mb-4" data-testid="column-details">
        <div className="tw-flex">
          <span className="tw-text-grey-muted tw-flex-none tw-mr-1">
            Column type:
          </span>{' '}
          <Ellipses tooltip rows={1}>
            {column.dataTypeDisplay}
          </Ellipses>
        </div>
        {column.tags && column.tags.length ? (
          <div className="tw-flex">
            <SVGIcons
              alt="icon-tag"
              className="tw-mr-1"
              icon="icon-tag-grey"
              width="12"
            />
            <div>{column.tags.map((tag) => `#${tag.tagFQN}`)?.join(' ')}</div>
          </div>
        ) : null}
      </div>
    ) : null;
  };

  const EntityDetail = () => {
    return (
      <div data-testid="entityDetail">
        <div className="tw-flex tw-ml-6">
          <span className="tw-text-grey-muted">Owner:</span>{' '}
          <span>
            {entityData.owner ? (
              <span className="tw-flex tw-ml-1">
                <ProfilePicture
                  displayName={getEntityName(entityData.owner)}
                  id=""
                  name={getEntityName(entityData.owner)}
                  width="20"
                />
                <span className="tw-ml-1">
                  {getEntityName(entityData.owner)}
                </span>
              </span>
            ) : (
              <span className="tw-text-grey-muted tw-ml-1">No Owner</span>
            )}
          </span>
          <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">|</span>
          <p data-testid="tier">
            {entityTier ? (
              entityTier
            ) : (
              <span className="tw-text-grey-muted">No Tier</span>
            )}
          </p>
        </div>
        <p className="tw-ml-6" data-testid="tags">
          {entityTags}
        </p>
      </div>
    );
  };

  const getCurrentDescription = () => {
    let markdown;
    if (taskDetail.task?.status === ThreadTaskStatus.Open) {
      markdown = taskDetail.task.suggestion;
    } else {
      markdown = taskDetail.task?.newValue;
    }

    return markdown ? (
      <RichTextEditorPreviewer
        className="tw-p-2"
        enableSeeMoreVariant={false}
        markdown={markdown}
      />
    ) : (
      <span className="tw-no-description tw-p-2">No description </span>
    );
  };

  const hasEditAccess = () => {
    const isOwner = entityData.owner?.id === currentUser?.id;
    const isAssignee = taskDetail.task?.assignees?.some(
      (assignee) => assignee.id === currentUser?.id
    );

    const isTaskClosed = taskDetail.task?.status === ThreadTaskStatus.Closed;

    return (
      (isAdminUser || isAuthDisabled || isAssignee || isOwner) && !isTaskClosed
    );
  };

  return (
    <Layout style={{ ...background, height: '100vh' }}>
      {error ? (
        <ErrorPlaceHolder>{error}</ErrorPlaceHolder>
      ) : (
        <Fragment>
          <Content style={{ ...contentStyles, overflowY: 'auto' }}>
            <TitleBreadcrumb
              titleLinks={getBreadCrumbList(
                entityData,
                entityType as EntityType
              )}
            />
            <EntityDetail />
            <Card
              key="task-details"
              style={{ ...cardStyles, marginTop: '16px' }}>
              <p
                className="tw-text-base tw-font-medium"
                data-testid="task-title">
                {`Task #${taskId}`} {taskDetail.message}
              </p>
              <p className="tw-flex" data-testid="task-metadata">
                <TaskStatusElement
                  status={taskDetail.task?.status as ThreadTaskStatus}
                />
                <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                  |
                </span>
                <span className="tw-flex">
                  <UserPopOverCard userName={taskDetail.createdBy || ''}>
                    <span className="tw-font-semibold tw-cursor-pointer hover:tw-underline">
                      {taskDetail.createdBy}
                    </span>
                  </UserPopOverCard>
                  <span className="tw-ml-1">created this task </span>
                  <span className="tw-ml-1">
                    {toLower(
                      getDayTimeByTimeStamp(taskDetail.threadTs as number)
                    )}
                  </span>
                </span>
              </p>

              <ColumnDetail column={columnObject} />

              <div className="tw-flex tw-mb-4" data-testid="task-assignees">
                <span className="tw-text-grey-muted tw-self-center tw-mr-1">
                  Assignees:
                </span>
                {editAssignee ? (
                  <Fragment>
                    <Assignees
                      assignees={assignees}
                      options={options}
                      onChange={setAssignees}
                      onSearch={onSearch}
                    />
                    <Button
                      className="tw-mx-1 tw-self-center ant-btn-primary-custom"
                      size="small"
                      type="primary"
                      onClick={() => setEditAssignee(false)}>
                      <FontAwesomeIcon
                        className="tw-w-3.5 tw-h-3.5"
                        icon="times"
                      />
                    </Button>
                    <Button
                      className="tw-mx-1 tw-self-center ant-btn-primary-custom"
                      size="small"
                      type="primary"
                      onClick={onTaskUpdate}>
                      <FontAwesomeIcon
                        className="tw-w-3.5 tw-h-3.5"
                        icon="check"
                      />
                    </Button>
                  </Fragment>
                ) : (
                  <Fragment>
                    <span className="tw-self-center tw-mr-1">
                      {taskDetail.task?.assignees
                        ?.map((assignee) => getEntityName(assignee))
                        ?.join(', ')}
                    </span>
                    {hasEditAccess() && (
                      <button
                        className="focus:tw-outline-none tw-self-baseline tw-p-2 tw-pl-0"
                        data-testid="edit-suggestion"
                        onClick={() => setEditAssignee(true)}>
                        <SVGIcons
                          alt="edit"
                          icon="icon-edit"
                          title="Edit"
                          width="12px"
                        />
                      </button>
                    )}
                  </Fragment>
                )}
              </div>

              <div data-testid="task-description-tabs">
                <span className="tw-text-grey-muted">Description:</span>{' '}
                {!isEmpty(taskDetail) && (
                  <Fragment>
                    {showEdit ? (
                      <DescriptionTabs
                        description={currentDescription()}
                        markdownRef={markdownRef}
                        suggestion={taskDetail.task?.suggestion || ''}
                      />
                    ) : (
                      <div className="tw-flex tw-border tw-border-main tw-rounded tw-mb-4">
                        {getCurrentDescription()}
                        {hasEditAccess() && (
                          <button
                            className="focus:tw-outline-none tw-self-baseline tw-p-2 tw-pl-0"
                            data-testid="edit-suggestion"
                            onClick={() => setShowEdit(true)}>
                            <SVGIcons
                              alt="edit"
                              icon="icon-edit"
                              title="Edit"
                              width="12px"
                            />
                          </button>
                        )}
                      </div>
                    )}
                  </Fragment>
                )}
              </div>

              {hasEditAccess() && (
                <div
                  className="tw-flex tw-justify-end"
                  data-testid="task-cta-buttons">
                  <Button
                    className="ant-btn-link-custom"
                    type="link"
                    onClick={onTaskReject}>
                    {showEdit ? 'Cancel' : 'Reject'}
                  </Button>
                  <Button
                    className="ant-btn-primary-custom"
                    type="primary"
                    onClick={onTaskResolve}>
                    {showEdit ? 'Submit' : 'Accept'}
                  </Button>
                </div>
              )}

              {taskDetail.task?.status === ThreadTaskStatus.Closed && (
                <p className="tw-flex" data-testid="task-closed">
                  <UserPopOverCard userName={taskDetail.task.closedBy || ''}>
                    <span className="tw-font-semibold tw-cursor-pointer hover:tw-underline">
                      {taskDetail.task.closedBy}
                    </span>{' '}
                  </UserPopOverCard>
                  <span className="tw-ml-1"> closed this task </span>
                  <span className="tw-ml-1">
                    {toLower(
                      getDayTimeByTimeStamp(taskDetail.task.closedAt as number)
                    )}
                  </span>
                </p>
              )}
            </Card>
          </Content>

          <Sider
            className="ant-layout-sider-task-detail"
            data-testid="task-right-sider"
            width={600}>
            <Tabs className="ant-tabs-task-detail" onChange={onTabChange}>
              <TabPane key="1" tab="Task">
                {!isEmpty(taskFeedDetail) ? (
                  <div id="task-feed">
                    <FeedPanelBody
                      isLoading={isLoading}
                      threadData={taskFeedDetail}
                      updateThreadHandler={onTaskFeedUpdate}
                    />
                    <ActivityFeedEditor
                      buttonClass="tw-mr-4"
                      className="tw-ml-5 tw-mr-2 tw-mb-2"
                      onSave={onPostTaskFeed}
                    />
                  </div>
                ) : null}
              </TabPane>

              <TabPane key="2" tab="Conversations">
                {!isEmpty(taskFeedDetail) ? (
                  <ActivityThreadPanelBody
                    className="tw-p-0"
                    createThread={createThread}
                    deletePostHandler={deletePostHandler}
                    postFeedHandler={postFeedHandler}
                    showHeader={false}
                    threadLink={taskFeedDetail.about}
                    updateThreadHandler={updateThreadHandler}
                  />
                ) : null}
              </TabPane>
            </Tabs>
          </Sider>
        </Fragment>
      )}
    </Layout>
  );
};

export default observer(TaskDetailPage);
