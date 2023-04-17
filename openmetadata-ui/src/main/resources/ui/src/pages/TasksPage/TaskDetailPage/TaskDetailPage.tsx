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

import { CheckOutlined, CloseOutlined, DownOutlined } from '@ant-design/icons';
import { Button, Card, Dropdown, Layout, MenuProps, Space, Tabs } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import ActivityFeedEditor from 'components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import FeedPanelBody from 'components/ActivityFeed/ActivityFeedPanel/FeedPanelBody';
import ActivityThreadPanelBody from 'components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanelBody';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import AssigneeList from 'components/common/AssigneeList/AssigneeList';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import UserPopOverCard from 'components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import Loader from 'components/Loader/Loader';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isEqual, toLower } from 'lodash';
import { observer } from 'mobx-react';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getFeedById,
  getTask,
  postFeedById,
  postThread,
  updatePost,
  updateTask,
  updateThread,
} from 'rest/feedsAPI';
import AppState from '../../../AppState';
import { ReactComponent as IconEdit } from '../../../assets/svg/ic-edit.svg';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { PanelTab, TaskOperation } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { CreateThread } from '../../../generated/api/feed/createThread';
import { Table } from '../../../generated/entity/data/table';
import {
  EntityReference,
  Post,
  TaskDetails,
  TaskType,
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useAuth } from '../../../hooks/authHooks';
import { ENTITY_LINK_SEPARATOR } from '../../../utils/EntityUtils';
import {
  deletePost,
  getEntityField,
  getEntityFQN,
  getEntityType,
  updateThreadData,
} from '../../../utils/FeedUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import { getEntityLink } from '../../../utils/TableUtils';
import {
  fetchEntityDetail,
  fetchOptions,
  getBreadCrumbList,
  getColumnObject,
  getTaskActionList,
  isDescriptionTask,
  isTagsTask,
} from '../../../utils/TasksUtils';
import { getDayTimeByTimeStamp } from '../../../utils/TimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Assignees from '../shared/Assignees';
import ClosedTask from '../shared/ClosedTask';
import ColumnDetail from '../shared/ColumnDetail';
import CommentModal from '../shared/CommentModal';
import DescriptionTask from '../shared/DescriptionTask';
import EntityDetail from '../shared/EntityDetail';
import TagsTask from '../shared/TagsTask';
import TaskStatus from '../shared/TaskStatus';
import { background, cardStyles, contentStyles } from '../TaskPage.styles';
import {
  EntityData,
  Option,
  TaskAction,
  TaskActionMode,
} from '../TasksPage.interface';

const TaskDetailPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { Content, Sider } = Layout;
  const { TabPane } = Tabs;
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  const { taskId } = useParams<{ [key: string]: string }>();

  const TASK_ACTION_LIST = useMemo(() => getTaskActionList(), []);

  const [taskDetail, setTaskDetail] = useState<Thread>({} as Thread);
  const [taskFeedDetail, setTaskFeedDetail] = useState<Thread>({} as Thread);
  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignees, setAssignees] = useState<Array<Option>>([]);
  const [error, setError] = useState<string>('');
  const [editAssignee, setEditAssignee] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<string>('');
  const [taskAction, setTaskAction] = useState<TaskAction>(TASK_ACTION_LIST[0]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [comment, setComment] = useState<string>('');
  const [tagsSuggestion, setTagsSuggestion] = useState<TagLabel[]>([]);
  const [isTaskLoading, setIsTaskLoading] = useState<boolean>(false);
  const [isLoadingOnSave, setIsLoadingOnSave] = useState<boolean>(false);

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const entityType = useMemo(() => {
    return getEntityType(taskDetail.about);
  }, [taskDetail]);

  const entityField = useMemo(() => {
    return getEntityField(taskDetail.about);
  }, [taskDetail]);

  const columnObject = useMemo(() => {
    // prepare column from entityField
    const column = entityField?.split(ENTITY_LINK_SEPARATOR)?.slice(-2)?.[0];

    // prepare column value by replacing double quotes
    const columnValue = column?.replaceAll(/^"|"$/g, '') || '';

    /**
     * Get column name by spliting columnValue with FQN Separator
     */
    const columnName = columnValue.split(FQN_SEPARATOR_CHAR).pop();

    return getColumnObject(
      columnName ?? '',
      (entityData as Table).columns || []
    );
  }, [taskDetail, entityData]);

  // const isRequestTag = isEqual(taskDetail.task?.type, TaskType.RequestTag);
  // const isUpdateTag = isEqual(taskDetail.task?.type, TaskType.UpdateTag);

  const isOwner = isEqual(entityData.owner?.id, currentUser?.id);

  const isAssignee = taskDetail.task?.assignees?.some((assignee) =>
    isEqual(assignee.id, currentUser?.id)
  );

  const isTaskClosed = isEqual(
    taskDetail.task?.status,
    ThreadTaskStatus.Closed
  );

  const isCreator = isEqual(taskDetail.createdBy, currentUser?.name);

  const isTaskActionEdit = isEqual(taskAction.key, TaskActionMode.EDIT);

  const isTaskDescription = isDescriptionTask(
    taskDetail.task?.type as TaskType
  );

  const isTaskTags = isTagsTask(taskDetail.task?.type as TaskType);

  const fetchTaskDetail = async () => {
    setIsTaskLoading(true);
    try {
      const data = await getTask(taskId);
      setTaskDetail(data);
    } catch (error) {
      showErrorToast(error as AxiosError, '', 5000, setError);
    } finally {
      setIsTaskLoading(false);
    }
  };

  const fetchTaskFeed = (id: string) => {
    setIsLoading(true);
    getFeedById(id)
      .then((res) => {
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
    } as Post;
    postFeedById(taskFeedDetail.id, data)
      .then((res) => {
        const { posts } = res;
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
        .then((res) => {
          setTaskFeedDetail((prev) => ({
            ...prev,
            reactions: res.reactions,
          }));
        })
        .catch((err: AxiosError) => {
          showErrorToast(err);
        });
    } else {
      updatePost(threadId, postId, data)
        .then((res) => {
          setTaskFeedDetail((prev) => {
            const updatedPosts = (prev.posts || []).map((post) => {
              if (isEqual(postId, post.id)) {
                return { ...post, reactions: res.reactions };
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
    const newAssignees = assignees.map((assignee) => {
      const existingAssignee = (taskDetail.task?.assignees || []).find(
        (exAssignee) => isEqual(exAssignee.id, assignee.value)
      );

      if (existingAssignee) {
        return {
          id: existingAssignee.id,
          type: existingAssignee.type,
        };
      } else {
        return {
          id: assignee.value,
          type: assignee.type,
        };
      }
    });

    const updatedTask = {
      ...taskDetail,
      task: { ...(taskDetail.task || {}), assignees: newAssignees },
    };

    // existing task assignees should only have id and type for the patch to work
    const existingAssignees = taskDetail.task?.assignees;
    let oldTask: Thread = taskDetail;
    if (existingAssignees) {
      const formattedAssignees: EntityReference[] = existingAssignees.map(
        (assignee: EntityReference) => {
          return {
            id: assignee.id,
            type: assignee.type,
          };
        }
      );
      oldTask = {
        ...taskDetail,
        task: {
          ...(taskDetail.task as TaskDetails),
          assignees: formattedAssignees,
        },
      };
    }

    const patch = compare(oldTask, updatedTask);
    updateThread(taskDetail.id, patch)
      .then(() => {
        fetchTaskDetail();
      })
      .catch((err: AxiosError) => showErrorToast(err));
    setEditAssignee(false);
  };

  const onTaskResolve = () => {
    const updateTaskData = (data: TaskDetails) => {
      if (!taskDetail.task?.id) {
        return;
      }
      updateTask(TaskOperation.RESOLVE, taskDetail.task?.id + '', data)
        .then(() => {
          showSuccessToast(t('server.task-resolved-successfully'));
          history.push(
            getEntityLink(
              entityType ?? '',
              entityData?.fullyQualifiedName ?? ''
            )
          );
        })
        .catch((err: AxiosError) => showErrorToast(err));
    };

    if (isTaskTags) {
      if (!isEmpty(tagsSuggestion)) {
        const data = { newValue: JSON.stringify(tagsSuggestion || '[]') };
        updateTaskData(data as TaskDetails);
      } else {
        showErrorToast(t('server.please-add-tags'));
      }
    } else {
      if (suggestion) {
        const data = { newValue: suggestion };
        updateTaskData(data as TaskDetails);
      } else {
        showErrorToast(t('server.please-add-description'));
      }
    }
  };

  const onTaskReject = () => {
    if (comment && taskDetail.task?.id) {
      setIsLoadingOnSave(true);
      updateTask(TaskOperation.REJECT, taskDetail.task?.id + '', {
        comment,
      } as unknown as TaskDetails)
        .then(() => {
          showSuccessToast(t('server.task-closed-successfully'));
          setModalVisible(false);
          history.push(
            getEntityLink(
              entityType ?? '',
              entityData?.fullyQualifiedName ?? ''
            )
          );
        })
        .catch((err: AxiosError) => showErrorToast(err))
        .finally(() => setIsLoadingOnSave(false));
    } else {
      showErrorToast(t('server.task-closed-without-comment'));
    }
  };

  const createThread = (data: CreateThread) => {
    postThread(data).catch((err: AxiosError) => {
      showErrorToast(err);
    });
  };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread);
  };

  const postFeedHandler = (value: string, id: string) => {
    const data = {
      message: value,
      from: currentUser?.name,
    } as Post;
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

  // prepare current description for update description task
  const currentDescription = () => {
    if (entityField && !isEmpty(columnObject)) {
      return columnObject.description || '';
    } else {
      return entityData.description || '';
    }
  };

  // prepare current tags for update tags task
  const getCurrentTags = () => {
    if (!isEmpty(columnObject) && entityField) {
      return columnObject.tags ?? [];
    } else {
      return entityData.tags ?? [];
    }
  };

  // handle assignees search
  const onSearch = (query: string) => {
    fetchOptions(query, setOptions);
  };

  // handle sider tab change
  const onTabChange = (key: string) => {
    if (isEqual(key, PanelTab.TASKS)) {
      fetchTaskFeed(taskDetail.id);
    }
  };

  // handle task action change
  const onTaskActionChange = (key: string) => {
    setTaskAction(
      TASK_ACTION_LIST.find((action) => isEqual(action.key, key)) as TaskAction
    );
  };

  /**
   *
   * @param taskSuggestion suggestion value
   * Based on task type set's the suggestion for task
   */
  const setTaskSuggestionOnRender = (taskSuggestion: string | undefined) => {
    if (isTaskTags) {
      const tagsSuggestion = JSON.parse(taskSuggestion || '[]');
      isEmpty(tagsSuggestion) && setTaskAction(TASK_ACTION_LIST[1]);
      setTagsSuggestion(tagsSuggestion);
    } else {
      if (!taskSuggestion) {
        setTaskAction(TASK_ACTION_LIST[1]);
      }
      setSuggestion(taskSuggestion || '');
    }
  };

  // handle task details change
  const onTaskDetailChange = () => {
    if (!isEmpty(taskDetail)) {
      // get entityFQN and fetch entity data
      const entityFQN = getEntityFQN(taskDetail.about);

      entityFQN &&
        fetchEntityDetail(
          entityType as EntityType,
          getEncodedFqn(entityFQN ?? ''),
          setEntityData
        );
      fetchTaskFeed(taskDetail.id);

      // set task assignees
      const taskAssignees = taskDetail.task?.assignees || [];
      if (taskAssignees.length) {
        const assigneesArr = taskAssignees.map((assignee) => ({
          label: assignee.name ?? '',
          value: assignee.id,
          type: assignee.type ?? '',
        }));
        setAssignees(assigneesArr);
        setOptions(assigneesArr);
      }

      // set task suggestion on render
      setTaskSuggestionOnRender(taskDetail.task?.suggestion);
    }
  };

  const onSuggestionChange = (value: string) => {
    setSuggestion(value);
  };

  const handleMenuItemClick: MenuProps['onClick'] = (info) =>
    onTaskActionChange(info.key);

  useEffect(() => {
    fetchTaskDetail();
  }, [taskId]);

  useEffect(() => {
    onTaskDetailChange();
  }, [taskDetail]);

  // handle comment modal close
  const onCommentModalClose = () => {
    setModalVisible(false);
    setComment('');
  };

  /**
   *
   * @returns True if has access otherwise false
   */
  const hasEditAccess = () =>
    isAdminUser || isAuthDisabled || isAssignee || isOwner;

  return (
    <>
      {isTaskLoading ? (
        <Loader />
      ) : (
        <Layout style={{ ...background, height: '100vh' }}>
          {error ? (
            <ErrorPlaceHolder>{error}</ErrorPlaceHolder>
          ) : (
            <Fragment>
              <Content style={{ ...contentStyles, overflowY: 'auto' }}>
                <TitleBreadcrumb
                  className="m-t-lg m-b-xs"
                  titleLinks={[
                    ...getBreadCrumbList(entityData, entityType as EntityType),
                    {
                      name: t('label.task-title', {
                        title: taskDetail.task?.id,
                      }),
                      activeTitle: true,
                      url: '',
                    },
                  ]}
                />
                <EntityDetail entityData={entityData} />

                <Card
                  data-testid="task-metadata"
                  style={{ ...cardStyles, marginTop: '16px' }}>
                  <p
                    className="tw-text-base tw-font-medium tw-mb-4"
                    data-testid="task-title">
                    {t('label.task-title', {
                      title: `${taskId} ${taskDetail.message}`,
                    })}
                  </p>
                  <div className="tw-flex tw-mb-4" data-testid="task-metadata">
                    <TaskStatus
                      status={taskDetail.task?.status as ThreadTaskStatus}
                    />
                    <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                      {t('label.pipe-symbol')}
                    </span>
                    <span className="tw-flex">
                      <UserPopOverCard userName={taskDetail.createdBy || ''}>
                        <span className="tw-flex">
                          <ProfilePicture
                            displayName={taskDetail.createdBy || ''}
                            id=""
                            name={taskDetail.createdBy || ''}
                            width="20"
                          />
                          <span className="tw-font-semibold tw-cursor-pointer hover:tw-underline tw-ml-1">
                            {taskDetail.createdBy}
                          </span>
                        </span>
                      </UserPopOverCard>
                      <span className="tw-ml-1">
                        {t('message.created-this-task-lowercase')}
                      </span>
                      <span className="tw-ml-1">
                        {toLower(
                          getDayTimeByTimeStamp(taskDetail.threadTs ?? 0)
                        )}
                      </span>
                    </span>
                  </div>

                  <ColumnDetail column={columnObject} />
                  <div className="tw-flex" data-testid="task-assignees">
                    <span
                      className={classNames('tw-text-grey-muted', {
                        'tw-self-center tw-mr-2': editAssignee,
                      })}>
                      {`${t('label.assignee-plural')}:`}
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
                          icon={<CloseOutlined />}
                          size="small"
                          type="primary"
                          onClick={() => setEditAssignee(false)}
                        />
                        <Button
                          className="tw-mx-1 tw-self-center ant-btn-primary-custom"
                          disabled={!assignees.length}
                          icon={<CheckOutlined />}
                          size="small"
                          type="primary"
                          onClick={onTaskUpdate}
                        />
                      </Fragment>
                    ) : (
                      <Fragment>
                        <AssigneeList
                          assignees={taskDetail?.task?.assignees || []}
                          className="tw-ml-0.5 tw-align-middle tw-inline-flex tw-flex-wrap"
                        />
                        {(hasEditAccess() || isCreator) && !isTaskClosed && (
                          <Button
                            className="p-0"
                            data-testid="edit-suggestion"
                            icon={<IconEdit height={14} width={14} />}
                            size="small"
                            type="text"
                            onClick={() => setEditAssignee(true)}
                          />
                        )}
                      </Fragment>
                    )}
                  </div>
                </Card>

                <Card
                  className="mt-4 ml-6"
                  data-testid="task-data"
                  style={{
                    ...cardStyles,
                  }}>
                  {isTaskDescription && (
                    <DescriptionTask
                      currentDescription={currentDescription()}
                      hasEditAccess={hasEditAccess()}
                      isTaskActionEdit={isTaskActionEdit}
                      suggestion={suggestion}
                      taskDetail={taskDetail}
                      onSuggestionChange={onSuggestionChange}
                    />
                  )}

                  {isTaskTags && (
                    <TagsTask
                      currentTags={getCurrentTags()}
                      hasEditAccess={hasEditAccess()}
                      isTaskActionEdit={isTaskActionEdit}
                      setSuggestion={setTagsSuggestion}
                      suggestions={tagsSuggestion}
                      task={taskDetail.task}
                    />
                  )}

                  <Space
                    className="m-t-xss"
                    data-testid="task-cta-buttons"
                    size="small">
                    {(hasEditAccess() || isCreator) && !isTaskClosed && (
                      <Button
                        className="ant-btn-link-custom"
                        type="link"
                        onClick={() => setModalVisible(true)}>
                        {t('label.close-with-comment')}
                      </Button>
                    )}

                    {hasEditAccess() && !isTaskClosed && (
                      <Fragment>
                        {taskDetail.task?.suggestion ? (
                          <Dropdown.Button
                            className="ant-btn-primary-dropdown"
                            data-testid="complete-task"
                            icon={<DownOutlined />}
                            menu={{
                              items: TASK_ACTION_LIST,
                              selectable: true,
                              selectedKeys: [taskAction.key],
                              onClick: handleMenuItemClick,
                            }}
                            trigger={['click']}
                            type="primary"
                            onClick={onTaskResolve}>
                            {taskAction.label}
                          </Dropdown.Button>
                        ) : (
                          <Button
                            className="ant-btn-primary-custom"
                            disabled={!suggestion}
                            type="primary"
                            onClick={onTaskResolve}>
                            {t('label.add-entity', {
                              entity: t('label.description'),
                            })}
                          </Button>
                        )}
                      </Fragment>
                    )}
                  </Space>

                  {isTaskClosed && <ClosedTask task={taskDetail.task} />}
                </Card>
                <CommentModal
                  comment={comment}
                  isLoading={isLoadingOnSave}
                  open={modalVisible}
                  setComment={setComment}
                  taskDetail={taskDetail}
                  onClose={onCommentModalClose}
                  onConfirm={onTaskReject}
                />
              </Content>

              <Sider
                className="ant-layout-sider-task-detail"
                data-testid="task-right-sider"
                theme="light"
                width={600}>
                <Tabs className="ant-tabs-custom-line" onChange={onTabChange}>
                  <TabPane key={PanelTab.TASKS} tab={t('label.task')}>
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

                  <TabPane
                    key={PanelTab.CONVERSATIONS}
                    tab={t('label.conversation-plural')}>
                    {!isEmpty(taskFeedDetail) ? (
                      <ActivityThreadPanelBody
                        className="tw-p-0"
                        createThread={createThread}
                        deletePostHandler={deletePostHandler}
                        postFeedHandler={postFeedHandler}
                        showHeader={false}
                        threadLink={taskFeedDetail.about}
                        threadType={ThreadType.Conversation}
                        updateThreadHandler={updateThreadHandler}
                      />
                    ) : null}
                  </TabPane>
                </Tabs>
              </Sider>
            </Fragment>
          )}
        </Layout>
      )}
    </>
  );
};

export default observer(TaskDetailPage);
