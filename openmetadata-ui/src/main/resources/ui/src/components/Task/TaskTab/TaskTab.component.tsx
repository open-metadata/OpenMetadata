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
import Icon, { DownOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Dropdown,
  Form,
  MenuProps,
  Row,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import Modal from 'antd/lib/modal/Modal';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty, isEqual, isUndefined, noop } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppState from '../../../AppState';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import ActivityFeedCardV1 from '../../../components/ActivityFeed/ActivityFeedCard/ActivityFeedCardV1';
import ActivityFeedEditor from '../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import { useActivityFeedProvider } from '../../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import AssigneeList from '../../../components/common/AssigneeList/AssigneeList';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import InlineEdit from '../../../components/InlineEdit/InlineEdit.component';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TaskOperation } from '../../../constants/Feeds.constants';
import { TaskType } from '../../../generated/api/feed/createThread';
import {
  TaskDetails,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useAuth } from '../../../hooks/authHooks';
import Assignees from '../../../pages/TasksPage/shared/Assignees';
import DescriptionTask from '../../../pages/TasksPage/shared/DescriptionTask';
import TagsTask from '../../../pages/TasksPage/shared/TagsTask';
import {
  Option,
  TaskAction,
  TaskActionMode,
} from '../../../pages/TasksPage/TasksPage.interface';
import { updateTask, updateThread } from '../../../rest/feedsAPI';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityFQN } from '../../../utils/FeedUtils';
import {
  fetchOptions,
  isDescriptionTask,
  isTagsTask,
  TASK_ACTION_LIST,
} from '../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import './task-tab.less';
import { TaskTabProps } from './TaskTab.interface';

export const TaskTab = ({
  taskThread,
  owner,
  entityType,
  ...rest
}: TaskTabProps) => {
  const [assigneesForm] = useForm();
  const updatedAssignees = Form.useWatch('assignees', assigneesForm);

  const { task: taskDetails } = taskThread;
  const entityFQN = getEntityFQN(taskThread.about) ?? '';
  const entityCheck = !isUndefined(entityFQN) && !isUndefined(entityType);
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { isAdminUser } = useAuth();
  const { postFeed, setActiveThread } = useActivityFeedProvider();
  const [taskAction, setTaskAction] = useState<TaskAction>(TASK_ACTION_LIST[0]);

  const isTaskClosed = isEqual(taskDetails?.status, ThreadTaskStatus.Closed);
  const [showEditTaskModel, setShowEditTaskModel] = useState(false);
  const [comment, setComment] = useState('');
  const [isEditAssignee, setIsEditAssignee] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);

  const initialAssignees = useMemo(
    () =>
      taskDetails?.assignees.map((assignee) => ({
        label: getEntityName(assignee),
        value: assignee.id || '',
        type: assignee.type,
      })) ?? [],
    [taskDetails]
  );

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const taskField = useMemo(() => {
    const entityField = EntityLink.getEntityField(taskThread.about) ?? '';
    const columnName = EntityLink.getTableColumnName(taskThread.about) ?? '';

    if (columnName) {
      return `${entityField}/${columnName}`;
    }

    return entityField;
  }, [taskThread]);

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

  const isTaskGlossaryApproval = taskDetails?.type === TaskType.RequestApproval;

  const getTaskLinkElement = entityCheck && (
    <Typography.Text className="font-medium text-md" data-testid="task-title">
      <span>{`#${taskDetails?.id} `}</span>

      <Typography.Text>{taskDetails?.type}</Typography.Text>
      <span className="m-x-xss">{t('label.for-lowercase')}</span>

      {!isEmpty(taskField) ? <span>{taskField}</span> : null}
    </Typography.Text>
  );

  const updateTaskData = (data: TaskDetails) => {
    if (!taskDetails?.id) {
      return;
    }
    updateTask(TaskOperation.RESOLVE, taskDetails?.id + '', data)
      .then(() => {
        showSuccessToast(t('server.task-resolved-successfully'));
        rest.onAfterClose?.();
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const onTaskResolve = () => {
    if (!isTaskGlossaryApproval && isEmpty(taskDetails?.suggestion)) {
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
      const newValue = isTaskGlossaryApproval
        ? 'approved'
        : taskDetails?.suggestion;
      const data = { newValue: newValue };
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
  const hasEditAccess =
    isAdminUser || isAssignee || isOwner || Boolean(isPartOfAssigneeTeam);

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
    if (!isTaskGlossaryApproval && isEmpty(comment)) {
      showErrorToast(t('server.task-closed-without-comment'));

      return;
    }

    const updatedComment = isTaskGlossaryApproval ? 'Rejected' : comment;
    updateTask(TaskOperation.REJECT, taskDetails?.id + '', {
      comment: updatedComment,
    } as unknown as TaskDetails)
      .then(() => {
        showSuccessToast(t('server.task-closed-successfully'));
        rest.onAfterClose?.();
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const approvalWorkflowActions = useMemo(() => {
    const hasApprovalAccess = isAssignee || Boolean(isPartOfAssigneeTeam);

    return (
      <Space
        className="m-t-sm items-end w-full"
        data-testid="task-cta-buttons"
        size="small">
        <Tooltip
          title={
            !hasApprovalAccess
              ? t('message.only-reviewers-can-accept-or-reject')
              : ''
          }>
          <Button
            data-testid="reject-task"
            disabled={!hasApprovalAccess}
            onClick={onTaskReject}>
            {t('label.reject')}
          </Button>
        </Tooltip>

        <Tooltip
          title={
            !hasApprovalAccess
              ? t('message.only-reviewers-can-accept-or-reject')
              : ''
          }>
          <Button
            data-testid="approve-task"
            disabled={!hasApprovalAccess}
            type="primary"
            onClick={onTaskResolve}>
            {t('label.approve')}
          </Button>
        </Tooltip>
      </Space>
    );
  }, [taskDetails, onTaskResolve, isAssignee, isPartOfAssigneeTeam]);

  const actionButtons = useMemo(() => {
    if (isTaskClosed) {
      return null;
    }

    const taskType = taskDetails?.type ?? '';

    if (isTaskGlossaryApproval) {
      return approvalWorkflowActions;
    }

    const parsedSuggestion = [
      'RequestDescription',
      'UpdateDescription',
    ].includes(taskType)
      ? taskDetails?.suggestion
      : JSON.parse(taskDetails?.suggestion || '[]');

    return (
      <Space
        className="m-t-sm items-end w-full"
        data-testid="task-cta-buttons"
        size="small">
        {(isCreator || hasEditAccess) && (
          <Button onClick={onTaskReject}>{t('label.close')}</Button>
        )}
        {hasEditAccess ? (
          <>
            {['RequestDescription', 'RequestTag'].includes(taskType) &&
            isEmpty(parsedSuggestion) ? (
              <Button
                type="primary"
                onClick={() =>
                  handleMenuItemClick({ key: TaskActionMode.EDIT } as MenuInfo)
                }>
                {t('label.add-suggestion')}
              </Button>
            ) : (
              <Dropdown.Button
                icon={<DownOutlined />}
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
    isTaskGlossaryApproval,
    isCreator,
    approvalWorkflowActions,
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

  const handleAssigneeUpdate = async () => {
    const updatedTaskThread = {
      ...taskThread,
      task: {
        ...taskThread.task,
        assignees: updatedAssignees.map((assignee: Option) => ({
          id: assignee.value,
          type: assignee.type,
        })),
      },
    };
    try {
      const patch = compare(taskThread, updatedTaskThread);
      const data = await updateThread(taskThread.id, patch);
      setIsEditAssignee(false);
      setActiveThread(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    assigneesForm.setFieldValue('assignees', initialAssignees);
    setOptions(initialAssignees);
  }, [initialAssignees]);

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
        <div
          className={classNames('d-flex justify-between', {
            'flex-column': isEditAssignee,
          })}>
          <div
            className={classNames('gap-2', { 'flex-center': !isEditAssignee })}>
            {isEditAssignee ? (
              <Form
                form={assigneesForm}
                layout="vertical"
                onFinish={handleAssigneeUpdate}>
                <Form.Item
                  data-testid="assignees"
                  label={`${t('label.assignee-plural')}:`}
                  name="assignees"
                  rules={[
                    {
                      required: true,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.assignee-plural'),
                      }),
                    },
                  ]}>
                  <InlineEdit
                    className="assignees-edit-input"
                    direction="horizontal"
                    onCancel={() => {
                      setIsEditAssignee(false);
                      assigneesForm.setFieldValue(
                        'assignees',
                        initialAssignees
                      );
                    }}
                    onSave={() => assigneesForm.submit()}>
                    <Assignees
                      options={options}
                      value={updatedAssignees}
                      onChange={(values) =>
                        assigneesForm.setFieldValue('assignees', values)
                      }
                      onSearch={(query) => fetchOptions(query, setOptions)}
                    />
                  </InlineEdit>
                </Form.Item>
              </Form>
            ) : (
              <>
                <Typography.Text className="text-grey-muted">
                  {t('label.assignee-plural')}:{' '}
                </Typography.Text>
                <AssigneeList
                  assignees={taskDetails?.assignees ?? []}
                  className="d-flex gap-1"
                  profilePicType="circle"
                  profileWidth="24"
                  showUserName={false}
                />
                {(isCreator || hasEditAccess) && !isTaskClosed ? (
                  <Button
                    className="flex-center p-0"
                    data-testid="edit-assignees"
                    icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                    size="small"
                    type="text"
                    onClick={() => setIsEditAssignee(true)}
                  />
                ) : null}
              </>
            )}
          </div>
          <div
            className={classNames('gap-2', { 'flex-center': !isEditAssignee })}>
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
            hasEditAccess={hasEditAccess}
            isTaskActionEdit={false}
            taskThread={taskThread}
            onChange={(value) => form.setFieldValue('description', value)}
          />
        )}

        {isTaskTags && (
          <TagsTask
            hasEditAccess={hasEditAccess}
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
                hasEditAccess={hasEditAccess}
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
                hasEditAccess={hasEditAccess}
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
