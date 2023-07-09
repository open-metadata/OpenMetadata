/*
 *  Copyright 2023 Collate.
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
import Icon from '@ant-design/icons';
import {
  Button,
  Col,
  Dropdown,
  Form,
  MenuProps,
  Row,
  Space,
  Typography,
} from 'antd';
import Modal from 'antd/lib/modal/Modal';
import AppState from 'AppState';
import { AxiosError } from 'axios';
import ActivityFeedCardV1 from 'components/ActivityFeed/ActivityFeedCard/ActivityFeedCardV1';
import ActivityFeedEditor from 'components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import { useActivityFeedProvider } from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import EntityPopOverCard from 'components/common/PopOverCard/EntityPopOverCard';
import { TaskOperation } from 'constants/Feeds.constants';
import { TaskType } from 'generated/api/feed/createThread';
import { TaskDetails, ThreadTaskStatus } from 'generated/entity/feed/thread';
import { TagLabel } from 'generated/type/tagLabel';
import { useAuth } from 'hooks/authHooks';
import { isEmpty, isEqual, isUndefined, noop } from 'lodash';
import DescriptionTask from 'pages/TasksPage/shared/DescriptionTask';
import TagsTask from 'pages/TasksPage/shared/TagsTask';
import {
  TaskAction,
  TaskActionMode,
} from 'pages/TasksPage/TasksPage.interface';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { updateTask } from 'rest/feedsAPI';
import { getNameFromFQN } from 'utils/CommonUtils';
import { getEntityFQN, prepareFeedLink } from 'utils/FeedUtils';
import { getEntityLink } from 'utils/TableUtils';
import {
  isDescriptionTask,
  isTagsTask,
  TASK_ACTION_LIST,
} from 'utils/TasksUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';
import { TaskTabProps } from './TaskTab.interface';
import { ReactComponent as TaskCloseIcon } from '/assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '/assets/svg/ic-open-task.svg';

export const TaskTab = ({
  taskThread,
  owner,
  entityType,
  ...rest
}: TaskTabProps) => {
  const { task: taskDetails } = taskThread;
  const entityFQN = getEntityFQN(taskThread.about) ?? '';
  const entityCheck = !isUndefined(entityFQN) && !isUndefined(entityType);
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const { postFeed } = useActivityFeedProvider();
  const [taskAction, setTaskAction] = useState<TaskAction>(TASK_ACTION_LIST[0]);

  const isTaskClosed = isEqual(taskDetails?.status, ThreadTaskStatus.Closed);
  const [showEditTaskModel, setShowEditTaskModel] = useState(false);
  const [comment, setComment] = useState('');

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const isOwner = isEqual(owner?.id, currentUser?.id);
  const isCreator = isEqual(taskThread.createdBy, currentUser?.name);

  const checkIfUserPartOfTeam = useCallback(
    (teamId: string): boolean => {
      return Boolean(currentUser?.teams?.find((team) => teamId === team.id));
    },
    [currentUser]
  );

  const isAssignee = taskDetails?.assignees?.some((assignee) =>
    isEqual(assignee.id, currentUser?.id)
  );

  const isPartOfAssigneeTeam = taskDetails?.assignees?.some((assignee) =>
    assignee.type === 'team' ? checkIfUserPartOfTeam(assignee.id) : false
  );

  const isTaskDescription = isDescriptionTask(taskDetails?.type as TaskType);

  const isTaskTags = isTagsTask(taskDetails?.type as TaskType);

  const getTaskLinkElement = entityCheck && (
    <Typography.Text className="font-medium text-md">
      <span>{`#${taskDetails?.id} `}</span>

      <Typography.Text>{taskDetails?.type}</Typography.Text>
      <span className="m-x-xss">{t('label.for-lowercase')}</span>
      <>
        <span className="p-r-xss">{entityType}</span>
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <Link
            className="break-all"
            data-testid="entitylink"
            to={prepareFeedLink(entityType, entityFQN)}
            onClick={(e) => e.stopPropagation()}>
            {getNameFromFQN(entityFQN)}
          </Link>
        </EntityPopOverCard>
      </>
    </Typography.Text>
  );

  const updateTaskData = (data: TaskDetails) => {
    if (!taskDetails?.id) {
      return;
    }
    updateTask(TaskOperation.RESOLVE, taskDetails?.id + '', data)
      .then(() => {
        showSuccessToast(t('server.task-resolved-successfully'));
        rest.onUpdateEntityDetails?.();
        history.push(getEntityLink(entityType ?? '', entityFQN ?? ''));
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const onTaskResolve = () => {
    if (isEmpty(taskDetails?.suggestion)) {
      showErrorToast(
        t('message.field-text-is-required', {
          fieldText: isTaskTags
            ? t('label.tag-plural')
            : t('label.description'),
        })
      );

      return;
    }
    if (isTaskTags) {
      const tagsData = {
        newValue: taskDetails?.suggestion || '[]',
      };

      updateTaskData(tagsData as TaskDetails);
    } else {
      const data = { newValue: taskDetails?.suggestion };
      updateTaskData(data as TaskDetails);
    }
  };

  const onEditAndSuggest = ({
    description,
    updatedTags,
  }: {
    description: string;
    updatedTags: TagLabel[];
  }) => {
    if (isTaskTags) {
      const tagsData = {
        newValue: JSON.stringify(updatedTags) || '[]',
      };

      updateTaskData(tagsData as TaskDetails);
    } else {
      const data = { newValue: description };
      updateTaskData(data as TaskDetails);
    }
  };

  /**
   *
   * @returns True if has access otherwise false
   */
  const hasEditAccess = () => isAdminUser || isAssignee || isOwner;

  const hasTaskUpdateAccess = () => hasEditAccess() || isPartOfAssigneeTeam;

  const onSave = (message: string) => {
    postFeed(message, taskThread?.id ?? '').catch(() => {
      // ignore since error is displayed in toast in the parent promise.
      // Added block for sonar code smell
    });
  };

  const handleMenuItemClick: MenuProps['onClick'] = (info) => {
    if (info.key === TaskActionMode.EDIT) {
      setShowEditTaskModel(true);
    } else {
      onTaskResolve();
    }
    setTaskAction(
      TASK_ACTION_LIST.find((action) => action.key === info.key) ??
        TASK_ACTION_LIST[0]
    );
  };

  const onTaskReject = () => {
    if (comment && taskDetails?.id) {
      updateTask(TaskOperation.REJECT, taskDetails?.id + '', {
        comment,
      } as unknown as TaskDetails)
        .then(() => {
          showSuccessToast(t('server.task-closed-successfully'));
        })
        .catch((err: AxiosError) => showErrorToast(err));
    } else {
      showErrorToast(t('server.task-closed-without-comment'));
    }
  };

  const actionButtons = useMemo(() => {
    if (isTaskClosed) {
      return null;
    }

    const parsedSuggestion = [
      'RequestDescription',
      'UpdateDescription',
    ].includes(taskDetails?.type ?? '')
      ? taskDetails?.suggestion
      : JSON.parse(taskDetails?.suggestion || '[]');

    return (
      <Space
        className="m-t-sm items-end w-full"
        data-testid="task-cta-buttons"
        size="small">
        {(isCreator || hasTaskUpdateAccess()) && (
          <Button onClick={onTaskReject}>{t('label.close')}</Button>
        )}
        {hasTaskUpdateAccess() ? (
          <>
            {['RequestDescription', 'RequestTag'].includes(
              taskDetails?.type ?? ''
            ) && isEmpty(parsedSuggestion) ? (
              <Button
                type="primary"
                onClick={() =>
                  handleMenuItemClick({ key: TaskActionMode.EDIT } as MenuInfo)
                }>
                {t('label.add-suggestion')}
              </Button>
            ) : (
              <Dropdown.Button
                menu={{
                  items: TASK_ACTION_LIST,
                  selectable: true,
                  selectedKeys: [taskAction.key],
                  onClick: handleMenuItemClick,
                }}
                type="primary"
                onClick={() =>
                  taskAction.key === TaskActionMode.EDIT
                    ? handleMenuItemClick({ key: taskAction.key } as MenuInfo)
                    : onTaskResolve()
                }>
                {taskAction.label}
              </Dropdown.Button>
            )}
          </>
        ) : (
          <></>
        )}
      </Space>
    );
  }, [
    taskDetails,
    onTaskResolve,
    handleMenuItemClick,
    taskAction,
    isTaskClosed,
    isCreator,
  ]);

  const initialFormValue = useMemo(() => {
    if (isTaskDescription) {
      const description =
        taskDetails?.suggestion ?? taskDetails?.oldValue ?? '';

      return { description };
    } else {
      const updatedTags = JSON.parse(
        taskDetails?.suggestion ?? taskDetails?.oldValue ?? '[]'
      );

      return { updatedTags };
    }
  }, [taskDetails, isTaskDescription]);

  return (
    <Row className="p-y-sm p-x-md" gutter={[0, 24]}>
      <Col className="d-flex items-center" span={24}>
        <Icon
          className="m-r-xs"
          component={
            taskDetails?.status === ThreadTaskStatus.Open
              ? TaskOpenIcon
              : TaskCloseIcon
          }
          style={{ fontSize: '18px' }}
        />

        {getTaskLinkElement}
      </Col>
      <Col span={24}>
        <div className="d-flex justify-between">
          <div className="flex-center gap-2">
            <Typography.Text className="text-grey-muted">
              {t('label.assignee-plural')}:{' '}
            </Typography.Text>

            <OwnerLabel
              hasPermission={false}
              owner={taskDetails?.assignees[0]}
              onUpdate={noop}
            />
          </div>
          <div className="flex-center gap-2">
            <Typography.Text className="text-grey-muted">
              {t('label.created-by')}:{' '}
            </Typography.Text>
            <OwnerLabel
              hasPermission={false}
              owner={{ name: taskThread.createdBy, type: 'user', id: '' }}
              onUpdate={noop}
            />
          </div>
        </div>
      </Col>
      <Col span={24}>
        {isTaskDescription && (
          <DescriptionTask
            hasEditAccess={hasEditAccess()}
            isTaskActionEdit={false}
            taskThread={taskThread}
            onChange={(value) => form.setFieldValue('description', value)}
          />
        )}

        {isTaskTags && (
          <TagsTask
            hasEditAccess={hasEditAccess()}
            isTaskActionEdit={false}
            task={taskDetails}
            onChange={(value) => form.setFieldValue('updatedTags', value)}
          />
        )}

        <div className="m-l-lg">
          {taskThread?.posts?.map((reply) => (
            <ActivityFeedCardV1
              isPost
              feed={taskThread}
              hidePopover={false}
              key={reply.id}
              post={reply}
            />
          ))}
        </div>
        {taskDetails?.status === ThreadTaskStatus.Open && (
          <ActivityFeedEditor onSave={onSave} onTextChange={setComment} />
        )}

        {actionButtons}
      </Col>
      <Modal
        maskClosable
        closable={false}
        closeIcon={null}
        open={showEditTaskModel}
        title={`${t('label.edit-entity', {
          entity: t('label.task-lowercase'),
        })} #${taskDetails?.id} ${taskThread.message}`}
        width={768}
        onCancel={() => setShowEditTaskModel(false)}
        onOk={form.submit}>
        <Form
          form={form}
          initialValues={initialFormValue}
          layout="vertical"
          onFinish={onEditAndSuggest}>
          {isTaskTags ? (
            <Form.Item
              data-testid="tags-label"
              label={t('label.tag-plural')}
              name="updatedTags"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.tag-plural'),
                  }),
                },
              ]}
              trigger="onChange">
              <TagsTask
                isTaskActionEdit
                hasEditAccess={hasEditAccess()}
                task={taskDetails}
                onChange={(value) => form.setFieldValue('updatedTags', value)}
              />
            </Form.Item>
          ) : (
            <Form.Item
              data-testid="tags-label"
              label={t('label.description')}
              name="description"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.description'),
                  }),
                },
              ]}
              trigger="onTextChange">
              <DescriptionTask
                isTaskActionEdit
                hasEditAccess={hasEditAccess()}
                taskThread={taskThread}
                onChange={(value) => form.setFieldValue('description', value)}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Row>
  );
};
