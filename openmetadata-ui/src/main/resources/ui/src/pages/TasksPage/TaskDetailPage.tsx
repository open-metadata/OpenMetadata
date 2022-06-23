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

import { Button, Card, Layout, Tabs } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import { isEmpty, isEqual, isUndefined, toLower } from 'lodash';
import { observer } from 'mobx-react';
import { EditorContentRef, EntityTags } from 'Models';
import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppState from '../../AppState';
import {
  getFeedById,
  getTask,
  postFeedById,
  postThread,
} from '../../axiosAPIs/feedsAPI';
import ActivityFeedEditor from '../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import FeedPanelBody from '../../components/ActivityFeed/ActivityFeedPanel/FeedPanelBody';
import ActivityThreadPanelBody from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanelBody';
import Ellipses from '../../components/common/Ellipses/Ellipses';
import ProfilePicture from '../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityType } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Column } from '../../generated/entity/data/table';
import { Thread, ThreadTaskStatus } from '../../generated/entity/feed/thread';
import { getEntityName } from '../../utils/CommonUtils';
import { ENTITY_LINK_SEPARATOR } from '../../utils/EntityUtils';
import {
  deletePost,
  getEntityField,
  getEntityFQN,
  getEntityType,
  updateThreadData,
} from '../../utils/FeedUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import {
  fetchEntityDetail,
  fetchOptions,
  getBreadCrumbList,
  getColumnObject,
} from '../../utils/TasksUtils';
import { getDayTimeByTimeStamp } from '../../utils/TimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Assignees from './Assignees';
import { DescriptionTabs } from './DescriptionTabs';
import { background, cardStyles, contentStyles } from './TaskPage.styles';
import { EntityData, Option } from './TasksPage.interface';

const TaskDetailPage = () => {
  const { Content, Sider } = Layout;
  const { TabPane } = Tabs;

  const { taskId } = useParams<{ [key: string]: string }>();

  const markdownRef = useRef<EditorContentRef>();

  const [taskDetail, setTaskDetail] = useState<Thread>({} as Thread);
  const [taskFeedDetail, setTaskFeedDetail] = useState<Thread>({} as Thread);
  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignees, setAssignees] = useState<Array<Option>>([]);
  const [showEdit, setShowEdit] = useState<boolean>(false);

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
      .catch((err: AxiosError) => showErrorToast(err));
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

  const onPostReply = (value: string) => {
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
        setAssignees(
          taskAssignees.map((assignee) => ({
            label: assignee.name as string,
            value: assignee.id,
            type: assignee.type as string,
          }))
        );
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
            'tw-inline-block tw-w-2 tw-h-2 tw-rounded-full',
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
      <div data-testid="column-details">
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

  const TaskDetail = () => {
    return (
      <Card key="task-details" style={{ ...cardStyles, marginTop: '16px' }}>
        <h6 className="tw-text-base" data-testid="task-title">
          {`Task #${taskId}`} {taskDetail.message}
        </h6>
        <p data-testid="task-metadata">
          <TaskStatusElement
            status={taskDetail.task?.status as ThreadTaskStatus}
          />
          <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">|</span>
          <span>
            <span className="tw-font-semibold tw-cursor-pointer hover:tw-underline">
              {taskDetail.createdBy}
            </span>{' '}
            created this task{' '}
            {toLower(getDayTimeByTimeStamp(taskDetail.threadTs as number))}
          </span>
        </p>

        <ColumnDetail column={columnObject} />

        <div className="tw-flex" data-testid="task-assignees">
          <span className="tw-text-grey-muted tw-self-center tw-mr-1">
            Assignees:
          </span>{' '}
          <Assignees
            assignees={assignees}
            options={options}
            onChange={setAssignees}
            onSearch={onSearch}
          />
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
                  {taskDetail.task?.suggestion?.trim() ? (
                    <RichTextEditorPreviewer
                      className="tw-p-2"
                      enableSeeMoreVariant={false}
                      markdown={taskDetail.task.suggestion}
                    />
                  ) : (
                    <span className="tw-no-description tw-p-2">
                      No description{' '}
                    </span>
                  )}
                  <button
                    className="focus:tw-outline-none tw-self-baseline tw-p-2 tw-pl-0"
                    data-testid="edit-suggestion"
                    onClick={() => setShowEdit(true)}>
                    <SVGIcons
                      alt="edit"
                      icon="icon-edit"
                      title="Edit"
                      width="14px"
                    />
                  </button>
                </div>
              )}
            </Fragment>
          )}
        </div>

        <div className="tw-flex tw-justify-end" data-testid="task-cta-buttons">
          <Button
            className="ant-btn-link-custom"
            type="link"
            onClick={() => setShowEdit(false)}>
            {showEdit ? 'Cancel' : 'Reject'}
          </Button>
          <Button className="ant-btn-primary-custom" type="primary">
            {showEdit ? 'Submit' : 'Accept'}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <Layout style={{ ...background, height: '100vh' }}>
      <Content style={{ ...contentStyles, overflowY: 'auto' }}>
        <TitleBreadcrumb
          titleLinks={getBreadCrumbList(entityData, entityType as EntityType)}
        />
        <EntityDetail />
        <TaskDetail />
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
                  updateThreadHandler={updateThreadHandler}
                />
                <ActivityFeedEditor
                  buttonClass="tw-mr-4"
                  className="tw-ml-5 tw-mr-2 tw-mb-2"
                  onSave={onPostReply}
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
    </Layout>
  );
};

export default observer(TaskDetailPage);
