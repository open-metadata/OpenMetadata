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
import { compare } from 'fast-json-patch';
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
import { TaskOperation } from '../../../../constants/Feeds.constants';
import { TASK_TYPES } from '../../../../constants/Task.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { TaskType } from '../../../../generated/api/feed/createThread';
import { ResolveTask } from '../../../../generated/api/feed/resolveTask';
import { CreateTestCaseResolutionStatus } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
  TaskDetails,
  ThreadTaskStatus,
} from '../../../../generated/entity/feed/thread';
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
import DescriptionTask from '../../../../pages/TasksPage/shared/DescriptionTask';
import DescriptionTaskNew from '../../../../pages/TasksPage/shared/DescriptionTaskNew';
import FeedbackApprovalTask from '../../../../pages/TasksPage/shared/FeedbackApprovalTask';
import TagsTask from '../../../../pages/TasksPage/shared/TagsTask';
import {
  Option,
  TaskAction,
  TaskActionMode,
} from '../../../../pages/TasksPage/TasksPage.interface';
import { updateTask, updateThread } from '../../../../rest/feedsAPI';
import { postTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getNameFromFQN } from '../../../../utils/CommonUtils';
import EntityLink from '../../../../utils/EntityLink';
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
  TASK_ACTION_LIST,
} from '../../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import CommentCard from '../../../ActivityFeed/ActivityFeedCardNew/CommentCard.component';
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
import TaskTabIncidentManagerHeaderNew from '../TaskTabIncidentManagerHeader/TasktabIncidentManagerHeaderNew';
import './task-tab-new.less';
import { TaskTabProps } from './TaskTab.interface';

export const TaskTabNew = ({
  taskThread,
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
    isPostsLoading,
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

  const isTaskRecognizerFeedbackApproval =
    taskDetails?.type === TaskType.RecognizerFeedbackApproval;

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
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
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
      icon: <Icon component={item.icon} height={16} />,
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
            <Typography.Text className="p-0 task-id text-sm task-details-id">{`#${taskDetails.id} `}</Typography.Text>

            <Typography.Text className="p-xss task-details">
              {t(TASK_TYPES[taskDetails.type])}
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
    const newValue =
      isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval
        ? status
        : taskDetails?.suggestion;
    const data = { newValue: newValue };
    updateTaskData(data as TaskDetails);
  };

  const onTaskResolve = () => {
    if (
      !isTaskGlossaryApproval &&
      !isTaskRecognizerFeedbackApproval &&
      isEmpty(taskDetails?.suggestion)
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
        newValue: taskDetails?.suggestion || '[]',
      };

      updateTaskData(tagsData as TaskDetails);
    } else {
      const newValue =
        isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval
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

  const [hasAddedComment, setHasAddedComment] = useState<boolean>(false);
  const [recentComment, setRecentComment] = useState<string>('');

  const shouldEditAssignee =
    (isCreator || hasEditAccess) && !isTaskClosed && owners.length === 0;
  const onSave = () => {
    postFeed(comment, taskThread?.id ?? '')
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
    if (
      !isTaskGlossaryApproval &&
      !isTaskRecognizerFeedbackApproval &&
      !hasAddedComment
    ) {
      showErrorToast(t('server.task-closed-without-comment'));

      return;
    }

    const updatedComment =
      isTaskGlossaryApproval || isTaskRecognizerFeedbackApproval
        ? 'Rejected'
        : recentComment;
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
        className="items-end  justify-end"
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
  }, [
    taskDetails,
    isAssignee,
    isPartOfAssigneeTeam,
    taskAction,
    renderCommentButton,
  ]);

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
    taskDetails,
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
    <TaskTabIncidentManagerHeaderNew thread={taskThread} />
  ) : (
    <div
      className={classNames('d-flex justify-between flex-wrap gap-2 relative', {
        'flex-column': isEditAssignee,
      })}>
      <div className="d-flex gap-2" data-testid="task-assignees">
        <Row className="m-l-0" gutter={[16, 16]}>
          <Col className="flex items-center gap-2 text-grey-muted" span={8}>
            <UserIcon height={16} />
            <Typography.Text className="incident-manager-details-label">
              {t('label.created-by')}
            </Typography.Text>
          </Col>
          <Col span={16}>
            <Link
              className="no-underline flex items-center gap-2"
              to={getUserPath(taskThread.createdBy ?? '')}>
              <UserPopOverCard userName={taskThread.createdBy ?? ''}>
                <div className="d-flex items-center">
                  <ProfilePicture
                    name={taskThread.createdBy ?? ''}
                    width="24"
                  />
                </div>
              </UserPopOverCard>

              <Typography.Text>{taskThread.createdBy}</Typography.Text>
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
              <Col className="flex gap-2 text-grey-muted" span={8}>
                <AssigneesIcon height={16} />
                <Typography.Text className="incident-manager-details-label @grey-8">
                  {t('label.assignee-plural')}
                </Typography.Text>
              </Col>
              <Col className="flex gap-2" span={16}>
                {taskThread?.task?.assignees?.length === 1 ? (
                  <div className="d-flex items-center gap-2">
                    <UserPopOverCard
                      userName={taskThread?.task?.assignees[0].name ?? ''}>
                      <div className="d-flex items-center">
                        <ProfilePicture
                          name={taskThread?.task?.assignees[0].name ?? ''}
                          width="24"
                        />
                      </div>
                    </UserPopOverCard>
                    <Typography.Text className="text-grey-body">
                      {getEntityName(taskThread?.task?.assignees[0])}
                    </Typography.Text>
                  </div>
                ) : (
                  <OwnerLabel
                    isAssignee
                    hasPermission={shouldEditAssignee}
                    isCompactView={false}
                    owners={taskThread?.task?.assignees}
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

  const posts = useMemo(() => {
    if (isPostsLoading) {
      return (
        <Space className="m-y-md" direction="vertical" size={16}>
          <Skeleton active />
          <Skeleton active />
          <Skeleton active />
        </Space>
      );
    }

    const posts = orderBy(taskThread.posts, ['postTs'], ['desc']);

    return (
      <Col className="p-l-0 p-r-0" data-testid="feed-replies">
        {posts.map((reply, index, arr) => (
          <CommentCard
            closeFeedEditor={closeFeedEditor}
            feed={taskThread}
            isLastReply={index === arr.length - 1}
            key={reply.id}
            post={reply}
          />
        ))}
      </Col>
    );
  }, [taskThread, closeFeedEditor, isPostsLoading]);

  useEffect(() => {
    closeFeedEditor();
  }, [taskThread.id]);

  useEffect(() => {
    setHasAddedComment(false);
  }, [taskThread.id]);

  return (
    <Row
      className="relative task-details-panel"
      data-testid="task-tab"
      gutter={[0, 20]}>
      <Col className="d-flex items-start task-feed-message-container" span={24}>
        <Icon
          className="m-r-xs"
          component={
            taskDetails?.status === ThreadTaskStatus.Open
              ? TaskOpenIcon
              : TaskCloseIcon
          }
          height={14}
        />

        {taskLinkTitleElement}
      </Col>
      <Divider className="m-0" type="horizontal" />
      <Col span={24}>{taskHeader}</Col>
      <Col span={24}>
        {isTaskDescription && (
          <DescriptionTaskNew
            showDescTitle
            hasEditAccess={hasEditAccess}
            isTaskActionEdit={false}
            taskThread={taskThread}
            onChange={(value) => form.setFieldValue('description', value)}
          />
        )}

        {isTaskTags && (
          <div className="tags-details-contianer">
            <TagsTask
              hasEditAccess={hasEditAccess}
              isTaskActionEdit={false}
              task={taskDetails}
              onChange={(value) => form.setFieldValue('updatedTags', value)}
            />
          </div>
        )}

        {isTaskRecognizerFeedbackApproval && taskDetails && (
          <div className="feedback-details-container">
            <FeedbackApprovalTask task={taskDetails} />
          </div>
        )}
        {taskThread.task?.status === ThreadTaskStatus.Open &&
          !rest.isOpenInDrawer &&
          ActionRequired()}

        <Col span={24}>
          <div className="activity-feed-comments-container d-flex flex-col">
            <Typography.Text
              className={classNames('activity-feed-comments-title', {
                'm-b-md':
                  taskThread?.task?.status === ThreadTaskStatus.Open &&
                  !showFeedEditor,
              })}>
              {t('label.comment-plural')}
            </Typography.Text>

            {showFeedEditor ? (
              <ActivityFeedEditorNew
                className={classNames(
                  'm-t-md feed-editor activity-feed-editor-container-new',
                  {
                    'm-b-md':
                      (showFeedEditor && taskThread?.posts?.length === 0) ||
                      rest.isOpenInDrawer,
                  }
                )}
                onSave={onSave}
                onTextChange={setComment}
              />
            ) : (
              taskThread?.task?.status === ThreadTaskStatus.Open && (
                <div className="d-flex gap-2">
                  <div className="profile-picture">
                    <UserPopOverCard userName={currentUser?.name ?? ''}>
                      <div className="d-flex items-center">
                        <ProfilePicture
                          key={taskThread.id}
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

            {posts}
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
          data-testid="suggestion-edit-task-modal"
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
          okText={t('label.save')}
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
