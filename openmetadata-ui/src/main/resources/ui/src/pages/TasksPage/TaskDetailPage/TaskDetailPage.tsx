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

import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Card, Dropdown, Layout, Menu, Modal, Tabs } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isEqual, isUndefined, toLower } from 'lodash';
import { observer } from 'mobx-react';
import { EditorContentRef, EntityTags } from 'Models';
import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
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
import AssigneeList from '../../../components/common/AssigneeList/AssigneeList';
import Ellipses from '../../../components/common/Ellipses/Ellipses';
import ErrorPlaceHolder from '../../../components/common/error-with-placeholder/ErrorPlaceHolder';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { TaskOperation } from '../../../constants/feed.constants';
import { EntityType } from '../../../enums/entity.enum';
import { CreateThread } from '../../../generated/api/feed/createThread';
import { Column } from '../../../generated/entity/data/table';
import {
  TaskType,
  Thread,
  ThreadTaskStatus,
  ThreadType,
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
import { getEncodedFqn } from '../../../utils/StringsUtils';
import SVGIcons from '../../../utils/SvgUtils';
import {
  getEntityLink,
  getTagsWithoutTier,
  getTierTags,
} from '../../../utils/TableUtils';
import {
  fetchEntityDetail,
  fetchOptions,
  getBreadCrumbList,
  getColumnObject,
  getDescriptionDiff,
  TASK_ACTION_LIST,
} from '../../../utils/TasksUtils';
import { getDayTimeByTimeStamp } from '../../../utils/TimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Assignees from '../shared/Assignees';
import { DescriptionTabs } from '../shared/DescriptionTabs';
import { DiffView } from '../shared/DiffView';
import { background, cardStyles, contentStyles } from '../TaskPage.styles';
import {
  EntityData,
  Option,
  TaskAction,
  TaskActionMode,
} from '../TasksPage.interface';

const TaskDetailPage = () => {
  const history = useHistory();
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
  const [error, setError] = useState<string>('');
  const [editAssignee, setEditAssignee] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<string>('');
  const [taskAction, setTaskAction] = useState<TaskAction>(TASK_ACTION_LIST[0]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [comment, setComment] = useState<string>('');

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

  const isRequestDescription = isEqual(
    taskDetail.task?.type,
    TaskType.RequestDescription
  );

  const isUpdateDescription = isEqual(
    taskDetail.task?.type,
    TaskType.UpdateDescription
  );

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
    const newAssignees = assignees.map((assignee) => {
      const existingAssignee = (taskDetail.task?.assignees || []).find(
        (exAssignee) => isEqual(exAssignee.id, assignee.value)
      );

      if (existingAssignee) {
        return existingAssignee;
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

    const patch = compare(taskDetail, updatedTask);
    updateThread(taskDetail.id, patch)
      .then(() => {
        fetchTaskDetail();
      })
      .catch((err: AxiosError) => showErrorToast(err));
    setEditAssignee(false);
  };

  const onTaskResolve = () => {
    if (suggestion) {
      const data = { newValue: suggestion };
      updateTask(TaskOperation.RESOLVE, taskDetail.task?.id, data)
        .then(() => {
          showSuccessToast('Task Resolved Successfully');
          history.push(
            getEntityLink(
              entityType as string,
              entityData?.fullyQualifiedName as string
            )
          );
        })
        .catch((err: AxiosError) => showErrorToast(err));
    } else {
      showErrorToast(
        'Cannot accept an empty description. Please add a description.'
      );
    }
  };

  const onTaskReject = () => {
    if (comment) {
      updateTask(TaskOperation.REJECT, taskDetail.task?.id, {
        comment,
      })
        .then(() => {
          showSuccessToast('Task Closed Successfully');
          history.push(
            getEntityLink(
              entityType as string,
              entityData?.fullyQualifiedName as string
            )
          );
        })
        .catch((err: AxiosError) => showErrorToast(err));
    } else {
      showErrorToast('Cannot close task without a comment');
    }
    setModalVisible(false);
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

  const currentDescription = () => {
    if (entityField && !isEmpty(columnObject)) {
      return columnObject.description || '';
    } else {
      return entityData.description || '';
    }
  };

  const onSearch = (query: string) => {
    fetchOptions(query, setOptions);
  };

  const onTabChange = (key: string) => {
    if (isEqual(key, '1')) {
      fetchTaskFeed(taskDetail.id);
    }
  };

  const onTaskActionChange = (key: string) => {
    setTaskAction(
      TASK_ACTION_LIST.find((action) => isEqual(action.key, key)) as TaskAction
    );
  };

  const onTaskDetailChange = () => {
    if (!isEmpty(taskDetail)) {
      const entityFQN = getEntityFQN(taskDetail.about);

      entityFQN &&
        fetchEntityDetail(
          entityType as EntityType,
          getEncodedFqn(entityFQN as string),
          setEntityData
        );
      fetchTaskFeed(taskDetail.id);

      const taskAssignees = taskDetail.task?.assignees || [];
      const taskSuggestion = taskDetail.task?.suggestion;
      if (taskAssignees.length) {
        const assigneesArr = taskAssignees.map((assignee) => ({
          label: assignee.name as string,
          value: assignee.id,
          type: assignee.type as string,
        }));
        setAssignees(assigneesArr);
        setOptions(assigneesArr);
      }
      if (!taskSuggestion) {
        setTaskAction(TASK_ACTION_LIST[1]);
      }
      setSuggestion(taskSuggestion || '');
    }
  };

  const onSuggestionChange = (value: string) => {
    setSuggestion(value);
  };

  useEffect(() => {
    fetchTaskDetail();
  }, [taskId]);

  useEffect(() => {
    onTaskDetailChange();
  }, [taskDetail]);

  const TaskStatusElement = ({ status }: { status: ThreadTaskStatus }) => {
    const openCheck = isEqual(status, ThreadTaskStatus.Open);
    const closedCheck = isEqual(status, ThreadTaskStatus.Closed);

    return (
      <Fragment>
        <div
          className={classNames(
            'tw-rounded-3xl tw-px-2 tw-p-0',
            {
              'tw-bg-task-status-bg': openCheck,
            },
            { 'tw-bg-gray-100': closedCheck }
          )}>
          <span
            className={classNames(
              'tw-inline-block tw-w-2 tw-h-2 tw-rounded-full',
              {
                'tw-bg-task-status-fg': openCheck,
              },
              {
                'tw-bg-gray-500': closedCheck,
              }
            )}
          />
          <span
            className={classNames(
              'tw-ml-1',
              { 'tw-text-task-status-fg': openCheck },
              { 'tw-text-gray-500': closedCheck }
            )}>
            {status}
          </span>
        </div>
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
          <div className="tw-flex tw-mt-4">
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

  const getDiffView = () => {
    const oldValue = taskDetail.task?.oldValue;
    const newValue = taskDetail.task?.newValue;
    if (!oldValue && !newValue) {
      return (
        <div className="tw-border tw-border-main tw-p-2 tw-rounded tw-my-1 tw-mb-3">
          <span className="tw-p-2 tw-text-grey-muted">No Description</span>
        </div>
      );
    } else {
      return (
        <DiffView
          className="tw-border tw-border-main tw-p-2 tw-rounded tw-my-1 tw-mb-3"
          diffArr={getDescriptionDiff(
            taskDetail?.task?.oldValue || '',
            taskDetail?.task?.newValue || ''
          )}
        />
      );
    }
  };

  const getCurrentDescription = () => {
    const newDescription = taskDetail?.task?.suggestion;
    const oldDescription = taskDetail?.task?.oldValue;

    const diffs = getDescriptionDiff(
      oldDescription || '',
      newDescription || ''
    );

    return !diffs.length ? (
      <span className="tw-p-2 tw-text-grey-muted">No Suggestion</span>
    ) : (
      <DiffView className="tw-p-2" diffArr={diffs} />
    );
  };

  const onModalClose = () => {
    setModalVisible(false);
    setComment('');
  };

  const hasEditAccess = () => {
    return isAdminUser || isAuthDisabled || isAssignee || isOwner;
  };

  return (
    <Layout style={{ ...background, height: '100vh' }}>
      {error ? (
        <ErrorPlaceHolder>{error}</ErrorPlaceHolder>
      ) : (
        <Fragment>
          <Content style={{ ...contentStyles, overflowY: 'auto' }}>
            <TitleBreadcrumb
              titleLinks={[
                ...getBreadCrumbList(entityData, entityType as EntityType),
                {
                  name: `Task #${taskDetail.task?.id}`,
                  activeTitle: true,
                  url: '',
                },
              ]}
            />
            <EntityDetail />

            <Card
              data-testid="task-metadata"
              style={{ ...cardStyles, marginTop: '16px' }}>
              <p
                className="tw-text-base tw-font-medium tw-mb-4"
                data-testid="task-title">
                {`Task #${taskId}`} {taskDetail.message}
              </p>
              <p className="tw-flex tw-mb-4" data-testid="task-metadata">
                <TaskStatusElement
                  status={taskDetail.task?.status as ThreadTaskStatus}
                />
                <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                  |
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
                  <span className="tw-ml-1">created this task </span>
                  <span className="tw-ml-1">
                    {toLower(
                      getDayTimeByTimeStamp(taskDetail.threadTs as number)
                    )}
                  </span>
                </span>
              </p>

              <ColumnDetail column={columnObject} />
              <div className="tw-flex" data-testid="task-assignees">
                <span className="tw-text-grey-muted ">Assignees:</span>
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
                    <AssigneeList
                      assignees={taskDetail?.task?.assignees || []}
                      className="tw-ml-0.5 tw-align-middle tw-inline-flex tw-flex-wrap"
                    />
                    {(hasEditAccess() || isCreator) && !isTaskClosed && (
                      <button
                        className="focus:tw-outline-none tw-self-baseline tw-flex-none"
                        data-testid="edit-suggestion"
                        onClick={() => setEditAssignee(true)}>
                        <SVGIcons
                          alt="edit"
                          icon="icon-edit"
                          title="Edit"
                          width="14px"
                        />
                      </button>
                    )}
                  </Fragment>
                )}
              </div>
            </Card>

            <Card
              data-testid="task-data"
              style={{ ...cardStyles, marginTop: '16px', marginLeft: '24px' }}>
              <div data-testid="task-description-tabs">
                <p className="tw-text-grey-muted">Description:</p>{' '}
                {!isEmpty(taskDetail) && (
                  <Fragment>
                    {isTaskClosed ? (
                      getDiffView()
                    ) : (
                      <div data-testid="description-task">
                        {isRequestDescription && (
                          <div data-testid="request-description">
                            {isTaskActionEdit ? (
                              <RichTextEditor
                                height="208px"
                                initialValue={suggestion}
                                placeHolder="Add description"
                                style={{ marginTop: '0px' }}
                                onTextChange={onSuggestionChange}
                              />
                            ) : (
                              <div className="tw-flex tw-border tw-border-main tw-rounded tw-mb-4">
                                {getCurrentDescription()}
                              </div>
                            )}
                          </div>
                        )}

                        {isUpdateDescription && (
                          <div data-testid="update-description">
                            {isTaskActionEdit ? (
                              <DescriptionTabs
                                description={currentDescription()}
                                markdownRef={markdownRef}
                                suggestion={suggestion}
                                onChange={onSuggestionChange}
                              />
                            ) : (
                              <div className="tw-flex tw-border tw-border-main tw-rounded tw-mb-4">
                                {getCurrentDescription()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Fragment>
                )}
              </div>

              {hasEditAccess() && !isTaskClosed && (
                <div
                  className="tw-flex tw-justify-end"
                  data-testid="task-cta-buttons">
                  <Button
                    className="ant-btn-link-custom"
                    type="link"
                    onClick={() => setModalVisible(true)}>
                    Close with comment
                  </Button>

                  <Dropdown.Button
                    className="ant-btn-primary-dropdown"
                    icon={
                      <FontAwesomeIcon
                        className="tw-text-sm"
                        icon={faChevronDown}
                      />
                    }
                    overlay={
                      <Menu
                        selectable
                        items={TASK_ACTION_LIST}
                        selectedKeys={[taskAction.key]}
                        onClick={(info) => onTaskActionChange(info.key)}
                      />
                    }
                    trigger={['click']}
                    type="primary"
                    onClick={onTaskResolve}>
                    {taskAction.label}
                  </Dropdown.Button>
                </div>
              )}

              {isTaskClosed && (
                <div className="tw-flex" data-testid="task-closed">
                  <UserPopOverCard userName={taskDetail?.task?.closedBy || ''}>
                    <span className="tw-flex">
                      <ProfilePicture
                        displayName={taskDetail?.task?.closedBy}
                        id=""
                        name={taskDetail?.task?.closedBy || ''}
                        width="20"
                      />
                      <span className="tw-font-semibold tw-cursor-pointer hover:tw-underline tw-ml-1">
                        {taskDetail?.task?.closedBy}
                      </span>{' '}
                    </span>
                  </UserPopOverCard>
                  <span className="tw-ml-1"> closed this task </span>
                  <span className="tw-ml-1">
                    {toLower(
                      getDayTimeByTimeStamp(
                        taskDetail?.task?.closedAt as number
                      )
                    )}
                  </span>
                </div>
              )}
            </Card>
            <Modal
              centered
              destroyOnClose
              cancelButtonProps={{
                type: 'link',
                className: 'ant-btn-link-custom',
              }}
              okButtonProps={{
                disabled: !comment,
                className: 'ant-btn-primary-custom',
              }}
              okText="Close with comment"
              title={`Close Task #${taskDetail.task?.id} ${taskDetail.message}`}
              visible={modalVisible}
              width={700}
              onCancel={onModalClose}
              onOk={onTaskReject}>
              <RichTextEditor
                height="208px"
                initialValue={comment}
                placeHolder="Add comment"
                style={{ marginTop: '0px' }}
                onTextChange={setComment}
              />
            </Modal>
          </Content>

          <Sider
            className="ant-layout-sider-task-detail"
            data-testid="task-right-sider"
            width={600}>
            <Tabs className="ant-tabs-custom-line" onChange={onTabChange}>
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
  );
};

export default observer(TaskDetailPage);
