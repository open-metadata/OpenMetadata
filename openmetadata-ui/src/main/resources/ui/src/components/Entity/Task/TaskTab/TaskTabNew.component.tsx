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
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import Modal from 'antd/lib/modal/Modal';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isEqual, isUndefined, last, orderBy } from 'lodash';
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
import { TASK_ENTITY_TYPES } from '../../../../constants/Task.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  TestCaseFailureReasonType,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { useAuth } from '../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import Assignees from '../../../../pages/TasksPage/shared/Assignees';
import FeedbackApprovalTask from '../../../../pages/TasksPage/shared/FeedbackApprovalTask';
import TaskPayloadSchemaFields from '../../../../pages/TasksPage/shared/TaskPayloadSchemaFields';
import {
  Option,
  TaskAction,
  TaskActionMode,
} from '../../../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentByStateId,
  transitionIncident,
} from '../../../../rest/incidentManagerAPI';
import { TaskFormSchema } from '../../../../rest/taskFormSchemasAPI';
import {
  closeTask as closeTaskAPI,
  patchTask,
  resolveTask as resolveTaskAPI,
  TaskAvailableTransition,
  TaskEntityStatus,
  TaskEntityType,
  TaskPayload,
  TaskResolutionType,
} from '../../../../rest/tasksAPI';
import { getNameFromFQN } from '../../../../utils/CommonUtils';
import EntityLink from '../../../../utils/EntityLink';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { getErrorText } from '../../../../utils/StringsUtils';
import {
  applyTaskFormSchemaDefaults,
  getDefaultTaskFormSchema,
  getEditableTaskPayload,
  getResolvedTaskFormSchema,
  getTaskFormHandlerConfig,
  getTaskResolutionNewValue,
  getTaskTransitionFormSchema,
  getTaskTransitionUiSchema,
  hasTaskFormFields,
  shouldRequireTaskResolutionValue,
} from '../../../../utils/TaskFormSchemaUtils';
import {
  fetchOptions,
  generateOptions,
  getNormalizedTaskPayload,
  getTaskDetailPathFromTask,
  getTaskDisplayId,
  GLOSSARY_TASK_ACTION_LIST,
  INCIDENT_TASK_ACTION_LIST,
  isTaskPendingFurtherApproval,
  isTaskTerminalStatus,
  TASK_ACTION_COMMON_ITEM,
  TASK_ACTION_LIST,
} from '../../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import TaskCommentCard from '../../../ActivityFeed/ActivityFeedCardNew/TaskCommentCard.component';
import ActivityFeedEditorNew from '../../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { EditIconButton } from '../../../common/IconButtons/EditIconButton';
import InlineEdit from '../../../common/InlineEdit/InlineEdit.component';

import { getEntityName } from '../../../../utils/EntityUtils';
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
  const editablePayload = Form.useWatch('payload', form) as
    | TaskPayload
    | undefined;
  const { isAdminUser } = useAuth();
  const {
    postFeed,
    updateTask,
    setActiveTask,
    fetchUpdatedThread,
    updateTestCaseIncidentStatus,
    testCaseResolutionStatus,
    isPostsLoading,
  } = useActivityFeedProvider();
  const { fieldPath, suggestedValue } = useMemo(
    () => getNormalizedTaskPayload(task),
    [task]
  );
  const taskDisplayId = useMemo(
    () => getTaskDisplayId(task.taskId),
    [task.taskId]
  );
  const [taskFormSchema, setTaskFormSchema] = useState<
    TaskFormSchema | undefined
  >(() => getDefaultTaskFormSchema(task.type, task.category));
  const taskHandler = useMemo(
    () => getTaskFormHandlerConfig(task, taskFormSchema?.uiSchema),
    [task, taskFormSchema?.uiSchema]
  );
  const isWorkflowDrivenTask = useMemo(
    () => Boolean(task.availableTransitions?.length),
    [task.availableTransitions]
  );
  const [selectedTransitionId, setSelectedTransitionId] = useState<
    string | undefined
  >(task.availableTransitions?.[0]?.id);
  const selectedTransition = useMemo(
    () =>
      task.availableTransitions?.find(
        (transition) => transition.id === selectedTransitionId
      ) ?? task.availableTransitions?.[0],
    [selectedTransitionId, task.availableTransitions]
  );
  const activeTaskFormSchema = useMemo(() => {
    if (!taskFormSchema || !isWorkflowDrivenTask) {
      return taskFormSchema;
    }

    return {
      ...taskFormSchema,
      formSchema: getTaskTransitionFormSchema(
        taskFormSchema,
        selectedTransition
      ),
      uiSchema: getTaskTransitionUiSchema(taskFormSchema, selectedTransition),
    };
  }, [isWorkflowDrivenTask, selectedTransition, taskFormSchema]);
  const isTaskTags = taskHandler.type === 'tagUpdate';
  const isTaskApprovalRequest = taskHandler.type === 'approval';
  const isTaskRecognizerFeedbackApproval =
    taskHandler.type === 'feedbackApproval';
  const isApprovalWorkflowTask =
    isTaskApprovalRequest || isTaskRecognizerFeedbackApproval;
  const readOnlyTaskPayload = useMemo(
    () =>
      applyTaskFormSchemaDefaults(
        getEditableTaskPayload(task, taskFormSchema?.uiSchema),
        taskFormSchema?.formSchema
      ),
    [task, taskFormSchema]
  );
  const initialTaskPayload = useMemo(
    () =>
      applyTaskFormSchemaDefaults(
        getEditableTaskPayload(task, activeTaskFormSchema?.uiSchema),
        activeTaskFormSchema?.formSchema
      ),
    [task, activeTaskFormSchema]
  );

  const showAddSuggestionButton = useMemo(() => {
    if (!['tagUpdate', 'descriptionUpdate'].includes(taskHandler.type)) {
      return false;
    }

    if (taskHandler.type === 'descriptionUpdate') {
      const valueField = taskHandler.valueField ?? 'newDescription';

      return isEmpty(readOnlyTaskPayload?.[valueField] ?? suggestedValue);
    }

    const addTagsField = taskHandler.addTagsField ?? 'tagsToAdd';
    const suggestedTags = readOnlyTaskPayload?.[addTagsField];

    return !Array.isArray(suggestedTags) || suggestedTags.length === 0;
  }, [
    readOnlyTaskPayload,
    suggestedValue,
    taskHandler.addTagsField,
    taskHandler.type,
    taskHandler.valueField,
  ]);

  const noSuggestionTaskMenuOptions = useMemo(() => {
    let label;

    if (suggestedValue) {
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
  }, [isTaskTags, suggestedValue]);

  const isTaskTestCaseResult =
    taskHandler.type === 'incident' &&
    task.type === TaskEntityType.TestCaseResolution;

  const latestAction = useMemo(() => {
    const resolutionStatus = last(testCaseResolutionStatus);
    const isAssignedIncidentTask =
      Boolean(task.assignees?.length) ||
      resolutionStatus?.testCaseResolutionStatusType ===
        TestCaseResolutionStatusTypes.Assigned;

    if (isTaskTestCaseResult) {
      return isAssignedIncidentTask
        ? INCIDENT_TASK_ACTION_LIST[0]
        : INCIDENT_TASK_ACTION_LIST[1];
    } else if (isTaskApprovalRequest) {
      return GLOSSARY_TASK_ACTION_LIST[0];
    } else if (showAddSuggestionButton) {
      return noSuggestionTaskMenuOptions[0];
    } else {
      return TASK_ACTION_LIST[0];
    }
  }, [
    showAddSuggestionButton,
    testCaseResolutionStatus,
    isTaskApprovalRequest,
    isTaskTestCaseResult,
    noSuggestionTaskMenuOptions,
    task.assignees,
  ]);

  const [taskAction, setTaskAction] = useState<TaskAction>(latestAction);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const isTaskClosed = isTaskTerminalStatus(task.status);
  const isTaskActionable = !isTaskClosed
    ? isWorkflowDrivenTask
      ? Boolean(task.availableTransitions?.length)
      : task.status === TaskEntityStatus.Open
    : false;
  const [showEditTaskModel, setShowEditTaskModel] = useState(false);
  const [comment, setComment] = useState('');
  const [isEditAssignee, setIsEditAssignee] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const [isAssigneeLoading, setIsAssigneeLoading] = useState<boolean>(false);
  const { initialAssignees, assigneeOptions } = useMemo(() => {
    const initialAssignees = generateOptions(task.assignees ?? []);

    return { initialAssignees, assigneeOptions: initialAssignees };
  }, [task.assignees]);

  const taskColumnLabel = useMemo(
    () =>
      fieldPath
        ? EntityLink.getTableColumnName(
            `<#E::${task.about?.type}::${task.about?.fullyQualifiedName}::${fieldPath}>`
          ) ?? ''
        : '',
    [fieldPath, task.about]
  );

  const taskColumnName = useMemo(() => {
    if (taskColumnLabel) {
      return (
        <Typography.Text className="p-r-xss">
          {taskColumnLabel} {t('label.in-lowercase')}
        </Typography.Text>
      );
    }

    return null;
  }, [taskColumnLabel, t]);

  const taskDisplayMessage = useMemo(() => {
    const taskTypeLabel = t(TASK_ENTITY_TYPES[task.type] ?? 'label.task');
    const entityName = entityFQN
      ? getNameFromFQN(entityFQN)
      : task.about?.name ?? '';
    const taskScope = taskColumnLabel
      ? `${taskColumnLabel} ${t('label.in-lowercase')} ${entityName}`
      : entityName;

    return [taskTypeLabel, taskScope].filter(Boolean).join(' ').trim();
  }, [entityFQN, task.about, task.type, taskColumnLabel, t]);
  const shouldRenderTaskPayload = useMemo(() => {
    return hasTaskFormFields(taskFormSchema?.formSchema);
  }, [taskFormSchema?.formSchema]);

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

  const getFormattedMenuOptions = (
    options: TaskAction[],
    onItemClick?: (info: MenuInfo) => void
  ) => {
    return options.map((item) => ({
      ...item,
      label: (
        <span
          data-testid={`task-action-menu-item-${item.key}`}
          onClick={
            onItemClick
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onItemClick({ key: item.key } as MenuInfo);
                }
              : undefined
          }>
          {item.label}
        </span>
      ),
      icon: <Icon component={item.icon} height={16} />,
    }));
  };

  const renderDropdownButtons =
    (testIdPrefix: string) => (buttons: React.ReactNode[]) =>
      buttons.map((button, index) =>
        React.isValidElement(button)
          ? React.cloneElement(button, {
              'data-testid': `${testIdPrefix}-${
                index === 0 ? 'primary' : 'trigger'
              }`,
            })
          : button
      );

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
            <Typography.Text className="p-0 task-id text-sm task-details-id">{`#${taskDisplayId} `}</Typography.Text>

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
    [
      entityFQN,
      entityType,
      handleTaskLinkClick,
      isEntityDetailsAvailable,
      task.type,
      taskColumnName,
      taskDisplayId,
      t,
    ]
  );

  const updateTaskData = async (
    data: { newValue?: string; payload?: TaskPayload; comment?: string },
    resolutionType?: TaskResolutionType,
    transitionId?: string
  ) => {
    if (!task?.id) {
      return;
    }
    try {
      const updatedTask = await resolveTaskAPI(task.id, {
        transitionId,
        resolutionType,
        comment: data.comment,
        newValue: data.newValue,
        payload: data.payload,
      });
      const taskRemainsOpen = isTaskPendingFurtherApproval(updatedTask);
      showSuccessToast(
        taskRemainsOpen
          ? 'Vote recorded.'
          : t('server.task-resolved-successfully')
      );

      setActiveTask(updatedTask);
      updateTask(updatedTask);

      const refreshed = await getListTestCaseIncidentByStateId(task.id);
      const latest = refreshed?.data?.[0];
      if (latest) {
        updateTestCaseIncidentStatus([...testCaseResolutionStatus, latest]);
      }

      if (taskRemainsOpen) {
        await fetchUpdatedThread(task.id, true);
      } else {
        rest.onAfterClose?.();
      }

      rest.onUpdateEntityDetails?.();
    } catch (err) {
      showErrorToast(
        getErrorText(err as AxiosError, t('server.unexpected-error'))
      );
    }
  };

  // Return the transition's declared resolutionType, or undefined if it
  // doesn't have one. Non-terminal transitions (ack, assign, reassign) must
  // NOT default to Approved — the server treats a non-null resolutionType as
  // a terminal resolution and would immediately close the task.
  const getTransitionResolutionType = (
    transition?: TaskAvailableTransition
  ): TaskResolutionType | undefined => transition?.resolutionType;

  const getTransitionForResolution = useCallback(
    (resolutionType: TaskResolutionType) =>
      task.availableTransitions?.find(
        (transition) => transition.resolutionType === resolutionType
      ) ??
      task.availableTransitions?.find((transition) =>
        resolutionType === TaskResolutionType.Rejected
          ? transition.id === 'reject'
          : transition.id === 'approve'
      ),
    [task.availableTransitions]
  );

  const shouldOpenWorkflowTransitionModal = useCallback(
    (transition?: TaskAvailableTransition) => {
      if (!isWorkflowDrivenTask || !transition) {
        return false;
      }

      return (
        transition.requiresComment === true ||
        hasTaskFormFields(
          getTaskTransitionFormSchema(taskFormSchema, transition)
        )
      );
    },
    [isWorkflowDrivenTask, taskFormSchema]
  );

  const runWorkflowTransition = useCallback(
    (
      transition: TaskAvailableTransition,
      payload: TaskPayload = initialTaskPayload
    ) => {
      const transitionUiSchema = getTaskTransitionUiSchema(
        taskFormSchema,
        transition
      );
      const commentText =
        typeof payload.comment === 'string' ? payload.comment : undefined;

      updateTaskData(
        {
          newValue: getTaskResolutionNewValue(
            task,
            payload,
            transitionUiSchema
          ),
          payload,
          comment: commentText,
        },
        getTransitionResolutionType(transition),
        transition.id
      );
    },
    [initialTaskPayload, task, taskFormSchema]
  );

  const onGlossaryTaskResolve = (status = 'approved') => {
    const resolutionType =
      status.toLowerCase() === 'approved'
        ? TaskResolutionType.Approved
        : TaskResolutionType.Rejected;
    const newValue =
      isApprovalWorkflowTask && status.toLowerCase() === 'approved'
        ? taskHandler.approvedValue
        : isApprovalWorkflowTask
        ? taskHandler.rejectedValue
        : suggestedValue;
    updateTaskData({ newValue }, resolutionType);
  };

  const onTaskResolve = () => {
    if (isWorkflowDrivenTask && selectedTransition) {
      // Assignment transitions (assign/reassign) need the inline assignee
      // picker, not the form modal. The assignee picker is the same UI used
      // by the INCIDENT_TASK_ACTION_LIST "Re-assign" action.
      if (selectedTransition.targetStageId === 'assigned') {
        setIsEditAssignee(true);

        return;
      }

      if (shouldOpenWorkflowTransitionModal(selectedTransition)) {
        setShowEditTaskModel(true);

        return;
      }

      runWorkflowTransition(selectedTransition);

      return;
    }

    const newValue = getTaskResolutionNewValue(
      task,
      initialTaskPayload,
      taskFormSchema?.uiSchema
    );

    if (
      !isApprovalWorkflowTask &&
      shouldRequireTaskResolutionValue(taskFormSchema?.uiSchema) &&
      isEmpty(newValue)
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

    updateTaskData(
      {
        newValue: isApprovalWorkflowTask ? taskHandler.approvedValue : newValue,
        payload: initialTaskPayload,
      },
      TaskResolutionType.Approved
    );
  };

  const onEditAndSuggest = ({ payload }: { payload: TaskPayload }) => {
    if (isWorkflowDrivenTask && selectedTransition) {
      const requiredFields = activeTaskFormSchema?.formSchema?.required;
      if (
        Array.isArray(requiredFields) &&
        requiredFields.some((field) => !payload?.[field])
      ) {
        showErrorToast(
          t('message.field-text-is-required', {
            fieldText: t('label.required-field-plural'),
          })
        );

        return;
      }
      runWorkflowTransition(selectedTransition, payload);

      return;
    }

    updateTaskData(
      {
        newValue: getTaskResolutionNewValue(
          task,
          payload,
          taskFormSchema?.uiSchema
        ),
        payload,
      },
      TaskResolutionType.Approved
    );
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
    const rejectedTransition = getTransitionForResolution(
      TaskResolutionType.Rejected
    );

    if (!task?.id) {
      return;
    }

    updateTaskData(
      {
        newValue: isApprovalWorkflowTask
          ? taskHandler.rejectedValue
          : undefined,
      },
      TaskResolutionType.Rejected,
      rejectedTransition?.id
    );
    setShowEditTaskModel(false);
  };

  const onTaskClose = async () => {
    if (!isApprovalWorkflowTask && !hasAddedComment) {
      showErrorToast(t('server.task-closed-without-comment'));

      return;
    }

    if (!task?.id) {
      return;
    }

    const updatedComment = recentComment;
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
    const taskId = task.id;
    if (!taskId || !updatedAssignees?.length) {
      return;
    }
    setIsActionLoading(true);
    const resolutionStatus = last(testCaseResolutionStatus);
    const transitionId =
      resolutionStatus?.testCaseResolutionStatusType ===
      TestCaseResolutionStatusTypes.Assigned
        ? 'reassign'
        : 'assign';
    const assignee = updatedAssignees[0];
    try {
      const updatedTask = await transitionIncident(taskId, {
        transitionId,
        payload: {
          assignees: [
            {
              id: assignee.value ?? assignee.id,
              type: assignee.type ?? 'user',
              name: assignee.name,
              fullyQualifiedName: assignee.name,
              displayName: assignee.displayName,
            },
          ],
        },
      });
      setActiveTask(updatedTask);
      updateTask(updatedTask);
      const refreshed = await getListTestCaseIncidentByStateId(taskId);
      const latest = refreshed?.data?.[0];
      if (latest) {
        updateTestCaseIncidentStatus([...testCaseResolutionStatus, latest]);
      }
      setIsEditAssignee(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsActionLoading(false);
    }
  };

  const onTestCaseIncidentResolve = async ({
    payload: resolutionPayload,
  }: {
    payload?: TaskPayload;
  }) => {
    const taskId = task.id;
    if (!taskId) {
      return;
    }
    setIsActionLoading(true);
    const testCaseFailureReason = resolutionPayload?.rootCause as
      | TestCaseFailureReasonType
      | undefined;
    const testCaseFailureComment = String(resolutionPayload?.resolution ?? '');
    try {
      await transitionIncident(taskId, {
        transitionId: 'resolve',
        resolutionType: TaskResolutionType.Completed,
        comment: testCaseFailureComment || undefined,
        payload: testCaseFailureReason ? { testCaseFailureReason } : undefined,
      });
      const refreshed = await getListTestCaseIncidentByStateId(taskId);
      const latest = refreshed?.data?.[0];
      if (latest) {
        updateTestCaseIncidentStatus([...testCaseResolutionStatus, latest]);
      }
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
      onTaskClose();
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
      onTaskClose();
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

  const workflowTransitionActions = useMemo(() => {
    if (!isWorkflowDrivenTask || !task.availableTransitions?.length) {
      return null;
    }

    const hasWorkflowAccess = hasEditAccess || isCreator;
    const menuItems = task.availableTransitions.map((transition) => ({
      key: transition.id,
      label: (
        <span data-testid={`workflow-transition-menu-item-${transition.id}`}>
          {transition.label}
        </span>
      ),
    }));

    const handleWorkflowTransitionSelect = (transitionId: string) => {
      const transition = task.availableTransitions?.find(
        (candidate) => candidate.id === transitionId
      );

      if (!transition) {
        return;
      }

      setSelectedTransitionId(transition.id);

      // Assignment transitions need the inline assignee picker
      if (transition.targetStageId === 'assigned') {
        setIsEditAssignee(true);

        return;
      }

      if (shouldOpenWorkflowTransitionModal(transition)) {
        setShowEditTaskModel(true);

        return;
      }

      runWorkflowTransition(transition);
    };

    if (task.availableTransitions.length === 1 && selectedTransition) {
      return (
        <Space
          className="items-end justify-end"
          data-testid="task-cta-buttons"
          size="small">
          <Button
            className="task-action-button"
            data-testid="workflow-task-action-primary"
            disabled={!hasWorkflowAccess}
            loading={isActionLoading}
            type="primary"
            onClick={() =>
              handleWorkflowTransitionSelect(selectedTransition.id)
            }>
            {selectedTransition.label}
          </Button>
        </Space>
      );
    }

    return (
      <Space
        className="items-end justify-end"
        data-testid="task-cta-buttons"
        size="small">
        <Dropdown.Button
          buttonsRender={renderDropdownButtons('workflow-task-action')}
          className="task-action-button"
          data-testid="workflow-task-action-dropdown"
          disabled={!hasWorkflowAccess}
          icon={<DownOutlined />}
          loading={isActionLoading}
          menu={{
            items: menuItems,
            selectable: true,
            selectedKeys: selectedTransition ? [selectedTransition.id] : [],
            onClick: ({ key }) => handleWorkflowTransitionSelect(String(key)),
          }}
          overlayClassName="task-action-dropdown"
          onClick={() => {
            if (selectedTransition) {
              handleWorkflowTransitionSelect(selectedTransition.id);
            }
          }}>
          {selectedTransition?.label ?? t('label.resolve')}
        </Dropdown.Button>
      </Space>
    );
  }, [
    hasEditAccess,
    isActionLoading,
    isCreator,
    isWorkflowDrivenTask,
    runWorkflowTransition,
    selectedTransition,
    shouldOpenWorkflowTransitionModal,
    task.availableTransitions,
    t,
  ]);

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
            buttonsRender={renderDropdownButtons('glossary-task-action')}
            className="task-action-button"
            data-testid="glossary-accept-reject-task-dropdown"
            disabled={!hasApprovalAccess}
            icon={<DownOutlined />}
            menu={{
              items: getFormattedMenuOptions(
                GLOSSARY_TASK_ACTION_LIST,
                handleGlossaryTaskMenuClick
              ),
              selectable: true,
              selectedKeys: [taskAction.key],
              onClick: handleGlossaryTaskMenuClick,
            }}
            overlayClassName="task-action-dropdown"
            onClick={() =>
              handleGlossaryTaskMenuClick({ key: taskAction.key } as MenuInfo)
            }>
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
    taskHandler.approvedValue,
    taskHandler.rejectedValue,
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
          buttonsRender={renderDropdownButtons('incident-task-action')}
          className="w-auto task-action-button"
          data-testid="task-cta-buttons"
          icon={<DownOutlined />}
          loading={isActionLoading}
          menu={{
            items: getFormattedMenuOptions(
              INCIDENT_TASK_ACTION_LIST,
              handleTaskMenuClick
            ),
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
    if (isWorkflowDrivenTask) {
      return workflowTransitionActions;
    }

    if (isTaskApprovalRequest || isTaskRecognizerFeedbackApproval) {
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
          <Button data-testid="close-button" onClick={onTaskClose}>
            {t('label.close')}
          </Button>
        )}
        {hasEditAccess && (
          <>
            {showAddSuggestionButton ? (
              <div className="d-flex justify-end gap-2">
                <Dropdown.Button
                  buttonsRender={renderDropdownButtons(
                    'no-suggestion-task-action'
                  )}
                  className="task-action-button"
                  data-testid="add-close-task-dropdown"
                  icon={<DownOutlined />}
                  menu={{
                    items: getFormattedMenuOptions(
                      noSuggestionTaskMenuOptions,
                      handleNoSuggestionMenuItemClick
                    ),
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
                buttonsRender={renderDropdownButtons('edit-accept-task-action')}
                className="task-action-button"
                data-testid="edit-accept-task-dropdown"
                icon={<DownOutlined />}
                menu={{
                  items: getFormattedMenuOptions(
                    TASK_ACTION_LIST,
                    handleMenuItemClick
                  ),
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
    onTaskClose,
    task,
    onTaskResolve,
    handleMenuItemClick,
    taskAction,
    isTaskApprovalRequest,
    isTaskRecognizerFeedbackApproval,
    isWorkflowDrivenTask,
    showAddSuggestionButton,
    isCreator,
    approvalWorkflowActions,
    testCaseResultFlow,
    isTaskTestCaseResult,
    workflowTransitionActions,
    renderCommentButton,
    handleNoSuggestionMenuItemClick,
    onNoSuggestionTaskDropdownClick,
  ]);

  const initialFormValue = useMemo(
    () => ({ payload: initialTaskPayload }),
    [initialTaskPayload]
  );

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

  useEffect(() => {
    assigneesForm.setFieldValue('assignees', initialAssignees);
    setOptions(assigneeOptions);
  }, [initialAssignees, assigneeOptions]);

  useEffect(() => {
    setTaskFormSchema(getDefaultTaskFormSchema(task.type, task.category));
    getResolvedTaskFormSchema(task.type, task.category).then(setTaskFormSchema);
  }, [task.category, task.type]);

  useEffect(() => {
    setSelectedTransitionId(task.availableTransitions?.[0]?.id);
  }, [task.availableTransitions, task.id]);

  useEffect(() => {
    form.setFieldsValue(initialFormValue);
  }, [form, initialFormValue]);

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
                    {shouldEditAssignee && (
                      <EditIconButton
                        className="p-0"
                        data-testid="edit-assignees"
                        size="small"
                        title={t('label.edit-entity', {
                          entity: t('label.assignee-plural'),
                        })}
                        onClick={handleEditClick}
                      />
                    )}
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

  const showRejectInEditModal = useMemo(
    () => !isTaskTestCaseResult && !showAddSuggestionButton,
    [isTaskTestCaseResult, showAddSuggestionButton]
  );

  const editTaskModalFooter = useMemo(
    () => [
      <Button
        key="cancel"
        onClick={() => {
          form.resetFields();
          setShowEditTaskModel(false);
        }}>
        {t('label.cancel')}
      </Button>,
      showRejectInEditModal ? (
        <Button key="reject" onClick={onTaskReject}>
          {t('label.reject')}
        </Button>
      ) : null,
      <Button key="submit" type="primary" onClick={() => form.submit()}>
        {t('label.ok')}
      </Button>,
    ],
    [form, onTaskReject, showRejectInEditModal, t]
  );

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
          component={isTaskClosed ? TaskCloseIcon : TaskOpenIcon}
          height={14}
        />

        {taskLinkTitleElement}
      </Col>
      <Divider className="m-0" type="horizontal" />
      <Col span={24}>{taskHeader}</Col>
      <Col span={24}>
        {isTaskRecognizerFeedbackApproval && task.payload && (
          <div className="feedback-details-container">
            <FeedbackApprovalTask task={task} />
          </div>
        )}
        {!isTaskRecognizerFeedbackApproval && shouldRenderTaskPayload && (
          <div
            className="task-payload-details-container"
            data-testid="task-payload-details">
            <TaskPayloadSchemaFields
              mode="read"
              payload={readOnlyTaskPayload}
              schema={taskFormSchema?.formSchema}
              uiSchema={taskFormSchema?.uiSchema}
            />
          </div>
        )}
        {isTaskActionable && !rest.isOpenInDrawer && ActionRequired()}

        <Col span={24}>
          <div className="activity-feed-comments-container d-flex flex-col">
            <Typography.Text
              className={classNames('activity-feed-comments-title', {
                'm-b-md': isTaskActionable && !showFeedEditor,
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
              isTaskActionable && (
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

      {isTaskTestCaseResult && !isWorkflowDrivenTask ? (
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
          title={`${t('label.resolve')} ${t('label.task')} #${taskDisplayId}`}
          width={768}
          onCancel={() => setShowEditTaskModel(false)}
          onOk={form.submit}>
          <Form
            form={form}
            initialValues={initialFormValue}
            layout="vertical"
            onFinish={onTestCaseIncidentResolve}>
            <Form.Item hidden name="payload" />
            <TaskPayloadSchemaFields
              payload={editablePayload ?? initialTaskPayload}
              schema={activeTaskFormSchema?.formSchema}
              uiSchema={activeTaskFormSchema?.uiSchema}
              onChange={(payload) => form.setFieldValue('payload', payload)}
            />
          </Form>
        </Modal>
      ) : (
        <Modal
          destroyOnClose
          closable={false}
          closeIcon={null}
          data-testid="suggestion-edit-task-modal"
          footer={editTaskModalFooter}
          maskClosable={false}
          open={showEditTaskModel}
          title={
            isWorkflowDrivenTask && selectedTransition
              ? `${selectedTransition.label} #${taskDisplayId} ${
                  task.displayName ?? taskDisplayMessage
                }`
              : `${t('label.edit-entity', {
                  entity: t('label.task-lowercase'),
                })} #${taskDisplayId} ${task.displayName ?? taskDisplayMessage}`
          }
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
            <Form.Item hidden name="payload" />
            <TaskPayloadSchemaFields
              payload={editablePayload ?? initialTaskPayload}
              schema={activeTaskFormSchema?.formSchema}
              uiSchema={activeTaskFormSchema?.uiSchema}
              onChange={(payload) => form.setFieldValue('payload', payload)}
            />
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
          title={`${t('label.re-assign')} ${t('label.task')} #${taskDisplayId}`}
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
