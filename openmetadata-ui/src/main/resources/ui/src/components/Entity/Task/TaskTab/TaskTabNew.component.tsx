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
  Divider,
  Dropdown,
  Form,
  Input,
  MenuProps,
  Row,
  Select,
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import Modal from 'antd/lib/modal/Modal';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  isEmpty,
  isEqual,
  isUndefined,
  last,
  orderBy,
  startCase,
  unionBy,
} from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as AssigneesIcon } from '../../../../assets/svg/ic-assignees.svg';
import { ReactComponent as TaskCloseIcon } from '../../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../../assets/svg/ic-open-task.svg';
import { ReactComponent as UserIcon } from '../../../../assets/svg/ic-user-profile.svg';
import { ReactComponent as AddColored } from '../../../../assets/svg/plus-colored.svg';
import { PAGE_SIZE_MEDIUM } from '../../../../constants/constants';
import { TASK_ENTITY_TYPES } from '../../../../constants/Task.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { CreateTestCaseResolutionStatus } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  TestCaseFailureReasonType,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { useAuth } from '../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  FieldProp,
  FieldTypes,
} from '../../../../interface/FormUtils.interface';
import Assignees from '../../../../pages/TasksPage/shared/Assignees';
import DescriptionTaskFromTask from '../../../../pages/TasksPage/shared/DescriptionTaskFromTask';
import FeedbackApprovalTask from '../../../../pages/TasksPage/shared/FeedbackApprovalTask';
import TagsTaskFromTask from '../../../../pages/TasksPage/shared/TagsTaskFromTask';
import {
  Option,
  TaskAction,
  TaskActionMode,
} from '../../../../pages/TasksPage/TasksPage.interface';
import { postTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import {
  closeTask as closeTaskAPI,
  patchTask,
  resolveTask as resolveTaskAPI,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from '../../../../rest/tasksAPI';
import { getNameFromFQN } from '../../../../utils/CommonUtils';
import EntityLink from '../../../../utils/EntityLink';
import { getField } from '../../../../utils/formUtils';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { getErrorText } from '../../../../utils/StringsUtils';
import {
  fetchOptions,
  generateOptions,
  getTaskDetailPathFromTask,
  GLOSSARY_TASK_ACTION_LIST,
  INCIDENT_TASK_ACTION_LIST,
  isDescriptionTaskType,
  isTagsTaskType,
  TASK_ACTION_COMMON_ITEM,
  TASK_ACTION_LIST,
} from '../../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import TaskCommentCard from '../../../ActivityFeed/ActivityFeedCardNew/TaskCommentCard.component';
import ActivityFeedEditorNew from '../../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import InlineEdit from '../../../common/InlineEdit/InlineEdit.component';

import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/tests/testCase';
import { getUsers } from '../../../../rest/userAPI';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../../utils/EntityUtils';
import { getUserPath } from '../../../../utils/RouterUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import EntityPopOverCard from '../../../common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import { EditorContentRef } from '../../../common/RichTextEditor/RichTextEditor.interface';
import TaskTabIncidentManagerHeaderNewFromTask from '../TaskTabIncidentManagerHeader/TasktabIncidentManagerHeaderNewFromTask';
import './task-tab-new.less';
import { TaskTabProps } from './TaskTab.interface';

export const TaskTabNew = ({
  task,
  owners = [],
  entityType,
  hasGlossaryReviewer,
  ...rest
}: TaskTabProps) => {
  const editorRef = useRef<EditorContentRef>();
  const navigate = useNavigate();
  const [assigneesForm] = useForm();
  const { currentUser } = useApplicationStore();
  const updatedAssignees = Form.useWatch('assignees', assigneesForm);
  const { permissions } = usePermissionProvider();

  const entityFQN = useMemo(
    () => task.about?.fullyQualifiedName ?? '',
    [task.about]
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
    updateTask,
    fetchUpdatedThread,
    updateTestCaseIncidentStatus,
    testCaseResolutionStatus,
    isPostsLoading,
  } = useActivityFeedProvider();

  // Access payload without strict type assertion to allow dynamic property access
  const payload = task.payload;

  const isTaskDescription = isDescriptionTaskType(task.type);

  const isTaskTags = isTagsTaskType(task.type);

  // Compute suggestedValue from new payload format (tagsToAdd, currentTags) or use old format
  const computedSuggestedValue = useMemo(() => {
    if (!isTaskTags) {
      return payload?.suggestedValue as string | undefined;
    }
    // For tags: support new format (tagsToAdd, currentTags, tagsToRemove)
    // Check if new format properties exist (same logic as TagsTaskFromTask)
    if (payload?.tagsToAdd || payload?.tagsToRemove || payload?.currentTags) {
      const tagsToAdd = (payload.tagsToAdd as TagLabel[]) ?? [];
      const tagsToRemove = (payload.tagsToRemove as TagLabel[]) ?? [];
      const currentTags = (payload.currentTags as TagLabel[]) ?? [];

      const removeFQNs = new Set(tagsToRemove.map((t) => t.tagFQN));
      // Suggested = current - removed + added
      const result = currentTags.filter((t) => !removeFQNs.has(t.tagFQN));
      const suggestedTags = [...result, ...tagsToAdd];

      return suggestedTags.length > 0
        ? JSON.stringify(suggestedTags)
        : undefined;
    }

    // Fallback to old format
    return payload?.suggestedValue as string | undefined;
  }, [payload, isTaskTags]);

  const showAddSuggestionButton = useMemo(() => {
    const taskType = task.type;
    const parsedSuggestion = [TaskEntityType.DescriptionUpdate].includes(
      taskType
    )
      ? computedSuggestedValue
      : JSON.parse(computedSuggestedValue || '[]');

    return (
      [TaskEntityType.TagUpdate, TaskEntityType.DescriptionUpdate].includes(
        taskType
      ) && isEmpty(parsedSuggestion)
    );
  }, [task.type, computedSuggestedValue]);

  const noSuggestionTaskMenuOptions = useMemo(() => {
    let label;

    if (computedSuggestedValue) {
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
  }, [isTaskTags, computedSuggestedValue]);

  const isTaskTestCaseResult = task.type === TaskEntityType.TestCaseResolution;

  const isTaskGlossaryApproval = task.type === TaskEntityType.GlossaryApproval;

  const isTaskRecognizerFeedbackApproval =
    task?.type === ('RecognizerFeedbackApproval' as TaskEntityType);

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
  const isTaskClosed =
    isEqual(task.status, TaskEntityStatus.Completed) ||
    isEqual(task.status, TaskEntityStatus.Cancelled) ||
    isEqual(task.status, TaskEntityStatus.Rejected);
  const [showEditTaskModel, setShowEditTaskModel] = useState(false);
  const [comment, setComment] = useState('');
  const [isEditAssignee, setIsEditAssignee] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const [isAssigneeLoading, setIsAssigneeLoading] = useState<boolean>(false);
  const { initialAssignees, assigneeOptions } = useMemo(() => {
    const initialAssignees = generateOptions(task.assignees ?? []);
    const assigneeOptions = unionBy(
      [...initialAssignees, ...generateOptions(usersList)],
      'value'
    );

    return { initialAssignees, assigneeOptions };
  }, [task.assignees, usersList]);

  const taskColumnName = useMemo(() => {
    // Support both old format (field) and new format (fieldPath)
    const fieldValue = (payload?.field ?? payload?.fieldPath) as
      | string
      | undefined;
    const columnName = fieldValue
      ? EntityLink.getTableColumnName(
          `<#E::${task.about?.type}::${task.about?.fullyQualifiedName}::${fieldValue}>`
        ) ?? ''
      : '';

    if (columnName) {
      return (
        <Typography.Text className="p-r-xss">
          {columnName} {t('label.in-lowercase')}
        </Typography.Text>
      );
    }

    return null;
  }, [task.about, payload]);

  const isOwner = owners?.some((owner) => isEqual(owner.id, currentUser?.id));
  const isCreator = isEqual(task.createdBy?.name, currentUser?.name);

  const checkIfUserPartOfTeam = useCallback(
    (teamId: string): boolean => {
      return Boolean(currentUser?.teams?.find((team) => teamId === team.id));
    },
    [currentUser]
  );

  const isAssignee = task.assignees?.some((assignee) =>
    isEqual(assignee.id, currentUser?.id)
  );

  const isPartOfAssigneeTeam = task.assignees?.some((assignee) =>
    assignee.type === 'team' ? checkIfUserPartOfTeam(assignee.id) : false
  );

  const getFormattedMenuOptions = (options: TaskAction[]) => {
    return options.map((item) => ({
      ...item,
      icon: <Icon component={item.icon} height={16} />,
    }));
  };

  const handleTaskLinkClick = () => {
    navigate({
      pathname: getTaskDetailPathFromTask(task),
    });
  };

  const taskLinkTitleElement = useMemo(
    () =>
      isEntityDetailsAvailable ? (
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <Button
            className="p-0 task-feed-message font-medium text-md"
            data-testid="task-title"
            type="link"
            onClick={handleTaskLinkClick}>
            <Typography.Text className="p-0 task-id text-sm task-details-id">{`#${task.taskId} `}</Typography.Text>

            <Typography.Text className="p-xss task-details">
              {t(TASK_ENTITY_TYPES[task.type])}
            </Typography.Text>

            {taskColumnName}

            <Typography.Text
              className="break-all text-sm entity-link header-link whitespace-normal"
              data-testid="entity-link">
              {getNameFromFQN(entityFQN)}
            </Typography.Text>

            <Typography.Text className="p-l-xss entity-type header-link whitespace-normal">{`(${entityType})`}</Typography.Text>
          </Button>
        </EntityPopOverCard>
      ) : null,
    [isEntityDetailsAvailable, entityFQN, entityType, task, handleTaskLinkClick]
  );

  const updateTaskData = async (data: { newValue?: string }) => {
    if (!task?.id) {
      return;
    }
    try {
      await resolveTaskAPI(task.id, {
        resolutionType: TaskResolutionType.Approved,
        newValue: data.newValue,
      });
      showSuccessToast(t('server.task-resolved-successfully'));
      rest.onAfterClose?.();
      rest.onUpdateEntityDetails?.();
    } catch (err) {
      showErrorToast(
        getErrorText(err as AxiosError, t('server.unexpected-error'))
      );
    }
  };

  const onGlossaryTaskResolve = (status = 'approved') => {
    const newValue =
      isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval
        ? status
        : computedSuggestedValue;
    const data = { newValue: newValue };
    updateTaskData(data);
  };

  const onTaskResolve = () => {
    if (
      !isTaskGlossaryApproval &&
      !isTaskRecognizerFeedbackApproval &&
      isEmpty(computedSuggestedValue)
    ) {
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
        newValue: computedSuggestedValue || '[]',
      };

      updateTaskData(tagsData);
    } else {
      const newValue =
        isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval
          ? 'approved'
          : computedSuggestedValue;
      const data = { newValue: newValue };
      updateTaskData(data);
    }
  };

  const onEditAndSuggest = ({
    description,
    updatedTags,
  }: {
    description: string;
    updatedTags: TagLabel[];
    testCaseFailureReason: TestCaseFailureReasonType;
    testCaseFailureComment: string;
  }) => {
    let data: { newValue?: string } = {};
    if (isTaskTags) {
      data = {
        newValue: JSON.stringify(updatedTags) || '[]',
      };
    } else {
      data = { newValue: description };
    }

    updateTaskData(data);
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

  const [hasAddedComment, setHasAddedComment] = useState<boolean>(false);
  const [recentComment, setRecentComment] = useState<string>('');

  const shouldEditAssignee =
    (isCreator || hasEditAccess) && !isTaskClosed && owners.length === 0;
  const onSave = () => {
    postFeed(comment, task?.id ?? '', true)
      .catch(() => {
        // ignore since error is displayed in toast in the parent promise.
      })
      .finally(() => {
        setHasAddedComment(true);
        editorRef.current?.clearEditorContent();
        setShowFeedEditor(false);
        setRecentComment(comment);
      });
  };

  const onTaskReject = async () => {
    if (
      !isTaskGlossaryApproval &&
      !isTaskRecognizerFeedbackApproval &&
      !hasAddedComment
    ) {
      showErrorToast(t('server.task-closed-without-comment'));

      return;
    }

    if (!task?.id) {
      return;
    }

    const updatedComment =
      isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval
        ? 'Rejected'
        : recentComment;
    try {
      await closeTaskAPI(task.id, updatedComment);
      showSuccessToast(t('server.task-closed-successfully'));
      rest.onAfterClose?.();
      rest.onUpdateEntityDetails?.();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
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
      fetchUpdatedThread(task.id, true).finally(() => {
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
        className="items-end  justify-end"
        data-testid="task-cta-buttons"
        size="small">
        <Tooltip
          title={
            hasApprovalAccess
              ? ''
              : t('message.only-reviewers-can-approve-or-reject')
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
      <div className=" d-flex justify-end items-center gap-4">
        <Dropdown.Button
          className="w-auto task-action-button"
          data-testid="task-cta-buttons"
          icon={<DownOutlined />}
          loading={isActionLoading}
          menu={{
            items: getFormattedMenuOptions(INCIDENT_TASK_ACTION_LIST),
            selectable: true,
            selectedKeys: [taskAction.key],
            onClick: handleTaskMenuClick,
            disabled: !hasApprovalAccess,
          }}
          overlayClassName="task-action-dropdown"
          onClick={onTestCaseTaskDropdownClick}>
          {taskAction.label}
        </Dropdown.Button>
      </div>
    );
  }, [task, isAssignee, isPartOfAssigneeTeam, taskAction, renderCommentButton]);

  const actionButtons = useMemo(() => {
    if (isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval) {
      return approvalWorkflowActions;
    }

    if (isTaskTestCaseResult) {
      return testCaseResultFlow;
    }

    return (
      <Space
        className="items-end  justify-end"
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
      </Space>
    );
  }, [
    onTaskReject,
    task,
    onTaskResolve,
    handleMenuItemClick,
    taskAction,
    isTaskClosed,
    isTaskGlossaryApproval,
    isTaskRecognizerFeedbackApproval,
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
        payload?.suggestedValue ?? payload?.currentValue ?? '';

      return { description };
    } else {
      const updatedTags = JSON.parse(
        payload?.suggestedValue ?? payload?.currentValue ?? '[]'
      );

      return { updatedTags };
    }
  }, [payload, isTaskDescription]);

  const handleAssigneeUpdate = async () => {
    setIsAssigneeLoading(true);
    try {
      const patch = [
        {
          op: 'replace' as const,
          path: '/assignees',
          value: updatedAssignees.map((assignee: Option) => ({
            id: assignee.value,
            type: assignee.type,
          })),
        },
      ];
      const data = await patchTask(task.id, patch);
      setIsEditAssignee(false);
      updateTask(data);
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
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.assignee'),
        })
      );
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

  const handleEditClick = () => {
    setIsEditAssignee(true);
  };

  const taskHeader = isTaskTestCaseResult ? (
    <TaskTabIncidentManagerHeaderNewFromTask task={task} />
  ) : (
    <div
      className={classNames('d-flex justify-between flex-wrap gap-2 relative', {
        'flex-column': isEditAssignee,
      })}>
      <div className="d-flex gap-2" data-testid="task-assignees">
        <Row className="m-l-0" gutter={[16, 16]}>
          <Col
            className="flex items-center gap-2 text-grey-muted"
            span={8}
            style={{ paddingLeft: 0 }}>
            <UserIcon height={16} />
            <Typography.Text className="incident-manager-details-label">
              {t('label.created-by')}
            </Typography.Text>
          </Col>
          <Col span={16} style={{ paddingLeft: '2px' }}>
            <Link
              className="no-underline flex items-center gap-2"
              to={getUserPath(task.createdBy?.name ?? '')}>
              <UserPopOverCard userName={task.createdBy?.name ?? ''}>
                <div className="d-flex items-center">
                  <ProfilePicture
                    name={task.createdBy?.name ?? ''}
                    width="24"
                  />
                </div>
              </UserPopOverCard>

              <Typography.Text>{task.createdBy?.name}</Typography.Text>
            </Link>
          </Col>

          {isEditAssignee ? (
            <Form
              className="w-full"
              form={assigneesForm}
              layout="vertical"
              onFinish={handleAssigneeUpdate}>
              <Form.Item
                data-testid="assignees"
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
              <Col
                className="flex gap-2 text-grey-muted"
                span={8}
                style={{ paddingLeft: 0 }}>
                <AssigneesIcon height={16} />
                <Typography.Text className="incident-manager-details-label @grey-8">
                  {t('label.assignee-plural')}
                </Typography.Text>
              </Col>
              <Col
                className="flex gap-2"
                span={16}
                style={{ paddingLeft: '2px' }}>
                {task?.assignees?.length === 1 ? (
                  <div className="d-flex items-center gap-2">
                    <UserPopOverCard userName={task?.assignees[0].name ?? ''}>
                      <div className="d-flex items-center">
                        <ProfilePicture
                          name={task?.assignees[0].name ?? ''}
                          width="24"
                        />
                      </div>
                    </UserPopOverCard>
                    <Typography.Text className="text-grey-body">
                      {getEntityName(task?.assignees[0])}
                    </Typography.Text>
                  </div>
                ) : (
                  <OwnerLabel
                    isAssignee
                    hasPermission={shouldEditAssignee}
                    isCompactView={false}
                    owners={task?.assignees}
                    showLabel={false}
                    onEditClick={handleEditClick}
                  />
                )}
              </Col>
            </>
          )}
        </Row>
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
  const ActionRequired = () => {
    if (!actionButtons) {
      return null;
    }

    if (React.isValidElement(actionButtons)) {
      const childrenProps = actionButtons.props as {
        children: React.ReactNode;
      };
      const childrenCount = React.Children.toArray(
        childrenProps.children
      ).length;
      if (childrenCount === 0) {
        return null;
      }
    }

    return (
      <div className="action-required-card d-flex flex-wrap justify-between items-center">
        <Col>
          <Typography.Text className="action-required-text">
            {t('label.action-required')}
          </Typography.Text>
        </Col>
        {actionButtons}
      </div>
    );
  };

  const closeFeedEditor = () => {
    setShowFeedEditor(false);
  };

  const comments = useMemo(() => {
    if (isPostsLoading) {
      return (
        <Space className="m-y-md" direction="vertical" size={16}>
          <Skeleton active />
          <Skeleton active />
          <Skeleton active />
        </Space>
      );
    }

    const sortedComments = orderBy(
      task.comments ?? [],
      ['createdAt'],
      ['desc']
    );

    return (
      <Col className="p-l-0 p-r-0" data-testid="feed-replies">
        {sortedComments.map((comment, index, arr) => (
          <TaskCommentCard
            closeFeedEditor={closeFeedEditor}
            comment={comment}
            isLastReply={index === arr.length - 1}
            key={comment.id}
            task={task}
          />
        ))}
      </Col>
    );
  }, [task, closeFeedEditor, isPostsLoading]);

  useEffect(() => {
    closeFeedEditor();
  }, [task.id]);

  useEffect(() => {
    setHasAddedComment(false);
  }, [task.id]);

  return (
    <Row
      className="relative task-details-panel"
      data-testid="task-tab"
      gutter={[0, 20]}>
      <Col className="d-flex items-start task-feed-message-container" span={24}>
        <Icon
          className="m-r-xs"
          component={
            task.status === TaskEntityStatus.Open ? TaskOpenIcon : TaskCloseIcon
          }
          height={14}
        />

        {taskLinkTitleElement}
      </Col>
      <Divider className="m-0" type="horizontal" />
      <Col span={24}>{taskHeader}</Col>
      <Col span={24}>
        {isTaskDescription && (
          <DescriptionTaskFromTask
            showDescTitle
            hasEditAccess={hasEditAccess}
            isTaskActionEdit={false}
            task={task}
            onChange={(value: string) =>
              form.setFieldValue('description', value)
            }
          />
        )}

        {isTaskTags && (
          <div className="tags-details-contianer">
            <TagsTaskFromTask
              hasEditAccess={hasEditAccess}
              isTaskActionEdit={false}
              task={task}
              onChange={(value) => form.setFieldValue('updatedTags', value)}
            />
          </div>
        )}

        {isTaskRecognizerFeedbackApproval && task.payload && (
          <div className="feedback-details-container">
            <FeedbackApprovalTask task={task} />
          </div>
        )}
        {task.status === TaskEntityStatus.Open &&
          !rest.isOpenInDrawer &&
          ActionRequired()}

        <Col span={24}>
          <div className="activity-feed-comments-container d-flex flex-col">
            <Typography.Text
              className={classNames('activity-feed-comments-title', {
                'm-b-md':
                  task.status === TaskEntityStatus.Open && !showFeedEditor,
              })}>
              {t('label.comment-plural')}
            </Typography.Text>

            {showFeedEditor ? (
              <ActivityFeedEditorNew
                className={classNames(
                  'm-t-md feed-editor activity-feed-editor-container-new',
                  {
                    'm-b-md':
                      (showFeedEditor && (task?.comments?.length ?? 0) === 0) ||
                      rest.isOpenInDrawer,
                  }
                )}
                onSave={onSave}
                onTextChange={setComment}
              />
            ) : (
              task.status === TaskEntityStatus.Open && (
                <div className="d-flex gap-2">
                  <div className="profile-picture">
                    <UserPopOverCard userName={currentUser?.name ?? ''}>
                      <div className="d-flex items-center">
                        <ProfilePicture
                          key={task.id}
                          name={currentUser?.name ?? ''}
                          width="32"
                        />
                      </div>
                    </UserPopOverCard>
                  </div>

                  <Input
                    className="comments-input-field"
                    data-testid="comments-input-field"
                    placeholder={t('message.input-placeholder')}
                    onClick={() => setShowFeedEditor(true)}
                  />
                </div>
              )
            )}

            {comments}
          </div>
        </Col>
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
          okText={t('label.save')}
          open={showEditTaskModel}
          title={`${t('label.resolve')} ${t('label.task')} #${task.taskId}`}
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
          data-testid="suggestion-edit-task-modal"
          maskClosable={false}
          open={showEditTaskModel}
          title={`${t('label.edit-entity', {
            entity: t('label.task-lowercase'),
          })} #${task.taskId} ${task.name}`}
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
                <TagsTaskFromTask
                  isTaskActionEdit
                  hasEditAccess={hasEditAccess}
                  task={task}
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
                <DescriptionTaskFromTask
                  isTaskActionEdit
                  hasEditAccess={hasEditAccess}
                  task={task}
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
          okText={t('label.save')}
          open={isEditAssignee}
          title={`${t('label.re-assign')} ${t('label.task')} #${task.taskId}`}
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
