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
import { Button, Col, Dropdown, Form, MenuProps, Row, Space, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import Modal from 'antd/lib/modal/Modal';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import {
    isEmpty,
    isEqual,
    isUndefined,
    last,
    startCase,
    unionBy
} from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as TaskCloseIcon } from '../../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../../assets/svg/ic-open-task.svg';
import { ReactComponent as AddColored } from '../../../../assets/svg/plus-colored.svg';
import {
    DE_ACTIVE_COLOR,
    PAGE_SIZE_MEDIUM
} from '../../../../constants/constants';
import { TaskOperation } from '../../../../constants/Feeds.constants';
import { TASK_TYPES } from '../../../../constants/Task.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { TaskType } from '../../../../generated/api/feed/createThread';
import { ResolveTask } from '../../../../generated/api/feed/resolveTask';
import { CreateTestCaseResolutionStatus } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
    TaskDetails,
    ThreadTaskStatus
} from '../../../../generated/entity/feed/thread';
import { Operation } from '../../../../generated/entity/policies/policy';
import { EntityReference } from '../../../../generated/tests/testCase';
import {
    TestCaseFailureReasonType,
    TestCaseResolutionStatusTypes
} from '../../../../generated/tests/testCaseResolutionStatus';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { useAuth } from '../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
    FieldProp,
    FieldTypes
} from '../../../../interface/FormUtils.interface';
import Assignees from '../../../../pages/TasksPage/shared/Assignees';
import DescriptionTask from '../../../../pages/TasksPage/shared/DescriptionTask';
import TagsTask from '../../../../pages/TasksPage/shared/TagsTask';
import {
    Option,
    TaskAction,
    TaskActionMode
} from '../../../../pages/TasksPage/TasksPage.interface';
import { updateTask, updateThread } from '../../../../rest/feedsAPI';
import { postTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getUsers } from '../../../../rest/userAPI';
import { getNameFromFQN } from '../../../../utils/CommonUtils';
import EntityLink from '../../../../utils/EntityLink';
import { getEntityReferenceListFromEntities } from '../../../../utils/EntityUtils';
import { getEntityFQN } from '../../../../utils/FeedUtils';
import { getField } from '../../../../utils/formUtils';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { getErrorText } from '../../../../utils/StringsUtils';
import {
    fetchOptions,
    generateOptions,
    getTaskDetailPath,
    GLOSSARY_TASK_ACTION_LIST,
    INCIDENT_TASK_ACTION_LIST,
    isDescriptionTask,
    isTagsTask,
    TASK_ACTION_COMMON_ITEM,
    TASK_ACTION_LIST
} from '../../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import ActivityFeedCardV2 from '../../../ActivityFeed/ActivityFeedCardV2/ActivityFeedCardV2';
import ActivityFeedEditor from '../../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { Select, Tooltip } from '../../../common/AntdCompat';
import InlineEdit from '../../../common/InlineEdit/InlineEdit.component';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import EntityPopOverCard from '../../../common/PopOverCard/EntityPopOverCard';
import { EditorContentRef } from '../../../common/RichTextEditor/RichTextEditor.interface';
import TaskTabIncidentManagerHeader from '../TaskTabIncidentManagerHeader/TaskTabIncidentManagerHeader.component';
import './task-tab.less';
import { TaskTabProps } from './TaskTab.interface';
;

export const TaskTab = ({
  taskThread,
  owners = [],
  entityType,
  hasGlossaryReviewer,
  ...rest
}: TaskTabProps) => {
  const editorRef = useRef<EditorContentRef>(null);
  const navigate = useNavigate();
  const [assigneesForm] = useForm();
  const { currentUser } = useApplicationStore();
  const updatedAssignees = Form.useWatch('assignees', assigneesForm);
  const { permissions } = usePermissionProvider();
  const { task: taskDetails } = taskThread;

  const entityFQN = useMemo(
    () => getEntityFQN(taskThread.about) ?? '',
    [taskThread.about]
  );

  const isEntityDetailsAvailable = useMemo(
    () => !isUndefined(entityFQN) && !isUndefined(entityType),
    [entityFQN, entityType]
  );

  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { isAdminUser } = useAuth();
  const {
    postFeed,
    updateEntityThread,
    fetchUpdatedThread,
    updateTestCaseIncidentStatus,
    testCaseResolutionStatus,
  } = useActivityFeedProvider();

  const isTaskDescription = isDescriptionTask(taskDetails?.type as TaskType);

  const isTaskTags = isTagsTask(taskDetails?.type as TaskType);

  const showAddSuggestionButton = useMemo(() => {
    const taskType = taskDetails?.type ?? ('' as TaskType);
    const parsedSuggestion = [
      TaskType.UpdateDescription,
      TaskType.RequestDescription,
    ].includes(taskType)
      ? taskDetails?.suggestion
      : JSON.parse(taskDetails?.suggestion || '[]');

    return (
      [TaskType.RequestTag, TaskType.RequestDescription].includes(taskType) &&
      isEmpty(parsedSuggestion)
    );
  }, [taskDetails]);

  const noSuggestionTaskMenuOptions = useMemo(() => {
    let label;

    if (taskThread.task?.newValue) {
      label = t('label.add-suggestion');
    } else if (isTaskTags) {
      label = t('label.add-entity', {
        entity: t('label.tag-plural'),
      });
    } else {
      label = t('label.add-entity', {
        entity: t('label.description'),
      });
    }

    return [
      {
        label,
        key: TaskActionMode.EDIT,
        icon: AddColored,
      },
      ...TASK_ACTION_COMMON_ITEM,
    ];
  }, [isTaskTags, taskThread.task?.newValue]);

  const isTaskTestCaseResult =
    taskDetails?.type === TaskType.RequestTestCaseFailureResolution;

  const isTaskGlossaryApproval = taskDetails?.type === TaskType.RequestApproval;

  const latestAction = useMemo(() => {
    const resolutionStatus = last(testCaseResolutionStatus);

    if (isTaskTestCaseResult) {
      switch (resolutionStatus?.testCaseResolutionStatusType) {
        case TestCaseResolutionStatusTypes.Assigned:
          return INCIDENT_TASK_ACTION_LIST[1];

        default:
          return INCIDENT_TASK_ACTION_LIST[0];
      }
    } else if (isTaskGlossaryApproval) {
      return GLOSSARY_TASK_ACTION_LIST[0];
    } else if (showAddSuggestionButton) {
      return noSuggestionTaskMenuOptions[0];
    } else {
      return TASK_ACTION_LIST[0];
    }
  }, [
    showAddSuggestionButton,
    testCaseResolutionStatus,
    isTaskGlossaryApproval,
    isTaskTestCaseResult,
    noSuggestionTaskMenuOptions,
  ]);

  const [usersList, setUsersList] = useState<EntityReference[]>([]);
  const [taskAction, setTaskAction] = useState<TaskAction>(latestAction);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const isTaskClosed = isEqual(taskDetails?.status, ThreadTaskStatus.Closed);
  const [showEditTaskModel, setShowEditTaskModel] = useState(false);
  const [comment, setComment] = useState('');
  const [isEditAssignee, setIsEditAssignee] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [isAssigneeLoading, setIsAssigneeLoading] = useState<boolean>(false);
  const { initialAssignees, assigneeOptions } = useMemo(() => {
    const initialAssignees = generateOptions(taskDetails?.assignees ?? []);
    const assigneeOptions = unionBy(
      [...initialAssignees, ...generateOptions(usersList)],
      'value'
    );

    return { initialAssignees, assigneeOptions };
  }, [taskDetails, usersList]);

  const taskColumnName = useMemo(() => {
    const columnName = EntityLink.getTableColumnName(taskThread.about) ?? '';

    if (columnName) {
      return (
        <Typography.Text className="p-r-xss">
          {columnName} {t('label.in-lowercase')}
        </Typography.Text>
      );
    }

    return null;
  }, [taskThread.about]);

  const isOwner = owners?.some((owner) => isEqual(owner.id, currentUser?.id));
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

  const getFormattedMenuOptions = (options: TaskAction[]) => {
    return options.map((item) => ({
      ...item,
      icon: <Icon component={item.icon} style={{ fontSize: '16px' }} />,
    }));
  };

  const handleTaskLinkClick = () => {
    navigate({
      pathname: getTaskDetailPath(taskThread),
    });
  };

  const taskLinkTitleElement = useMemo(
    () =>
      isEntityDetailsAvailable && !isUndefined(taskDetails) ? (
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <Button
            className="p-0 task-feed-message font-medium text-md"
            data-testid="task-title"
            type="link"
            onClick={handleTaskLinkClick}>
            <Typography.Text className="p-0 text-primary">{`#${taskDetails.id} `}</Typography.Text>

            <Typography.Text className="p-xss">
              {TASK_TYPES[taskDetails.type]}
            </Typography.Text>

            {taskColumnName}

            <Typography.Text className="break-all" data-testid="entity-link">
              {getNameFromFQN(entityFQN)}
            </Typography.Text>

            <Typography.Text className="p-l-xss">{`(${entityType})`}</Typography.Text>
          </Button>
        </EntityPopOverCard>
      ) : null,
    [
      isEntityDetailsAvailable,
      entityFQN,
      entityType,
      taskDetails,
      handleTaskLinkClick,
    ]
  );

  const updateTaskData = (data: TaskDetails | ResolveTask) => {
    if (!taskDetails?.id) {
      return;
    }
    updateTask(TaskOperation.RESOLVE, taskDetails?.id + '', data)
      .then(() => {
        showSuccessToast(t('server.task-resolved-successfully'));
        rest.onAfterClose?.();
        rest.onUpdateEntityDetails?.();
      })
      .catch((err: AxiosError) =>
        showErrorToast(getErrorText(err, t('server.unexpected-error')))
      );
  };

  const onGlossaryTaskResolve = (status = 'approved') => {
    const newValue = isTaskGlossaryApproval ? status : taskDetails?.suggestion;
    const data = { newValue: newValue };
    updateTaskData(data as TaskDetails);
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
    testCaseFailureReason,
    testCaseFailureComment,
  }: {
    description: string;
    updatedTags: TagLabel[];
    testCaseFailureReason: TestCaseFailureReasonType;
    testCaseFailureComment: string;
  }) => {
    let data = {} as ResolveTask;
    if (isTaskTags) {
      data = {
        newValue: JSON.stringify(updatedTags) || '[]',
      };
    } else {
      if (isTaskTestCaseResult) {
        data = {
          newValue: testCaseFailureComment,
          testCaseFQN: entityFQN,
          testCaseFailureReason,
        };
      } else {
        data = { newValue: description };
      }
    }

    updateTaskData(data as ResolveTask);
  };

  /**
   *
   * @returns True if has access otherwise false
   */
  const hasEditAccess =
    isAdminUser ||
    isAssignee ||
    (!hasGlossaryReviewer && isOwner) ||
    (Boolean(isPartOfAssigneeTeam) && !isCreator);

  const onSave = () => {
    postFeed(comment, taskThread?.id ?? '')
      .catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      })
      .finally(() => {
        editorRef.current?.clearEditorContent();
      });
  };

  const handleMenuItemClick: MenuProps['onClick'] = (info) => {
    if (info.key === TaskActionMode.EDIT) {
      setShowEditTaskModel(true);
    } else if (info.key === TaskActionMode.CLOSE) {
      onTaskReject();
    } else {
      onTaskResolve();
    }
    setTaskAction(
      [
        ...TASK_ACTION_LIST,
        ...GLOSSARY_TASK_ACTION_LIST,
        ...INCIDENT_TASK_ACTION_LIST,
      ].find((action) => action.key === info.key) ?? TASK_ACTION_LIST[0]
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
        rest.onUpdateEntityDetails?.();
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const onTestCaseIncidentAssigneeUpdate = async () => {
    setIsActionLoading(true);
    const testCaseIncident: CreateTestCaseResolutionStatus = {
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      testCaseReference: entityFQN,
      testCaseResolutionStatusDetails: {
        assignee: {
          id: updatedAssignees[0].value,
          name: updatedAssignees[0].name,
          displayName: updatedAssignees[0].displayName,
          type: updatedAssignees[0].type,
        },
      },
    };
    try {
      const response = await postTestCaseIncidentStatus(testCaseIncident);
      updateTestCaseIncidentStatus([...testCaseResolutionStatus, response]);
      fetchUpdatedThread(taskThread.id).finally(() => {
        setIsEditAssignee(false);
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsActionLoading(false);
    }
  };

  const onTestCaseIncidentResolve = async ({
    testCaseFailureReason,
    testCaseFailureComment,
  }: {
    testCaseFailureReason: TestCaseFailureReasonType;
    testCaseFailureComment: string;
  }) => {
    setIsActionLoading(true);
    const testCaseIncident: CreateTestCaseResolutionStatus = {
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      testCaseReference: entityFQN,
      testCaseResolutionStatusDetails: {
        resolvedBy: {
          id: currentUser?.id ?? '',
          name: currentUser?.name ?? '',
          type: 'user',
        },
        testCaseFailureReason,
        testCaseFailureComment,
      },
    };
    try {
      const response = await postTestCaseIncidentStatus(testCaseIncident);
      updateTestCaseIncidentStatus([...testCaseResolutionStatus, response]);
      rest.onAfterClose?.();
      setShowEditTaskModel(false);
    } catch (error) {
      showErrorToast(
        getErrorText(error as AxiosError, t('server.unexpected-error'))
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTaskMenuClick = (info: MenuInfo) => {
    setTaskAction(
      INCIDENT_TASK_ACTION_LIST.find((action) => action.key === info.key) ??
        INCIDENT_TASK_ACTION_LIST[0]
    );
    switch (info.key) {
      case TaskActionMode.RE_ASSIGN:
        setIsEditAssignee(true);

        break;
      case TaskActionMode.RESOLVE:
        setShowEditTaskModel(true);

        break;
    }
  };

  const onTestCaseTaskDropdownClick = () => {
    if (taskAction.key === TaskActionMode.RESOLVE) {
      setShowEditTaskModel(true);
    } else {
      handleTaskMenuClick({ key: taskAction.key } as MenuInfo);
    }
  };

  const handleGlossaryTaskMenuClick = (info: MenuInfo) => {
    setTaskAction(
      GLOSSARY_TASK_ACTION_LIST.find((action) => action.key === info.key) ??
        GLOSSARY_TASK_ACTION_LIST[0]
    );
    switch (info.key) {
      case TaskActionMode.RESOLVE:
        onTaskResolve();

        break;

      case TaskActionMode.CLOSE:
        onGlossaryTaskResolve('rejected');

        break;
    }
  };

  const handleNoSuggestionMenuItemClick: MenuProps['onClick'] = (info) => {
    if (info.key === TaskActionMode.EDIT) {
      setShowEditTaskModel(true);
    } else {
      onTaskReject();
    }
    setTaskAction(
      noSuggestionTaskMenuOptions.find((action) => action.key === info.key) ??
        noSuggestionTaskMenuOptions[0]
    );
  };

  const onTaskDropdownClick = () => {
    if (taskAction.key === TaskActionMode.RESOLVE) {
      handleMenuItemClick({ key: taskAction.key } as MenuInfo);
    } else {
      onTaskReject();
    }
  };

  const onNoSuggestionTaskDropdownClick = () => {
    if (taskAction.key === TaskActionMode.EDIT) {
      handleNoSuggestionMenuItemClick({ key: taskAction.key } as MenuInfo);
    } else {
      onTaskReject();
    }
  };

  const renderCommentButton = useMemo(() => {
    return (
      <Button
        data-testid="comment-button"
        disabled={isEmpty(comment)}
        type="primary"
        onClick={onSave}>
        {t('label.comment')}
      </Button>
    );
  }, [comment, onSave]);

  const approvalWorkflowActions = useMemo(() => {
    const hasApprovalAccess =
      isAssignee || (Boolean(isPartOfAssigneeTeam) && !isCreator);

    return (
      <Space
        className="m-t-sm items-end w-full justify-end task-cta-buttons"
        data-testid="task-cta-buttons"
        size="small">
        <Tooltip
          title={
            !hasApprovalAccess
              ? t('message.only-reviewers-can-approve-or-reject')
              : ''
          }>
          <Dropdown.Button
            className="task-action-button"
            data-testid="glossary-accept-reject-task-dropdown"
            disabled={!hasApprovalAccess}
            icon={<DownOutlined />}
            menu={{
              items: getFormattedMenuOptions(GLOSSARY_TASK_ACTION_LIST),
              selectable: true,
              selectedKeys: [taskAction.key],
              onClick: handleGlossaryTaskMenuClick,
            }}
            overlayClassName="task-action-dropdown"
            onClick={onTaskDropdownClick}>
            {taskAction.label}
          </Dropdown.Button>
        </Tooltip>

        {renderCommentButton}
      </Space>
    );
  }, [
    taskAction,
    isAssignee,
    isCreator,
    isPartOfAssigneeTeam,
    renderCommentButton,
    handleGlossaryTaskMenuClick,
    onTaskDropdownClick,
  ]);

  const testCaseResultFlow = useMemo(() => {
    const editPermission = checkPermission(
      Operation.EditAll,
      ResourceEntity.TEST_CASE,
      permissions
    );
    const hasApprovalAccess = isAssignee || isCreator || editPermission;

    return (
      <div className="m-t-sm d-flex justify-end items-center gap-4 task-cta-buttons">
        <Dropdown.Button
          className="w-auto task-action-button"
          data-testid="task-cta-buttons"
          icon={<DownOutlined />}
          loading={isActionLoading}
          menu={{
            items: INCIDENT_TASK_ACTION_LIST as ItemType[],
            selectable: true,
            selectedKeys: [taskAction.key],
            onClick: handleTaskMenuClick,
            disabled: !hasApprovalAccess,
          }}
          onClick={onTestCaseTaskDropdownClick}>
          {taskAction.label}
        </Dropdown.Button>
        {renderCommentButton}
      </div>
    );
  }, [
    taskDetails,
    isAssignee,
    isPartOfAssigneeTeam,
    taskAction,
    renderCommentButton,
  ]);

  const actionButtons = useMemo(() => {
    if (isTaskGlossaryApproval) {
      return approvalWorkflowActions;
    }

    if (isTaskTestCaseResult) {
      return testCaseResultFlow;
    }

    return (
      <Space
        className="m-t-sm items-end w-full justify-end task-cta-buttons"
        data-testid="task-cta-buttons"
        size="small">
        {isCreator && !hasEditAccess && (
          <Button data-testid="close-button" onClick={onTaskReject}>
            {t('label.close')}
          </Button>
        )}
        {hasEditAccess && (
          <>
            {showAddSuggestionButton ? (
              <div className="d-flex justify-end gap-2">
                <Dropdown.Button
                  className="task-action-button"
                  data-testid="add-close-task-dropdown"
                  icon={<DownOutlined />}
                  menu={{
                    items: getFormattedMenuOptions(noSuggestionTaskMenuOptions),
                    selectable: true,
                    selectedKeys: [taskAction.key],
                    onClick: handleNoSuggestionMenuItemClick,
                  }}
                  overlayClassName="task-action-dropdown"
                  onClick={onNoSuggestionTaskDropdownClick}>
                  {taskAction.label}
                </Dropdown.Button>
              </div>
            ) : (
              <Dropdown.Button
                className="task-action-button"
                data-testid="edit-accept-task-dropdown"
                icon={<DownOutlined />}
                menu={{
                  items: getFormattedMenuOptions(TASK_ACTION_LIST),
                  selectable: true,
                  selectedKeys: [taskAction.key],
                  onClick: handleMenuItemClick,
                }}
                overlayClassName="task-action-dropdown"
                onClick={() =>
                  handleMenuItemClick({ key: taskAction.key } as MenuInfo)
                }>
                {taskAction.label}
              </Dropdown.Button>
            )}
          </>
        )}
        {renderCommentButton}
      </Space>
    );
  }, [
    onTaskReject,
    taskDetails,
    onTaskResolve,
    handleMenuItemClick,
    taskAction,
    isTaskClosed,
    isTaskGlossaryApproval,
    showAddSuggestionButton,
    isCreator,
    approvalWorkflowActions,
    testCaseResultFlow,
    isTaskTestCaseResult,
    renderCommentButton,
    handleNoSuggestionMenuItemClick,
    onNoSuggestionTaskDropdownClick,
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
    setIsAssigneeLoading(true);
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
      updateEntityThread(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsAssigneeLoading(false);
    }
  };

  const fetchInitialAssign = useCallback(async () => {
    try {
      const { data } = await getUsers({
        limit: PAGE_SIZE_MEDIUM,

        isBot: false,
      });
      const filterData = getEntityReferenceListFromEntities(
        data,
        EntityType.USER
      );
      setUsersList(filterData);
    } catch (error) {
      setUsersList([]);
    }
  }, []);

  useEffect(() => {
    // fetch users only when the task is a test case result and the assignees are getting edited
    if (isTaskTestCaseResult && isEmpty(usersList) && isEditAssignee) {
      fetchInitialAssign();
    }
  }, [isTaskTestCaseResult, usersList, isEditAssignee]);

  useEffect(() => {
    assigneesForm.setFieldValue('assignees', initialAssignees);
    setOptions(assigneeOptions);
  }, [initialAssignees, assigneeOptions]);

  useEffect(() => {
    setTaskAction(latestAction);
  }, [latestAction]);

  const taskHeader = isTaskTestCaseResult ? (
    <TaskTabIncidentManagerHeader thread={taskThread} />
  ) : (
    <div
      className={classNames('d-flex justify-between flex-wrap gap-2', {
        'flex-column': isEditAssignee,
      })}>
      <div className="d-flex gap-2" data-testid="task-assignees">
        {isEditAssignee ? (
          <Form
            className="w-full"
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
                isLoading={isAssigneeLoading}
                onCancel={() => {
                  setIsEditAssignee(false);
                  assigneesForm.setFieldValue('assignees', initialAssignees);
                }}
                onSave={() => assigneesForm.submit()}>
                <Assignees
                  disabled={owners.length > 0}
                  options={options}
                  value={updatedAssignees}
                  onChange={(values) =>
                    assigneesForm.setFieldValue('assignees', values)
                  }
                  onSearch={(query) =>
                    fetchOptions({
                      query,
                      setOptions,
                      currentUserId: currentUser?.id,
                      initialOptions: assigneeOptions,
                    })
                  }
                />
              </InlineEdit>
            </Form.Item>
          </Form>
        ) : (
          <>
            <Typography.Text className="text-grey-muted">
              {t('label.assignee-plural')}:{' '}
            </Typography.Text>
            <OwnerLabel owners={taskDetails?.assignees} />
            {(isCreator || hasEditAccess) &&
            !isTaskClosed &&
            owners.length === 0 ? (
              <Button
                className="flex-center p-0 h-auto"
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
      <div className="d-flex gap-2">
        <Typography.Text className="text-grey-muted">
          {t('label.created-by')}:{' '}
        </Typography.Text>
        <OwnerLabel
          owners={[{ name: taskThread.createdBy, type: 'user', id: '' }]}
        />
      </div>
    </div>
  );

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'testCaseFailureComment',
      required: true,
      label: t('label.comment'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      rules: [
        {
          required: true,
          message: t('label.field-required', {
            field: t('label.comment'),
          }),
        },
      ],
      props: {
        'data-testid': 'description',
        initialValue: '',
        placeHolder: t('message.write-your-text', {
          text: t('label.comment'),
        }),
      },
    }),
    []
  );

  return (
    <Row className="p-y-sm p-x-md" data-testid="task-tab" gutter={[0, 24]}>
      <Col
        className="d-flex items-center task-feed-message-container"
        span={24}>
        <Icon
          className="m-r-xs"
          component={
            taskDetails?.status === ThreadTaskStatus.Open
              ? TaskOpenIcon
              : TaskCloseIcon
          }
          style={{ fontSize: '18px' }}
        />

        {taskLinkTitleElement}
      </Col>
      <Col span={24}>{taskHeader}</Col>
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
            <ActivityFeedCardV2
              isPost
              componentsVisibility={{
                showRepliesContainer: false,
                showThreadIcon: false,
              }}
              feed={taskThread}
              key={reply.id}
              post={reply}
            />
          ))}
        </div>
      </Col>

      <Col span={24}>
        {taskDetails?.status === ThreadTaskStatus.Open && (
          <ActivityFeedEditor
            editAction={actionButtons}
            ref={editorRef}
            onSave={onSave}
            onTextChange={setComment}
          />
        )}
      </Col>
      {isTaskTestCaseResult ? (
        <Modal
          destroyOnClose
          closable={false}
          closeIcon={null}
          maskClosable={false}
          okButtonProps={{
            loading: isActionLoading,
          }}
          okText={t('label.submit')}
          open={showEditTaskModel}
          title={`${t('label.resolve')} ${t('label.task')} #${taskDetails?.id}`}
          width={768}
          onCancel={() => setShowEditTaskModel(false)}
          onOk={form.submit}>
          <Form
            form={form}
            initialValues={initialFormValue}
            layout="vertical"
            onFinish={onTestCaseIncidentResolve}>
            <Form.Item
              label={t('label.reason')}
              name="testCaseFailureReason"
              rules={[
                {
                  required: true,
                  message: t('label.field-required', {
                    field: t('label.reason'),
                  }),
                },
              ]}>
              <Select
                placeholder={t('label.please-select-entity', {
                  entity: t('label.reason'),
                })}>
                {Object.values(TestCaseFailureReasonType).map((value) => (
                  <Select.Option key={value}>{startCase(value)}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            {getField(descriptionField)}
          </Form>
        </Modal>
      ) : (
        <Modal
          destroyOnClose
          closable={false}
          closeIcon={null}
          maskClosable={false}
          open={showEditTaskModel}
          title={`${t('label.edit-entity', {
            entity: t('label.task-lowercase'),
          })} #${taskDetails?.id} ${taskThread.message}`}
          width={768}
          onCancel={() => {
            form.resetFields();
            setShowEditTaskModel(false);
          }}
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
      )}
      {isTaskTestCaseResult && (
        <Modal
          maskClosable
          closable={false}
          closeIcon={null}
          okButtonProps={{
            loading: isActionLoading,
          }}
          okText={t('label.submit')}
          open={isEditAssignee}
          title={`${t('label.re-assign')} ${t('label.task')} #${
            taskDetails?.id
          }`}
          width={768}
          onCancel={() => setIsEditAssignee(false)}
          onOk={assigneesForm.submit}>
          <Form
            form={assigneesForm}
            layout="vertical"
            onFinish={onTestCaseIncidentAssigneeUpdate}>
            <Form.Item
              data-testid="assignee"
              label={`${t('label.assignee')}:`}
              name="assignees"
              rules={[
                {
                  required: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.assignee'),
                  }),
                },
              ]}>
              <Assignees
                isSingleSelect
                options={options}
                value={updatedAssignees}
                onChange={(values) =>
                  assigneesForm.setFieldValue('assignees', values)
                }
                onSearch={(query) =>
                  fetchOptions({
                    query,
                    setOptions,
                    initialOptions: assigneeOptions,
                  })
                }
              />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </Row>
  );
};
